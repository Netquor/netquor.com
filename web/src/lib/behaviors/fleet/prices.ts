// prices.ts: reads the Fleet prices out of the price snapshot (the same snapshot <Price> shows), falling back to the last-known seed for a key the snapshot lacks, so the calculator never disagrees with the page copy.
import type { PriceEntry } from "#server/prices/types";
import { centsOf } from "#lib/pages/fleet/tokens.ts";
import type { FleetPrices } from "./pricing";

/** The price keys the calculator uses. */
export const FLEET_PRICE_KEYS = {
    macMonth: "fleet.mac.month",
    iosMonth: "fleet.mobile.month",
    macYear: "fleet.mac.year",
    iosYear: "fleet.mobile.year",
    macLifetime: "fleet.mac.lifetime",
    iosLifetime: "fleet.mobile.lifetime",
    dedicatedSetup: "fleet.dedicated.setup",
    dedicatedYear: "fleet.dedicated.year",
    dedicatedMonth: "fleet.dedicated.month",
} as const satisfies Record<keyof FleetPrices, string>;

/** The Fleet prices in cents from a snapshot's prices (page.data.prices). */
export const fleetPricesFrom = (prices: Readonly<Record<string, PriceEntry>> | undefined): FleetPrices => {
    const out = {} as Record<keyof FleetPrices, number>;
    for (const [field, key] of Object.entries(FLEET_PRICE_KEYS)) out[field as keyof FleetPrices] = centsOf(prices, key);
    return out;
};

/** True when two price sets are the same amounts. */
export const samePrices = (a: FleetPrices, b: FleetPrices): boolean => (Object.keys(a) as (keyof FleetPrices)[]).every((k) => a[k] === b[k]);
