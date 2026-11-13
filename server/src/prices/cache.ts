// cache.ts: the in-memory price cache the web process renders every page from. It loads the persisted snapshot once at construction (data/prices.json, else prices.prev.json, else the baked-in seed) and from then on only changes through replace(), which ingest calls after the new snapshot is safely on disk. Reads are synchronous and allocation free.
import type { CatalogSource } from "./catalog";
import type { Loaded, SnapshotStore } from "./store";
import type { Snapshot, SnapshotSource } from "./types";

export interface PriceCacheStatus {
    /** The snapshot's own version. */
    version: number;
    updatedAt: string;
    /** Seconds since the snapshot's updatedAt, by the clock; null if updatedAt does not parse. */
    ageSeconds: number | null;
    /** When this process last took in a snapshot (ISO), or null if it has not since it started. */
    lastIngestAt: string | null;
    lastIngestSource: SnapshotSource | null;
    /** When the worker last reported a successful poll of the API (ISO), or null. */
    lastPollOkAt: string | null;
    /** The last time ingest refused a snapshot (409, 422 or change_too_large), from any path; null if none since start. version is the refused snapshot's own version, null when it had none. */
    lastRefusal: { version: number | null; code: string; at: string } | null;
    /** True when PRICING_API_URL is set and nothing has been taken in (an ingest or a worker heartbeat) for more than 3 x PRICING_POLL_SECONDS, counted from the latest of those and the process start. Always false when no API is configured. The worker only reports; the web process decides this. */
    stale: boolean;
    /** The latest catalog book each product's price came from (version, checksum, when checked), as reported by the worker or a nudge pull. Empty when no catalog mode. */
    catalogSources: Record<string, CatalogSource>;
}

export interface PriceCache {
    /** The snapshot in force. Deeply frozen; never mutate it. */
    get(): Snapshot;
    /** Changes whenever the content in force changes (use it in ETags and memo keys). It equals the snapshot's version, except after an operator rebase to a lower version, when it keeps counting up so a number is never reused for other content. */
    version(): number;
    status(): PriceCacheStatus;
    /** Puts a snapshot in force, recording how it arrived, and tells subscribers. Ingest is the only caller; the snapshot must already be validated and persisted. */
    replace(snapshot: Snapshot, source: SnapshotSource): void;
    /** Called after every replace. Returns the unsubscribe function. A subscriber that throws does not stop the others. */
    subscribe(fn: (snapshot: Snapshot) => void): () => void;
    /** The worker's poll.ok heartbeat: the API was reached and had nothing newer. */
    markPollOk(): void;
    /** Ingest calls this whenever it refuses a snapshot. */
    markRefusal(r: { version: number | null; code: string }): void;
    /** Remembers the latest catalog sources per product (merged by product). */
    markCatalogSources(sources: Record<string, CatalogSource>): void;
}

export interface PriceCacheDeps {
    store: Pick<SnapshotStore, "load">;
    /** Milliseconds since the epoch (a Date is accepted too). */
    clock: () => number | Date;
    /** Told once what the cache loaded from (a non-"current" origin or a skipped file is worth a log line). */
    onLoad?: (loaded: Loaded) => void;
    /** PRICING_POLL_SECONDS when PRICING_API_URL is set, else undefined (then stale is always false). */
    pollSeconds?: number;
}

/** A deep copy, frozen, so what is served can never be changed by whoever handed it in. */
const frozenCopy = (s: Snapshot, source: SnapshotSource = s.source): Snapshot => {
    const prices: Snapshot["prices"] = {};
    for (const [k, p] of Object.entries(s.prices)) prices[k] = Object.freeze({ ...p });
    return Object.freeze({ ...s, source, prices: Object.freeze(prices) });
};

export const createPriceCache = (d: PriceCacheDeps): PriceCache => {
    const now = (): number => { const t = d.clock(); return t instanceof Date ? t.getTime() : t; };
    const iso = (): string => new Date(now()).toISOString();
    const loaded = d.store.load();
    d.onLoad?.(loaded);
    let current = frozenCopy(loaded.snapshot);
    let revision = current.version;
    let lastIngestAt: string | null = null, lastIngestSource: SnapshotSource | null = null, lastPollOkAt: string | null = null;
    let lastRefusal: PriceCacheStatus["lastRefusal"] = null;
    const catalogSources: Record<string, CatalogSource> = {};
    const startedAt = now();
    const subscribers = new Set<(s: Snapshot) => void>();

    return {
        get: () => current,
        version: () => revision,
        status() {
            const updated = Date.parse(current.updatedAt);
            return {
                version: current.version,
                updatedAt: current.updatedAt,
                ageSeconds: Number.isNaN(updated) ? null : Math.max(0, Math.floor((now() - updated) / 1000)),
                lastIngestAt, lastIngestSource, lastPollOkAt,
                lastRefusal: lastRefusal ? { ...lastRefusal } : null,
                catalogSources: Object.fromEntries(Object.entries(catalogSources).map(([k, v]) => [k, { ...v }])),
                stale: d.pollSeconds !== undefined && d.pollSeconds > 0 && now() - Math.max(startedAt, lastIngestAt ? Date.parse(lastIngestAt) : 0, lastPollOkAt ? Date.parse(lastPollOkAt) : 0) > 3 * d.pollSeconds * 1000,
            };
        },
        replace(snapshot, source) {
            current = frozenCopy(snapshot, source);
            revision = Math.max(revision + 1, current.version);
            lastIngestAt = iso();
            lastIngestSource = source;
            for (const fn of [...subscribers]) { try { fn(current); } catch { /* a bad subscriber must not break ingest */ } }
        },
        subscribe(fn) { subscribers.add(fn); return () => { subscribers.delete(fn); }; },
        markPollOk() { lastPollOkAt = iso(); },
        markCatalogSources(s) { for (const [k, v] of Object.entries(s)) catalogSources[k] = { ...v }; },
        markRefusal(r) { lastRefusal = { version: r.version, code: r.code, at: iso() }; },
    };
};
