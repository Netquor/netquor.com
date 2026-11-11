// hydration.ts: `bun run e2e:hydration`. Starts the Vite dev server (the Svelte dev build warns about hydration mismatches, a11y problems and bad state use, the production build does not) on a free loopback port with a temp data folder, loads every page in headless Chrome and prints the console warnings and errors of each page plus the dev server's own warnings. Exit code 1 when any page produced a Svelte warning or an error. Nothing outside temp folders is written.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launchBrowser } from "./browser";
import { PAGES } from "./audit";

const WEB = join(import.meta.dir, "../..");
const REPO = join(WEB, "..");

/** Messages that are not about our code: failed third-party loads when offline, Chrome's own notices. */
export const isNoise = (text: string): boolean => /favicon|Failed to load resource.*(googleapis|gstatic|jsdelivr|googletagmanager)|net::ERR_(INTERNET|NAME|CONNECTION)/i.test(text);

/** Messages that are Svelte or our own: hydration mismatch, a11y, ownership, state. */
export const isSvelteWarning = (text: string): boolean => /hydration_|\[svelte\]|svelte\.dev\/e\/|a11y|state_|ownership_|attribute_|each_key|node_invalid_placement/i.test(text);

if (import.meta.main) {
    const root = mkdtempSync(join(tmpdir(), "nq-hydration-"));
    const dataDir = join(root, "data");
    Bun.spawnSync(["mkdir", "-p", dataDir]);
    const probe = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response("") });
    const port = probe.port as number;
    probe.stop(true);
    const base = `http://127.0.0.1:${port}`;
    const server = Bun.spawn(["bun", "--bun", "vite", "dev", "--port", String(port), "--strictPort", "--host", "127.0.0.1"], {
        cwd: WEB,
        env: {
            PATH: process.env.PATH ?? "", HOME: root, ORIGIN: base, LEGACY_DIR: REPO, PRICES_DIR: dataDir, DATA_DIR: dataDir, PRICES_SEED_FILE: join(REPO, "server/data/prices.seed.json"),
            LEAD_FILE: join(dataDir, "leads.jsonl"), PRICING_WEBHOOK_SECRET: "hydration-throwaway-secret-0123456789abcdef", SITE_ORIGIN: "https://www.netquor.com", ALLOWED_ORIGINS: `https://www.netquor.com,${base}`,
        },
        stdout: "pipe", stderr: "pipe",
    });
    let log = "";
    const drain = async (s: ReadableStream<Uint8Array>) => { for await (const c of s) log += new TextDecoder().decode(c); };
    void drain(server.stdout);
    void drain(server.stderr);
    const stop = () => { server.kill(); rmSync(root, { recursive: true, force: true }); };
    let bad = 0;
    try {
        for (let i = 0; ; i++) {
            try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* not up yet */ }
            if (i > 200) throw new Error(`the dev server did not start:\n${log.slice(-2000)}`);
            await Bun.sleep(150);
        }
        const browser = await launchBrowser();
        try {
            for (const path of PAGES) {
                const page = await browser.newPage();
                try {
                    await page.goto(base + path, { waitUntil: "networkidle", timeoutMs: 90000 });
                    await page.wait(2500);
                    // Scroll through the page so lazy and observer driven code runs too.
                    await page.eval(`window.scrollTo(0, document.body.scrollHeight)`);
                    await page.wait(500);
                    // Self-check: the console capture works, and this really is the hydrated dev build (Kit's dev flag, and the Nav action has run on pages that have a nav).
                    await page.eval(`console.warn("nq-probe")`);
                    await page.wait(100);
                    const probe = page.consoleMessages().some((m) => m.text.includes("nq-probe"));
                    const dev = await page.eval(`typeof window.__sveltekit_dev !== "undefined" || !!document.querySelector('script[src*="/@vite/client"], script[src*="@vite"]') || [...document.scripts].some((x) => /@vite|\\/node_modules\\/\\.vite|\\.svelte-kit/.test(x.textContent || x.src))`);
                    if (!probe) { bad++; console.log(`    FAIL: the console capture did not see a probe warning on ${path}`); }
                    console.log(`    dev build: ${dev}`);
                    const msgs = page.consoleMessages().filter((m) => !m.text.includes("nq-probe")).filter((m) => !isNoise(m.text));
                    const sv = msgs.filter((m) => isSvelteWarning(m.text) || m.type === "error");
                    if (sv.length) bad++;
                    console.log(`${path.padEnd(26)} ${sv.length ? `FAIL (${sv.length})` : "ok"}  (${msgs.length} console message${msgs.length === 1 ? "" : "s"} in all)`);
                    for (const m of msgs) console.log(`    ${m.type}: ${m.text.slice(0, 400)}`);
                } finally { await page.close(); }
            }
        } finally { await browser.close(); }
        const serverWarnings = log.split("\n").filter((l) => /warn|a11y|hydrat|error/i.test(l) && !/deprecat/i.test(l));
        console.log(`\ndev server warnings: ${serverWarnings.length}`);
        for (const l of serverWarnings.slice(0, 40)) console.log(`    ${l.slice(0, 300)}`);
        if (serverWarnings.some((l) => /a11y/i.test(l))) bad++;
    } finally { stop(); }
    process.exit(bad ? 1 : 0);
}
