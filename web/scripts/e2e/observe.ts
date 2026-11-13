// observe.ts: take a normalised JSON snapshot of a page. The in-page part only collects raw facts; everything that decides what counts as "the same" is the pure normaliser below, which has browser-free tests.
import type { Page } from "./browser";

export interface ObserveSpec {
    /** CSS selectors. Each is read with querySelectorAll, at most `limit` matches kept (the true count is reported too). */
    selectors?: string[];
    /** Attribute names to record when present. A trailing * is a prefix ("aria-*", "data-*"). */
    attrs?: string[];
    /** true (default): every class, sorted. false: none. A list: only those classes (exact names, or a trailing * prefix). Framework hash classes (svelte-xxxx) are always dropped. */
    classes?: boolean | string[];
    /** Computed style properties (kebab-case) to record. */
    computed?: string[];
    /** Record the element's visible text (default true), cut to `textMax` characters (default 120). */
    text?: boolean;
    textMax?: number;
    /** Record the bounding box in viewport CSS pixels, rounded (default true). */
    box?: boolean;
    limit?: number;
    /** Storage keys to read: { local: ["nq-bg-paused"], session: ["nq-nudge"] }. A missing key is null. */
    storage?: { local?: string[]; session?: string[] };
    /** Named JavaScript expressions evaluated in the page (promises are awaited); the JSON result is recorded. */
    evals?: Record<string, string>;
    /** Record the network requests made since the page was opened: "all" or "external" (not the page's own origin). */
    requests?: false | "all" | "external";
    /** Record console errors and warnings since the page was opened. */
    console?: boolean;
}

export interface ObservedBox { x: number; y: number; w: number; h: number }
export interface ObservedEl {
    tag: string;
    attrs: Record<string, string>;
    classes: string[];
    box: ObservedBox | null;
    computed: Record<string, string>;
    text: string;
    visible: boolean;
}
export interface Observed {
    scroll: { x: number; y: number };
    /** The focused element as tag#id.firstclass ("body" when nothing is focused). */
    focus: string;
    elements: Record<string, { count: number; items: ObservedEl[] }>;
    storage?: { local: Record<string, string | null>; session: Record<string, string | null> };
    evals?: Record<string, unknown>;
    requests?: string[];
    console?: string[];
}

// ---- pure normalisation ----

export const normaliseText = (s: string, max = 120): string => {
    const t = s.replace(/\s+/g, " ").trim();
    return t.length > max ? t.slice(0, max) + "..." : t;
};

/** Rounds every number in a CSS value to 2 decimals and trims float noise ("matrix(1, 0, 0, 1, 0, 0.0000001)"). */
export const normaliseCssValue = (s: string): string =>
    s.replace(/-?\d+\.\d+(?:e[+-]?\d+)?/gi, (n) => { const v = Math.round(Number(n) * 100) / 100; return String(Object.is(v, -0) ? 0 : v); }).replace(/\s+/g, " ").trim();

/** Drops ?v=<fingerprint> from a URL-ish attribute value (the cache-busting parameter is not behaviour). */
export const stripVersion = (u: string): string => u.replace(/([?&])v=[^&#]*(&?)/, (_m, a: string, b: string) => (a === "?" && b ? "?" : a === "&" && b ? "&" : "")).replace(/\?$/, "");

const hashClass = /^svelte-[a-z0-9]+$/;
const matchName = (name: string, pat: string): boolean => (pat.endsWith("*") ? name.startsWith(pat.slice(0, -1)) : name === pat);

export const normaliseClasses = (classes: string[], keep: boolean | string[] = true): string[] => {
    if (keep === false) return [];
    const all = [...new Set(classes.filter((c) => c && !hashClass.test(c)))];
    const picked = keep === true ? all : all.filter((c) => keep.some((p) => matchName(c, p)));
    return picked.sort();
};

const URLISH = new Set(["href", "src", "action", "srcset", "poster"]);
export const normaliseAttrs = (attrs: Record<string, string>): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const k of Object.keys(attrs).sort()) {
        if (k.startsWith("data-svelte") || k.startsWith("data-sveltekit")) continue;
        const v = attrs[k].replace(/\s+/g, " ").trim();
        out[k] = URLISH.has(k) ? stripVersion(v) : v;
    }
    return out;
};

export const roundBox = (b: { x: number; y: number; width: number; height: number } | null): ObservedBox | null =>
    b && (b.width > 0 || b.height > 0) ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null;

/** Hosts whose paths depend on which glyphs the page uses (web font subsets): requests to them are reported as one "origin/*" entry. */
export const COLLAPSE_HOSTS = new Set(["fonts.gstatic.com"]);

/** "http://127.0.0.1:4000/nq.css?v=ab12" to "/nq.css" for the page's own origin; other origins keep scheme, host and path, with the query dropped. */
export const normaliseRequestUrl = (url: string, ownOrigins: string[]): string => {
    let u: URL;
    try { u = new URL(url); } catch { return url.slice(0, 80); }
    if (u.protocol === "data:") return "data:";
    if (ownOrigins.includes(u.origin)) return u.pathname + (u.search ? stripVersion(u.search) : "");
    if (COLLAPSE_HOSTS.has(u.hostname)) return `${u.origin}/*`;
    return `${u.origin}${u.pathname}`;
};

