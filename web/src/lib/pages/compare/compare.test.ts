import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assetVersions } from "../../assets";
import { renderSvelte } from "../../server/svelteHarness";
import { CATEGORIES, TABS, type Part } from "./data";

const REPO = join(import.meta.dir, "../../../../..");
const seedKeys = new Set(Object.keys((JSON.parse(readFileSync(join(REPO, "server/data/prices.seed.json"), "utf8")) as { prices: Record<string, unknown> }).prices));
const data = { assets: assetVersions((f) => `h-${f.replace(/\W/g, "")}`), origin: "https://www.netquor.com", prices: {}, priceVersion: 1 };

const priceKeys = CATEGORIES.flatMap((c) => c.rows.flatMap((r) => r.price.filter((p): p is Exclude<Part, string> => typeof p !== "string").map((p) => p.price)));

describe("compare data", () => {
    test("six categories, each with a tab, a table and an Our view note; Netquor's rows come first", () => {
        expect(CATEGORIES.map((c) => `#${c.id}`)).toEqual(TABS.map((t) => t.href));
        for (const c of CATEGORIES) { expect(c.rows[0].mine).toBe(true); expect(c.view.length).toBeGreaterThan(20); }
    });
    test("every Netquor price on the page is a key of the price seed (the source of truth), and the expected keys of the table are used", () => {
        for (const k of priceKeys) expect(seedKeys.has(k)).toBe(true);
        // the nav's vpn.from.month is the shell's; the table's own keys are all rendered
        for (const k of ["fleet.mac.month", "fleet.mobile.month", "phone.planned_launch.month", "vpn.to.month", "network.from.month", "homeassistant.from.month", "digitalaccess.plus.month"]) expect(priceKeys).toContain(k);
    });
    test("competitor prices stay literal text", () => {
        const text = CATEGORIES.flatMap((c) => c.rows.filter((r) => !r.mine)).flatMap((r) => r.price).filter((p) => typeof p === "string");
        expect(text.length).toBeGreaterThan(20);
    });
});

describe("compare page", () => {
    test("server-renders the tables with the price markers, ids and open state", async () => {
        const { body, head } = await renderSvelte("routes/(site)/compare.html/+page.svelte", { data }, data);
        expect(body).toMatch(/<details id="apple" open/);
        for (const c of CATEGORIES) expect(body).toContain(`id="${c.id}"`);
        expect((body.match(/class="nq-me"/g) ?? []).length).toBe(CATEGORIES.reduce((n, c) => n + c.rows.filter((r) => r.mine).length, 0));
        expect(body).toContain('data-price="fleet.mac.month"');
        expect(body).toContain('data-price="vpn.to.month"');
        expect(body).toContain("<em>third-party</em>");
        expect(head).toContain('rel="canonical" href="https://www.netquor.com/compare.html"');
        expect(head).toContain("checked November 10, 2026 against");
    });
});
