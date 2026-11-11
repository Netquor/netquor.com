// catalog.ts: prices from the Netquor API price catalog (NETQUOR_CATALOG_URL, e.g. https://api.netquor.com). Pure functions plus injected fetch and clock, so the worker (backup poll) and the web process (when the API nudges it) share one implementation.
//   parseCatalogMap   validates server/data/catalog-map.json (which site keys are catalog-managed, and the derivation rule of each).
//   createCatalogPuller  one conditional GET per product (ETag), 10 s timeout, byte-capped stream, https only (http to loopback for tests), Retry-After honoured; a failing product never blocks another.
//   buildCandidate    the current snapshot plus the books gives the next snapshot (version + 1) only when a catalog-managed price actually changed. It never deletes a key, never adds a key that is not in the map, and never invents a price: the web ingest guards still apply to what it returns.
import { readBodyCapped } from "./pull";
import { KEY_PATTERN, MAX_CENTS } from "./snapshot";
import type { PriceEntry, Snapshot } from "./types";
import { validateServiceUrl } from "./url";

export const CATALOG_USER_AGENT = "netquor-web-worker";
export const DEFAULT_CATALOG_PRODUCTS = ["netquor-fleet", "netquor-phone"];
export const DEFAULT_CATALOG_INTERVAL_SECONDS = 300;
export const MAX_BOOK_BYTES = 512 * 1024;
const PRODUCT_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_RETRY_AFTER_MS = 3_600_000;
const DEFAULT_RETRY_AFTER_MS = 60_000;

// ---- the map ----

export type MapRule = "flat_micros" | "fleet_month" | "fleet_year" | "fleet_lifetime" | "fleet_dedicated";
export interface MapEntry { product: string; sku: string; rule: MapRule; kind?: string; field?: "setupCents" | "yearlyCents" | "monthlyCents" }
export interface CatalogMap { keys: Record<string, MapEntry>; manual: string[] }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const RULES: MapRule[] = ["flat_micros", "fleet_month", "fleet_year", "fleet_lifetime", "fleet_dedicated"];
const FIELDS = ["setupCents", "yearlyCents", "monthlyCents"];

/** Validates the map file's content; throws one Error listing every problem. */
export const parseCatalogMap = (input: unknown): CatalogMap => {
    const problems: string[] = [];
    const keys: Record<string, MapEntry> = {};
    if (!isObject(input) || input.schema !== 1) problems.push("the map must be an object with schema 1");
    const raw = isObject(input) && isObject(input.keys) ? input.keys : null;
    if (!raw) problems.push("keys must be an object");
    for (const [key, e] of Object.entries(raw ?? {})) {
        if (!KEY_PATTERN.test(key)) { problems.push(`${key}: not a valid price key`); continue; }
        if (!isObject(e)) { problems.push(`${key}: must be an object`); continue; }
        const before = problems.length;
        const { product, sku, rule, kind, field } = e;
        if (typeof product !== "string" || !PRODUCT_PATTERN.test(product)) problems.push(`${key}: product is not a valid product id`);
        if (typeof sku !== "string" || !sku || sku.length > 120) problems.push(`${key}: sku must be text`);
        if (typeof rule !== "string" || !RULES.includes(rule as MapRule)) problems.push(`${key}: rule must be one of ${RULES.join(", ")}`);
        if (["fleet_month", "fleet_year", "fleet_lifetime"].includes(rule as string) && (typeof kind !== "string" || !kind)) problems.push(`${key}: ${String(rule)} needs a kind`);
        if (rule === "fleet_dedicated" && !FIELDS.includes(field as string)) problems.push(`${key}: fleet_dedicated needs field ${FIELDS.join(", ")}`);
        if (problems.length === before) keys[key] = { product: product as string, sku: sku as string, rule: rule as MapRule, ...(typeof kind === "string" ? { kind } : {}), ...(typeof field === "string" ? { field: field as MapEntry["field"] } : {}) };
    }
    if (Object.keys(keys).length === 0 && problems.length === 0) problems.push("the map has no keys");
    const manual = isObject(input) && Array.isArray(input.manual) ? input.manual.filter((m): m is string => typeof m === "string") : [];
    if (problems.length) throw new Error(`catalog map is invalid: ${problems.slice(0, 10).join("; ")}`);
    return { keys, manual };
};

