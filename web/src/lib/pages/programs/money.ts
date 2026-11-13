// Money helpers for figures that are arithmetic on published prices (the half price startup figures, the partner commission examples). Everything is computed in whole cents from the price snapshot, falling back to the last-known seed price like <Price>, so an example is recomputed when a price changes.
import { PRICE_FALLBACKS } from "#lib/priceFallbacks.ts";

export type Prices = Readonly<Record<string, { amountCents: number }>> | undefined;

export const cents = (prices: Prices, key: string): number => {
    const e = prices && Object.hasOwn(prices, key) ? prices[key] : undefined;
    const v = e?.amountCents ?? (Object.hasOwn(PRICE_FALLBACKS, key) ? PRICE_FALLBACKS[key].amountCents : undefined);
    if (v === undefined) throw new Error(`no price for ${key}`);
    return v;
};

/** 79200 -> "$792.00", 190080 -> "$1,900.80": two decimals and thousands separators, as the commission examples print them. */
export const usd = (c: number): string => `$${(Math.round(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
