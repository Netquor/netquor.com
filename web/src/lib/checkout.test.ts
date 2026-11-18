import { describe, expect, test } from "bun:test";
import { renderSvelte } from "./server/svelteHarness";
import { snap } from "./server/testkit";
import { CHECKOUT, checkoutHref, cleanRef } from "./checkout";
import { TIERS } from "./pages/homeassistant/data";

describe("checkout map", () => {
    test("the four Hosted Home Assistant plans are checkout links into the portal, and every other id falls back to mailto", () => {
        expect(Object.keys(CHECKOUT).sort()).toEqual(["hosted-home-assistant.home", "hosted-home-assistant.home-plus", "hosted-home-assistant.home-pro", "hosted-home-assistant.resilient"]);
        expect(checkoutHref("hosted-home-assistant.home")).toBe("https://account.netquor.com/order/home-assistant?plan=home");
        expect(checkoutHref("hosted-home-assistant.home-plus")).toBe("https://account.netquor.com/order/home-assistant?plan=home-plus");
        expect(checkoutHref("hosted-home-assistant.home-pro")).toBe("https://account.netquor.com/order/home-assistant?plan=home-pro");
        expect(checkoutHref("hosted-home-assistant.resilient")).toBe("https://account.netquor.com/order/home-assistant?plan=resilient");
        for (const id of ["vpn.plus", "network.startup", "digitalaccess.plus", "", "__proto__", "constructor"]) expect(checkoutHref(id)).toBeNull();
    });
    test("every Home Assistant tier has an id the map can answer for", () => {
        for (const t of TIERS) expect(checkoutHref(t.cta.id), t.name).not.toBeNull();
    });
    test("a valid ref is appended, an invalid one is dropped, no term is ever added", () => {
        expect(checkoutHref("hosted-home-assistant.home", "friend-42")).toBe("https://account.netquor.com/order/home-assistant?plan=home&ref=friend-42");
        for (const bad of ["", " ", "a b", "x&plan=resilient", "<script>", "a".repeat(65), "é", "a/b"]) expect(cleanRef(bad), bad).toBeNull();
        expect(checkoutHref("hosted-home-assistant.home", "x&plan=resilient")).toBe("https://account.netquor.com/order/home-assistant?plan=home");
        for (const u of Object.values(CHECKOUT)) expect(u).not.toContain("term=");
    });
});

describe("homeassistant plan buttons", () => {
    const render = (url: string) => {
        const data = { prices: snap(3, {}).prices, priceVersion: 3, origin: "https://www.netquor.com", assets: { nudge: "abc" }, chrome: { footer: "none" } };
        return renderSvelte("routes/(site)/homeassistant.html/+page.svelte", { data }, data, url);
    };
    test("each plan says what happens, goes to the portal in the same tab, and keeps a quiet mailto", async () => {
        const { body } = await render("http://localhost/homeassistant.html");
        for (const [slug, label] of [["home", "Order Home"], ["home-plus", "Order Home Plus"], ["home-pro", "Order Home Pro"], ["resilient", "Order Resilient"]]) {
            expect(body).toContain(`href="https://account.netquor.com/order/home-assistant?plan=${slug}"`);
            expect(body).toContain(`>${label}</a>`);
        }
        expect(body.match(/>Ask us first<\/a>/g)).toHaveLength(4);
        expect(body).not.toMatch(/Choose Home/);
        // same tab: no target and no rel on the checkout links
        for (const m of body.matchAll(/<a href="https:\/\/account\.netquor\.com\/order[^"]*"([^>]*)>/g)) expect(m[1]).not.toMatch(/target=|rel=/);
    });
    test("a ref on the page URL is kept on every checkout link, and a bad one is not", async () => {
        const good = (await render("http://localhost/homeassistant.html?ref=friend-42")).body;
        expect(good.match(/plan=[a-z-]+&amp;ref=friend-42/g)).toHaveLength(4);
        const bad = (await render("http://localhost/homeassistant.html?ref=x%26plan%3Dresilient")).body;
        expect(bad).not.toContain("&amp;ref=");
    });
});
