// real.ts: the real pricing pieces for the web process, built from the environment: the file store, the cache, ingest, the nudge pull and the webhook routes. createPricing() is the one call the web entry makes; everything is injectable so tests build the same thing with a temp folder and a fake fetch.
import type { Elysia } from "elysia";
import { createPriceCache, type PriceCache } from "./cache";
import { parseIntervalSeconds } from "./schedule";
import { readFileSync } from "node:fs";
import { createCatalogPuller, DEFAULT_CATALOG_INTERVAL_SECONDS, fetchPlan, parseCatalogMap, type CatalogMap, type Fetcher as CatalogFetcher } from "./catalog";
import { apiToken, apiUrl, catalogMapFile, catalogProducts, catalogUrl, env, pricesDir, seedFile, webhookSecrets, type Env } from "./env";
import { createIngest, type Ingest } from "./ingest";
import { createNudger, createWebCatalogPull, createWebPull } from "./nudge";
import { createFetcher, type Fetcher } from "./pull";
import { priceRoutes } from "./routes";
import { fileStore, type SnapshotStore } from "./store";

export interface PricingOptions {
    env?: Env;
    log?: (line: string) => void;
    fetch?: Fetcher;
    /** Milliseconds since the epoch. */
    now?: () => number;
    dir?: string;
    seedFile?: string;
    /** The catalog map, parsed (default: read CATALOG_MAP_FILE). */
    catalogMap?: CatalogMap;
}

export interface Pricing {
    cache: PriceCache;
    ingest: Ingest;
    store: SnapshotStore;
    /** The webhook and public snapshot routes, or undefined when no valid PRICING_WEBHOOK_SECRET is set (then they do not exist). Mount with `.use()`. */
    routes: Elysia | undefined;
}

export const createPricing = (o: PricingOptions = {}): Pricing => {
    const e = o.env ?? process.env;
    const log = o.log ?? ((l: string) => console.log(l));
    const now = o.now ?? Date.now;
    const store = fileStore(o.dir ?? pricesDir(e), { seedFile: o.seedFile ?? seedFile(e) });
    const cache = createPriceCache({ store, clock: now, pollSeconds: catalogUrl(e) ? parseIntervalSeconds(env("PRICING_POLL_SECONDS", String(DEFAULT_CATALOG_INTERVAL_SECONDS), e)) : apiUrl(e) ? parseIntervalSeconds(env("PRICING_POLL_SECONDS", "", e)) : undefined, onLoad: (l) => { for (const p of l.problems) log(`prices: skipped ${p}`); log(`prices: loaded version ${l.snapshot.version} from ${l.from}`); } });
    const { ingestSnapshot } = createIngest({ cache, store, clock: now, log });
    const secrets = webhookSecrets(e, log);
    if (secrets.length === 0) {
        if (!env("PRICING_WEBHOOK_SECRET", "", e)) log("prices: PRICING_WEBHOOK_SECRET is not set, so the pricing routes (/hooks/pricing and /api/prices) are off and prices stay at the last snapshot");
        return { cache, ingest: ingestSnapshot, store, routes: undefined };
    }
    let pull: ReturnType<typeof createWebPull>;
    if (catalogUrl(e)) {
        if (apiUrl(e)) log("prices: NETQUOR_CATALOG_URL and PRICING_API_URL are both set; catalog mode wins and PRICING_API_URL is not used");
        let map: CatalogMap | null = null;
        try { map = o.catalogMap ?? parseCatalogMap(JSON.parse(readFileSync(catalogMapFile(e), "utf8"))); } catch (err) { log(`prices: catalog mode is off: ${err instanceof Error ? err.message : "the catalog map could not be read"}`); }
        const products = map ? fetchPlan(map, catalogProducts(e).products) : [];
        if (map && products.length) {
            log(`prices: catalog mode, products ${products.join(", ")}`);
            const puller = createCatalogPuller({ baseUrl: catalogUrl(e), fetch: (o.fetch as CatalogFetcher | undefined) ?? ((url, init) => fetch(url, init)), now });
            pull = createWebCatalogPull({ puller, products, map, cache, ingest: ingestSnapshot, now });
            return { cache, ingest: ingestSnapshot, store, routes: priceRoutes({ secrets: () => secrets, now, ingest: ingestSnapshot, cache, nudge: createNudger({ pull, now, onTrailing: (r) => log(`prices: trailing nudge pull ${r.kind}${r.kind === "failed" ? `: ${r.reason}` : ""}`) }), log }) as unknown as Elysia };
        }
        if (map) log("prices: catalog mode is off: none of NETQUOR_CATALOG_PRODUCTS is in the catalog map");
    }
    const fetcher = createFetcher({ url: apiUrl(e), token: apiToken(e) || undefined, fetch: o.fetch ?? ((url, init) => fetch(url, init)) });
    pull = createWebPull({ fetch: fetcher, ingest: ingestSnapshot });
    const nudge = createNudger({ pull, now, onTrailing: (o) => log(`prices: trailing nudge pull ${o.kind}${o.kind === "failed" ? `: ${o.reason}` : ""}`) });
    return { cache, ingest: ingestSnapshot, store, routes: priceRoutes({ secrets: () => secrets, now, ingest: ingestSnapshot, cache, nudge, log }) as unknown as Elysia };
};
