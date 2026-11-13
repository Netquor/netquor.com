// wiring.test.ts: the ported behaviors are adopted everywhere. No Svelte page or layout loads nav.js, fx.js, bg.js, nudge.js, analytics.js, readiness.js or the Bootstrap JavaScript bundle; the components that replace them are in place; the three pure calculation scripts are the only legacy scripts left.
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { assetVersions } from "./assets";
import { renderSvelte } from "./server/svelteHarness";
import { snap } from "./server/testkit";

const SRC = join(import.meta.dir, "..");
const GONE = ["nav.js", "fx.js", "bg.js", "nudge.js", "analytics.js", "readiness.js", "bootstrap.bundle", "fleet/site.js", "fleet/pricing.js"];
const assets = assetVersions((f) => `h-${f.replace(/\W/g, "")}`);
const data = () => ({ assets, origin: "https://www.netquor.com", prices: snap(3, {}).prices, priceVersion: 3 });
const pages = readdirSync(join(SRC, "routes/(site)")).filter((d) => d.endsWith(".html"));
const strip = (h: string) => h.replace(/<!--.*?-->/g, "");

const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

describe("source", () => {
    test("no svelte file or app shell names a replaced script", () => {
        const files = [...walk(join(SRC, "routes")), ...walk(join(SRC, "lib")), join(SRC, "app.html")].filter((f) => /\.(svelte|html)$/.test(f));
        const hits = files.flatMap((f) => {
            const text = readFileSync(f, "utf8");
            return GONE.filter((g) => new RegExp(`<script[^>]*src=[^>]*${g.replace(".", "\\.")}`).test(text) || (g === "bootstrap.bundle" && /BOOTSTRAP_JS/.test(text))).map((g) => `${f}: ${g}`);
        });
        expect(hits).toEqual([]);
    });
    test("app.html adds nq-js before first paint, as nav.js did in the head", () => {
        const head = readFileSync(join(SRC, "app.html"), "utf8");
        expect(head).toContain(`r.classList.add("nq-js")`); // added synchronously in the head, before first paint
        expect(head).toContain(`contains("nq-hydrated")`); // and dropped after 5 s unless the nav woke up (failsafe)
    });
});

describe("every (site) page", () => {
    test.each(pages)("%s renders with no replaced script", async (p) => {
        const { head, body } = await renderSvelte(`routes/(site)/${p}/+page.svelte`, { data: data() }, data(), `http://localhost/${p}`);
        const all = strip(head + body);
        for (const g of GONE) expect(all).not.toContain(g);
    });
    test("the collapse pages carry the toggles the accordion drives", async () => {
        for (const [p, n] of [["vpn.html", 6], ["network.html", 6], ["sdn.html", 8], ["homeassistant.html", 7]] as const) {
            const { body } = await renderSvelte(`routes/(site)/${p}/+page.svelte`, { data: data() }, data(), `http://localhost/${p}`);
            expect(strip(body).match(/data-bs-toggle="collapse"/g)).toHaveLength(n);
        }
    });
    test("index has the progress bar, the hero background and the map", async () => {
        const { body } = await renderSvelte("routes/(site)/+page.svelte", { data: data() }, data(), "http://localhost/");
        const b = strip(body);
        expect(b).toContain('class="nq-progress"');
        expect(b).toContain('class="nq-bg"');
        expect(b.indexOf('class="nq-bg"')).toBeGreaterThan(b.indexOf('class="hero-section"'));
        expect(b).toContain('class="nq-map"');
    });
    test("the fx pages draw the progress bar", async () => {
        for (const p of ["compare.html", "readiness.html", "fargo-moorhead.html", "startups.html", "referrals.html", "partners.html"]) {
            const { body } = await renderSvelte(`routes/(site)/${p}/+page.svelte`, { data: data() }, data(), `http://localhost/${p}`);
            expect(strip(body)).toContain('class="nq-progress"');
        }
    });
    test("the pure calculation scripts stay, for the index and the subnet calculator only", async () => {
        const idx = await renderSvelte("routes/(site)/+page.svelte", { data: data() }, data(), "http://localhost/");
        expect(idx.head).toContain("/cost-calc.js");
        expect(idx.head).toContain("/bundle-calc.js");
        const sub = await renderSvelte("routes/(site)/subnet-calculator.html/+page.svelte", { data: data() }, data(), "http://localhost/subnet-calculator.html");
        expect(sub.head).toContain("/subnet-calc.js");
    });
});

describe("layouts", () => {
    const layout = (rel: string, url: string) => renderSvelte(rel, { data: data() }, data(), url, "<p>PAGE</p>");
    test("(site) and (fleet) render without any replaced script", async () => {
        for (const [rel, url] of [["routes/(site)/+layout.svelte", "http://localhost/vpn.html"], ["routes/(fleet)/+layout.svelte", "http://localhost/fleet.html"]] as const) {
            const { head, body } = await layout(rel, url);
            for (const g of GONE) expect(head + body).not.toContain(g);
        }
    });
});

describe("html marker classes", () => {
    // A class we put on <html> from JavaScript must not also be a site style. (nq-ready did exactly that: .nq-ready is the home page readiness card, and it padded the whole page by 24px.)
    test("nq-hydrated and nq-js are not used as style selectors other than the nq-js nav rules", async () => {
        const { readdirSync, readFileSync } = await import("node:fs");
        const dir = join(SRC, "lib", "styles");
        const css = readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
        expect(css).not.toMatch(/\.nq-hydrated\b/);
        const owners = [...css.matchAll(/(^|[^\w-])\.nq-js\b[^{]*\{/gm)].map((m) => m[0]);
        expect(owners.length).toBeGreaterThan(0); // the menu rules are there
    });
});

describe("footer", () => {
    test("the Company list flows in two independent columns, so a wrapped link never stretches a row or spills into a third column", () => {
        const css = readFileSync(join(SRC, "lib/styles/after-baseline.css"), "utf8");
        const rule = css.match(/nav\.nq-2col \{([^}]*)\}/)?.[1] ?? "";
        expect(rule).toContain("columns: 2");
        expect(readFileSync(join(SRC, "lib/styles/entry-site.css"), "utf8")).toContain('@import "./after-baseline.css"');
    });
});

describe("error page", () => {
    const src = readFileSync(join(SRC, "routes/+error.svelte"), "utf8");
    test("is not indexed, says the trace is a joke, and respects reduced motion", () => {
        expect(src).toContain('<meta name="robots" content="noindex">');
        expect(src).toContain("nothing was traced");
        expect(src).toContain("prefers-reduced-motion: reduce");
    });
    test("draws the site nav and footer itself, since the root layout draws nothing", () => {
        expect(src).toContain("<Nav ");
        expect(src).toContain("<Footer ");
        expect(src).toContain("entry-site.css");
    });
});
