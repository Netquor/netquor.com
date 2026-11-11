// priceFallbacks.ts: what a Svelte page shows for a price key the live snapshot lacks. Price.svelte never throws (Nav renders a price on every Svelte page, so one dropped key must not 500 the site): it uses the page's own fallback text, else the last-known price from the seed (copied into this file by scripts/gen-price-fallbacks.ts), else a neutral phrase.
import { formatPrice, type PriceFormat } from "#server/prices/stamp";
import type { PriceEntry } from "#server/prices/types";

/** Last-known prices, copied from server/data/prices.seed.json by scripts/gen-price-fallbacks.ts (a test fails when this block is stale). */
// BEGIN GENERATED PRICE_FALLBACKS (bun scripts/gen-price-fallbacks.ts)
export const PRICE_FALLBACKS: Readonly<Record<string, PriceEntry>> = {
    "digitalaccess.plus.month": { amountCents: 999, currency: "USD", unit: "per month, first paid plan" },
    "digitalaccess.pro.month": { amountCents: 5999, currency: "USD", unit: "per month" },
    "digitalaccess.scale.month": { amountCents: 19900, currency: "USD", unit: "per month" },
    "digitalaccess.tenant_addon.month": { amountCents: 200, currency: "USD", unit: "per tenant per month, Connected Tenant Experience add-on" },
    "fleet.dedicated.month": { amountCents: 3000, currency: "USD", unit: "per month, dedicated cloud instance" },
    "fleet.dedicated.setup": { amountCents: 30000, currency: "USD", unit: "one-time setup for a dedicated cloud instance" },
    "fleet.dedicated.year": { amountCents: 30000, currency: "USD", unit: "per year, dedicated cloud instance" },
    "fleet.mac.lifetime": { amountCents: 17850, currency: "USD", unit: "per Mac, lifetime license, three years of the annual price" },
    "fleet.mac.month": { amountCents: 595, currency: "USD", unit: "per Mac per month" },
    "fleet.mac.year": { amountCents: 5950, currency: "USD", unit: "per Mac per year, ten months of the monthly price" },
    "fleet.mobile.lifetime": { amountCents: 11850, currency: "USD", unit: "per iPhone or iPad, lifetime license, three years of the annual price" },
    "fleet.mobile.month": { amountCents: 395, currency: "USD", unit: "per iPhone or iPad per month" },
    "fleet.mobile.year": { amountCents: 3950, currency: "USD", unit: "per iPhone or iPad per year, ten months of the monthly price" },
    "homeassistant.extra_bridge.month": { amountCents: 600, currency: "USD", unit: "per month, about, extra bridge for a second home" },
    "homeassistant.from.month": { amountCents: 1200, currency: "USD", unit: "per month, starting price" },
    "homeassistant.home.month": { amountCents: 1400, currency: "USD", unit: "per month, Home plan" },
    "homeassistant.plus.month": { amountCents: 2400, currency: "USD", unit: "per month, Home Plus plan" },
    "homeassistant.pro.month": { amountCents: 3900, currency: "USD", unit: "per month, Home Pro plan" },
    "homeassistant.resilient.month": { amountCents: 1200, currency: "USD", unit: "per month, Resilient plan" },
    "homeassistant.setup_session.once": { amountCents: 7900, currency: "USD", unit: "one-time, setup session or migration, free on yearly plans" },
    "homeassistant.zigbee_radio.once": { amountCents: 4900, currency: "USD", unit: "one-time, per Zigbee or Z-Wave USB radio" },
    "network.addon_anycast.month": { amountCents: 1200, currency: "USD", unit: "per month, anycast address" },
    "network.addon_byo_prefix.month": { amountCents: 1500, currency: "USD", unit: "per month, bring your own prefix" },
    "network.addon_gateway.month": { amountCents: 1000, currency: "USD", unit: "per month, dedicated transit gateway, per location" },
    "network.addon_ipv4.month": { amountCents: 350, currency: "USD", unit: "per month, extra IPv4 address" },
    "network.addon_ipv6_48.month": { amountCents: 300, currency: "USD", unit: "per month, extra IPv6 /48" },
    "network.addon_location.month": { amountCents: 900, currency: "USD", unit: "per month, extra location" },
    "network.addon_tunnel.month": { amountCents: 400, currency: "USD", unit: "per month, extra tunnel" },
    "network.addon_volume_tb.month": { amountCents: 200, currency: "USD", unit: "per month, per extra TB of volume" },
    "network.from.month": { amountCents: 649, currency: "USD", unit: "per month, starting price, month to month" },
    "network.homelab.month": { amountCents: 649, currency: "USD", unit: "per month, Homelab plan" },
    "network.startup.month": { amountCents: 3749, currency: "USD", unit: "per month, Startup plan" },
    "phone.planned_launch.month": { amountCents: 2500, currency: "USD", unit: "per month, planned launch price, early access, not billed" },
    "vpn.fast.month": { amountCents: 2000, currency: "USD", unit: "per month, Fast plan, 500 Mbps" },
    "vpn.from.month": { amountCents: 500, currency: "USD", unit: "per month, smallest plan" },
    "vpn.gigabit.month": { amountCents: 3000, currency: "USD", unit: "per month, Gigabit plan, up to 1 Gbps" },
    "vpn.lite.month": { amountCents: 500, currency: "USD", unit: "per month, Lite plan, 25/25 Mbps" },
    "vpn.plus.month": { amountCents: 1000, currency: "USD", unit: "per month, Plus plan, 100 Mbps" },
    "vpn.to.month": { amountCents: 3000, currency: "USD", unit: "per month, largest plan" },
};
// END GENERATED PRICE_FALLBACKS

/** Shown when a key is in neither the snapshot nor the seed. */
export const UNKNOWN_PRICE_TEXT = "see pricing";

const warned = new Set<string>();

/** The text for a price: the snapshot's value, else the explicit fallback, else the last-known seed value, else UNKNOWN_PRICE_TEXT. Never throws. A missing key is logged once per key per version. */
export const priceText = (
    prices: Readonly<Record<string, PriceEntry>> | undefined,
    key: string,
    fmt: PriceFormat,
    fallback: string | undefined,
    version: number | string = 0,
    log: (line: string) => void = (l) => console.error(l),
): string => {
    const entry = prices && Object.hasOwn(prices, key) ? prices[key] : undefined;
    if (entry) return formatPrice(entry, fmt);
    const k = `${key}@${version}`;
    if (!warned.has(k)) { warned.add(k); log(`Price: "${key}" is not in the price snapshot (version ${version}); showing the fallback`); }
    if (fallback !== undefined) return fallback;
    const last = Object.hasOwn(PRICE_FALLBACKS, key) ? PRICE_FALLBACKS[key] : undefined;
    return last ? formatPrice(last, fmt) : UNKNOWN_PRICE_TEXT;
};

/** Test seam: forget which keys were logged. */
export const resetPriceWarnings = (): void => warned.clear();
