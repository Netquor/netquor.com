// The server-rendered Calc and LeadForm (what a visitor sees before any JavaScript runs) against the legacy markup, and the page's removal of the legacy scripts.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PRICE_FALLBACKS } from "../../priceFallbacks";
import { renderSvelte } from "../../server/svelteHarness";

const WEB = join(import.meta.dir, "../../../..");
const legacy = readFileSync(join(WEB, "../fleet.html"), "utf8");
const seedPrices = Object.fromEntries(Object.entries(PRICE_FALLBACKS));
const data = { prices: seedPrices, priceVersion: 1, origin: "https://www.netquor.com", assets: { fleetJs: "a", fleetCss: "a", nav: "a", navJs: "a", analytics: "a", nudge: "a" } };

const norm = (s: string): string => s.replace(/<!--.*?-->/g, "").replace(/\s+/g, " ").replace(/&nbsp;/g, "\u00a0").replace(/&mdash;/g, "\u2014").replace(/&amp;/g, "&").replace(/> </g, "><").trim();
const block = (html: string, startMarker: string, endMarker: string): string => { const a = html.indexOf(startMarker); return norm(html.slice(a, html.indexOf(endMarker, a))); };

describe("server-rendered markup", () => {
    test("the calculator is the legacy block, complete without JavaScript", async () => {
        const { body } = await renderSvelte("lib/pages/fleet/Calc.svelte", {}, data);
        const calc = norm(body);
        expect(calc).toContain('id="annual-main">\u2014<');
        expect(calc).toContain('class="plan-card on" id="term-annual" aria-pressed="true"');
        expect(calc).toContain('class="plan-card" id="term-monthly" aria-pressed="false"');
        for (const id of ["annual", "monthly", "lifetime"]) expect(calc).toContain(`id="${id}-tag"></span>`);
        // The same ids, in the same order, as the legacy block.
        const ids = (h: string) => [...h.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
        expect(ids(calc)).toEqual(ids(block(legacy, '<div class="calc card" id="calc">', "</section>")));
        expect(calc).toContain('value="25"');
        expect(calc).toContain('id="calc-error" role="status"></p>');
    });
    test("the form is the legacy form: no action, novalidate, the same fields and defaults", async () => {
        const { body } = await renderSvelte("lib/pages/fleet/LeadForm.svelte", {}, data);
        const form = norm(body);
        expect(form).not.toMatch(/action=/);
        expect(form).toContain('id="lead-form" class="card form" novalidate');
        expect(form).not.toContain("data-touched");
        const names = (h: string) => [...h.matchAll(/<(?:input|textarea)[^>]*\bname="([^"]+)"/g)].map((m) => m[1]);
        expect(names(form)).toEqual(names(block(legacy, '<form id="lead-form"', "</form>")));
        expect(form).toContain('name="macs" type="number" min="0" max="100000" value="0"');
        expect(form).toContain('name="term" value="annual"');
        expect(form).toContain('name="dedicated" value="0"');
        expect(form).toContain('id="lead-status" class="status" role="status" aria-live="polite"></p>');
    });
    test("the page no longer loads fleet/site.js or fleet/pricing.js", () => {
        const page = readFileSync(join(WEB, "src/routes/(fleet)/fleet.html/+page.svelte"), "utf8");
        const code = page.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
        expect(code).not.toMatch(/fleetJs|site\.js|pricing\.js|loadScript/);
        expect(code).toContain("provideFleetModel");
    });
});
