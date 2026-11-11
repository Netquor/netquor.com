// priceFallbacks.test.ts: the generated PRICE_FALLBACKS block matches the seed, and the generator behaves.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { applyBlock, BEGIN, END, generate, renderBlock, seedPath } from "../../scripts/gen-price-fallbacks";
import { PRICE_FALLBACKS, priceText, UNKNOWN_PRICE_TEXT } from "./priceFallbacks";

const seedPrices = JSON.parse(readFileSync(seedPath, "utf8")).prices as Record<string, { amountCents: number; currency: string; unit?: string }>;

describe("PRICE_FALLBACKS", () => {
    test("is up to date with the seed (run bun scripts/gen-price-fallbacks.ts when this fails)", () => {
        const { current, next } = generate();
        expect(current).toBe(next);
    });
    test("has exactly the seed's keys and amounts", () => {
        expect(Object.keys(PRICE_FALLBACKS).sort()).toEqual(Object.keys(seedPrices).sort());
        for (const [k, e] of Object.entries(seedPrices)) { expect(PRICE_FALLBACKS[k].amountCents).toBe(e.amountCents); expect(PRICE_FALLBACKS[k].unit).toBe(e.unit); }
    });
    test("a key missing from the snapshot shows the last-known seed price, an unknown key a neutral phrase", () => {
        expect(priceText({}, "vpn.lite.month", "usd0", undefined, 1, () => {})).toBe("$5");
        expect(priceText({}, "nope.nothing.month", "usd0", undefined, 1, () => {})).toBe(UNKNOWN_PRICE_TEXT);
    });
});

describe("the generator", () => {
    test("renders sorted keys and escapes units", () => {
        const b = renderBlock({ "b.x.month": { amountCents: 2, currency: "USD", unit: 'say "hi"' }, "a.x.month": { amountCents: 1, currency: "USD" } });
        expect(b.indexOf("a.x.month")).toBeLessThan(b.indexOf("b.x.month"));
        expect(b).toContain('unit: "say \\"hi\\""');
        expect(b.startsWith(BEGIN) && b.endsWith(END)).toBe(true);
    });
    test("replaces only the marked block and is idempotent", () => {
        const src = `top\n${BEGIN}\nold\n${END}\nbottom\n`;
        const out = applyBlock(src, renderBlock({ "a.b.c": { amountCents: 1, currency: "USD" } }));
        expect(out.startsWith("top\n") && out.endsWith("\nbottom\n")).toBe(true);
        expect(out).not.toContain("old");
        expect(applyBlock(out, renderBlock({ "a.b.c": { amountCents: 1, currency: "USD" } }))).toBe(out);
    });
    test("refuses a file without the markers", () => {
        expect(() => applyBlock("nothing", "x")).toThrow("markers");
    });
});
