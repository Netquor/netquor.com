import { describe, expect, test } from "bun:test";
import { renderSvelte } from "./server/svelteHarness";
import { assetVersions } from "./assets";

const assets = assetVersions((f) => `h-${f.replace(/\W/g, "")}`);
const data = (chrome?: unknown) => ({ assets, origin: "https://www.netquor.com", prices: {}, priceVersion: 1, chrome });
const site = (url: string, chrome?: unknown) => renderSvelte("routes/(site)/+layout.svelte", { data: data(chrome) }, data(chrome), url, "<p>PAGE</p>");
const fleet = () => renderSvelte("routes/(fleet)/+layout.svelte", { data: data() }, data(), "http://localhost/fleet.html", "<p>PAGE</p>");

describe("(site) layout", () => {
    test("head carries no stylesheet or script link of its own (the CSS is bundled by Vite); nav, page and footer come in that order", async () => {
        const { head, body } = await site("http://localhost/subnet-calculator.html");
        for (const gone of ["nav.js", "analytics.js", "nudge.js", "fx.js", "bg.js", "readiness.js", "/nq.css", "/nav.css", "bootstrap", "fonts.googleapis", "cdn.jsdelivr"]) expect(head).not.toContain(gone);
        expect(head).not.toContain('rel="stylesheet"');
        expect(head).not.toContain("<style");
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
    test("has its own head (theme color, icon), links no stylesheet or font from anywhere, and draws no site nav or footer around the page", async () => {
        const { head, body } = await fleet();
        expect(head).toContain('content="#0B0D14"');
        expect(head).toContain('href="/fleet/favicon.svg"');
        expect(head).not.toContain('rel="stylesheet"');
        for (const gone of ["/fleet/site.css", "/nq.css", "/nav.css", "fonts.googleapis", "cdn.jsdelivr", "bootstrap"]) expect(head).not.toContain(gone);
        expect(body).toContain("PAGE");
        expect(body).not.toContain("nq-nav");
        expect(body).not.toContain("<footer");
    });
});
