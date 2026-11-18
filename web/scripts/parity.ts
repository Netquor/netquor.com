// parity.ts: `bun run parity <page>.html` or `bun run parity --all`. Compares a migrated Svelte page with its legacy page from the baseline (the legacy site at the legacy-baseline-2026-11 tag, extracted under .baseline/) (text blocks, links and images, metadata and JSON-LD, external scripts and stylesheets, ids scripts need). Exit code 1 when anything differs. Intended differences go in migration/parity-allow.json with a reason. See migration/README.md.
//   --no-build   use the existing web/build (otherwise it is rebuilt first)
//   --base URL   compare against a server that is already running (it must serve the seed prices); no build, no server started
import { existsSync } from "node:fs";
import { join } from "node:path";
import { baselineDirSync } from "./baseline/dir";
import { checkPage, migratedPaths, pageKey, pagePathFor, startServer } from "./parity/run";
import { PAGES } from "../src/lib/pages";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const valueOf = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const base = valueOf("--base");
const names = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--base");

const usage = () => { console.error("usage: bun run parity <page>.html [--no-build] [--base URL]\n       bun run parity --all [--no-build]"); process.exit(2); };
if (!flag("--all") && names.length === 0) usage();

const baseline = baselineDirSync();
console.log(`baseline: ${baseline}`);
const migrated = migratedPaths();
let paths: string[];
if (flag("--all")) {
    // A page that has no legacy HTML file in the baseline (written new in Svelte, like story.html) has nothing to compare with.
    const legacyExists = (p: string) => p === "/" ? existsSync(join(baseline, "index.html")) : existsSync(join(baseline, p.slice(1)));
    const newPages = PAGES.map((p) => p.path).filter((p) => migrated.has(p) && !legacyExists(p));
    if (newPages.length) console.log(`new pages with no legacy file (skipped): ${newPages.map(pageKey).join(", ")}`);
    paths = PAGES.map((p) => p.path).filter((p) => migrated.has(p) && legacyExists(p));
    const waiting = PAGES.map((p) => p.path).filter((p) => !migrated.has(p));
    console.log(`${paths.length} migrated page(s) to check; ${waiting.length} not migrated yet: ${waiting.map(pageKey).join(", ") || "none"}`);
    if (paths.length === 0) process.exit(0);
} else {
    paths = [];
    for (const n of names) {
        const p = pagePathFor(n);
        if (!p) { console.error(`${n}: not a page in src/lib/pages.ts`); process.exit(2); }
        if (!migrated.has(p)) { console.error(`${n}: not migrated (no src/routes/(site)/${pageKey(p)}/+page.svelte or (fleet) equivalent); there is nothing to compare`); process.exit(2); }
        paths.push(p);
    }
}

const served = base ? { base: base.replace(/\/$/, ""), stop() {} } : await startServer({ build: !flag("--no-build"), log: (s) => console.log(s) });
let failed = 0;
try {
    for (const p of paths) {
        const out = await checkPage(served.base, p);
        console.log(out.text);
        if (!out.ok) failed++;
    }
} finally { served.stop(); }
console.log(failed ? `\n${failed} of ${paths.length} page(s) differ` : `\nall ${paths.length} page(s) match`);
process.exit(failed ? 1 : 0);
