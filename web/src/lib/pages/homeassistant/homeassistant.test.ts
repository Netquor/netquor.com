import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { startServer, WEB } from "../../../../scripts/parity/run";
import { PRICE_FALLBACKS, resetPriceWarnings } from "../../priceFallbacks";
import { renderSvelte } from "../../server/svelteHarness";
import { snap } from "../../server/testkit";
import { EXTRAS, JSON_LD, PRICE_MAP, TIERS } from "./data";

beforeEach(() => resetPriceWarnings());
const ROUTE = "routes/(site)/homeassistant.html/+page.svelte";
const render = (prices: Record<string, number>) => {
    const data = { prices: snap(3, prices).prices, priceVersion: 3, origin: "https://www.netquor.com", assets: { nudge: "abc" }, chrome: { footer: "none" } };
    return renderSvelte(ROUTE, { data }, data, "http://localhost/homeassistant.html");
};
const ldOf = (head: string) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(head)![1]);

describe("homeassistant data", () => {
    test("every price key the page uses exists in the price seed", () => {
        const keys = [...TIERS.map((t) => t.priceKey), ...EXTRAS.flatMap((x) => (x.priceKey ? [x.priceKey] : [])), ...Object.values(PRICE_MAP), "homeassistant.from.month"];
        for (const k of keys) expect(PRICE_FALLBACKS[k], k).toBeDefined();
    });
    test("the JSON-LD pointers all lead to an offer price", () => {
        for (const p of Object.keys(PRICE_MAP)) {
            const v = p.split("/").slice(1).reduce((o: any, k) => o[k], JSON_LD);
            expect(typeof v, p).toBe("string");
        }
    });
});

describe("homeassistant page", () => {
    test("shows the cached prices, in the visible text, the description and the JSON-LD", async () => {
        const { body, head } = await render({ "homeassistant.from.month": 1300, "homeassistant.home.month": 1500, "homeassistant.plus.month": 2500, "homeassistant.pro.month": 4000, "homeassistant.resilient.month": 1300, "homeassistant.extra_bridge.month": 700, "homeassistant.zigbee_radio.once": 5000, "homeassistant.setup_session.once": 8000 });
        expect(body).toContain('<span data-price="homeassistant.home.month" data-fmt="usd0">$15</span>');
        expect(body).toMatch(/from <span data-price="homeassistant.from.month" data-fmt="usd0">\$13<\/span>(<!---->)?\/mo/);
        expect(body).toContain(">$50<");
        expect(head).toContain("From $13 a month.");
        const offers = ldOf(head)["@graph"][1].offers;
        expect(offers.map((o: { price: string }) => o.price)).toEqual(["15", "25", "40", "13"]);
    });
    test("keeps the accordion ids and the page's own footer, and no nav of its own", async () => {
        const { body } = await render({});
        for (const id of ["h0", "h1", "h2", "h3", "h4", "h5", "h6"]) expect(body).toContain(`id="${id}"`);
        expect(body).toContain('id="faq"');
        expect(body).toContain('id="plans"');
        expect(body).toContain("Fargo, North Dakota");
        expect(body).not.toContain("nq-nav");
    });
    test("the built server answers 200 (when a build exists)", async () => {
        if (!existsSync(join(WEB, "build/index.js"))) return;
        const s = await startServer({ build: false });
        try {
            const r = await fetch(`${s.base}/homeassistant.html`);
            expect(r.status).toBe(200);
            expect(await r.text()).toContain("Pick your plan");
        } finally { s.stop(); }
    }, 30000);
});
