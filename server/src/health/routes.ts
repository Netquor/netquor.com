// health/routes.ts: GET /health is the load balancer's check: the process answers. GET /health/detail adds non-sensitive status for people and monitors: uptime, the price cache status, which lead sinks are on (booleans). Never secrets, paths, addresses, counts of visitors or lead data. Every value comes from an injected provider, so the routes know nothing about the price cache itself.
import { Elysia } from "elysia";

/** What the price cache reports (cache.status()). Only these fields are ever passed on. */
export interface PriceStatus {
    version: number;
    updatedAt: string;
    ageSeconds: number | null;
    lastIngestAt: string | null;
    lastIngestSource: string | null;
    lastPollOkAt: string | null;
    lastRefusal: { version: number | null; code: string; at: string } | null;
    stale: boolean;
    catalogSources?: Record<string, { version: number; checksum: string; fetchedAt: string }>;
}

export interface HealthDeps {
    /** Milliseconds since the epoch. */
    clock?: () => number;
    /** When this process started (ms since the epoch). Default: when the routes were built. */
    startedAt?: number;
    /** The price cache status in force. May throw; that reads as null. */
    prices?: () => PriceStatus | null;
    /** Which lead sinks are configured. */
    leads?: { file: boolean; webhook: boolean };
}

const pick = (s: PriceStatus): PriceStatus => ({
    version: s.version, updatedAt: s.updatedAt, ageSeconds: s.ageSeconds ?? null,
    lastIngestAt: s.lastIngestAt ?? null, lastIngestSource: s.lastIngestSource ?? null, lastPollOkAt: s.lastPollOkAt ?? null,
    lastRefusal: s.lastRefusal ? { version: s.lastRefusal.version ?? null, code: s.lastRefusal.code, at: s.lastRefusal.at } : null,
    stale: s.stale === true,
    catalogSources: Object.fromEntries(Object.entries(s.catalogSources ?? {}).map(([k, v]) => [k, { version: v.version, checksum: v.checksum, fetchedAt: v.fetchedAt }])),
});

export const healthRoutes = (d: HealthDeps = {}) => {
    const clock = d.clock ?? Date.now;
    const startedAt = d.startedAt ?? clock();
    return new Elysia()
        .get("/health", () => ({ ok: true }))
        .get("/health/detail", () => {
            let prices: PriceStatus | null = null;
            try { const s = d.prices?.(); prices = s ? pick(s) : null; } catch { prices = null; }
            return {
                ok: true,
                uptimeSeconds: Math.max(0, Math.floor((clock() - startedAt) / 1000)),
                prices,
                leadSinks: { file: d.leads?.file === true, webhook: d.leads?.webhook === true },
            };
        });
};