export const isExternal = (url: string, ownOrigins: string[]): boolean => {
    try { const u = new URL(url); return u.protocol !== "data:" && u.protocol !== "about:" && u.protocol !== "blob:" && !ownOrigins.includes(u.origin); } catch { return false; }
};

export interface RawEl {
    tag: string;
    attrs: Record<string, string>;
    classes: string[];
    box: { x: number; y: number; width: number; height: number } | null;
    computed: Record<string, string>;
    text: string;
    visible: boolean;
}
export interface RawObserved {
    scroll: { x: number; y: number };
    focus: string;
    elements: Record<string, { count: number; items: RawEl[] }>;
}

export const normaliseObserved = (raw: RawObserved, spec: ObserveSpec): Observed => {
    const elements: Observed["elements"] = {};
    for (const [sel, group] of Object.entries(raw.elements)) {
        elements[sel] = {
            count: group.count,
            items: group.items.map((e) => ({
                tag: e.tag.toLowerCase(),
                attrs: normaliseAttrs(e.attrs),
                classes: normaliseClasses(e.classes, spec.classes ?? true),
                box: spec.box === false ? null : roundBox(e.box),
                computed: Object.fromEntries(Object.entries(e.computed).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => [k, normaliseCssValue(v)])),
                text: spec.text === false ? "" : normaliseText(e.text, spec.textMax ?? 120),
                visible: e.visible,
            })),
        };
    }
    return { scroll: { x: Math.round(raw.scroll.x), y: Math.round(raw.scroll.y) }, focus: raw.focus, elements };
};

// ---- in-page collector (serialised with toString, so it must be self-contained) ----

/* eslint-disable */
export function inPageObserve(spec: { selectors: string[]; attrs: string[]; computed: string[]; limit: number }): RawObserved {
    const wanted = (name: string) => spec.attrs.some((a) => (a.endsWith("*") ? name.startsWith(a.slice(0, -1)) : name === a));
    const describe = (el: Element | null): string => {
        if (!el || el === document.body || el === document.documentElement) return "body";
        const cls = (el.getAttribute("class") || "").split(/\s+/).filter((c) => c && !/^svelte-[a-z0-9]+$/.test(c))[0];
        return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (cls ? "." + cls : "");
    };
    const elements: RawObserved["elements"] = {};
    for (const sel of spec.selectors) {
        let list: Element[] = [];
        try { list = Array.from(document.querySelectorAll(sel)); } catch { list = []; }
        elements[sel] = {
            count: list.length,
            items: list.slice(0, spec.limit).map((el) => {
                const attrs: Record<string, string> = {};
                for (const a of Array.from(el.attributes)) if (wanted(a.name)) attrs[a.name] = a.value;
                const r = el.getBoundingClientRect();
                const cs = getComputedStyle(el);
                const computed: Record<string, string> = {};
                for (const p of spec.computed) computed[p] = cs.getPropertyValue(p);
                const area = r.width > 0 && r.height > 0;
                return {
                    tag: el.tagName,
                    attrs,
                    classes: (el.getAttribute("class") || "").split(/\s+/).filter(Boolean),
                    box: { x: r.x, y: r.y, width: r.width, height: r.height },
                    computed,
                    text: ((el as HTMLElement).innerText ?? el.textContent ?? "") as string,
                    visible: area && cs.visibility !== "hidden" && cs.display !== "none",
                };
            }),
        };
    }
    return { scroll: { x: window.scrollX, y: window.scrollY }, focus: describe(document.activeElement), elements };
}
/* eslint-enable */

/** Takes the snapshot of `page` described by `spec`. */
export const observe = async (page: Page, spec: ObserveSpec): Promise<Observed> => {
    const arg = { selectors: spec.selectors ?? [], attrs: spec.attrs ?? [], computed: spec.computed ?? [], limit: spec.limit ?? 30 };
    const raw = await page.eval<RawObserved>(`(${inPageObserve.toString()})(${JSON.stringify(arg)})`);
    const out = normaliseObserved(raw, spec);
    if (spec.storage) {
        const read = async (kind: "localStorage" | "sessionStorage", keys: string[] = []) => {
            const o: Record<string, string | null> = {};
            for (const k of keys) o[k] = await page.eval<string | null>(`(() => { try { return ${kind}.getItem(${JSON.stringify(k)}); } catch (e) { return "unavailable"; } })()`);
            return o;
        };
        out.storage = { local: await read("localStorage", spec.storage.local), session: await read("sessionStorage", spec.storage.session) };
    }
    if (spec.evals) {
        out.evals = {};
        for (const [name, expr] of Object.entries(spec.evals)) {
            try { out.evals[name] = await page.eval(expr); } catch (e) { out.evals[name] = `error: ${(e as Error).message}`; }
        }
    }
    if (spec.requests) {
        const own = page.ownOrigins();
        const urls = page.requests().map((r) => r.url).filter((u) => !u.startsWith("data:") && (spec.requests === "all" || isExternal(u, own)));
        out.requests = [...new Set(urls.map((u) => normaliseRequestUrl(u, own)))].sort();
    }
    if (spec.console) out.console = [...new Set(page.consoleMessages().map((m) => `${m.type}: ${normaliseText(m.text, 200)}`))].sort();
    return out;
};
