// jsonld.ts: JSON-LD whose prices come from the live price cache. The legacy pages mark the values with a data-price-map attribute on the JSON-LD script ({"<JSON pointer>": "key" or "key|format"}) and the legacy stamper rewrites them per request. A Svelte page gives the Seo component the same map next to the JSON-LD it builds, and the values are written here, from the same snapshot the visible prices come from.
//   priceMap: { "/@graph/4/itemListElement/0/priceSpecification/price": "phone.planned_launch.month", "/offers/price": "fleet.mac.month|plain" }
// The default format is "plain" (25 or 5.95, no symbol), as in the stamper. A string stays a string ("5.95"), a number stays a number.
import type { PriceFormat } from "#server/prices/stamp";
import type { PriceEntry } from "#server/prices/types";
import { priceText, UNKNOWN_PRICE_TEXT } from "./priceFallbacks";

export type PriceMap = Record<string, string>;

const unescapeToken = (t: string) => t.replace(/~1/g, "/").replace(/~0/g, "~");
const FORMATS: readonly string[] = ["usd", "usd0", "int", "plain"];

/** A copy of `ld` with the values a priceMap points at replaced by the current prices. A pointer that does not exist, or a spec with an unknown format, is a mistake in the page and throws (a test or the parity check finds it the first time). A key missing from the snapshot never throws: the last-known seed price is used, and when there is none either, the value as written stays. */
export const withPrices = (
    ld: unknown,
    map: PriceMap,
    prices: Readonly<Record<string, PriceEntry>> | undefined,
    version: number | string = 0,
    log?: (line: string) => void,
): unknown => {
    const copy = structuredClone(ld);
    for (const [pointer, spec] of Object.entries(map)) {
        const [key, fmt = "plain"] = spec.split("|");
        if (!FORMATS.includes(fmt)) throw new Error(`priceMap ${pointer}: unknown format "${fmt}"`);
        const tokens = pointer === "" ? [] : pointer.startsWith("/") ? pointer.slice(1).split("/").map(unescapeToken) : null;
        if (!tokens || tokens.length === 0) throw new Error(`priceMap pointer "${pointer}" must be a JSON pointer such as /offers/0/price`);
        let parent: unknown = copy;
        for (const tok of tokens.slice(0, -1)) parent = parent && typeof parent === "object" ? (parent as Record<string, unknown>)[tok] : undefined;
        const last = tokens[tokens.length - 1];
        if (!parent || typeof parent !== "object" || !Object.hasOwn(parent, last)) throw new Error(`priceMap pointer ${pointer} does not exist in the JSON-LD`);
        const slot = parent as Record<string, unknown>;
        const text = priceText(prices, key, fmt as PriceFormat, undefined, version, log);
        if (text === UNKNOWN_PRICE_TEXT) continue;
        const old = slot[last];
        if (typeof old === "string") slot[last] = text;
        else if (typeof old === "number" && /^\d+(\.\d+)?$/.test(text)) slot[last] = Number(text);
        else throw new Error(`priceMap ${pointer}: the value there is not a string or a number, or the format gives text that is not a number`);
    }
    return copy;
};
