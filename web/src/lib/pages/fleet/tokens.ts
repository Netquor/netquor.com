// tokens.ts: price tokens in fleet.html's copy, and the figures derived from published prices. Nothing here types a price: the amounts come from the price snapshot (or the last-known seed when a key is missing), the same source as <Price>.
import type { PriceFormat } from "#server/prices/stamp";
import { formatPrice } from "#server/prices/stamp";
import type { PriceEntry } from "#server/prices/types";
import { PRICE_FALLBACKS, priceText } from "#lib/priceFallbacks.ts";

type Prices = Readonly<Record<string, PriceEntry>> | undefined;

export type Part = { html: string } | { key: string; fmt: PriceFormat };

const TOKEN = /\{\{([a-z0-9_.]+)(?::(usd0|usd|int|plain))?\}\}/g;

/** Splits "from {{fleet.mac.month}} a month" into html and price parts, in order. Text without a token is one html part. */
export const splitTokens = (text: string): Part[] => {
    const parts: Part[] = [];
    let at = 0;
    for (const m of text.matchAll(TOKEN)) {
        if (m.index > at) parts.push({ html: text.slice(at, m.index) });
        parts.push({ key: m[1], fmt: (m[2] as PriceFormat | undefined) ?? "usd0" });
        at = m.index + m[0].length;
    }
    if (at < text.length) parts.push({ html: text.slice(at) });
    return parts;
};

/** The copy as HTML with each token written as the <span data-price data-fmt> that <Price> renders (same markers, same text from the same snapshot), so a token inside a <b> or a link stays inside it. */
export const richHtml = (text: string, prices: Prices, version: number | string = 0, log?: (line: string) => void): string =>
    splitTokens(text).map((p) => ("key" in p ? `<span data-price="${p.key}" data-fmt="${p.fmt}">${priceText(prices, p.key, p.fmt, undefined, version, log)}</span>` : p.html)).join("");

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

/** The copy as plain text with the prices filled in: tags removed, entities decoded (the form JSON-LD text and the meta description use). */
export const plainText = (text: string, prices: Prices, version: number | string = 0): string =>
    splitTokens(text).map((p) => ("key" in p ? priceText(prices, p.key, p.fmt, undefined, version) : p.html.replace(/<[^>]*>/g, "").replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (e) => ENTITIES[e]))).join("");

/** The amount of a key in cents: the snapshot's, else the last-known seed, else 0. */
export const centsOf = (prices: Prices, key: string): number => (prices && Object.hasOwn(prices, key) ? prices[key].amountCents : Object.hasOwn(PRICE_FALLBACKS, key) ? PRICE_FALLBACKS[key].amountCents : 0);

/** A price in cents less a discount in basis points, rounded half up to the cent (the rule fleet/pricing.js uses). */
export const discounted = (cents: number, bps: number): number => Math.floor((cents * (10000 - bps) + 5000) / 10000);

/** "$56.53": a derived amount as dollars and cents, always two decimals. */
export const usd = (cents: number): string => formatPrice({ amountCents: cents, currency: "USD", unit: "" }, "usd");

/** "$360": a derived amount without cents when they are zero. */
export const usd0 = (cents: number): string => formatPrice({ amountCents: cents, currency: "USD", unit: "" }, "usd0");
