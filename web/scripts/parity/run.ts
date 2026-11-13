// run.ts: renders a migrated page from a built server on a free loopback port (seed prices) and the legacy page from the baseline (the legacy site as of the legacy-baseline tag, stamped with the same seed prices), and compares them.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PAGES } from "../../src/lib/pages";
import { routePathsFromGlob } from "../../src/lib/server/files";
import type { Snapshot } from "#server/prices/types";
import { baselineDirSync } from "../baseline/dir";
import { stampBaselineHtml } from "../baseline/stamp";
import { loadAllow } from "./allow";
import { compareFacts, formatReport, type Report } from "./compare";
import { extractFacts } from "./extract";

export const WEB = resolve(import.meta.dir, "../..");
export const REPO = resolve(WEB, "..");
export const ALLOW_FILE = join(WEB, "migration/parity-allow.json");
const SEED = join(REPO, "server/data/prices.seed.json");

/** "subnet-calculator.html", "/subnet-calculator.html", "index.html" or "/" to the page's URL path; null when it is not a registry page. */
export const pagePathFor = (arg: string): string | null => {
    const a = arg.trim();
    const path = a === "index.html" || a === "/" ? "/" : a.startsWith("/") ? a : `/${a}`;
    return PAGES.some((p) => p.path === path) ? path : null;
};

/** The URL paths that are SvelteKit routes right now, from the route files on disk. */
export const migratedPaths = (webDir = WEB): Set<string> => {
    const keys = [...new Bun.Glob("src/routes/**/+page.svelte").scanSync({ cwd: webDir })].map((f) => `/${f}`);
    return routePathsFromGlob(keys);
};

export const pageKey = (path: string): string => (path === "/" ? "index.html" : path.slice(1));

const readSeed = (): Snapshot => JSON.parse(readFileSync(SEED, "utf8")) as Snapshot;

/** The legacy page from the baseline directory (stamped with the seed prices the way the old server did), and the text of its local scripts. `legacyDir` defaults to the baseline extracted from the tag. */
export const legacyPage = async (path: string, legacyDir: string = baselineDirSync()): Promise<{ html: string; scripts: string[] }> => {
    const snap = readSeed();
    const rel = path === "/" ? "index.html" : path.slice(1);
    const file = join(legacyDir, rel);
    if (!PAGES.some((p) => p.path === path) || !existsSync(file)) throw new Error(`the legacy site does not serve ${path} (is the file in the page registry and in ${legacyDir}?)`);
    const html = stampBaselineHtml(readFileSync(file, "utf8"), rel, snap);
    const scripts: string[] = [];
    for (const src of extractFacts(html, path).localScriptSrcs) {
        const f = join(legacyDir, ...src.slice(1).split("/"));
        if (!src.includes("..") && existsSync(f)) scripts.push(readFileSync(f, "utf8"));
    }
    return { html, scripts };
};

export interface Served { base: string; stop(): void }

/** Builds (unless told not to) and starts the built server on a free loopback port with a temp data folder and the repository's seed. Nothing outside temp folders is written; the secret is a throwaway. */
export const startServer = async (o: { build: boolean; log?: (s: string) => void }): Promise<Served> => {
    if (o.build) {
        o.log?.("building web (bun run build)");
        const b = Bun.spawnSync(["bun", "run", "build"], { cwd: WEB, stdout: "ignore", stderr: "pipe" });
        if (b.exitCode !== 0) throw new Error(`build failed:\n${b.stderr.toString().slice(-2000)}`);
    }
    if (!existsSync(join(WEB, "build/index.js"))) throw new Error("web/build/index.js is missing: run without --no-build");
    const root = mkdtempSync(join(tmpdir(), "nq-parity-"));
    const probe = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response("") });
    const port = probe.port as number;
    probe.stop(true);
    const base = `http://127.0.0.1:${port}`;
    const dataDir = join(root, "data");
    Bun.spawnSync(["mkdir", "-p", dataDir]);
    const server = Bun.spawn(["bun", "build/index.js"], {
        cwd: WEB,
        env: {
            PATH: process.env.PATH ?? "", HOME: root, PORT: String(port), HOST: "127.0.0.1", ORIGIN: base, ADDRESS_HEADER: "X-Real-IP",
            LEGACY_DIR: REPO /* runtime assets only (images, manifest, calculator scripts, llms template); the old pages come from the baseline */, PRICES_DIR: dataDir, DATA_DIR: dataDir, PRICES_SEED_FILE: SEED, LEAD_FILE: join(dataDir, "leads.jsonl"),
            PRICING_WEBHOOK_SECRET: "parity-throwaway-secret-0123456789abcdef", SITE_ORIGIN: "https://www.netquor.com", ALLOWED_ORIGINS: `https://www.netquor.com,${base}`,
        },
        stdout: "ignore", stderr: "ignore",
    });
    const stop = () => { server.kill(); rmSync(root, { recursive: true, force: true }); };
    for (let i = 0; ; i++) {
        try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* not up yet */ }
        if (i > 100) { stop(); throw new Error("the built server did not start"); }
        await Bun.sleep(150);
    }
    return { base, stop };
};

export interface PageOutcome { page: string; report?: Report; text: string; ok: boolean }

export const checkPage = async (base: string, path: string, allowPath = ALLOW_FILE): Promise<PageOutcome> => {
    const page = pageKey(path);
    const res = await fetch(base + path, { redirect: "manual" });
    if (res.status !== 200) return { page, ok: false, text: `${page}: FAIL\n  the Svelte page answered ${res.status}, not 200` };
    const { html: legacyHtml, scripts } = await legacyPage(path);
    const allow = loadAllow(allowPath).pages[page];
    const report = compareFacts({ legacy: extractFacts(legacyHtml, path), svelte: extractFacts(await res.text(), path), legacyScriptTexts: scripts, allow });
    return { page, report, ok: report.ok, text: formatReport(page, report) };
};
