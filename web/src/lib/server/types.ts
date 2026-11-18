// types.ts: the price cache contract this app is written against (server/src/prices/cache.ts, createPriceCache). Declared here, narrowly, so the web code and its tests depend on the contract and not on the server's internals.
import type { Snapshot } from "#server/prices/types";

export type { Snapshot };

export interface PriceSource {
    get(): Snapshot;
    version(): number;
}
