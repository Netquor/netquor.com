// stamp.ts: writing prices into HTML and llms.txt, per request, in memory. Pure: text in, text out; nothing here touches a file. Everything outside the price text stays byte for byte as it was, so stamping the snapshot a page already shows changes nothing. Bytes are decoded as strict UTF-8 (a file that is not valid UTF-8 is refused, never repaired), so a stamped page can never gain replacement characters. See README.md in this folder for the markup.
import type { PriceEntry, Snapshot } from "./types";

export type PriceFormat = "usd" | "usd0" | "int" | "plain";
const FORMATS: PriceFormat[] = ["usd", "usd0", "int", "plain"];

export interface StampIssue { file: string; key: string; reason: string }

/** Every problem found in a file, so one run reports them all. Nothing is written when there is one. */
export class StampError extends Error {
    constructor(readonly issues: StampIssue[]) {
        super(issues.map((i) => `${i.file}: ${i.key ? `${i.key}: ` : ""}${i.reason}`).join("\n"));
        this.name = "StampError";
    }
}

/** Strict UTF-8: throws StampError on an invalid byte sequence instead of substituting U+FFFD. A leading BOM is kept (so bytes round-trip). */
export const decodeUtf8Strict = (bytes: Uint8Array, file = "input"): string => {
    try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw new StampError([{ file, key: "", reason: "not valid UTF-8" }]); }
};

/** A string with an unpaired surrogate cannot be encoded back to UTF-8 faithfully. */
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const assertWellFormed = (text: string, file: string): void => {
    if (LONE_SURROGATE.test(text)) throw new StampError([{ file, key: "", reason: "not valid UTF-8 text (unpaired surrogate)" }]);
};

const withCommas = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** usd: $5.95 and $25.00. usd0: $25 when the cents are zero, otherwise $5.95. int: the cents (595). plain: 25 or 5.95 with no symbol (for JSON-LD). */
export const formatPrice = (p: PriceEntry, fmt: PriceFormat): string => {
    const dollars = Math.floor(p.amountCents / 100), cents = p.amountCents % 100;
    const cc = String(cents).padStart(2, "0");
    switch (fmt) {
        case "int": return String(p.amountCents);
        case "plain": return cents === 0 ? String(dollars) : `${dollars}.${cc}`;
        case "usd": return `$${withCommas(dollars)}.${cc}`;
        case "usd0": return cents === 0 ? `$${withCommas(dollars)}` : `$${withCommas(dollars)}.${cc}`;
    }
};

const isFormat = (f: string): f is PriceFormat => (FORMATS as string[]).includes(f);

export const escapeHtml = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const lookup = (snapshot: Snapshot, key: string, fmt: string | undefined, file: string, issues: StampIssue[], defaultFmt: PriceFormat): string | null => {
    const f = fmt ?? defaultFmt;
    if (!isFormat(f)) { issues.push({ file, key, reason: `unknown format "${f}"` }); return null; }
    if (!Object.hasOwn(snapshot.prices, key)) { issues.push({ file, key, reason: "key is not in the snapshot" }); return null; }
    return formatPrice(snapshot.prices[key], f);
};

// ---- HTML scanning ----

interface Tag { name: string; attrs: Map<string, string>; start: number; end: number }

const decodeAttr = (v: string): string => v.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const NAME = /[a-zA-Z][a-zA-Z0-9:-]*/y;

/** Reads the start tag at `lt` (which holds "<"). Handles quoted attribute values that contain ">". Null when it is not a tag. */
const readTag = (html: string, lt: number): Tag | null => {
    NAME.lastIndex = lt + 1;
    const m = NAME.exec(html);
    if (!m) return null;
    const attrs = new Map<string, string>();
    let i = lt + 1 + m[0].length;
    const n = html.length;
    while (i < n) {
        while (i < n && /[\s/]/.test(html[i])) i++;
        if (html[i] === ">") return { name: m[0].toLowerCase(), attrs, start: lt, end: i + 1 };
        const s = i;
        while (i < n && !/[\s=/>]/.test(html[i])) i++;
        if (i === s) { i++; continue; }
        const name = html.slice(s, i).toLowerCase();
        while (i < n && /\s/.test(html[i])) i++;
        let value = "";
        if (html[i] === "=") {
            i++;
            while (i < n && /\s/.test(html[i])) i++;
            if (html[i] === '"' || html[i] === "'") {
                const q = html[i], close = html.indexOf(q, i + 1);
                if (close < 0) return null;
                value = html.slice(i + 1, close);
                i = close + 1;
            } else {
                const vs = i;
                while (i < n && !/[\s>]/.test(html[i])) i++;
                value = html.slice(vs, i);
            }
        }
        if (!attrs.has(name)) attrs.set(name, decodeAttr(value));
    }
    return null;
};

