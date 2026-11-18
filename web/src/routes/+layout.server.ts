import type { LayoutServerLoad } from "./$types";
import { assetVersions } from "#lib/assets.ts";
import { getRuntime } from "#lib/server/runtime.ts";

// Every page gets the price map (taken once per request in hooks.server.ts), the canonical origin and the cache-busting versions of the legacy assets (see src/lib/assets.ts).
export const load: LayoutServerLoad = async ({ locals }) => {
    const rt = await getRuntime();
    return {
        prices: locals.prices.prices,
        priceVersion: locals.prices.version,
        origin: rt.env.siteOrigin,
        assets: assetVersions((f) => rt.assetVersion(f)),
    };
};
