import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { assetVersions } from "../../assets";
import { renderSvelte } from "../../server/svelteHarness";
import { privacyPage } from "../privacy/data";
import { termsPage } from "../terms/data";
import { commissionRows, partnersPage } from "../partners/data";
import { referralsPage } from "../referrals/data";
import { halfPrice, startupsPage } from "../startups/data";
import { cents, usd } from "./money";
import type { Block, ProgramPageData } from "./types";

const seed = { "fleet.mac.month": { amountCents: 595 }, "fleet.mobile.month": { amountCents: 395 } };
const assets = assetVersions((f) => `h-${f.replace(/\W/g, "")}`);
const render = (page: ProgramPageData) => renderSvelte("lib/pages/programs/ProgramPage.svelte", { page, assets }, { prices: {}, priceVersion: 1 }).then((r) => r.body);
const blocks = (p: ProgramPageData): Block[] => p.items.flatMap((i) => (i.kind === "section" ? [...i.blocks] : []));

describe("money", () => {
    test("usd prints two decimals and thousands separators", () => {
        expect(usd(79200)).toBe("$792.00");
        expect(usd(190080)).toBe("$1,900.80");
        expect(usd(595)).toBe("$5.95");
    });
    test("cents reads the snapshot first, then the seed fallback, and throws for an unknown key", () => {
        expect(cents({ "fleet.mac.month": { amountCents: 700 } }, "fleet.mac.month")).toBe(700);
        expect(cents(undefined, "fleet.mac.month")).toBe(595);
        expect(() => cents(undefined, "no.such")).toThrow();
    });
});

describe("startups data", () => {
    test("half price per device rounds half up to the cent", () => {
        expect(halfPrice(595)).toBe("$2.98");
        expect(halfPrice(395)).toBe("$1.98");
    });
    test("the Fleet row follows the price snapshot", () => {
        const row = (prices: typeof seed) => (blocks(startupsPage(prices)).find((b) => b.kind === "table") as Extract<Block, { kind: "table" }>).rows[0][1];
        expect(row(seed)).toContain("About $2.98 a Mac and $1.98 an iPhone or iPad a month.");
        expect(row({ ...seed, "fleet.mac.month": { amountCents: 800 } })).toContain("About $4.00 a Mac");
    });
});

describe("partners data", () => {
    test("the commission examples at the published prices are the figures the legacy page prints", () => {
        expect(commissionRows(595, 395)).toEqual([
            ["One referred customer, 8 Macs and 8 iPhones", "8 x $5.95 + 8 x $3.95 = $79.20 a month. 20% = $15.84", "$15.84 a month, $190.08 over 12 months"],
            ["Ten referred customers like that", "10 x $79.20 = $792.00 a month. 20% = $158.40", "$158.40 a month, $1,900.80 over 12 months"],
            ["If those ten customers pay annually", "Annual Fleet pays for 10 months of the monthly price: $7,920.00 a year. 20% = $1,584.00", "$1,584.00 for the year"],
            ["If a customer qualifies for startup pricing", "Half price for 12 months, so the base halves: $39.60 a month. 20% = $7.92", "$7.92 a month for that customer"],
        ]);
    });
    test("a changed price recomputes every example", () => {
        const rows = commissionRows(600, 400);
        expect(rows[0][1]).toBe("8 x $6.00 + 8 x $4.00 = $80.00 a month. 20% = $16.00");
    });
    test("the four role cards link to a mailto with the title encoded", async () => {
        const html = await render(partnersPage(seed));
        expect(html).toContain("subject=Work%20with%20Netquor%3A%20Attention%20to%20detail%3A%20QA%20and%20documentation");
        expect(html).toContain("Tell us about yourself");
    });
});

describe("ProgramPage", () => {
    test("renders the hero, sections, rules, FAQ and the call to action of each page", async () => {
        for (const page of [startupsPage(seed), referralsPage(), partnersPage(seed)]) {
            const html = await render(page);
            expect(html).toContain(`<h1 class="mb-3">${page.hero.title}</h1>`);
            expect(html).toContain('class="nq-faq"');
            expect(html).toContain('class="nq-section-head"');
            expect(html.match(/class="nq-rule"/g)?.length).toBe(page.items.filter((i) => i.kind === "rule").length);
        }
    });
    test("anchors the hero buttons point at exist as section ids", async () => {
        for (const page of [startupsPage(seed), referralsPage(), partnersPage(seed)]) {
            const html = await render(page);
            for (const a of [page.hero.primary.href, page.hero.secondary.href].filter((h) => h.startsWith("#"))) expect(html).toContain(`id="${a.slice(1)}"`);
        }
    });
    test("metadata matches the generator's titles", () => {
        expect(startupsPage(seed).meta.title).toBe("Netquor for startups: half price Fleet for 12 months | Netquor");
        expect(referralsPage().meta.title).toBe("Refer a business: $25 credit each, on any product | Netquor");
        expect(partnersPage(seed).meta.title).toBe("Work with Netquor: channel partners and open roles | Netquor");
    });
});

describe("legal pages", () => {
    test("terms has its thirteen numbered clauses and privacy its eleven plus the changes clause", () => {
        expect(termsPage.blocks.filter((b) => b.k === "h3")).toHaveLength(13);
        expect(privacyPage.blocks.filter((b) => b.k === "h3")).toHaveLength(12);
        expect(termsPage.meta.title).toBe("Terms of Use");
        expect(privacyPage.meta.title).toBe("Privacy Policy");
    });
    test("the liability cap and the mobile-information promise are kept word for word", () => {
        expect(JSON.stringify(termsPage.blocks)).toContain("the twelve (12) months preceding the claim, or $100 USD, whichever is greater.");
        expect(JSON.stringify(privacyPage.blocks)).toContain("Your mobile information will not be sold or shared with third parties for promotional or marketing purposes.");
    });
});

// What the built server does with the five routes (run `bun run build` first; skipped when there is no build). `bun run parity <page>.html` is the full check; this pins that each page is a Svelte route that answers 200.
const built = existsSync(join(import.meta.dir, "../../../../build/index.js"));
describe.skipIf(!built)("built server", () => {
    test("each program and legal page answers 200 with its own content", async () => {
        const { startServer } = await import("../../../../scripts/parity/run");
        const srv = await startServer({ build: false });
        try {
            const want: Record<string, string> = {
                "/startups.html": "Half price Fleet for 12 months", "/referrals.html": "Refer a business, you both get a credit", "/partners.html": "Refer or resell our services",
                "/terms.html": "1. Acceptance of Terms", "/privacy.html": "1. Scope of This Policy",
            };
            for (const [path, text] of Object.entries(want)) {
                const r = await fetch(srv.base + path);
                expect(r.status).toBe(200);
                expect(await r.text()).toContain(text);
            }
        } finally { srv.stop(); }
    }, 60_000);
});
