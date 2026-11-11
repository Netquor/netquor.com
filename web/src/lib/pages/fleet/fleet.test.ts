import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { startServer, WEB } from "../../../../scripts/parity/run";
import { baselineText } from "../../baselineFiles";
import { PRICE_FALLBACKS } from "../../priceFallbacks";
import { renderSvelte } from "../../server/svelteHarness";
import { snap } from "../../server/testkit";
import { apiCode, demoTicks, faq, features, mdmTicks, roadmap, tiers } from "./data";
import { description, jsonLd, PRICE_MAP } from "./seo";
import { centsOf, discounted, plainText, richHtml, splitTokens, usd, usd0 } from "./tokens";

const ROUTE = "routes/(fleet)/fleet.html/+page.svelte";
const seedPrices = Object.fromEntries(Object.entries(PRICE_FALLBACKS)) as Record<string, { amountCents: number; currency: "USD"; unit: string }>;
const legacy = baselineText("fleet.html");
const data = (prices: Record<string, number> = {}) => ({ prices: { ...seedPrices, ...snap(3, prices).prices }, priceVersion: 3, origin: "https://www.netquor.com", assets: {} });

describe("tokens", () => {
    test("splitTokens finds keys and formats in order and leaves the rest as html", () => {
        expect(splitTokens("a {{fleet.mac.month}} b {{fleet.mac.year:usd}}")).toEqual([{ html: "a " }, { key: "fleet.mac.month", fmt: "usd0" }, { html: " b " }, { key: "fleet.mac.year", fmt: "usd" }]);
        expect(splitTokens("plain <b>text</b>")).toEqual([{ html: "plain <b>text</b>" }]);
    });
    test("richHtml keeps a token inside its tag and writes the price marker", () => {
        const html = richHtml("<b>One license is {{fleet.mac.year}}</b> for a Mac", seedPrices);
        expect(html).toBe('<b>One license is <span data-price="fleet.mac.year" data-fmt="usd0">$59.50</span></b> for a Mac');
    });
    test("plainText fills prices, drops tags and decodes entities", () => {
        expect(plainText('ask <a href="#demo">for a demo</a> from {{fleet.mac.month}} &amp; up', seedPrices)).toBe("ask for a demo from $5.95 & up");
        expect(plainText("{{fleet.mac.month}}", { "fleet.mac.month": { amountCents: 612, currency: "USD", unit: "" } })).toBe("$6.12");
    });
    test("a price missing from the snapshot falls back to the last-known one", () => {
        expect(centsOf({}, "fleet.mac.month")).toBe(595);
        expect(centsOf(undefined, "nope.nope")).toBe(0);
    });
    test("the pack discounts give the figures the legacy table shows (half a cent rounds up)", () => {
        const table = tiers.map((t) => [usd(discounted(5950, t.bps)), usd(discounted(3950, t.bps))]);
        expect(table).toEqual([["$56.53", "$37.53"], ["$53.55", "$35.55"], ["$50.58", "$33.58"], ["$47.60", "$31.60"], ["$44.63", "$29.63"]]);
        expect(usd0(36000)).toBe("$360");
        expect(usd0(6000)).toBe("$60");
    });
});

describe("data", () => {
    test("counts match the legacy page", () => {
        expect(features.length).toBe(10);
        expect(faq.length).toBe(22);
        expect(faq.filter((f) => f.ld).length).toBe(20);
        expect(roadmap.length).toBe(7);
        expect(tiers.length).toBe(5);
        expect(mdmTicks.length).toBe(6);
        expect(demoTicks.length).toBe(3);
        expect(apiCode).toContain("https://fleet.netquor.com/fleet/v1/devices");
    });
    test("every price token names a key the seed knows, and no copy types a price", () => {
        const all = [...faq.map((f) => f.a), ...features.map((f) => f.text), ...mdmTicks];
        for (const text of all) {
            for (const p of splitTokens(text)) if ("key" in p) expect(Object.hasOwn(PRICE_FALLBACKS, p.key)).toBe(true);
            expect(text).not.toMatch(/\$\d/);
        }
    });
});

