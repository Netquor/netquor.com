// local.test.ts: the Fargo-Moorhead page keeps its promises: every provider row names a source link, the facts carry the check date, no private or invented claims, and the structured data ties to the home page's LocalBusiness.
import { describe, expect, test } from "bun:test";
import { CHECKED, localFaq, localJsonLd, localMeta, localPage } from "./data";
import type { Block } from "../programs/types";

const blocks = (): Block[] => localPage().items.flatMap((i) => (i.kind === "section" ? i.blocks : []));
const table = () => blocks().find((b) => b.kind === "table") as Extract<Block, { kind: "table" }>;

describe("local page", () => {
    test("every provider row links its own source page over https", () => {
        const rows = table().rows;
        expect(rows.length).toBeGreaterThanOrEqual(4);
        for (const r of rows) expect(r[2]).toMatch(/href="https:\/\/[^"]+" target="_blank" rel="noopener"/);
    });
    test("the facts carry their check date", () => {
        expect(CHECKED).toBe("November 11, 2026");
        expect(JSON.stringify(localPage())).toContain(`as of ${CHECKED}`);
    });
    test("it never claims to be an internet provider or invents proof", () => {
        const text = JSON.stringify(localPage()).toLowerCase();
        expect(text).toContain("does not sell");
        for (const bad of ["#1", "best in fargo", "award", "customers love", "guarantee", "cheapest", "fastest"]) expect(text).not.toContain(bad);
    });
    test("Phone is described as early access", () => {
        expect(JSON.stringify(localPage())).toContain("early access");
    });
    test("title and description fit search results", () => {
        expect(localMeta.title.length).toBeLessThanOrEqual(70);
        expect(localMeta.description.length).toBeLessThanOrEqual(260);
        expect(localMeta.title).toContain("Fargo-Moorhead");
    });
    test("structured data links to the LocalBusiness and lists every question", () => {
        const ld = localJsonLd("https://www.netquor.com") as { "@graph": { "@type": string; about?: { "@id": string }; mainEntity?: unknown[] }[] };
        const [pageNode, faq] = ld["@graph"];
        expect(pageNode.about?.["@id"]).toBe("https://www.netquor.com/#local");
        expect(faq.mainEntity).toHaveLength(localFaq.length);
        expect(JSON.stringify(ld)).not.toContain("<a ");
    });
});
