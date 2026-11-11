import { describe, expect, test } from "bun:test";
import { baselineText } from "../../baselineFiles";
import { assetVersions } from "../../assets";
import { renderSvelte } from "../../server/svelteHarness";
import { CHECKLISTS, ORDER } from "./data";

const data = { assets: assetVersions((f) => `h-${f.replace(/\W/g, "")}`), origin: "https://www.netquor.com", prices: {}, priceVersion: 1 };

describe("readiness data", () => {
    test("four checklists of seven questions, in the legacy order", () => {
        expect(CHECKLISTS.map((c) => c.key)).toEqual([...ORDER]);
        for (const c of CHECKLISTS) { expect(c.qs.length).toBe(7); expect(c.icon).toMatch(/^bi-/); }
    });
    test("the titles, calls to action and question count of readiness-data.json match what readiness.js carries", () => {
        const js = baselineText("readiness.js");
        const embedded = JSON.parse(/var DATA = (\{.*\});/.exec(js)![1]) as Record<string, { title: string; qs: string[][]; cta: string[]; calc: string[] }>;
        for (const c of CHECKLISTS) {
            expect(embedded[c.key].title).toBe(c.title);
            expect(embedded[c.key].cta).toEqual([...c.cta]);
            expect(embedded[c.key].calc).toEqual([...c.calc]);
            // The gap texts in readiness.js lag readiness-data.json in the legacy files (the call-handling copy was edited in the JSON only). The page keeps the legacy behaviour: readiness.js is loaded unchanged, so the result boxes show its text. Same number of questions, though.
            expect(embedded[c.key].qs.length).toBe(c.qs.length);
        }
    });
});

describe("readiness page", () => {
    test("server-renders every question as Yes / Not yet radios with the names readiness.js reads, and an empty hidden result box", async () => {
        const { body, head } = await renderSvelte("routes/(site)/readiness.html/+page.svelte", { data }, data);
        for (const c of CHECKLISTS) {
            expect(body).toContain(`<section class="nq-check" id="${c.key}" data-key="${c.key}" aria-labelledby="${c.key}-t">`);
            for (let i = 0; i < 7; i++) expect(body).toContain(`name="${c.key}-${i}" value="1"`);
        }
        expect((body.match(/<input type="radio"/g) ?? []).length).toBe(4 * 7 * 2);
        expect((body.match(/class="nq-check-result" aria-live="polite" hidden/g) ?? []).length).toBe(4);
        expect(head).toContain('rel="canonical" href="https://www.netquor.com/readiness.html"');
    });
});
