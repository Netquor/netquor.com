import { describe, expect, test } from "bun:test";
import { countOf, DASH, EMPTY_VERDICT, initialView, money, NBSP, renderQuote, sliderFor } from "./calculator";
import { fleetPricesFrom } from "./prices";
import { createPricing } from "./pricing";

const p = createPricing(fleetPricesFrom(undefined));
const view = (macs: number, ios: number, term: "annual" | "monthly" | "lifetime", dedicated = 0) => renderQuote(p.compare({ macs, ios, dedicated }), term);

describe("calculator view", () => {
    test("money is en-US with two decimals", () => {
        expect([money(196200), money(0), money(5), money(123456789)]).toEqual(["$1,962.00", "$0.00", "$0.05", "$1,234,567.89"]);
    });
    test("count and slider rules", () => {
        expect([countOf("12.9"), countOf(""), countOf("x"), countOf(-5), countOf(1e9)]).toEqual([12, 0, 0, 0, 100000]);
        expect([sliderFor("800"), sliderFor("40"), sliderFor("")]).toEqual(["500", "40", "0"]);
    });
    test("the server view is a dash, a non-breaking space and nothing else", () => {
        const v = initialView();
        expect(v.annual).toEqual({ main: DASH, sub: NBSP, tag: "" });
        expect(v.verdict).toBe("");
        expect(v.breakdown).toEqual([]);
    });
    test("zero devices: dollars, enter your devices, no tags, no breakdown", () => {
        const v = view(0, 0, "annual");
        expect([v.annual, v.monthly, v.lifetime].every((c) => c.main === "$0.00" && c.sub === "enter your devices" && c.tag === "")).toBe(true);
        expect(v.verdict).toBe(EMPTY_VERDICT);
        expect(v.breakdown).toEqual([]);
    });
    test("defaults: annual is cheaper and tagged, with its own breakdown", () => {
        const v = view(25, 10, "annual");
        expect(v.annual.tag).toBe("Lower first-year cost");
        expect(v.monthly.tag).toBe("");
        expect(v.annual.sub).toMatch(/^a year, about \$[\d,]+\.\d\d a month$/);
        expect(v.lifetime.sub).toBe("paid once, nothing to renew");
        expect(v.verdict).toMatch(/^Annual saves you \$[\d,.]+ in the first year\./);
        expect(v.breakdown[0]).toMatch(/Mac packs? .*\(\d+ licenses\)\.$/);
        expect(v.breakdown.some((l) => l.startsWith("Annual means 10 months' price for 12"))).toBe(true);
    });
    test("when monthly is cheaper (not at the seed prices) the verdict says what rolls over", () => {
        const dear = createPricing({ ...fleetPricesFrom(undefined), macYear: 9000 });
        const v = renderQuote(dear.compare({ macs: 1, ios: 0 }), "monthly");
        expect(v.monthly.tag).toBe("Lower first-year cost");
        expect(v.annual.tag).toBe("");
        expect(v.verdict).toMatch(/^Monthly costs \$[\d,.]+ less in the first year\. 9 licenses in your packs aren't in use yet \(worth \$[\d,.]+\); they roll over and cover the devices you add next\./);
        expect(v.breakdown[0]).toBe("Month to month at list price, no commitment. Pay for a year at once and two months are free.");
    });
    test("lifetime breakdown and the five-year sentence", () => {
        const v = view(100, 100, "lifetime", 1);
        expect(v.lifetime.tag).toBe("Lowest over 5 years");
        expect(v.verdict).toMatch(/Over five years, lifetime costs \$[\d,.]+ against \$[\d,.]+ on annual and \$[\d,.]+ month to month\.$/);
        const lines = v.breakdown;
        expect(lines[0]).toMatch(/^10 Mac packs \+ 10 iPhone & iPad packs \(200 licenses\), bought once, with 20% off\.$/);
        expect(lines.some((l) => l.startsWith("A lifetime license costs 3 years of the annual price."))).toBe(true);
        expect(lines.some((l) => l.startsWith("Dedicated instance: $300.00 one-time setup + $300.00 a year of hosting"))).toBe(true);
        expect(lines.some((l) => l.startsWith("Every year after: $300.00 for the dedicated instance."))).toBe(true);
        expect(lines[lines.length - 1]).toMatch(/^Over five years: /);
    });
    test("dedicated on monthly says a month; year two says a month too", () => {
        const v = view(20, 0, "monthly", 1);
        expect(v.breakdown.some((l) => l === "Dedicated instance: $300.00 one-time setup + $30.00 a month, on your own URL.")).toBe(true);
        expect(v.breakdown.some((l) => /^Year two with the same devices and instance: .* \(\$[\d,.]+ a month\)\.$/.test(l))).toBe(true);
    });
});
