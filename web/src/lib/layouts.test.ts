import { describe, expect, test } from "bun:test";
import { renderSvelte } from "./server/svelteHarness";
import { assetVersions } from "./assets";

const assets = assetVersions((f) => `h-${f.replace(/\W/g, "")}`);
const data = (chrome?: unknown) => ({ assets, origin: "https://www.netquor.com", prices: {}, priceVersion: 1, chrome });
const site = (url: string, chrome?: unknown) => renderSvelte("routes/(site)/+layout.svelte", { data: data(chrome) }, data(chrome), url, "<p>PAGE</p>");
const fleet = () => renderSvelte("routes/(fleet)/+layout.svelte", { data: data() }, data(), "http://localhost/fleet.html", "<p>PAGE</p>");

describe("(site) layout", () => {
    test("head carries the site stylesheets and scripts with fingerprints; nav, page and footer come in that order", async () => {
        const { head, body } = await site("http://localhost/subnet-calculator.html");
        expect(head).toContain('href="/nq.css?v=h-nqcss"');
        expect(head).toContain('href="/nav.css?v=h-navcss"');
        expect(head).toContain('src="/nav.js?v=h-navjs"');
        expect(head).toContain("bootstrap.min.css");
        const nav = body.indexOf('class="nq-nav"'), page = body.indexOf("PAGE"), foot = body.indexOf("<footer");
        expect(nav).toBeGreaterThan(-1);
        expect(page).toBeGreaterThan(nav);
        expect(foot).toBeGreaterThan(page);
    });
    test("the nav marks the page's own entry as current", async () => {
        const { body } = await site("http://localhost/subnet-calculator.html");
        expect(body).toContain('aria-current="page"');
    });
    test("chrome overrides: no nav, no footer, static nav, full footer", async () => {
        const bare = await site("http://localhost/x.html", { nav: false, footer: "none" });
        expect(bare.body).not.toContain("nq-nav");
        expect(bare.body).not.toContain("<footer");
        expect((await site("http://localhost/x.html", { navStatic: true })).body).toContain("nq-nav nq-static");
        expect((await site("http://localhost/x.html", { footer: "full" })).body).toContain("nq-footer");
    });
});

describe("(fleet) layout", () => {
    test("loads fleet's own stylesheet and fonts, and draws no site nav or footer around the page", async () => {
        const { head, body } = await fleet();
        expect(head).toContain('href="/fleet/site.css?v=h-fleetsitecss"');
        expect(head).toContain("family=Geist");
        expect(head).toContain('content="#0B0D14"');
        expect(head).not.toContain("/nq.css");
        expect(head).not.toContain("bootstrap.min.css");
        expect(body).toContain("PAGE");
        expect(body).not.toContain("nq-nav");
        expect(body).not.toContain("<footer");
    });
});
