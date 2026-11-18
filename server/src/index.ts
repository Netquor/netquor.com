// index.ts: builds the real app from the environment. The web process (web/, SvelteKit) calls buildApp() from its hooks.server.ts and hands /api/*, /hooks/* and /health* to app.handle(request); run directly (bun src/index.ts) it is a stand-alone dev server for the API only, with no pages and no price cache.
import { createApp, type Plugin } from "./app";
import { ConfigError, loadConfig, type Config } from "./lib/config";
import { slidingWindowLimiter } from "./lib/rateLimit";
import type { PriceStatus } from "./health/routes";
import { realLeadSink } from "./lead/real";

export interface BuildOptions {
    config?: Config;
    /** Extra routes, for example the prices webhook routes built around the price cache. */
    plugins?: Plugin[];
    /** The price cache's status(), for GET /health/detail. */
    priceStatus?: () => PriceStatus;
    /** True only when the caller overwrites x-nq-client-ip with the address it resolved (the SvelteKit hooks do). */
    trustPeerIpHeader?: boolean;
    now?: () => number;
    log?: (message: string) => void;
}

export function buildApp(o: BuildOptions = {}) {
    const config = o.config ?? loadConfig();
    const now = o.now ?? Date.now;
    return createApp({
        config,
        leadSink: realLeadSink(config),
        clock: now,
        trustPeerIpHeader: o.trustPeerIpHeader === true,
        // Requests with no address share one bucket; its limit is far higher so it can never lock everyone out.
        rateLimiter: slidingWindowLimiter({ max: config.rateLimitMax, windowMs: config.rateLimitWindowMs, now, keyMax: { unknown: config.rateLimitMax * 20 } }),
        health: { startedAt: now(), clock: now, prices: o.priceStatus, leads: { file: config.leadFile !== "", webhook: config.leadForwardUrl !== "" } },
        plugins: o.plugins,
        log: o.log,
    });
}

if (import.meta.main) {
    try {
        const config = loadConfig();
        // The lead route enforces its own 16 KB cap; this backstop is above the prices webhook cap (256 KB).
        buildApp({ config }).listen({ port: config.port, hostname: config.host, maxRequestBodySize: 512 * 1024 });
        console.log(`netquor API (dev, no pages) listening on ${config.host}:${config.port}`);
    } catch (e) {
        console.error("netquor API could not start:", e instanceof ConfigError || e instanceof Error ? e.message : e);
        process.exit(1);
    }
}
