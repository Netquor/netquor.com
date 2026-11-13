// visual.ts: pixel diff of every page, the baseline (legacy site at the legacy-baseline-2026-11 tag, extracted under .baseline/) against the built SvelteKit page.
//
//   bun run visual                     all pages, 1280x900 and 390x844
//   bun run visual vpn.html fleet.html some pages          (--no-build reuses web/build)
//   VISUAL_OUT=/some/dir bun run visual                     where the PNGs go (default: a temp folder)
//
// The legacy pages are served from the baseline directory (seed prices stamped in) on one port, the built server (seed prices, temp data folder) on another. Headless Chrome takes a full-page screenshot of each at both sizes with reduced motion on (so fx.js and bg.js stay static), CSS animations and transitions off, the background canvas hidden and web fonts loaded. Nothing outside temp folders is written. Dev only: needs pngjs and pixelmatch.
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { PAGES } from "../src/lib/pages";
import type { Snapshot } from "#server/prices/types";
import { baselineDirSync } from "./baseline/dir";
import { serveBaseline } from "./baseline/server";
import { stampBaselineHtml } from "./baseline/stamp";
import { REPO, pageKey, startServer } from "./parity/run";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const VIEWPORTS = [{ name: "desktop", width: 1280, height: 900 }, { name: "mobile", width: 390, height: 844 }] as const;
const THRESHOLD_PCT = 0.5;

const STYLE = `*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}
canvas{visibility:hidden!important}`;

class Cdp {
    private id = 0;
    onEvent?: (m: any) => void;
    private pending = new Map<number, (m: any) => void>();
    private constructor(private ws: WebSocket) {
        ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); if (m.method) this.onEvent?.(m); if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)!(m); this.pending.delete(m.id); } };
    }
    static async open(url: string): Promise<Cdp> {
        const ws = new WebSocket(url);
        await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = () => rej(new Error("devtools socket")); });
        return new Cdp(ws);
    }
    send(method: string, params: object = {}, sessionId?: string): Promise<any> {
        const id = ++this.id;
        return new Promise((res, rej) => {
            this.pending.set(id, (m) => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)));
            this.ws.send(JSON.stringify({ id, method, params, sessionId }));
        });
    }
    close() { this.ws.close(); }
}

const startChrome = async (profile: string): Promise<{ cdp: Cdp; stop(): void }> => {
    const proc = Bun.spawn([CHROME, "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--hide-scrollbars", "--no-first-run", "--disable-gpu", "--force-color-profile=srgb", "--font-render-hinting=none", "about:blank"], { stdout: "ignore", stderr: "pipe" });
    const reader = proc.stderr.getReader();
    let seen = "";
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
        const { value, done } = await reader.read();
        if (done) break;
        seen += new TextDecoder().decode(value);
        const m = /DevTools listening on (ws:\/\/\S+)/.exec(seen);
        if (m) return { cdp: await Cdp.open(m[1]), stop: () => proc.kill() };
    }
    proc.kill();
    throw new Error("Chrome did not start");
};

/** Errors and warnings seen in the page: uncaught exceptions, console.error and console.warn, failed log entries. Reported for the Svelte side. */
const problems: string[] = [];