/** The products the map draws on, limited to those the operator configured. */
export const fetchPlan = (map: CatalogMap, configured: string[]): string[] => {
    const inMap = new Set(Object.values(map.keys).map((k) => k.product));
    return configured.filter((p) => inMap.has(p));
};

// ---- books ----

export interface PriceBook { product: string; version: number; checksum: string; status?: string; entries: { sku: string; structure?: unknown }[] }

const asBook = (payload: unknown, product: string): PriceBook | string => {
    let b: unknown = payload;
    if (isObject(b) && !("entries" in b)) b = isObject(b.data) ? b.data : isObject(b.book) ? b.book : b;
    if (!isObject(b) || !Array.isArray(b.entries)) return "the book has no entries";
    if (b.product !== product) return "the book is for another product";
    if (typeof b.version !== "number" || !Number.isSafeInteger(b.version) || b.version < 1) return "the book has no valid version";
    if (b.status !== undefined && b.status !== "published") return `the book is not published (${String(b.status).slice(0, 20)})`;
    const checksum = typeof b.checksum === "string" && b.checksum.length <= 128 ? b.checksum : "";
    return { product, version: b.version, checksum, status: b.status as string | undefined, entries: b.entries.filter(isObject) as PriceBook["entries"] };
};

// ---- the fetch plan ----

export type Fetcher = (url: string, init: { headers: Record<string, string>; signal: AbortSignal; redirect: "error" }) => Promise<Response>;
export type ProductResult =
    | { kind: "changed" | "not_modified" }
    | { kind: "failed"; reason: string }
    | { kind: "rate_limited"; reason: string; retryAfterMs: number };

export interface PullReport {
    /** The book to use per product: fetched now, or (on a 304) the one kept from the last 200. Absent when the product failed. */
    books: Record<string, PriceBook>;
    results: Record<string, ProductResult>;
    /** ISO time each successfully checked product was checked. */
    checkedAt: Record<string, string>;
}

export interface PullerDeps {
    baseUrl: string;
    fetch: Fetcher;
    now: () => number;
    timeoutMs?: number;
    maxBytes?: number;
}

/** Retry-After: seconds or an HTTP date; bounded to an hour; one minute when absent or unreadable. */
export const parseRetryAfter = (header: string | null, nowMs: number): number => {
    if (!header) return DEFAULT_RETRY_AFTER_MS;
    const t = header.trim();
    const ms = /^\d+$/.test(t) ? Number(t) * 1000 : Date.parse(t) - nowMs;
    return Number.isFinite(ms) ? Math.min(MAX_RETRY_AFTER_MS, Math.max(1000, ms)) : DEFAULT_RETRY_AFTER_MS;
};

