import { describe, expect, test } from "bun:test";
import { fleetPricesFrom, FLEET_PRICE_KEYS, samePrices } from "./prices";
import { countDevices, createPricing, off, PACK, VOLUME_TIERS, volumeBps, type FleetPrices } from "./pricing";

const seed = fleetPricesFrom(undefined);

describe("pricing math", () => {
    test("count floors and clamps", () => {
        expect([countDevices(3.9), countDevices(-1), countDevices(1e9), countDevices("x"), countDevices(NaN)]).toEqual([3, 0, 100000, 0, 0]);
    });
    test("off rounds half up on integer cents", () => {
        expect(off(5950, 500)).toBe(5653);
        expect(off(100, 5000)).toBe(50);
        expect(off(1, 5000)).toBe(1);
        expect(() => off(1.5, 0)).toThrow();
    });
    test("volume tiers by pack count", () => {
        expect([0, 1, 2, 4, 5, 9, 10, 24, 25, 99].map(volumeBps)).toEqual([0, 500, 1000, 1000, 1500, 1500, 2000, 2000, 2500, 2500]);
        expect(PACK).toBe(10);
        expect(VOLUME_TIERS.length).toBe(5);
    });
    test("known quote: 25 Macs and 10 iPhones", () => {
        const c = createPricing(seed).compare({ macs: 25, ios: 10, dedicated: 0 });
        expect(c.annual.year_one.packs_mac).toBe(3);
        expect(c.annual.total_year_one_cents).toBe(c.annual.year_one.yearly_cents);
        expect(c.monthly.total_year_one_cents).toBe((25 * 595 + 10 * 395) * 12 + 5 * 595 * 12);
        expect(c.cheaper_first_year).toBe("annual");
    });
    test("the amounts follow the prices given, not constants", () => {
        const cheaper: FleetPrices = { ...seed, macMonth: 500, macYear: 5000, macLifetime: 15000 };
        const a = createPricing(seed).compare({ macs: 10, ios: 0 });
        const b = createPricing(cheaper).compare({ macs: 10, ios: 0 });
        expect(b.monthly.total_year_one_cents).toBe(10 * 500 * 12);
        expect(b.annual.total_year_one_cents).toBeLessThan(a.annual.total_year_one_cents);
        expect(b.lifetime.total_year_one_cents).toBe(off(10 * 15000, 500));
        const ded = createPricing({ ...seed, dedicatedSetup: 100, dedicatedYear: 200, dedicatedMonth: 30 }).price({ macs: 0, ios: 0, term: "monthly", dedicated: 1 });
        expect(ded.dedicated).toEqual({ included: true, setup_cents: 100, hosting_year_cents: 360, year_one_cents: 460, renewal_cents: 360 });
    });
    test("a price that is not whole cents makes compare throw (the calculator shows its error)", () => {
        expect(() => createPricing({ ...seed, macYear: Number.NaN }).compare({ macs: 5, ios: 5 })).toThrow();
    });
});

describe("prices from the snapshot", () => {
    test("reads the nine keys, falling back to the seed", () => {
        expect(Object.values(FLEET_PRICE_KEYS).length).toBe(9);
        expect(seed.macMonth).toBe(595);
        const live = fleetPricesFrom({ "fleet.mac.month": { amountCents: 650, currency: "USD", unit: "" } });
        expect(live.macMonth).toBe(650);
        expect(live.iosMonth).toBe(395);
        expect(samePrices(seed, live)).toBe(false);
        expect(samePrices(seed, fleetPricesFrom(undefined))).toBe(true);
    });
});
