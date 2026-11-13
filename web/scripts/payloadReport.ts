// payloadReport.ts: `bun run payload:report [--no-build] [path...]`. For every page, loads it in headless Chrome on the baseline legacy site (the legacy-baseline-2026-11 tag extracted under .baseline/, behind a static server) and on the built Svelte server, and tabulates the JavaScript and CSS each one loads: file counts and bytes (raw and gzip as a compressing proxy would send them), split into first-party (the page's own origin) and third-party (CDNs). Google Analytics requests are stubbed by the browser harness, so they are counted apart and weigh nothing here; both sides make the same one. Inline scripts and styles are counted too (JSON-LD is data, not script). Third-party files are fetched from the network once to weigh them; a failure is reported as unweighed, never as zero.
import { launchBrowser } from "./e2e/browser";
import { PAGES } from "./e2e/audit";
import { startServers } from "./e2e/servers";

const GOOGLE = /(^|\.)(googletagmanager|google-analytics|doubleclick|googleadservices|analytics\.google)\.com$/;

export type Kind = "js" | "css";
export interface Bytes { raw: number; gzip: number }
export interface Counted extends Bytes { files: number }
export interface Side { js: { first: Counted; third: Counted; inline: Counted }; css: { first: Counted; third: Counted; inline: Counted }; analytics: number; unweighed: string[]; failed: string[] }

export const zero = (): Counted => ({ files: 0, raw: 0, gzip: 0 });
export const emptySide = (): Side => ({ js: { first: zero(), third: zero(), inline: zero() }, css: { first: zero(), third: zero(), inline: zero() }, analytics: 0, unweighed: [], failed: [] });

/** "own" for the page's origin, "analytics" for Google Analytics hosts, "third" for everything else. data: and blob: are not requests. */
export const originOf = (url: string, own: string): "own" | "analytics" | "third" | "none" => {
    if (url.startsWith("data:") || url.startsWith("blob:")) return "none";
    if (url.startsWith(own)) return "own";
    try { return GOOGLE.test(new URL(url).hostname) ? "analytics" : "third"; } catch { return "none"; }
};

/** The Chrome resource type for a kind. */
export const kindOfType = (type: string): Kind | null => (type === "Script" ? "js" : type === "Stylesheet" ? "css" : null);

export const weigh = (body: Uint8Array<ArrayBuffer>): Bytes => ({ raw: body.length, gzip: Bun.gzipSync(body).length });

const add = (c: Counted, b: Bytes, files = 1): void => { c.files += files; c.raw += b.raw; c.gzip += b.gzip; };