interface Edit { start: number; end: number; text: string }

const applyEdits = (src: string, edits: Edit[]): string => {
    if (edits.length === 0) return src;
    edits.sort((a, b) => a.start - b.start);
    let out = "", at = 0;
    for (const e of edits) { out += src.slice(at, e.start) + e.text; at = e.end; }
    return out + src.slice(at);
};

// ---- JSON-LD ----

const skipWs = (t: string, i: number): number => { while (i < t.length && /\s/.test(t[i])) i++; return i; };
const skipString = (t: string, i: number): number => {
    i++;
    while (i < t.length && t[i] !== '"') i += t[i] === "\\" ? 2 : 1;
    return i + 1;
};
const skipValue = (t: string, i: number): number => {
    i = skipWs(t, i);
    const c = t[i];
    if (c === '"') return skipString(t, i);
    if (c === "{" || c === "[") {
        let depth = 0;
        for (; i < t.length; i++) {
            if (t[i] === '"') { i = skipString(t, i) - 1; continue; }
            if (t[i] === "{" || t[i] === "[") depth++;
            else if (t[i] === "}" || t[i] === "]") { depth--; if (depth === 0) return i + 1; }
        }
        return t.length;
    }
    while (i < t.length && !/[\s,}\]]/.test(t[i])) i++;
    return i;
};

/** The [start, end) of the value at a JSON pointer in raw JSON text, or null. Works on the text so nothing else in the block is re-serialized. */
export const locateJsonValue = (text: string, pointer: string): [number, number] | null => {
    if (pointer !== "" && !pointer.startsWith("/")) return null;
    const tokens = pointer === "" ? [] : pointer.slice(1).split("/").map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"));
    let i = skipWs(text, 0);
    for (const tok of tokens) {
        if (text[i] === "{") {
            i = skipWs(text, i + 1);
            let found = false;
            while (i < text.length && text[i] !== "}") {
                if (text[i] !== '"') return null;
                const keyEnd = skipString(text, i);
                let key: string;
                try { key = JSON.parse(text.slice(i, keyEnd)); } catch { return null; }
                i = skipWs(text, keyEnd);
                if (text[i] !== ":") return null;
                i = skipWs(text, i + 1);
                if (key === tok) { found = true; break; }
                i = skipWs(text, skipValue(text, i));
                if (text[i] === ",") i = skipWs(text, i + 1);
            }
            if (!found) return null;
        } else if (text[i] === "[") {
            if (!/^(0|[1-9]\d*)$/.test(tok)) return null;
            let idx = Number(tok);
            i = skipWs(text, i + 1);
            while (idx > 0 && i < text.length && text[i] !== "]") {
                i = skipWs(text, skipValue(text, i));
                if (text[i] === ",") i = skipWs(text, i + 1);
                idx--;
            }
            if (text[i] === "]" || i >= text.length) return null;
        } else return null;
    }
    i = skipWs(text, i);
    return [i, skipValue(text, i)];
};

/** Rewrites the values a data-price-map points at. Each value keeps its JSON type: a string stays a string ("5.95"), a number stays a number. */
const stampJsonLd = (json: string, map: unknown, snapshot: Snapshot, file: string, issues: StampIssue[]): Edit[] => {
    const edits: Edit[] = [];
    if (typeof map !== "object" || map === null || Array.isArray(map)) { issues.push({ file, key: "", reason: "data-price-map must be a JSON object of pointer to key" }); return edits; }
    for (const [pointer, spec] of Object.entries(map)) {
        if (typeof spec !== "string") { issues.push({ file, key: "", reason: `data-price-map ${pointer}: the value must be "key" or "key|format"` }); continue; }
        const [key, fmt] = spec.split("|");
        const span = locateJsonValue(json, pointer);
        if (!span) { issues.push({ file, key, reason: `data-price-map pointer ${pointer} does not exist in the JSON-LD` }); continue; }
        const text = lookup(snapshot, key, fmt, file, issues, "plain");
        if (text === null) continue;
        const old = json.slice(span[0], span[1]);
        if (old.startsWith('"')) edits.push({ start: span[0], end: span[1], text: JSON.stringify(text) });
        else if (/^-?\d/.test(old) && /^\d+(\.\d+)?$/.test(text)) edits.push({ start: span[0], end: span[1], text });
        else issues.push({ file, key, reason: `data-price-map ${pointer}: the value there is not a string or a number, or the format gives text that is not a number` });
    }
    return edits;
};

// ---- HTML ----

