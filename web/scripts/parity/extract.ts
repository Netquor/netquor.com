// extract.ts: reads the facts the parity check compares out of one HTML document: the visible text as blocks, links and images in order, metadata, JSON-LD, external scripts and stylesheets, element ids and the ids scripts look up. A small tolerant tokenizer, not a full HTML parser: enough for pages we write ourselves and for SvelteKit's server output.

export interface Tag { name: string; attrs: Map<string, string>; selfClosing: boolean }
export type Token =
    | { kind: "open"; tag: Tag; raw?: string }
    | { kind: "close"; name: string }
    | { kind: "text"; text: string };

const RAW_TEXT = new Set(["script", "style", "textarea", "title"]);

const ENTITIES: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", copy: "©", reg: "®", trade: "™", middot: "·", bull: "•", hellip: "…",
    mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", times: "×", divide: "÷",
    larr: "←", rarr: "→", uarr: "↑", darr: "↓", check: "✓", deg: "°", plusmn: "±", frac12: "½", euro: "€", pound: "£", cent: "¢",
    shy: "­", thinsp: " ", ensp: " ", emsp: " ", zwj: "‍", zwnj: "‌", ne: "≠", le: "≤", ge: "≥", infin: "∞", sect: "§", para: "¶",
};

export const decodeEntities = (s: string): string =>
    s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, body: string) => {
        if (body[0] === "#") {
            const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
            try { return String.fromCodePoint(code); } catch { return m; }
        }
        return ENTITIES[body] ?? ENTITIES[body.toLowerCase()] ?? m;
    });

/** Reads one start tag whose "<" is at `lt`. Returns the tag and the index after its ">". Handles quoted attribute values holding ">". */
const readTag = (html: string, lt: number): { tag: Tag; end: number } | null => {
    const nameMatch = /^[a-zA-Z][a-zA-Z0-9:_-]*/.exec(html.slice(lt + 1, lt + 64));
    if (!nameMatch) return null;
    const attrs = new Map<string, string>();
    let i = lt + 1 + nameMatch[0].length;
    const n = html.length;
    let selfClosing = false;
    while (i < n) {
        while (i < n && /\s/.test(html[i])) i++;
        if (html[i] === ">") return { tag: { name: nameMatch[0].toLowerCase(), attrs, selfClosing }, end: i + 1 };
        if (html[i] === "/") { selfClosing = html[i + 1] === ">"; i++; continue; }
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
        if (!attrs.has(name)) attrs.set(name, decodeEntities(value));
    }
    return null;
};

export const tokenize = (html: string): Token[] => {
    const out: Token[] = [];
    let i = 0;
    const n = html.length;
    const text = (from: number, to: number) => { if (to > from) out.push({ kind: "text", text: html.slice(from, to) }); };
    while (i < n) {
        const lt = html.indexOf("<", i);
        if (lt < 0) { text(i, n); break; }
        text(i, lt);
        if (html.startsWith("<!--", lt)) { const e = html.indexOf("-->", lt + 4); i = e < 0 ? n : e + 3; continue; }
        if (html[lt + 1] === "!" || html[lt + 1] === "?") { const e = html.indexOf(">", lt); i = e < 0 ? n : e + 1; continue; }
        if (html[lt + 1] === "/") {
            const m = /^<\/([a-zA-Z][a-zA-Z0-9:_-]*)[^>]*>/.exec(html.slice(lt, lt + 200));
            if (m) { out.push({ kind: "close", name: m[1].toLowerCase() }); i = lt + m[0].length; continue; }
            text(lt, lt + 1); i = lt + 1; continue;
        }
        const t = readTag(html, lt);
        if (!t) { text(lt, lt + 1); i = lt + 1; continue; }
        if (RAW_TEXT.has(t.tag.name) && !t.tag.selfClosing) {
            const close = new RegExp(`</${t.tag.name}\\s*>`, "i");
            const rest = html.slice(t.end);
            const m = close.exec(rest);
            const body = m ? rest.slice(0, m.index) : rest;
            out.push({ kind: "open", tag: t.tag, raw: body });
            out.push({ kind: "close", name: t.tag.name });
            i = t.end + (m ? m.index + m[0].length : rest.length);
            continue;
        }
        out.push({ kind: "open", tag: t.tag });
        i = t.end;
    }
    return out;
};

// ---- visible text ----

