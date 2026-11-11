import { describe, expect, test } from "bun:test";
import { renderSvelte } from "../server/svelteHarness";
import { snap } from "../server/testkit";

const seo = (props: Record<string, unknown>, prices: Record<string, number> = { "fleet.mac.month": 612 }) =>
    renderSvelte("lib/components/Seo.svelte", { origin: "https://www.netquor.com", title: "T", ...props }, { prices: snap(3, prices).prices, priceVersion: 3 }).then((r) => r.head.replace(/<!--.*?-->/g, "").replace(/\/>/g, ">"));

describe("Seo", () => {
    test("title, description, canonical and Open Graph from the origin", async () => {
        const head = await seo({ description: "D", canonical: "/x.html", ogTitle: "OT" });
        expect(head).toContain("<title>T</title>");
        expect(head).toContain('<meta name="description" content="D">');
        expect(head).toContain('<link rel="canonical" href="https://www.netquor.com/x.html">');
        expect(head).toContain('<meta property="og:url" content="https://www.netquor.com/x.html">');
        expect(head).toContain('<meta property="og:title" content="OT">');
        expect(head).toContain('<meta property="og:description" content="D">');
        expect(head).toContain('<meta property="og:image" content="https://www.netquor.com/brand/og.png">');
        expect(head).toContain('<meta name="robots" content="index, follow');
    });
    test("everything optional can be left out: no description, no og, no canonical, no robots (terms.html)", async () => {
        const head = await seo({ og: false, robots: null });
        expect(head).toContain("<title>T</title>");
        for (const bad of ["description", "og:", "canonical", "robots", "twitter", "keywords"]) expect(head).not.toContain(bad);
    });
    test("the legacy extras: keywords, author, geo, site name, locale, twitter card and site", async () => {
        const head = await seo({ description: "D", canonical: "/", keywords: "a, b", author: "Me", geo: { region: "US-ND", placename: "Fargo" }, siteName: "Netquor", locale: "en_US", twitter: { site: "@netquor" }, ogImage: "/fleet/img/console.png" });
        expect(head).toContain('<meta name="keywords" content="a, b">');
        expect(head).toContain('<meta name="author" content="Me">');
        expect(head).toContain('<meta name="geo.region" content="US-ND">');
        expect(head).toContain('<meta name="geo.placename" content="Fargo">');
        expect(head).toContain('<meta property="og:site_name" content="Netquor">');
        expect(head).toContain('<meta property="og:locale" content="en_US">');
        expect(head).toContain('<meta name="twitter:site" content="@netquor">');
        expect(head).toContain('<meta name="twitter:card" content="summary_large_image">');
        expect(head).toContain('<meta name="twitter:image" content="https://www.netquor.com/fleet/img/console.png">');
        expect(head).toContain('<meta name="twitter:title" content="T">');
    });
    test("ogImage null leaves og:image and twitter:image out; an absolute URL is kept", async () => {
        const head = await seo({ ogImage: null, twitter: true });
        expect(head).not.toContain("og:image");
        expect(head).not.toContain("twitter:image");
        expect(await seo({ ogImage: "https://cdn.test/a.png" })).toContain('content="https://cdn.test/a.png"');
    });
    test("JSON-LD is written once and cannot close its script", async () => {
        const head = await seo({ jsonLd: { name: "</script><b>" } });
        expect(head).toContain('<script type="application/ld+json">{"name":"\\u003c/script>\\u003cb>"}</script>');
        expect(head.match(/application\/ld\+json/g)?.length).toBe(1);
    });
    test("priceMap fills the JSON-LD prices from the page's price data", async () => {
        const head = await seo({ jsonLd: { offers: { price: "5.95" } }, priceMap: { "/offers/price": "fleet.mac.month" } });
        expect(head).toContain('"price":"6.12"');
    });
});
