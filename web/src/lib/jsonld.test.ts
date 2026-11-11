import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stampHtml } from "#server/prices/stamp";
import { withPrices } from "./jsonld";
import { PRICE_FALLBACKS, resetPriceWarnings } from "./priceFallbacks";
import { snap } from "./server/testkit";

beforeEach(() => resetPriceWarnings());
const quiet = () => {};

describe("withPrices", () => {
    const ld = { offers: [{ price: "1", n: 2 }, { price: 3 }], a: { b: "x" } };
    test("a string stays a string, a number stays a number, other values are untouched, the input is not changed", () => {
        const prices = snap(1, { "fleet.mac.month": 595, "vpn.from.month": 500 }).prices;
        const out = withPrices(ld, { "/offers/0/price": "fleet.mac.month", "/offers/1/price": "vpn.from.month|int" }, prices, 1, quiet) as typeof ld;
        expect(out.offers[0]).toEqual({ price: "5.95", n: 2 });
        expect(out.offers[1]).toEqual({ price: 500 });
        expect(out.a).toEqual({ b: "x" });
        expect(ld.offers[0].price).toBe("1");
    });
    test("formats: plain is the default, usd0 and usd carry the symbol", () => {
        const prices = snap(1, { "vpn.from.month": 500 }).prices;
        const run = (spec: string) => (withPrices({ p: "" }, { "/p": spec }, prices, 1, quiet) as { p: string }).p;
        expect(run("vpn.from.month")).toBe("5");
        expect(run("vpn.from.month|usd0")).toBe("$5");
        expect(run("vpn.from.month|usd")).toBe("$5.00");
    });
    test("a pointer with ~1 reaches a key with a slash", () => {
        expect((withPrices({ "a/b": { c: "0" } }, { "/a~1b/c": "vpn.from.month" }, snap(1).prices, 1, quiet) as { "a/b": { c: string } })["a/b"].c).toBe("5");
    });
    test("a key missing from the snapshot uses the last-known seed price; a key nowhere keeps the value as written; neither throws", () => {
        const empty = snap(1, {}).prices;
        const lines: string[] = [];
        const out = withPrices({ p: "9", q: "7" }, { "/p": "vpn.from.month", "/q": "no.such.key" }, empty, 1, (l) => lines.push(l)) as { p: string; q: string };
        expect(out.p).toBe(String(PRICE_FALLBACKS["vpn.from.month"].amountCents / 100));
        expect(out.q).toBe("7");
        expect(lines.length).toBe(2);
    });
    test("mistakes in the page throw: missing pointer, bad pointer, unknown format, a value that is not a string or number", () => {
        const prices = snap(1).prices;
        expect(() => withPrices({ a: "1" }, { "/b": "vpn.from.month" }, prices)).toThrow(/does not exist/);
        expect(() => withPrices({ a: "1" }, { "a": "vpn.from.month" }, prices)).toThrow(/JSON pointer/);
        expect(() => withPrices({ a: "1" }, { "/a": "vpn.from.month|euro" }, prices)).toThrow(/unknown format/);
        expect(() => withPrices({ a: { x: 1 } }, { "/a": "vpn.from.month" }, prices)).toThrow(/not a string or a number/);
    });
    test("gives the same JSON-LD as the legacy stamper does for the legacy home page", () => {
        const html = readFileSync(join(import.meta.dir, "../../../index.html"), "utf8");
        const m = /<script type="application\/ld\+json" data-price-map='([^']*)'>([\s\S]*?)<\/script>/.exec(html);
        expect(m).not.toBeNull();
        const map = JSON.parse(m![1]) as Record<string, string>;
        const shifted = snap(9, Object.fromEntries(Object.values(map).map((s, i) => [s.split("|")[0], 1000 + i * 111])));
        const stamped = stampHtml(`<html><body><script type="application/ld+json" data-price-map='${m![1]}'>${m![2]}</script></body></html>`, shifted);
        const legacyLd = JSON.parse(/<script[^>]*>([\s\S]*?)<\/script>/.exec(stamped)![1]);
        expect(withPrices(JSON.parse(m![2]), map, shifted.prices, 9, quiet)).toEqual(legacyLd);
        expect(JSON.stringify(legacyLd)).not.toBe(JSON.stringify(JSON.parse(m![2])));
    });
});