export const createCatalogPuller = (d: PullerDeps) => {
    const timeoutMs = d.timeoutMs ?? 10_000, maxBytes = d.maxBytes ?? MAX_BOOK_BYTES;
    const etags = new Map<string, string>();
    const kept = new Map<string, PriceBook>();
    const blockedUntil = new Map<string, number>();

    const one = async (product: string, force: boolean, signal?: AbortSignal): Promise<{ result: ProductResult; book?: PriceBook }> => {
        const checked = validateServiceUrl(d.baseUrl);
        if (!checked.ok) return { result: { kind: "failed", reason: `NETQUOR_CATALOG_URL ${checked.reason}` } };
        if (!PRODUCT_PATTERN.test(product)) return { result: { kind: "failed", reason: "not a valid product id" } };
        const wait = (blockedUntil.get(product) ?? 0) - d.now();
        if (wait > 0) return { result: { kind: "rate_limited", reason: "waiting out Retry-After", retryAfterMs: wait } };
        const url = new URL("/v1/catalog/price-books/current", checked.url.origin);
        url.searchParams.set("product", product);
        const headers: Record<string, string> = { accept: "application/json", "user-agent": CATALOG_USER_AGENT };
        const etag = etags.get(product);
        if (!force && etag && kept.has(product)) headers["if-none-match"] = etag;
        const ctl = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs);
        const onAbort = () => ctl.abort();
        signal?.addEventListener("abort", onAbort);
        if (signal?.aborted) ctl.abort();
        try {
            const res = await d.fetch(url.href, { headers, signal: ctl.signal, redirect: "error" });
            if (res.status === 304) {
                await res.body?.cancel().catch(() => {});
                const book = kept.get(product);
                return book ? { result: { kind: "not_modified" }, book } : { result: { kind: "failed", reason: "the API answered 304 to a request without a validator" } };
            }
            if (res.status === 429) {
                await res.body?.cancel().catch(() => {});
                const retryAfterMs = parseRetryAfter(res.headers.get("retry-after"), d.now());
                blockedUntil.set(product, d.now() + retryAfterMs);
                return { result: { kind: "rate_limited", reason: "the API answered 429", retryAfterMs } };
            }
            if (res.status !== 200) { await res.body?.cancel().catch(() => {}); return { result: { kind: "failed", reason: `the API answered ${res.status}` } }; }
            const bytes = await readBodyCapped(res, maxBytes, ctl.signal);
            if (bytes === null) return { result: { kind: "failed", reason: "the answer is too large" } };
            let payload: unknown;
            try { payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return { result: { kind: "failed", reason: "the answer is not UTF-8 JSON" } }; }
            const book = asBook(payload, product);
            if (typeof book === "string") return { result: { kind: "failed", reason: book } };
            kept.set(product, book);
            const tag = res.headers.get("etag");
            if (tag) etags.set(product, tag); else etags.delete(product);
            return { result: { kind: "changed" }, book };
        } catch {
            if (signal?.aborted) return { result: { kind: "failed", reason: "stopped" } };
            return { result: { kind: "failed", reason: timedOut ? `no answer within ${Math.round(timeoutMs / 1000)} s` : "could not reach the API" } };
        } finally { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); }
    };

    return {
        /** Checks every product independently. force: no If-None-Match (a nudge says something changed). */
        async pull(products: string[], o: { force?: boolean; signal?: AbortSignal } = {}): Promise<PullReport> {
            const out = await Promise.all(products.map((p) => one(p, o.force === true, o.signal)));
            const report: PullReport = { books: {}, results: {}, checkedAt: {} };
            const at = new Date(d.now()).toISOString();
            products.forEach((p, i) => {
                report.results[p] = out[i].result;
                if (out[i].book) { report.books[p] = out[i].book!; report.checkedAt[p] = at; }
            });
            return report;
        },
        /** Forgets the validators (the next pull is unconditional). */
        reset() { etags.clear(); },
    };
};
export type CatalogPuller = ReturnType<typeof createCatalogPuller>;

// ---- deriving prices ----

