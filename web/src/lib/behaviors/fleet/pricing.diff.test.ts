// Differential test: the legacy fleet/pricing.js (loaded in a sandbox, untouched) against pricing.ts at the seed prices, over a grid of inputs. Every output must be identical, field for field.
import { describe, expect, test } from "bun:test";
import vm from "node:vm";
import { baselineText } from "../../baselineFiles";
import { PRICE_FALLBACKS } from "../../priceFallbacks";
import { fleetPricesFrom } from "./prices";
import { createPricing } from "./pricing";


interface LegacyApi {
    compare(i: unknown): unknown;
    price(i: unknown): unknown;
    lifetimePrice(i: unknown): unknown;
    bill(m: number, i: number, term: string, owned?: { mac: number; ios: number }): unknown;
    quote(i: unknown): unknown;
    dedicatedCost(term: string, included: boolean): unknown;
    volumeBps(n: number): number;
    PRICE_CENTS: { mac: number; ios: number };
}

const loadLegacy = (): LegacyApi => {
    const src = baselineText("fleet/pricing.js");
    const body = src.replace(/export\s*\{([\s\S]*?)\}\s*;?\s*$/, (_m, names: string) => `return { ${names} };`);
    expect(body).not.toBe(src);
    return vm.runInNewContext(`(function () {\n${body}\n})()`, Object.create(null)) as LegacyApi;
};

// JSON round trip: the legacy objects come from another realm, and undefined and prototypes do not matter to the page.
const plain = (v: unknown): unknown => JSON.parse(JSON.stringify(v));

const legacy = loadLegacy();
const ours = createPricing(fleetPricesFrom(undefined));
const COUNTS = [0, 1, 2, 5, 9, 10, 11, 19, 20, 21, 25, 49, 50, 51, 99, 100, 101, 249, 250, 251, 499, 500, 2500, 99999, 100000, 100001, -4, 3.7];

describe("the seed prices are the legacy constants", () => {
    test("monthly prices", () => {
        const p = fleetPricesFrom(undefined);
        expect(p.macMonth).toBe(legacy.PRICE_CENTS.mac);
        expect(p.iosMonth).toBe(legacy.PRICE_CENTS.ios);
        expect(p.macYear).toBe(legacy.PRICE_CENTS.mac * 10);
        expect(p.iosLifetime).toBe(legacy.PRICE_CENTS.ios * 30);
        expect(Object.keys(PRICE_FALLBACKS).filter((k) => k.startsWith("fleet.")).length).toBe(9);
    });
});

describe("differential: compare, price, lifetimePrice", () => {
    test("compare() over a grid of at least 200 combinations", () => {
        let n = 0;
        for (const macs of COUNTS) {
            for (const ios of COUNTS) {
                for (const dedicated of [0, 1]) {
                    const input = { macs, ios, dedicated };
                    expect(plain(ours.compare(input))).toEqual(plain(legacy.compare(input)));
                    n++;
                }
            }
        }
        expect(n).toBeGreaterThanOrEqual(200);
    });
    test("price() and lifetimePrice() agree for both terms and every dedicated spelling", () => {
        let n = 0;
        for (const macs of [0, 7, 10, 33, 120, 260]) {
            for (const ios of [0, 3, 10, 41, 250]) {
                for (const dedicated of [true, false, "1", "true", 1, 0, "0", undefined]) {
                    for (const term of ["annual", "monthly", "weekly"]) {
                        const input = { macs, ios, dedicated, term };
                        expect(plain(ours.price(input))).toEqual(plain(legacy.price(input)));
                        n++;
                    }
                    expect(plain(ours.lifetimePrice({ macs, ios, dedicated }))).toEqual(plain(legacy.lifetimePrice({ macs, ios, dedicated })));
                }
            }
        }
        expect(n).toBeGreaterThanOrEqual(200);
    });
    test("odd inputs are counted the same way", () => {
        for (const v of ["12", "  7 ", "abc", "", null, undefined, NaN, Infinity, -Infinity, "1e3", "0x10", 1e9, true, [], {}]) {
            const input = { macs: v, ios: v, dedicated: 1 };
            expect(plain(ours.compare(input))).toEqual(plain(legacy.compare(input)));
        }
    });
    test("bill() with owned licenses, quote() and dedicatedCost()", () => {
        for (const m of [0, 4, 10, 37, 100]) {
            for (const i of [0, 6, 10, 55]) {
                for (const owned of [{ mac: 0, ios: 0 }, { mac: 3, ios: 8 }, { mac: 50, ios: 50 }]) {
                    for (const term of ["annual", "monthly"] as const) expect(plain(ours.bill(m, i, term, owned))).toEqual(plain(legacy.bill(m, i, term, owned)));
                }
                expect(plain(ours.quote({ macs: m, ios: i }))).toEqual(plain(legacy.quote({ macs: m, ios: i })));
            }
        }
        for (const term of ["annual", "monthly"] as const) for (const inc of [true, false]) expect(plain(ours.dedicatedCost(term, inc))).toEqual(plain(legacy.dedicatedCost(term, inc)));
    });
});
