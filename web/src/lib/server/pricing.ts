// pricing.ts: the one place the web process is wired to the server package: the price cache, ingest and the webhook routes (createPricing) and the Elysia app (buildApp). Everything else in web/ depends only on the small contracts in types.ts and handle.ts, so a change in the server package touches this file alone.
import { buildApp } from "#server/index";
import type { Plugin } from "#server/app";
import { createPricing } from "#server/prices/real";
import type { HandleRuntime } from "./handle";
import type { PriceSource } from "./types";

const stamp = (line: string) => console.log(`${new Date().toISOString()} ${line}`);

export const buildWebParts = async (): Promise<{ prices: PriceSource; api: HandleRuntime["api"]; log: (line: string) => void }> => {
    const pricing = createPricing({ log: stamp });
    const app = buildApp({
        plugins: pricing.routes ? [pricing.routes as unknown as Plugin] : [],
        priceStatus: () => pricing.cache.status(),
        // The hooks overwrite x-nq-client-ip with the address the web server resolved, so the header can be believed here and only here.
        trustPeerIpHeader: true,
        log: (m) => console.error(`${new Date().toISOString()} ${m}`),
    });
    return { prices: pricing.cache, api: (request) => app.handle(request), log: (l) => console.error(`${new Date().toISOString()} ${l}`) };
};