type Derived = { ok: true; cents: number } | { ok: false; reason: string };
const intIn = (v: unknown, lo: number, hi: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi;
const bound = (cents: number, what: string): Derived => (intIn(cents, 0, MAX_CENTS) ? { ok: true, cents } : { ok: false, reason: `${what} is ${cents}, outside 0 to ${MAX_CENTS} cents` });

export const derive = (e: MapEntry, book: PriceBook): Derived => {
    const entry = book.entries.find((x) => x.sku === e.sku);
    if (!entry) return { ok: false, reason: `sku ${e.sku} is not in ${book.product}@${book.version}` };
    const s = isObject(entry.structure) ? entry.structure : null;
    if (!s) return { ok: false, reason: `sku ${e.sku} has no structure` };
    if (e.rule === "flat_micros") {
        const m = s.amountMicros;
        if (s.type !== "flat" || typeof m !== "number" || !Number.isInteger(m) || m < 0) return { ok: false, reason: `sku ${e.sku} is not a flat price with whole amountMicros` };
        if (m % 10_000 !== 0) return { ok: false, reason: `sku ${e.sku} is ${m} micros, which is not a whole number of cents` };
        return bound(m / 10_000, `sku ${e.sku}`);
    }
    const cfg = isObject(s.config) ? s.config : null;
    if (!cfg || s.type !== "engine") return { ok: false, reason: `sku ${e.sku} is not an engine entry with a config` };
    if (e.rule === "fleet_dedicated") {
        const ded = isObject(cfg.dedicated) ? cfg.dedicated : null;
        const v = ded?.[e.field as string];
        return intIn(v, 0, MAX_CENTS) ? { ok: true, cents: v } : { ok: false, reason: `dedicated.${e.field} is missing or not whole cents` };
    }
    const kinds = Array.isArray(cfg.kinds) ? cfg.kinds : [];
    const kind = kinds.find((k) => isObject(k) && k.sku === e.kind) as Record<string, unknown> | undefined;
    if (!kind || !intIn(kind.monthlyCents, 0, MAX_CENTS)) return { ok: false, reason: `kind ${e.kind} has no whole monthlyCents` };
    if (e.rule === "fleet_month") return bound(kind.monthlyCents, `${e.kind} monthly`);
    if (!intIn(cfg.annualMonthsPaid, 1, 12)) return { ok: false, reason: "annualMonthsPaid is missing or not 1 to 12" };
    const year = kind.monthlyCents * cfg.annualMonthsPaid;
    if (e.rule === "fleet_year") return bound(year, `${e.kind} yearly`);
    if (!intIn(cfg.lifetimeAnnualMultiple, 1, 20)) return { ok: false, reason: "lifetimeAnnualMultiple is missing or not 1 to 20" };
    return bound(year * cfg.lifetimeAnnualMultiple, `${e.kind} lifetime`);
};

export interface Change { key: string; product: string; from: number; to: number }
export interface Candidate {
    candidate: Snapshot | null;
    changes: Change[];
    warnings: string[];
    /** The book version and checksum each given book came from. */
    sources: Record<string, { version: number; checksum: string }>;
}

/** The next snapshot, or null when no catalog-managed price changed. A key whose book is missing (the product failed) is left alone silently; a key that cannot be derived is left alone with a warning. Keys the current snapshot lacks are not added (a warning says to add them to the seed). */
export const buildCandidate = (current: Snapshot, books: Record<string, PriceBook | undefined>, map: CatalogMap, o: { now?: Date } = {}): Candidate => {
    const changes: Change[] = [], warnings: string[] = [], sources: Candidate["sources"] = {};
    const next: Record<string, PriceEntry> = { ...current.prices };
    for (const [product, b] of Object.entries(books)) if (b) sources[product] = { version: b.version, checksum: b.checksum };
    for (const key of Object.keys(map.keys).sort()) {
        const e = map.keys[key];
        const book = books[e.product];
        if (!book) continue;
        const cur = current.prices[key];
        if (!cur) { warnings.push(`${key}: not in the current snapshot, so it is not added; add it to the seed first`); continue; }
        const d = derive(e, book);
        if (!d.ok) { warnings.push(`${key}: kept at ${cur.amountCents}: ${d.reason}`); continue; }
        if (d.cents !== cur.amountCents) { changes.push({ key, product: e.product, from: cur.amountCents, to: d.cents }); next[key] = { ...cur, amountCents: d.cents }; }
    }
    if (changes.length === 0) return { candidate: null, changes, warnings, sources };
    return { candidate: { schema: 1, version: current.version + 1, updatedAt: (o.now ?? new Date()).toISOString(), source: "poll", prices: next }, changes, warnings, sources };
};

/** What identifies the book content a candidate was built from; a refusal is remembered under it. */
export const sourcesFingerprint = (s: Record<string, { version: number; checksum: string }>): string =>
    Object.keys(s).sort().map((p) => `${p}@${s[p].version}:${s[p].checksum}`).join(",");

export interface CatalogSource { version: number; checksum: string; fetchedAt: string }

/** Sources from a signed body: only well-formed entries survive. */
export const sanitizeSources = (v: unknown): Record<string, CatalogSource> => {
    const out: Record<string, CatalogSource> = {};
    if (!isObject(v)) return out;
    for (const [p, s] of Object.entries(v).slice(0, 20)) {
        if (!PRODUCT_PATTERN.test(p) || !isObject(s)) continue;
        if (typeof s.version !== "number" || !Number.isSafeInteger(s.version) || s.version < 1) continue;
        if (typeof s.checksum !== "string" || s.checksum.length > 128) continue;
        if (typeof s.fetchedAt !== "string" || s.fetchedAt.length > 40 || Number.isNaN(Date.parse(s.fetchedAt))) continue;
        out[p] = { version: s.version, checksum: s.checksum, fetchedAt: s.fetchedAt };
    }
    return out;
};

/** NETQUOR_CATALOG_PRODUCTS: comma separated product ids; invalid ones are dropped (and returned), duplicates removed. Empty means the default. */
export const parseProducts = (raw: string): { products: string[]; invalid: string[] } => {
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    if (!parts.length) return { products: [...DEFAULT_CATALOG_PRODUCTS], invalid: [] };
    const products = [...new Set(parts.filter((p) => PRODUCT_PATTERN.test(p)))];
    return { products, invalid: parts.filter((p) => !PRODUCT_PATTERN.test(p)) };
};