const shoot = async (cdp: Cdp, url: string, vp: { width: number; height: number }, label: string): Promise<PNG> => {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const s = (m: string, p: object = {}) => cdp.send(m, p, sessionId);
    const prev = cdp.onEvent;
    cdp.onEvent = (m) => {
        if (m.sessionId !== sessionId) return prev?.(m);
        if (m.method === "Runtime.exceptionThrown") problems.push(`${label}: exception ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
        if (m.method === "Runtime.consoleAPICalled" && ["error", "warning", "assert"].includes(m.params.type)) problems.push(`${label}: console.${m.params.type} ${m.params.args.map((a: any) => a.value ?? a.description ?? "").join(" ").slice(0, 300)}`);
        if (m.method === "Log.entryAdded" && ["error", "warning"].includes(m.params.entry.level)) problems.push(`${label}: log ${m.params.entry.level} ${m.params.entry.text} ${m.params.entry.url ?? ""}`);
    };
    try {
        await s("Page.enable"); await s("Runtime.enable"); await s("Log.enable");
        // The web chat widget's host only allows the real site origin: answer its script with an empty file so the comparison never reaches the network.
        await s("Fetch.enable", { patterns: [{ urlPattern: "*pbx-iad-c-01.netquor.net*", requestStage: "Request" }] });
        const prevEv = cdp.onEvent;
        cdp.onEvent = (m) => {
            if (m.sessionId === sessionId && m.method === "Fetch.requestPaused") { void cdp.send("Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "text/javascript" }, { name: "Access-Control-Allow-Origin", value: "*" }], body: "" }, sessionId).catch(() => {}); return; }
            prevEv?.(m);
        };
        await s("Emulation.setDeviceMetricsOverride", { width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: false });
        await s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
        await s("Page.addScriptToEvaluateOnNewDocument", { source: `document.addEventListener("DOMContentLoaded",()=>{const s=document.createElement("style");s.textContent=${JSON.stringify(STYLE)};document.head.appendChild(s)});` });
        await s("Page.navigate", { url });
        const until = async (expr: string, ms = 20000) => {
            const end = Date.now() + ms;
            while (Date.now() < end) { const r = await s("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.value) return; await Bun.sleep(100); }
            throw new Error(`timed out waiting for ${expr}`);
        };
        await until(`document.readyState === "complete"`);
        await until(`document.fonts.ready.then(() => true)`);
        // Walk down the page once so anything that loads lazily is in, then back to the top.
        await s("Runtime.evaluate", { expression: `(async()=>{const h=document.documentElement.scrollHeight;for(let y=0;y<h;y+=400){scrollTo(0,y);await new Promise(r=>setTimeout(r,30))}scrollTo(0,0);await new Promise(r=>setTimeout(r,300))})()`, awaitPromise: true });
        const h = (await s("Runtime.evaluate", { expression: `Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight))`, returnByValue: true })).result.value as number;
        await s("Emulation.setDeviceMetricsOverride", { width: vp.width, height: h, deviceScaleFactor: 1, mobile: false });
        await Bun.sleep(400);
        const shot = await s("Page.captureScreenshot", { format: "png", fromSurface: true });
        return PNG.sync.read(Buffer.from(shot.data, "base64"));
    } finally {
        cdp.onEvent = prev; await cdp.send("Target.closeTarget", { targetId }).catch(() => {});
    }
};

const pad = (img: PNG, w: number, h: number): PNG => {
    if (img.width === w && img.height === h) return img;
    const out = new PNG({ width: w, height: h });
    out.data.fill(255);
    PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
    return out;
};

const args = process.argv.slice(2);
const build = !args.includes("--no-build");
const wanted = args.filter((a) => !a.startsWith("--"));
const hasBaselinePage = (path: string): boolean => existsSync(join(baselineDirSync(), path === "/" ? "index.html" : path.slice(1)));
const pages = PAGES.filter((p) => wanted.length === 0 || wanted.includes(pageKey(p.path))).filter((p) => {
    if (hasBaselinePage(p.path)) return true;
    console.log(`${pageKey(p.path)}: no page in the baseline (written new in Svelte), skipped`);
    return false;
});
const outDir = process.env.VISUAL_OUT ?? join(tmpdir(), "nq-visual");
mkdirSync(outDir, { recursive: true });

const seed = JSON.parse(await Bun.file(join(REPO, "server/data/prices.seed.json")).text()) as Snapshot;
const baselineDir = baselineDirSync();
console.log(`baseline: ${baselineDir}`);
const legacyHttp = serveBaseline({ dir: baselineDir, transformHtml: (html, rel) => stampBaselineHtml(html, rel, seed) });
const legacyBase = legacyHttp.base;
const svelte = await startServer({ build, log: (s) => console.log(s) });
const profile = mkdtempSync(join(tmpdir(), "nq-visual-chrome-"));
const chrome = await startChrome(profile);

console.log(`legacy ${legacyBase}  svelte ${svelte.base}  png ${outDir}\n`);
console.log("page".padEnd(26) + "viewport".padEnd(10) + "size legacy".padEnd(14) + "size svelte".padEnd(14) + "mismatch");
let worst = 0;
const over: string[] = [];
try {
    for (const p of pages) {
        for (const vp of VIEWPORTS) {
            const a = await shoot(chrome.cdp, legacyBase + p.path, vp, `legacy ${pageKey(p.path)} ${vp.name}`);
            const b = await shoot(chrome.cdp, svelte.base + p.path, vp, `svelte ${pageKey(p.path)} ${vp.name}`);
            const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
            const pa = pad(a, w, h), pb = pad(b, w, h);
            const diff = new PNG({ width: w, height: h });
            const n = pixelmatch(pa.data, pb.data, diff.data, w, h, { threshold: 0.1, includeAA: false });
            const pct = (n / (w * h)) * 100;
            worst = Math.max(worst, pct);
            const key = pageKey(p.path).replace(/\.html$/, "");
            writeFileSync(join(outDir, `${key}-${vp.name}-diff.png`), PNG.sync.write(diff));
            writeFileSync(join(outDir, `${key}-${vp.name}-legacy.png`), PNG.sync.write(a));
            writeFileSync(join(outDir, `${key}-${vp.name}-svelte.png`), PNG.sync.write(b));
            if (pct > THRESHOLD_PCT) over.push(`${pageKey(p.path)} ${vp.name}`);
            console.log(pageKey(p.path).padEnd(26) + vp.name.padEnd(10) + `${a.width}x${a.height}`.padEnd(14) + `${b.width}x${b.height}`.padEnd(14) + `${pct.toFixed(3)}%${pct > THRESHOLD_PCT ? "  <-- above " + THRESHOLD_PCT + "%" : ""}`);
        }
    }
} finally {
    chrome.cdp.close(); chrome.stop(); svelte.stop(); legacyHttp.stop();
    rmSync(profile, { recursive: true, force: true });
}
console.log(`\nbrowser console, errors and warnings (${problems.length}):`);
for (const q of problems) console.log("  " + q);
console.log(`\nworst ${worst.toFixed(3)}%; ${over.length} above ${THRESHOLD_PCT}%${over.length ? ": " + over.join(", ") : ""}`);
// A visual check that cannot fail is decoration: exit non-zero when any page is above the threshold (console noise stays advisory).
if (over.length) process.exit(1);
