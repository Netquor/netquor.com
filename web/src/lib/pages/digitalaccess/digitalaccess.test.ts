import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { startServer, WEB } from "../../../../scripts/parity/run";
import { PRICE_FALLBACKS, resetPriceWarnings } from "../../priceFallbacks";
import { renderSvelte } from "../../server/svelteHarness";
import { snap } from "../../server/testkit";
import { JSON_LD, PRICE_MAP, TIERS } from "./data";

beforeEach(() => resetPriceWarnings());
const ROUTE = "routes/(site)/digitalaccess.html/+page.svelte";
const render = (prices: Record<string, number>) => {
    const data = { prices: snap(3, prices).prices, priceVersion: 3, origin: "https://www.netquor.com", assets: { nudge: "abc" }, chrome: { footer: "none" } };
    return renderSvelte(ROUTE, { data }, data, "http://localhost/digitalaccess.html");
};
const ldOf = (head: string) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(head)![1]);

describe("digitalaccess data", () => {
    test("every price key exists in the price seed, and only the free plan has none", () => {
        for (const k of [...Object.values(PRICE_MAP), "digitalaccess.tenant_addon.month"]) expect(PRICE_FALLBACKS[k], k).toBeDefined();
        expect(TIERS.filter((t) => t.priceKey === null).map((t) => t.name)).toEqual(["Community"]);
        for (const t of TIERS) if (t.priceKey) expect(PRICE_FALLBACKS[t.priceKey], t.name).toBeDefined();
    });
    test("the JSON-LD pointers lead to the paid offers, and Community stays 0", () => {
        const offers = (JSON_LD["@graph"][1] as { offers: { name: string; price: string }[] }).offers;
        expect(offers[0]).toMatchObject({ name: "Community", price: "0" });
        expect(Object.keys(PRICE_MAP)).toEqual(["/@graph/1/offers/1/price", "/@graph/1/offers/2/price", "/@graph/1/offers/3/price"]);
    });
});

describe("digitalaccess page", () => {
    test("shows the cached prices in the cards and the JSON-LD, with cents kept", async () => {
        const { body, head } = await render({ "digitalaccess.plus.month": 1099, "digitalaccess.pro.month": 6999, "digitalaccess.scale.month": 20000, "digitalaccess.tenant_addon.month": 250 });
        expect(body).toContain('<span data-price="digitalaccess.plus.month" data-fmt="usd0">$10.99</span>');
        expect(body).toContain(">$200<");
        expect(body).toContain(">Free<");
        expect(ldOf(head)["@graph"][1].offers.map((o: { price: string }) => o.price)).toEqual(["0", "10.99", "69.99", "200"]);
    });
    test("keeps the anchors the nav links to and the page's own footer", async () => {
        const { body } = await render({});
        for (const id of ["ai", "passport", "home-assistant", "buzzer", "pricing"]) expect(body).toContain(`id="${id}"`);
        expect(body).toContain("Fargo, North Dakota");
    });
    test("the built server answers 200 (when a build exists)", async () => {
        if (!existsSync(join(WEB, "build/index.js"))) return;
        const s = await startServer({ build: false });
        try {
            const r = await fetch(`${s.base}/digitalaccess.html`);
            expect(r.status).toBe(200);
            expect(await r.text()).toContain("Simple, scalable pricing");
        } finally { s.stop(); }
    }, 30000);
});
