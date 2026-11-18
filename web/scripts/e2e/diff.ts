// diff.ts: compares two traces (one per site) and applies the per-scenario allowlist. Pure: no browser, no I/O. Tested in diff.test.ts.
import type { Observed } from "./observe";

export interface StepSnapshot { name: string; observed?: Observed; error?: string; /** How long the step and its snapshot took; informational, never compared. */ ms?: number }
export type Trace = StepSnapshot[];

export interface Diff { path: string; legacy: unknown; svelte: unknown }
export interface AllowEntry {
    /** Matches the diff path printed in the report, e.g. `after click :: .nq-dd-btn[0].attrs.aria-expanded`. `*` matches any run of characters (including none). */
    path: string;
    /** Why the difference is intended. Required. */
    reason: string;
}

export interface DiffOptions {
    /** Pixels of slack for numbers under a `.box.` path (default 1). */
    tolerance?: number;
    /** Pixels of slack for the scroll position (default 2: pages that differ by a sub-pixel in height land one pixel apart after an anchor jump). */
    scrollTolerance?: number;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const valueDiff = (a: unknown, b: unknown, path: string, tol: number, out: Diff[], scrollTol = 2): void => {
    if (typeof a === "number" && typeof b === "number" && /(^| :: )scroll\.[xy]$/.test(path)) {
        if (Math.abs(a - b) > scrollTol) out.push({ path, legacy: a, svelte: b });
        return;
    }
    if (typeof a === "number" && typeof b === "number" && /\.box\./.test(path)) {
        if (Math.abs(a - b) > tol) out.push({ path, legacy: a, svelte: b });
        return;
    }
    if (isObj(a) && isObj(b)) {
        for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
            const p = path ? `${path}.${k}` : k;
            if (!(k in a)) out.push({ path: p, legacy: undefined, svelte: b[k] });
            else if (!(k in b)) out.push({ path: p, legacy: a[k], svelte: undefined });
            else valueDiff(a[k], b[k], p, tol, out, scrollTol);
        }
        return;
    }
    if (!sameJson(a, b)) out.push({ path, legacy: a, svelte: b });
};

/** Diffs one snapshot pair. Elements are keyed by selector and index so a diff reads `.nq-dd-btn[0].attrs.aria-expanded`. */
export const diffObserved = (step: string, a: Observed, b: Observed, o: DiffOptions = {}): Diff[] => {
    const tol = o.tolerance ?? 1;
    const out: Diff[] = [];
    const pre = (p: string) => `${step} :: ${p}`;
    valueDiff(a.scroll, b.scroll, pre("scroll"), tol, out, o.scrollTolerance ?? 2);
    if (a.focus !== b.focus) out.push({ path: pre("focus"), legacy: a.focus, svelte: b.focus });
    for (const sel of [...new Set([...Object.keys(a.elements), ...Object.keys(b.elements)])]) {
        const ga = a.elements[sel], gb = b.elements[sel];
        if (!ga || !gb) { out.push({ path: pre(`${sel}`), legacy: ga ? `${ga.count} found` : undefined, svelte: gb ? `${gb.count} found` : undefined }); continue; }
        if (ga.count !== gb.count) out.push({ path: pre(`${sel}.count`), legacy: ga.count, svelte: gb.count });
        const n = Math.max(ga.items.length, gb.items.length);
        for (let i = 0; i < n; i++) {
            const ea = ga.items[i], eb = gb.items[i];
            const base = pre(`${sel}[${i}]`);
            if (!ea || !eb) { if (ga.count === gb.count) out.push({ path: base, legacy: ea ? "present" : "missing", svelte: eb ? "present" : "missing" }); continue; }
            valueDiff(ea, eb, base, tol, out);
        }
    }
    for (const k of ["storage", "evals", "requests", "console"] as const) {
        if (a[k] === undefined && b[k] === undefined) continue;
        valueDiff(a[k], b[k], pre(k), tol, out);
    }
    return out;
};

