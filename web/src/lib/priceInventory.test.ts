// priceInventory.test.ts: the price inventory covers every dollar amount on the legacy pages, every key it names is in the seed with the amount the page shows, and the seed keeps its original keys and values.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateSnapshot } from "#server/prices/snapshot";
import { buildInventory, legacyPages, repoRoot, scanHtml, type Entry } from "../../migration/scan-prices";

const seedRaw = JSON.parse(readFileSync(join(repoRoot, "server/data/prices.seed.json"), "utf8"));
const seed: Record<string, { amountCents: number; currency: string; unit?: string }> = seedRaw.prices;
const stored = JSON.parse(readFileSync(join(repoRoot, "web/migration/price-inventory.json"), "utf8")) as { pages: Record<string, Entry[]> };
const live = buildInventory();

// the sixteen keys that existed before the inventory, with their values: they must never change here
const ORIGINAL: Record<string, number> = {
    "digitalaccess.plus.month": 999, "digitalaccess.pro.month": 5999, "digitalaccess.scale.month": 19900,
    "fleet.dedicated.month": 3000, "fleet.dedicated.setup": 30000, "fleet.dedicated.year": 30000,
    "fleet.mac.lifetime": 17850, "fleet.mac.month": 595, "fleet.mac.year": 5950,
    "fleet.mobile.lifetime": 11850, "fleet.mobile.month": 395, "fleet.mobile.year": 3950,
    "homeassistant.from.month": 1200, "network.from.month": 649, "phone.planned_launch.month": 2500,
    "vpn.from.month": 500, "vpn.to.month": 3000,
};

describe("the seed", () => {
    test("is a valid seed snapshot", () => {
        const v = validateSnapshot(seedRaw);
        expect(v.ok).toBe(true);
        expect(seedRaw.source).toBe("seed");
    });
    test("keeps every original key and value", () => {
        for (const [k, cents] of Object.entries(ORIGINAL)) expect(seed[k]?.amountCents).toBe(cents);
    });
    test("every price is USD with a unit and its keys are sorted", () => {
        for (const e of Object.values(seed)) { expect(e.currency).toBe("USD"); expect(typeof e.unit).toBe("string"); }
        const keys = Object.keys(seed); expect(keys).toEqual([...keys].sort());
    });
    test("Phone has only the planned launch key and nothing that implies billing", () => {
        expect(Object.keys(seed).filter((k) => k.startsWith("phone."))).toEqual(["phone.planned_launch.month"]);
        expect(seed["phone.planned_launch.month"].unit).toContain("not billed");
    });
    test("year, lifetime and bundle relations hold", () => {
        expect(seed["fleet.mac.year"].amountCents).toBe(seed["fleet.mac.month"].amountCents * 10);
        expect(seed["fleet.mobile.year"].amountCents).toBe(seed["fleet.mobile.month"].amountCents * 10);
        expect(seed["fleet.mac.lifetime"].amountCents).toBe(seed["fleet.mac.year"].amountCents * 3);
        expect(seed["fleet.mobile.lifetime"].amountCents).toBe(seed["fleet.mobile.year"].amountCents * 3);
        expect(seed["vpn.lite.month"].amountCents).toBe(seed["vpn.from.month"].amountCents);
        expect(seed["vpn.gigabit.month"].amountCents).toBe(seed["vpn.to.month"].amountCents);
        expect(seed["network.homelab.month"].amountCents).toBe(seed["network.from.month"].amountCents);
        expect(seed["homeassistant.resilient.month"].amountCents).toBe(seed["homeassistant.from.month"].amountCents);
    });
});

describe("the inventory", () => {
    test("classifies every price on every legacy page", () => {
        expect(live.unclassified).toEqual([]);
    });
    test("price-inventory.json is what the scan produces now", () => {
        expect(stored.pages).toEqual(live.pages);
    });
    test("every legacy page with a dollar amount is listed, and no page is invented", () => {
        const withAmounts = legacyPages().filter((f) => scanHtml(readFileSync(join(repoRoot, f), "utf8"), f).length > 0);
        expect(Object.keys(stored.pages).sort()).toEqual(withAmounts);
    });
    test("every entry has text containing its amount, a valid kind and a seed key or null", () => {
        for (const [file, entries] of Object.entries(stored.pages)) for (const e of entries) {
            const where = `${file}:${e.line}`;
            expect(["price", "derived", "range-part", "jsonld"], where).toContain(e.kind);
            expect(typeof e.note, where).toBe("string");
            if (e.kind === "jsonld") expect(e.text, where).toContain("price");
            else if (e.text.includes("price ")) expect(e.text, where).toContain(e.amount);
            else expect(e.text, where).toContain(e.amount);
            if (e.key !== null) expect(seed[e.key], `${where} ${e.key}`).toBeDefined();
        }
    });
    test("a keyed price shows the amount the seed holds", () => {
        for (const [file, entries] of Object.entries(stored.pages)) for (const e of entries) {
            if (e.key === null) continue;
            const shown = Number(e.amount.replace(/[$,]/g, ""));
            expect(Math.round(shown * 100), `${file}:${e.line} ${e.key}`).toBe(seed[e.key].amountCents);
        }
    });
    test("derived entries never carry a key and always explain themselves", () => {
        for (const entries of Object.values(stored.pages)) for (const e of entries.filter((x) => x.kind === "derived")) {
            expect(e.key).toBeNull(); expect(e.note.length).toBeGreaterThan(5);
        }
    });
    test("every seed key is used by the inventory or is one of the original keys", () => {
        const used = new Set(Object.values(stored.pages).flat().map((e) => e.key).filter(Boolean));
        for (const k of Object.keys(seed)) expect(used.has(k) || k in ORIGINAL, k).toBe(true);
    });
    test("the unresolved Business plan price has no key", () => {
        expect(seed["network.business.month"]).toBeUndefined();
        const biz = stored.pages["network.html"].filter((e) => e.amount.includes("129.49") || e.amount === "$99");
        expect(biz.length).toBeGreaterThan(0);
        for (const e of biz) { expect(e.key).toBeNull(); expect(e.note).toContain("CONFLICT"); }
    });
});

describe("the scanner", () => {
    test("handles the price forms the pages use", () => {
        const html = [
            "<p>$5.95 per Mac, from $6.49, $59.50 a year, $178.50, $1,500 a year, $5 to $30</p>",
            `<meta name="description" content="Pay $12 a month.">`,
            `<script type="application/ld+json">{"name": "Plus", "price": "9.99"}</script>`,
            "<p>Save 25% and 3 devices</p>",
        ].join("\n");
        const hits = scanHtml(html, "x.html");
        expect(hits.map((h) => h.value)).toEqual([5.95, 6.49, 59.5, 178.5, 1500, 5, 30, 12, 9.99]);
        expect(hits.find((h) => h.value === 12)!.text).toContain("Pay $12 a month");
        expect(hits.find((h) => h.value === 9.99)!.jsonld).toBe(true);
    });
    test("percentages and bare numbers are not prices", () => {
        expect(scanHtml("<p>25% off, 10 devices, AS403008, 1 Gbps</p>", "x.html")).toEqual([]);
    });
});