const SKIP = new Set(["script", "style", "noscript", "template", "head", "title"]);
const BREAKS = new Set([
    "address", "article", "aside", "blockquote", "body", "br", "caption", "dd", "details", "div", "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6",
    "header", "hr", "li", "main", "nav", "ol", "option", "p", "pre", "section", "select", "summary", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul", "button", "label", "textarea", "iframe", "html",
]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

export const normalizeText = (s: string): string => decodeEntities(s).replace(/[\s ]+/g, " ").trim();

/** The visible text as blocks: script, style, noscript, template and the head are removed, a block level tag or <br> ends a block, whitespace is collapsed and entities decoded. */
export const textBlocks = (tokens: Token[]): string[] => {
    const blocks: string[] = [];
    let cur = "";
    const flush = () => { const t = normalizeText(cur); if (t) blocks.push(t); cur = ""; };
    const skipStack: string[] = [];
    for (const t of tokens) {
        if (t.kind === "open") {
            const name = t.tag.name;
            if (SKIP.has(name) && !VOID.has(name)) { if (!t.tag.selfClosing) skipStack.push(name); continue; }
            if (skipStack.length === 0 && BREAKS.has(name)) flush();
        } else if (t.kind === "close") {
            if (skipStack.length && skipStack[skipStack.length - 1] === t.name) { skipStack.pop(); continue; }
            if (skipStack.length === 0 && BREAKS.has(t.name)) flush();
        } else if (skipStack.length === 0) cur += t.text;
    }
    flush();
    return blocks;
};

// ---- facts ----

export interface PageFacts {
    blocks: string[];
    /** "a:<href>" and "img:<src>" in document order, relative URLs resolved against the page. */
    links: string[];
    /** "title = ...", "canonical = ...", "name:x = content", "property:x = content". */
    meta: string[];
    jsonLd: unknown[];
    /** JSON-LD scripts whose text is not valid JSON (index into the blocks). */
    jsonLdInvalid: number[];
    /** "script:<url>" and "stylesheet:<url>" in order, ?v= removed, relative URLs resolved. SvelteKit's own /_app/ files are not listed. */
    assets: string[];
    /** Every id attribute in the body. */
    ids: Set<string>;
    /** Text of scripts with no src (JSON-LD and importmap excluded). */
    inlineScripts: string[];
    /** Same-origin script sources as the page wrote them (resolved), for reading their text. */
    localScriptSrcs: string[];
}

const BASE = "http://parity.invalid";

/** Resolves a URL as written in a page at `pagePath` ("/fleet.html"); URLs on the page's own fake origin come back as path+query+hash (with /index.html as /), others as written. */
export const resolveUrl = (value: string, pagePath: string): string => {
    const v = value.trim();
    if (v === "" || /^(mailto:|tel:|javascript:|data:|#)/i.test(v)) return v;
    try {
        const u = new URL(v, BASE + pagePath);
        // /index.html is a 301 to /, so the two are the same link.
        return u.origin === BASE ? (u.pathname === "/index.html" ? "/" : u.pathname) + u.search + u.hash : u.href;
    } catch { return v; }
};

const withoutVersion = (url: string): string => {
    const q = url.indexOf("?");
    if (q < 0) return url;
    const hashAt = url.indexOf("#", q);
    const search = new URLSearchParams(url.slice(q + 1, hashAt < 0 ? undefined : hashAt));
    search.delete("v");
    const rest = search.toString();
    return url.slice(0, q) + (rest ? `?${rest}` : "") + (hashAt < 0 ? "" : url.slice(hashAt));
};

export const isInternalAsset = (url: string): boolean => url.startsWith("/_app/");

export const extractFacts = (html: string, pagePath: string): PageFacts => {
    const tokens = tokenize(html);
    const facts: PageFacts = { blocks: textBlocks(tokens), links: [], meta: [], jsonLd: [], jsonLdInvalid: [], assets: [], ids: new Set(), inlineScripts: [], localScriptSrcs: [] };
    let inBody = false;
    for (const t of tokens) {
        if (t.kind !== "open") continue;
        const { name, attrs } = t.tag;
        if (name === "body") inBody = true;
        if (inBody && attrs.has("id")) facts.ids.add(attrs.get("id") as string);
        if (name === "a" && attrs.has("href")) facts.links.push(`a:${resolveUrl(attrs.get("href") as string, pagePath)}`);
        else if (name === "img" && attrs.has("src")) facts.links.push(`img:${resolveUrl(attrs.get("src") as string, pagePath)}`);
        else if (name === "title" && t.raw !== undefined && !inBody) facts.meta.push(`title = ${normalizeText(t.raw)}`);
        else if (name === "meta") {
            const content = attrs.get("content") ?? "";
            if (attrs.has("name")) facts.meta.push(`name:${(attrs.get("name") as string).toLowerCase()} = ${normalizeText(content)}`);
            else if (attrs.has("property")) facts.meta.push(`property:${(attrs.get("property") as string).toLowerCase()} = ${normalizeText(content)}`);
        } else if (name === "link") {
            const rel = (attrs.get("rel") ?? "").toLowerCase().split(/\s+/);
            const href = resolveUrl(attrs.get("href") ?? "", pagePath);
            if (rel.includes("canonical")) facts.meta.push(`canonical = ${href}`);
            else if (rel.includes("stylesheet") && !isInternalAsset(href)) facts.assets.push(`stylesheet:${withoutVersion(href)}`);
        } else if (name === "script") {
            const type = (attrs.get("type") ?? "").toLowerCase();
            if (attrs.has("src")) {
                const src = resolveUrl(attrs.get("src") as string, pagePath);
                if (!isInternalAsset(src)) {
                    facts.assets.push(`script:${withoutVersion(src)}`);
                    if (src.startsWith("/")) facts.localScriptSrcs.push(src.split(/[?#]/)[0]);
                }
            } else if (type === "application/ld+json") {
                try { facts.jsonLd.push(JSON.parse(t.raw ?? "")); } catch { facts.jsonLdInvalid.push(facts.jsonLd.length + facts.jsonLdInvalid.length); }
            } else if (type !== "importmap" && type !== "speculationrules" && (t.raw ?? "").trim()) facts.inlineScripts.push(t.raw as string);
        }
    }
    return facts;
};

/** Ids that script text looks up: getElementById("x"), querySelector("#x .y"), querySelectorAll, closest, matches, and [id="x"]. Ids with ${} in them are skipped. */
export const referencedIds = (scripts: string[]): Set<string> => {
    const out = new Set<string>();
    const add = (id: string | undefined) => { if (id && /^[A-Za-z_][\w-]*$/.test(id)) out.add(id); };
    for (const js of scripts) {
        for (const m of js.matchAll(/getElementById\(\s*(["'`])([^"'`$]*)\1\s*\)/g)) add(m[2]);
        for (const m of js.matchAll(/\b(?:querySelector(?:All)?|closest|matches)\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g)) {
            for (const h of m[2].matchAll(/#([A-Za-z_][\w-]*)/g)) add(h[1]);
            for (const h of m[2].matchAll(/\[id\s*=\s*["']?([\w-]+)["']?\]/g)) add(h[1]);
        }
    }
    return out;
};