/** The inline script text (everything but JSON data blocks and external scripts) and inline style text of an HTML document. */
export const inlineParts = (html: string): { js: string; css: string } => {
    const js = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
        .filter((m) => !/\bsrc\s*=/.test(m[1]) && !/type\s*=\s*["']?(application\/(ld\+)?json|importmap|speculationrules)/i.test(m[1]))
        .map((m) => m[2]).join("\n");
    const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
    return { js, css };
};

export interface Loaded { url: string; type: string; status?: number; failed?: string; bytes: Bytes | null }

/** Folds a page's loaded files and its HTML into one Side. A request with a failure or a 4xx/5xx status counts under `failed` and weighs nothing. */
export const summarize = (loaded: Loaded[], html: string, own: string): Side => {
    const side = emptySide();
    const seen = new Set<string>();
    for (const l of loaded) {
        const kind = kindOfType(l.type);
        if (!kind) continue;
        const key = l.url;
        if (seen.has(key)) continue;
        seen.add(key);
        const origin = originOf(l.url, own);
        if (origin === "none") continue;
        if (origin === "analytics") { side.analytics++; continue; }
        if (l.failed || (l.status !== undefined && l.status >= 400)) { side.failed.push(l.url.replace(own, "")); continue; }
        if (!l.bytes) { side.unweighed.push(l.url); (origin === "own" ? side[kind].first : side[kind].third).files++; continue; }
        add(origin === "own" ? side[kind].first : side[kind].third, l.bytes);
    }
    const inline = inlineParts(html);
    if (inline.js.trim()) add(side.js.inline, weigh(new TextEncoder().encode(inline.js)));
    if (inline.css.trim()) add(side.css.inline, weigh(new TextEncoder().encode(inline.css)));
    return side;
};

export const totals = (side: Side, kind: Kind): Counted => {
    const k = side[kind];
    return { files: k.first.files + k.third.files, raw: k.first.raw + k.third.raw + k.inline.raw, gzip: k.first.gzip + k.third.gzip + k.inline.gzip };
};

const kb = (n: number): string => (n / 1024).toFixed(1);

export interface Row { page: string; legacy: Side | null; svelte: Side }

const cells = (s: Side | null): string[] => {
    if (!s) return ["-", "-", "-", "-", "-", "-"];
    const js = totals(s, "js"), css = totals(s, "css");
    return [`${s.js.first.files}+${s.js.third.files}`, kb(js.gzip), `${s.css.first.files}+${s.css.third.files}`, kb(css.gzip), String(s.js.third.files + s.css.third.files), String(s.analytics)];
};

/** A table: per page and side, JS files (first-party+third-party), JS KB gzip incl. inline, CSS files, CSS KB gzip incl. inline, non-analytics third-party files, analytics requests. */
export const formatReport = (rows: Row[]): string => {
    const head = ["page", "side", "js files 1p+3p", "js gzip KB", "css files 1p+3p", "css gzip KB", "3p files", "analytics"];
    const lines = [head.join(" | ")];
    for (const r of rows) {
        if (r.legacy) lines.push([r.page, "legacy", ...cells(r.legacy)].join(" | "));
        else lines.push([r.page, "legacy", "no legacy page", "", "", "", "", ""].join(" | "));
        lines.push([r.page, "svelte", ...cells(r.svelte)].join(" | "));
    }
    const notes: string[] = [];
    for (const r of rows) for (const [name, s] of [["legacy", r.legacy], ["svelte", r.svelte]] as const) {
        if (s?.unweighed.length) notes.push(`${r.page} ${name}: not weighed (fetch failed): ${s.unweighed.join(", ")}`);
        if (s?.failed.length) notes.push(`${r.page} ${name}: failed or 4xx: ${s.failed.join(", ")}`);
    }
    return [...lines, ...notes].join("\n");
};

/** Sums the per-page rows of one side (a page counted once per row). */
export const grand = (rows: Row[], side: "legacy" | "svelte"): { js: Counted; css: Counted; third: number } => {
    const out = { js: zero(), css: zero(), third: 0 };
    for (const r of rows) {
        const s = r[side];
        if (!s) continue;
        for (const k of ["js", "css"] as const) { const t = totals(s, k); out[k].files += t.files; out[k].raw += t.raw; out[k].gzip += t.gzip; }
        out.third += s.js.third.files + s.css.third.files;
    }
    return out;
};

/** Fetches a file and weighs it; up to three tries (a CDN can be slow under load). null when all fail, so the caller reports it as not weighed. */
const fetchBytes = async (url: string): Promise<Bytes | null> => {
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetch(url, { headers: { "accept-encoding": "identity" }, signal: AbortSignal.timeout(45000) });
            if (res.ok) return weigh(new Uint8Array(await res.arrayBuffer()));
            if (res.status < 500) return null;
        } catch { /* try again */ }
    }
    return null;
};

if (import.meta.main) {
    const args = process.argv.slice(2);
    const only = args.filter((a) => !a.startsWith("--"));
    const servers = await startServers({ build: !args.includes("--no-build"), log: (s) => console.log(s) });
    const browser = await launchBrowser();
    const rows: Row[] = [];
    const thirdCache = new Map<string, Bytes>();
    try {
        for (const path of only.length ? only : PAGES) {
            const measure = async (base: string): Promise<Side> => {
                const page = await browser.newPage();
                try {
                    // A slow CDN must not end the run: what was requested by the time the load stalls is still the page's payload, and the file is weighed from the network below.
                    try { await page.goto(base + path, { waitUntil: "networkidle", timeoutMs: 45000 }); } catch (e) { console.error(`${base + path}: ${e instanceof Error ? e.message : e} (measuring what was requested so far)`); }
                    await page.wait(1500);
                    const reqs = page.requests().filter((r) => kindOfType(r.type));
                    const loaded: Loaded[] = [];
                    for (const r of reqs) {
                        const origin = originOf(r.url, base);
                        let bytes: Bytes | null = null;
                        if (origin === "own") bytes = await fetchBytes(r.url);
                        else if (origin === "third") { bytes = thirdCache.get(r.url) ?? (await fetchBytes(r.url)); if (bytes) thirdCache.set(r.url, bytes); }
                        loaded.push({ url: r.url, type: r.type, status: r.status, failed: r.failed, bytes });
                    }
                    const html = await (await fetch(base + path)).text();
                    return summarize(loaded, html, base);
                } finally { await page.close(); }
            };
            const legacy = path === "/story.html" ? null : await measure(servers.legacy);
            rows.push({ page: path, legacy, svelte: await measure(servers.svelte) });
        }
    } finally { await browser.close(); servers.stop(); }
    console.log(formatReport(rows));
    for (const side of ["legacy", "svelte"] as const) {
        const g = grand(rows, side);
        console.log(`${side}: js ${g.js.files} files ${kb(g.js.gzip)} KB gzip, css ${g.css.files} files ${kb(g.css.gzip)} KB gzip, ${g.third} third-party files (summed over pages)`);
    }
}
