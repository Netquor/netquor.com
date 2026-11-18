// nudge.ts: what the web process does when the API says "prices.changed": pull once from PRICING_API_URL itself. Single flight (a nudge that arrives while a pull runs does not start another) and at most one pull per 30 s, so a chatty or hostile sender cannot turn the webhook into a way to hammer the API. Extra nudges are answered at once and folded into ONE trailing pull when the window ends, so a second change is never missed.
import { IngestError, type Ingest } from "./ingest";
import type { PriceCache } from "./cache";
import { buildCandidate, type CatalogMap, type CatalogPuller } from "./catalog";
import type { Fetch } from "./pull";

export const MIN_NUDGE_GAP_MS = 30_000;

export type PullOutcome = { kind: "updated"; version: number } | { kind: "unchanged" } | { kind: "failed"; reason: string };
export type NudgeResult = { kind: "coalesced" } | { kind: "pulled"; outcome: PullOutcome };

/** One forced pull (no ETag: a nudge says something changed) whose snapshot goes through ingest. */
export const createWebPull = (d: { fetch: Fetch; ingest: Ingest }) => async (): Promise<PullOutcome> => {
    const r = await d.fetch({});
    if (r.kind === "failed") return r;
    if (r.kind === "not_modified") return { kind: "unchanged" };
    try {
        const applied = await d.ingest(r.candidate, { source: "poll" });
        return applied.status === "applied" ? { kind: "updated", version: applied.version } : { kind: "unchanged" };
    } catch (e) {
        if (e instanceof IngestError) return { kind: "failed", reason: `rejected (${e.code}): ${e.message}` };
        return { kind: "failed", reason: "unexpected error" };
    }
};

/** The nudge in catalog mode: one forced pull of every product in the fetch plan from the catalog, a candidate built against the snapshot in force here, and the candidate through ingest (so the guards apply). A product that fails leaves its keys alone; only when every product fails is the pull "failed". */
export const createWebCatalogPull = (d: { puller: CatalogPuller; products: string[]; map: CatalogMap; cache: PriceCache; ingest: Ingest; now: () => number }) => async (): Promise<PullOutcome> => {
    const report = await d.puller.pull(d.products, { force: true });
    const okProducts = Object.keys(report.books);
    if (okProducts.length === 0) return { kind: "failed", reason: Object.entries(report.results).map(([p, r]) => `${p}: ${"reason" in r ? r.reason : r.kind}`).join("; ") || "no products to pull" };
    const built = buildCandidate(d.cache.get(), report.books, d.map, { now: new Date(d.now()) });
    d.cache.markCatalogSources(Object.fromEntries(okProducts.map((p) => [p, { ...built.sources[p], fetchedAt: report.checkedAt[p] }])));
    if (!built.candidate) return { kind: "unchanged" };
    try {
        const applied = await d.ingest(built.candidate, { source: "poll" });
        return applied.status === "applied" ? { kind: "updated", version: applied.version } : { kind: "unchanged" };
    } catch (e) {
        if (e instanceof IngestError) return { kind: "failed", reason: `rejected (${e.code}): ${e.message}` };
        return { kind: "failed", reason: "unexpected error" };
    }
};

export const SEEN_ID_MEMORY_MS = 24 * 3600_000;
export const SEEN_ID_MAX = 5000;

/** Remembers webhook event ids for 24 h, at most 5000 (oldest forgotten first), so a redelivered event is answered but not acted on twice. */
export const createSeenIds = (o: { now: () => number; memoryMs?: number; max?: number }) => {
    const memoryMs = o.memoryMs ?? SEEN_ID_MEMORY_MS, max = o.max ?? SEEN_ID_MAX;
    const seen = new Map<string, number>();
    const prune = (now: number) => {
        for (const [k, at] of seen) { if (now - at <= memoryMs) break; seen.delete(k); }
        while (seen.size > max) seen.delete(seen.keys().next().value as string);
    };
    return {
        /** True when the id is new (now remembered); false when already seen. */
        accept(id: string): boolean { const now = o.now(); prune(now); if (seen.has(id)) return false; seen.set(id, now); prune(now); return true; },
        /** Forgets an id (the event could not be handled, so a redelivery must be allowed through). */
        forget(id: string): void { seen.delete(id); },
        size: () => seen.size,
    };
};

export interface NudgerDeps {
    pull: () => Promise<PullOutcome>;
    now: () => number;
    minGapMs?: number;
    /** Runs fn once after delayMs. Default: setTimeout, unref'd so a pending trailing pull never keeps the process alive. Tests pass a fake. */
    schedule?: (fn: () => void, delayMs: number) => void;
    /** Told the outcome of every trailing pull (the one a coalesced nudge asked for). */
    onTrailing?: (outcome: PullOutcome) => void;
}

const defaultSchedule = (fn: () => void, ms: number): void => { const t = setTimeout(fn, ms); (t as { unref?: () => void }).unref?.(); };

/** Single flight with a trailing pull. A nudge that arrives while a pull runs, or inside the 30 s window after one started, is answered "coalesced" but is remembered: when the window ends exactly one more pull runs, so the change that nudge announced is never lost. Any number of nudges in the meantime produce that one trailing pull. */
export const createNudger = (d: NudgerDeps) => {
    const gap = d.minGapMs ?? MIN_NUDGE_GAP_MS;
    const schedule = d.schedule ?? defaultSchedule;
    let inflight = false;
    let lastStart: number | null = null;
    let pending = false;
    let timerSet = false;

    const run = async (): Promise<PullOutcome> => {
        inflight = true;
        pending = false;
        lastStart = d.now();
        try { return await d.pull(); }
        catch { return { kind: "failed", reason: "unexpected error" }; }
        finally { inflight = false; if (pending) arm(); }
    };

    /** Makes sure one trailing pull is scheduled for when the window ends (never while a pull is running: run() arms again when it finishes). */
    const arm = (): void => {
        if (timerSet || inflight || !pending) return;
        timerSet = true;
        const wait = lastStart === null ? 0 : Math.max(0, lastStart + gap - d.now());
        schedule(() => {
            timerSet = false;
            if (!pending || inflight) { if (pending) arm(); return; } // a nudge already pulled for it, or a pull is running (it re-arms)
            if (lastStart !== null && d.now() - lastStart < gap) { arm(); return; } // fired early
            void run().then((o) => d.onTrailing?.(o), () => {});
        }, wait);
    };

    return async (): Promise<NudgeResult> => {
        const now = d.now();
        if (inflight || (lastStart !== null && now - lastStart < gap)) { pending = true; arm(); return { kind: "coalesced" }; }
        return { kind: "pulled", outcome: await run() };
    };
};

export type Nudger = ReturnType<typeof createNudger>;