/** Diffs two traces step by step. A step that errored on one side only, or on different messages, is a diff of its own. */
export const diffTraces = (legacy: Trace, svelte: Trace, o: DiffOptions = {}): Diff[] => {
    const out: Diff[] = [];
    const n = Math.max(legacy.length, svelte.length);
    for (let i = 0; i < n; i++) {
        const a = legacy[i], b = svelte[i];
        const name = (a ?? b).name;
        if (!a || !b) { out.push({ path: `${name} :: step`, legacy: a ? "ran" : "did not run", svelte: b ? "ran" : "did not run" }); continue; }
        if (a.name !== b.name) { out.push({ path: `step ${i + 1} :: name`, legacy: a.name, svelte: b.name }); continue; }
        if (a.error !== b.error) { out.push({ path: `${name} :: error`, legacy: a.error, svelte: b.error }); continue; }
        if (a.observed && b.observed) out.push(...diffObserved(name, a.observed, b.observed, o));
    }
    return out;
};

export const globToRegExp = (glob: string): RegExp =>
    new RegExp("^" + glob.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");

/** Throws on an entry without a path or without a reason: an unexplained difference is a bug, not an allowance. */
export const validateAllow = (entries: AllowEntry[], where = "allowlist"): void => {
    for (const e of entries) {
        if (!e || typeof e.path !== "string" || !e.path.trim()) throw new Error(`${where}: an entry has no path`);
        if (typeof e.reason !== "string" || e.reason.trim().length < 8) throw new Error(`${where}: the entry "${e.path}" needs a reason (at least a short sentence)`);
    }
};

export interface Applied { remaining: Diff[]; allowed: { diff: Diff; entry: AllowEntry }[]; unused: AllowEntry[] }

/** Splits diffs into those still failing and those an allow entry explains. An entry that matched nothing is returned as unused so the list does not collect dead entries. */
export const applyAllow = (diffs: Diff[], allow: AllowEntry[] = []): Applied => {
    validateAllow(allow);
    const res = allow.map((e) => ({ e, re: globToRegExp(e.path), hits: 0 }));
    const remaining: Diff[] = [];
    const allowed: Applied["allowed"] = [];
    for (const d of diffs) {
        const hit = res.find((r) => r.re.test(d.path));
        if (hit) { hit.hits++; allowed.push({ diff: d, entry: hit.e }); } else remaining.push(d);
    }
    return { remaining, allowed, unused: res.filter((r) => r.hits === 0).map((r) => r.e) };
};

const show = (v: unknown): string => (v === undefined ? "(absent)" : typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v));

const setNote = (a: unknown, b: unknown): string => {
    if (!Array.isArray(a) || !Array.isArray(b)) return "";
    const onlyA = a.filter((x) => !b.some((y) => sameJson(x, y))), onlyB = b.filter((x) => !a.some((y) => sameJson(x, y)));
    const parts = [onlyA.length ? `only legacy: ${onlyA.map(show).join(", ")}` : "", onlyB.length ? `only svelte: ${onlyB.map(show).join(", ")}` : ""].filter(Boolean);
    return parts.length ? `\n      ${parts.join("; ")}` : "";
};

export const formatDiff = (d: Diff): string => `  ${d.path}\n    - legacy: ${show(d.legacy)}\n    + svelte: ${show(d.svelte)}${setNote(d.legacy, d.svelte)}`;

export interface ScenarioReport {
    name: string;
    steps: number;
    diffs: Diff[];
    allowed: { diff: Diff; entry: AllowEntry }[];
    unused: AllowEntry[];
    errors: string[];
}

export const reportOk = (r: ScenarioReport): boolean => r.diffs.length === 0 && r.errors.length === 0;

export const formatReport = (r: ScenarioReport): string => {
    const lines = [`${r.name}: ${reportOk(r) ? "ok" : "FAIL"} (${r.steps} steps, ${r.allowed.length} allowed difference${r.allowed.length === 1 ? "" : "s"})`];
    if (r.errors.length) lines.push("  errors:", ...r.errors.map((e) => `    ${e}`));
    if (r.diffs.length) lines.push(`  ${r.diffs.length} difference${r.diffs.length === 1 ? "" : "s"} (- legacy, + svelte):`, ...r.diffs.map(formatDiff));
    if (r.allowed.length) {
        const reasons = new Map<string, number>();
        for (const a of r.allowed) reasons.set(`${a.entry.path}: ${a.entry.reason}`, (reasons.get(`${a.entry.path}: ${a.entry.reason}`) ?? 0) + 1);
        lines.push("  allowed:", ...[...reasons].map(([k, n]) => `    ${k} (${n})`));
    }
    if (r.unused.length) lines.push("  note: allow entries that matched nothing (remove them):", ...r.unused.map((u) => `    ${u.path}`));
    return lines.join("\n");
};
