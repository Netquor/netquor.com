// compare.ts: compares the facts of a legacy page with those of its Svelte version, applies the page's allowlist, and formats a concise report.
import { isDeepStrictEqual } from "node:util";
import { referencedIds, type PageFacts } from "./extract";

export const CATEGORIES = ["text", "links", "meta", "jsonld", "assets", "ids"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface AllowEntry { match: string; reason: string }
/** One page's allowlist: per category, the items (as the report prints them, without the +/- sign) that may differ, each with a reason. match "*" allows the whole category. */
export type PageAllow = Partial<Record<Category, AllowEntry[]>>;

export interface Diff { op: "-" | "+"; item: string }
export interface CategoryResult { category: Category; diffs: Diff[]; allowed: Diff[]; note?: string }
export interface Report { results: CategoryResult[]; staleAllow: { category: Category; match: string }[]; ok: boolean }

/** Longest-common-subsequence diff of two lists of strings: "-" only in a, "+" only in b, in order. Equal runs at both ends are trimmed first. */
export const diffSeq = (a: string[], b: string[]): Diff[] => {
    let lo = 0;
    while (lo < a.length && lo < b.length && a[lo] === b[lo]) lo++;
    let ea = a.length, eb = b.length;
    while (ea > lo && eb > lo && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
    const x = a.slice(lo, ea), y = b.slice(lo, eb);
    if (x.length === 0) return y.map((item) => ({ op: "+", item }));
    if (y.length === 0) return x.map((item) => ({ op: "-", item }));
    const w = y.length + 1;
    const t = new Uint32Array((x.length + 1) * w);
    for (let i = x.length - 1; i >= 0; i--) for (let j = y.length - 1; j >= 0; j--) t[i * w + j] = x[i] === y[j] ? t[(i + 1) * w + j + 1] + 1 : Math.max(t[(i + 1) * w + j], t[i * w + j + 1]);
    const out: Diff[] = [];
    let i = 0, j = 0;
    while (i < x.length && j < y.length) {
        if (x[i] === y[j]) { i++; j++; } else if (t[(i + 1) * w + j] >= t[i * w + j + 1]) out.push({ op: "-", item: x[i++] }); else out.push({ op: "+", item: y[j++] });
    }
    while (i < x.length) out.push({ op: "-", item: x[i++] });
    while (j < y.length) out.push({ op: "+", item: y[j++] });
    return out;
};

/** Multiset difference: order does not matter, repeats do. */
export const diffBag = (a: string[], b: string[]): Diff[] => {
    const count = new Map<string, number>();
    for (const s of a) count.set(s, (count.get(s) ?? 0) + 1);
    const extra: string[] = [];
    for (const s of b) { const c = count.get(s) ?? 0; if (c > 0) count.set(s, c - 1); else extra.push(s); }
    const out: Diff[] = [];
    for (const s of a) { const c = count.get(s) ?? 0; if (c > 0) { out.push({ op: "-", item: s }); count.set(s, c - 1); } }
    for (const s of extra) out.push({ op: "+", item: s });
    return out;
};

export interface CompareInput {
    legacy: PageFacts;
    svelte: PageFacts;
    /** Text of the legacy page's local external scripts, to find the ids they look up (inline scripts come from the facts). */
    legacyScriptTexts?: string[];
    allow?: PageAllow;
}

const short = (s: string, n = 140) => (s.length > n ? `${s.slice(0, n - 1)}...` : s);

const jsonLdDiffs = (a: unknown[], b: unknown[], aBad: number[], bBad: number[]): Diff[] => {
    const out: Diff[] = [];
    for (const i of aBad) out.push({ op: "-", item: `jsonld[${i}] is not valid JSON (legacy)` });
    for (const i of bBad) out.push({ op: "+", item: `jsonld[${i}] is not valid JSON (svelte)` });
    if (a.length !== b.length) out.push({ op: a.length > b.length ? "-" : "+", item: `jsonld block count: legacy ${a.length}, svelte ${b.length}` });
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (isDeepStrictEqual(a[i], b[i])) continue;
        const where = firstDifference(a[i], b[i], "");
        out.push({ op: "-", item: `jsonld[${i}] ${where.path || "(root)"}: ${short(JSON.stringify(where.a) ?? "undefined", 100)}` });
        out.push({ op: "+", item: `jsonld[${i}] ${where.path || "(root)"}: ${short(JSON.stringify(where.b) ?? "undefined", 100)}` });
    }
    return out;
};

/** The first JSON pointer where two parsed values differ. */
export const firstDifference = (a: unknown, b: unknown, path: string): { path: string; a: unknown; b: unknown } => {
    if (Array.isArray(a) && Array.isArray(b)) {
        for (let i = 0; i < Math.max(a.length, b.length); i++) if (!isDeepStrictEqual(a[i], b[i])) return firstDifference(a[i], b[i], `${path}/${i}`);
    } else if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a) && !Array.isArray(b)) {
        const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
        for (const k of keys) if (!isDeepStrictEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return firstDifference((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}/${k}`);
    }
    return { path, a, b };
};

export const compareFacts = (i: CompareInput): Report => {
    const { legacy: L, svelte: S } = i;
    const raw: Record<Category, { diffs: Diff[]; note?: string }> = {
        text: { diffs: diffSeq(L.blocks, S.blocks) },
        links: { diffs: diffSeq(L.links, S.links) },
        meta: { diffs: diffBag(L.meta, S.meta) },
        jsonld: { diffs: jsonLdDiffs(L.jsonLd, S.jsonLd, L.jsonLdInvalid, S.jsonLdInvalid) },
        assets: { diffs: diffSeq(L.assets, S.assets) },
        ids: { diffs: [] },
    };
    // Ids: the ids the legacy page's own scripts look up AND the legacy page has; each must exist in the Svelte page.
    const wanted = referencedIds([...L.inlineScripts, ...(i.legacyScriptTexts ?? [])]);
    const needed = [...wanted].filter((id) => L.ids.has(id)).sort();
    raw.ids.diffs = needed.filter((id) => !S.ids.has(id)).map((id) => ({ op: "-" as const, item: `#${id} (used by scripts) is missing from the Svelte page` }));
    raw.ids.note = `${needed.length} ids used by scripts`;

    const staleAllow: Report["staleAllow"] = [];
    const results: CategoryResult[] = CATEGORIES.map((category) => {
        const entries = i.allow?.[category] ?? [];
        const used = new Set<number>();
        const diffs: Diff[] = [], allowed: Diff[] = [];
        for (const d of raw[category].diffs) {
            const hit = entries.findIndex((e) => e.match === "*" || e.match === d.item);
            if (hit >= 0) { used.add(hit); allowed.push(d); } else diffs.push(d);
        }
        entries.forEach((e, idx) => { if (!used.has(idx)) staleAllow.push({ category, match: e.match }); });
        return { category, diffs, allowed, note: raw[category].note };
    });
    return { results, staleAllow, ok: results.every((r) => r.diffs.length === 0) };
};

/** A concise report: one line per category, then the differences ("-" legacy only, "+" Svelte only), at most `max` lines per category. */
export const formatReport = (page: string, r: Report, max = 30): string => {
    const lines: string[] = [`${page}: ${r.ok ? "PASS" : "FAIL"}`];
    for (const c of r.results) {
        const allowed = c.allowed.length ? ` (${c.allowed.length} allowed)` : "";
        lines.push(`  ${c.diffs.length === 0 ? "ok  " : "FAIL"} ${c.category}${allowed}${c.note ? `: ${c.note}` : ""}`);
        c.diffs.slice(0, max).forEach((d, k) => {
            const prev = c.diffs[k - 1];
            const spaceOnly = d.op === "+" && prev?.op === "-" && prev.item.replace(/\s+/g, "") === d.item.replace(/\s+/g, "");
            lines.push(`       ${d.op} ${short(d.item, 200)}${spaceOnly ? "   (differs from the line above only in whitespace)" : ""}`);
        });
        if (c.diffs.length > max) lines.push(`       ... ${c.diffs.length - max} more`);
    }
    for (const s of r.staleAllow) lines.push(`  note: allowlist entry for ${s.category} matches nothing now: ${short(s.match, 80)}`);
    return lines.join("\n");
};
