import type { RequestHandler } from "./$types";
import { buildLlms } from "#lib/server/files.ts";
import { conditional, HTML_CACHE_CONTROL } from "#lib/server/http.ts";
import { getRuntime } from "#lib/server/runtime.ts";
import { createHash } from "node:crypto";
import { PRICE_FALLBACKS } from "#lib/priceFallbacks.ts";

// Rendered per request from the price cache and the template (llms.template.txt in the legacy folder); the ETag is the hash of the text, so it changes exactly when a price or the template does.
export const GET: RequestHandler = async ({ request }) => {
    const rt = await getRuntime();
    const live = rt.prices.get();
    let text: string;
    try {
        text = buildLlms(rt.llmsTemplate(), live);
    } catch (err) {
        // A key the live snapshot lacks must not 500 this file: fill gaps from the last-known prices and log it once per message.
        console.error(`llms.txt: ${(err as Error).message}; using last-known prices for missing keys`);
        text = buildLlms(rt.llmsTemplate(), { ...live, prices: { ...PRICE_FALLBACKS, ...live.prices } });
    }
    const etag = `W/"${createHash("sha1").update(text).digest("base64url").slice(0, 22)}"`;
    return conditional(request, text, { "content-type": "text/plain; charset=utf-8", "cache-control": HTML_CACHE_CONTROL }, etag);
};