/**
 * Rewrites the text of every element with data-price="<key>" (format from data-fmt, default usd0) and the JSON-LD values listed in a data-price-map on an application/ld+json script tag.
 * Comments, script and style contents are never searched for markers. An element with data-price must hold text only. Throws StampError listing every problem; never leaves stale text.
 */
export const stampHtml = (html: string, snapshot: Snapshot, file = "html"): string => {
    assertWellFormed(html, file);
    const edits: Edit[] = [];
    const issues: StampIssue[] = [];
    let i = 0;
    while (i < html.length) {
        const lt = html.indexOf("<", i);
        if (lt < 0) break;
        if (html.startsWith("<!--", lt)) { const e = html.indexOf("-->", lt + 4); i = e < 0 ? html.length : e + 3; continue; }
        if (html[lt + 1] === "!" || html[lt + 1] === "?" || html[lt + 1] === "/") { const e = html.indexOf(">", lt); i = e < 0 ? html.length : e + 1; continue; }
        const tag = readTag(html, lt);
        if (!tag) { i = lt + 1; continue; }
        i = tag.end;
        if (tag.name === "script" || tag.name === "style") {
            const close = html.slice(i).search(new RegExp(`</${tag.name}`, "i"));
            const contentEnd = close < 0 ? html.length : i + close;
            const type = (tag.attrs.get("type") ?? "").toLowerCase();
            if (tag.name === "script" && type === "application/ld+json" && tag.attrs.has("data-price-map")) {
                let map: unknown;
                try { map = JSON.parse(tag.attrs.get("data-price-map") as string); } catch { issues.push({ file, key: "", reason: "data-price-map is not valid JSON" }); map = null; }
                if (map !== null) {
                    const before = issues.length;
                    const e = stampJsonLd(html.slice(i, contentEnd), map, snapshot, file, issues).map((x) => ({ ...x, start: x.start + i, end: x.end + i }));
                    if (issues.length === before) edits.push(...e);
                }
            } else if (tag.attrs.has("data-price")) issues.push({ file, key: tag.attrs.get("data-price") ?? "", reason: `data-price is not allowed on <${tag.name}>` });
            i = contentEnd;
            continue;
        }
        const key = tag.attrs.get("data-price");
        if (key === undefined) continue;
        if (key === "") { issues.push({ file, key, reason: "data-price is empty" }); continue; }
        const next = html.indexOf("<", tag.end);
        const closer = `</${tag.name}`;
        if (next < 0 || html.slice(next, next + closer.length).toLowerCase() !== closer || !/[\s>]/.test(html[next + closer.length] ?? "")) {
            issues.push({ file, key, reason: `the <${tag.name}> must hold only text (no child elements) and be closed` });
            continue;
        }
        if (html[tag.end - 2] === "/") { issues.push({ file, key, reason: "a self-closing element cannot hold a price" }); continue; }
        const text = lookup(snapshot, key, tag.attrs.get("data-fmt"), file, issues, "usd0");
        if (text !== null) edits.push({ start: tag.end, end: next, text: escapeHtml(text) });
    }
    if (issues.length) throw new StampError(issues);
    return applyEdits(html, edits);
};

/** stampHtml for the bytes of a file: strict UTF-8 in, UTF-8 out. Every byte outside a price is unchanged. */
export const stampHtmlBytes = (bytes: Uint8Array, snapshot: Snapshot, file = "html"): Uint8Array =>
    new TextEncoder().encode(stampHtml(decodeUtf8Strict(bytes, file), snapshot, file));

/** Does this page carry any marker at all? A cheap test so the site scan skips pages without one. */
export const hasPriceMarkers = (html: string): boolean => html.includes("data-price");

// ---- llms.txt ----

const TOKEN = /\{\{price:([a-z0-9][a-z0-9._]*)(?:\|([a-z0-9]+))?\}\}/g;

/**
 * Renders llms.txt from llms.template.txt (per request, never written to disk): {{price:<key>}} or {{price:<key>|<fmt>}} becomes the price (default usd0). The published llms.txt holds no tokens. Any other "{{" in the template is an error, so a typo never reaches the published file.
 */
export const renderLlms = (template: string, snapshot: Snapshot, file = "llms.template.txt"): string => {
    assertWellFormed(template, file);
    const issues: StampIssue[] = [];
    const out = template.replace(TOKEN, (_m, key: string, fmt?: string) => lookup(snapshot, key, fmt, file, issues, "usd0") ?? "");
    const leftover = out.indexOf("{{");
    if (leftover >= 0 && issues.length === 0) issues.push({ file, key: "", reason: `a "{{" that is not a valid price token: ${out.slice(leftover, leftover + 40).split("\n")[0]}` });
    if (issues.length) throw new StampError(issues);
    return out;
};