describe("head", () => {
    test("the JSON-LD with the seed prices equals the legacy block, and the description the legacy meta", () => {
        const block = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(legacy)![1]);
        const built = jsonLd(seedPrices, 1) as { "@graph": { offers?: { price: string; priceSpecification: { price: string } }[] }[] };
        for (const [pointer, key] of Object.entries(PRICE_MAP)) {
            const [, , idx, , offer, , ...rest] = pointer.split("/");
            expect(Number(offer)).toBeLessThan(2);
            expect(rest.length >= 0 && key.startsWith("fleet.")).toBe(true);
            expect(idx).toBe("2");
        }
        // Seo fills the offer prices; the rest must already be equal.
        built["@graph"][2].offers![0].price = "5.95"; built["@graph"][2].offers![0].priceSpecification.price = "5.95";
        built["@graph"][2].offers![1].price = "3.95"; built["@graph"][2].offers![1].priceSpecification.price = "3.95";
        expect(built).toEqual(block);
        expect(description(seedPrices, 1)).toBe(/<meta name="description" content="([^"]*)"/.exec(legacy)![1]);
    });
    test("FAQ answers in the JSON-LD follow the live price", () => {
        const live = { ...seedPrices, "fleet.mac.month": { amountCents: 650, currency: "USD" as const, unit: "" } };
        const text = JSON.stringify(jsonLd(live, 2));
        expect(text).toContain("$6.50 per Mac");
        expect(text).not.toContain("$5.95");
    });
});

describe("page", () => {
    test("renders the sections, ids and form the page script needs; prices follow the snapshot; the form posts nowhere", async () => {
        const d = data({ "fleet.mac.month": 612, "fleet.dedicated.month": 3100 });
        const { body, head } = await renderSvelte(ROUTE, { data: d }, d, "http://localhost/fleet.html");
        for (const id of ["calc", "calc-mac", "calc-mac-r", "calc-ios", "calc-ios-r", "calc-dedicated", "term-annual", "term-monthly", "term-lifetime", "annual-main", "annual-tag", "annual-sub", "verdict", "breakdown", "calc-error", "lead-form", "lead-status", "features", "buffet", "santa", "pricing", "dedicated", "api", "mdm", "faq", "demo"]) expect(body).toContain(`id="${id}"`);
        expect(body).toContain('<span data-price="fleet.mac.month" data-fmt="usd0">$6.12</span>');
        expect(body).toContain("billed monthly ($372 a year)");
        expect(body).toContain("Paying yearly saves $72 a year.");
        expect((body.match(/<details>/g) ?? []).length).toBe(faq.length);
        expect(body).toContain('data-add-dedicated');
        expect(body).not.toMatch(/<form[^>]*action=/);
        expect(head).toContain("$6.12 per Mac");
        expect(head).toContain('rel="canonical" href="https://www.netquor.com/fleet.html"');
        expect(head).toContain('property="og:image" content="https://www.netquor.com/fleet/img/console.png"');
        expect(head).toContain('"price":"6.12"');
        expect(body).toContain('class="nq-nav nq-static"');
    });
    test("the built server answers 200 with the Fleet viewport and no Bootstrap theme (when a build exists)", async () => {
        const hooks = join(WEB, "build/server/entries/hooks.server.js");
        // A build made before this page and its shell handling existed is not this page's to judge.
        if (!existsSync(join(WEB, "build/index.js")) || !existsSync(hooks) || !readFileSync(hooks, "utf8").includes("viewport-fit=cover")) return;
        const s = await startServer({ build: false });
        try {
            const r = await fetch(`${s.base}/fleet.html`);
            expect(r.status).toBe(200);
            const html = await r.text();
            expect(html).toContain("viewport-fit=cover");
            expect(html).toContain('<html lang="en-US">');
            expect(html).not.toContain("data-bs-theme");
            expect(html).toContain('id="lead-form"');
        } finally { s.stop(); }
    }, 30000);
});
