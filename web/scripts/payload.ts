// payload.ts: `bun run payload [--no-build] [path...]`. Loads pages in headless Chrome on the built server and reports the CSS (and font) bytes each one loads (raw and gzip, as a compressing proxy would send them), and the requests that went to a third-party origin. The target: no third-party request but analytics.
import { launchBrowser } from "./e2e/browser";
import { startServer } from "./parity/run";

const GOOGLE_ANALYTICS = /(^|\.)(googletagmanager|google-analytics|doubleclick|googleadservices|analytics\.google)\.com$/;

export interface Weighed { url: string; type: string; raw: number; gzip: number }
export interface PayloadRow { path: string; css: Weighed[]; fonts: Weighed[]; inlineCss: Weighed; thirdParty: string[]; thirdPartyOther: string[] }

/** Bytes of a body as sent: the raw length and the gzip length. */
export const weigh = (url: string, type: string, body: Uint8Array<ArrayBuffer>): Weighed => ({ url, type, raw: body.length, gzip: Bun.gzipSync(body).length });

/** The text of every inline <style> block of an HTML document, joined. */
export const inlineStyles = (html: string): string => [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");

/** Requests to an origin other than `own`, split into analytics (allowed) and everything else (a failure). data: and blob: URLs are not requests to anyone. */
export const thirdParty = (urls: string[], own: string): { analytics: string[]; other: string[] } => {
    const analytics = new Set<string>(), other = new Set<string>();
    for (const u of urls) {
        if (u.startsWith("data:") || u.startsWith("blob:") || u.startsWith(own)) continue;
        let host = "";
        try { host = new URL(u).hostname; } catch { continue; }
        (GOOGLE_ANALYTICS.test(host) ? analytics : other).add(u.split("?")[0]);
    }
    return { analytics: [...analytics].sort(), other: [...other].sort() };
};

const sum = (rows: Weighed[], key: "raw" | "gzip") => rows.reduce((n, r) => n + r[key], 0);
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

export const formatRow = (r: PayloadRow): string => {
    const lines = [`${r.path}`];
    const css = [...r.css, ...(r.inlineCss.raw ? [r.inlineCss] : [])];
    for (const c of css) lines.push(`  css   ${kb(c.raw).padStart(10)} ${kb(c.gzip).padStart(10)}  ${c.url}`);
    lines.push(`  css total   ${kb(sum(css, "raw")).padStart(10)} raw  ${kb(sum(css, "gzip")).padStart(10)} gzip  (${css.length} sheets)`);
    lines.push(`  fonts total ${kb(sum(r.fonts, "raw")).padStart(10)} raw  ${kb(sum(r.fonts, "gzip")).padStart(10)} gzip  (${r.fonts.length} files)`);
    lines.push(`  third-party: ${r.thirdPartyOther.length} non-analytics${r.thirdPartyOther.length ? " " + r.thirdPartyOther.join(", ") : ""}; ${r.thirdParty.length} analytics`);
    return lines.join("\n");
};

if (import.meta.main) {
    const args = process.argv.slice(2);
    const paths = args.filter((a) => !a.startsWith("--"));
    const served = await startServer({ build: !args.includes("--no-build"), log: (s) => console.log(s) });
    const browser = await launchBrowser();
    try {
        for (const path of paths.length ? paths : ["/", "/fleet.html"]) {
            const page = await browser.newPage();
            try {
                await page.goto(served.base + path, { waitUntil: "networkidle", timeoutMs: 45000 });
                await page.wait(1500);
                const reqs = page.requests().filter((r) => !r.url.startsWith("data:"));
                const fetchAll = async (type: string): Promise<Weighed[]> => {
                    const urls = [...new Set(reqs.filter((r) => r.type === type).map((r) => r.url))];
                    return Promise.all(urls.map(async (u) => weigh(u.replace(served.base, ""), type, new Uint8Array(await (await fetch(u, { headers: { "accept-encoding": "identity" } })).arrayBuffer()))));
                };
                const html = await (await fetch(served.base + path)).text();
                const inline = inlineStyles(html);
                const tp = thirdParty(reqs.map((r) => r.url), served.base);
                console.log(formatRow({ path, css: await fetchAll("Stylesheet"), fonts: await fetchAll("Font"), inlineCss: weigh("(inline <style>)", "Inline", new TextEncoder().encode(inline)), thirdParty: tp.analytics, thirdPartyOther: tp.other }) + "\n");
            } finally { await page.close(); }
        }
    } finally { await browser.close(); served.stop(); }
}
