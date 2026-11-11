import { describe, expect, test } from "bun:test";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { startServer, WEB } from "../../../../scripts/parity/run";
import { withPrices } from "../../jsonld";
import { renderSvelte } from "../../server/svelteHarness";
import { snap } from "../../server/testkit";
import { bundleView, type BundleApi } from "./bundleTool";
import { devView, EXAMPLES, missView, type CostApi } from "./calculators";
import { APP_GROUPS, COMPARE, FAQ, JSON_LD, PRICE_MAP, PRICE_ROWS, READY, SERVICES, WHO } from "./data";
import { PAGE_CSS } from "./pageCss";
import { halfPriceText, splitRich } from "./rich";
import { initTerminal } from "./terminal";

// The pure scripts of the legacy page, loaded the way they are in the browser (unchanged files at the repository root).
const req = createRequire(import.meta.url);
const root = join(import.meta.dir, "../../../../..");
const C = req(join(root, "cost-calc.js")) as CostApi;
const B = req(join(root, "bundle-calc.js")) as BundleApi;

const ROUTE = "routes/(site)/+page.svelte";
const data = { prices: snap(3, { "phone.planned_launch.month": 2500, "fleet.mac.month": 595, "fleet.mobile.month": 395, "network.from.month": 799, "vpn.from.month": 700, "vpn.to.month": 3000, "vpn.lite.month": 700, "vpn.plus.month": 1000, "vpn.fast.month": 2000, "vpn.gigabit.month": 3000, "homeassistant.from.month": 1200, "digitalaccess.plus.month": 999, "digitalaccess.pro.month": 5999, "digitalaccess.scale.month": 19900 }).prices, priceVersion: 3, origin: "https://www.netquor.com", assets: { costCalc: "a", bundleCalc: "b", fx: "c", bg: "d" } };

describe("index data", () => {
    test("the repeated blocks keep the counts of the legacy page", () => {
        expect(WHO.length).toBe(6);
        expect(APP_GROUPS.map((g) => [g.title, g.cols, g.apps.length])).toEqual([["Business", "n4", 4], ["Network and hosting", "n3", 3], ["Home and building", "n2", 2]]);
        expect(PRICE_ROWS.length).toBe(8);
        expect(READY.length).toBe(4);
        expect(COMPARE.length).toBe(6);
        expect(SERVICES.length).toBe(6);
        expect(FAQ.length).toBe(5);
    });
    test("every link written in data is absolute, a fragment, mailto or tel", () => {
        const links = [...WHO.flatMap((w) => [...w.chips, w.cta]), ...APP_GROUPS.flatMap((g) => g.apps.flatMap((a) => a.links)), ...PRICE_ROWS, ...READY, ...COMPARE].map((x) => x.href);
        for (const h of links) expect(h).toMatch(/^(\/|#|https?:|mailto:|tel:)/);
    });
    test("every price token in data names a key the price cache knows", () => {
        const known = Object.keys(data.prices);
        const all = [...APP_GROUPS.flatMap((g) => g.apps.map((a) => a.meta)), ...PRICE_ROWS.map((r) => r.price)].join(" ");
        const keys = [...all.matchAll(/\{\{([^}|]+)/g)].map((m) => m[1]);
        expect(keys.length).toBeGreaterThan(8);
        for (const k of keys) expect(known).toContain(k);
    });
    test("the JSON-LD price map resolves and the prices come from the cache", () => {
        const ld = withPrices(JSON_LD, PRICE_MAP, data.prices, 3) as typeof JSON_LD;
        const offers = (ld["@graph"][4] as { itemListElement: { priceSpecification: { price: string } }[] }).itemListElement.map((o) => o.priceSpecification.price);
        expect(offers).toEqual(["25", "5.95", "7.99", "7", "12", "9.99"]);
    });
    test("the inline CSS drops the two rules that never applied in the legacy head", () => {
        expect(PAGE_CSS).not.toMatch(/\n\s*body \{/);
        expect(PAGE_CSS).not.toContain("focus-visible");
        expect(PAGE_CSS).toContain(".homelab {");
    });
});

describe("rich", () => {
    test("splits tokens from HTML", () => {
        expect(splitRich("From {{a.b}}<i>/mo</i>")).toEqual([{ html: "From " }, { key: "a.b" }, { html: "<i>/mo</i>" }]);
        expect(splitRich("{{a.b|usd}} to {{c.d}}")).toEqual([{ key: "a.b", fmt: "usd" }, { html: " to " }, { key: "c.d" }]);
        expect(splitRich("no price")).toEqual([{ html: "no price" }]);
    });
    test("half a price rounds to the cent, half a cent up", () => {
        expect(halfPriceText({ amountCents: 649, currency: "USD" })).toBe("$3.25");
        expect(halfPriceText({ amountCents: 800, currency: "USD" })).toBe("$4");
        expect(halfPriceText(undefined)).toBe("see pricing");
    });
});

describe("cost calculators (same words as the legacy script)", () => {
    const dev = { new: "6", hrs: "2", chg: "4", chgm: "15", sig: "10", sigm: "5", rate: "60", macs: "4", devs: "4" };
    test("empty inputs ask for numbers", () => {
        expect(devView(C, { new: "", hrs: "", chg: "", chgm: "", sig: "", sigm: "", rate: "", macs: "", devs: "" })).toEqual([{ kind: "p", text: "Enter your numbers to see the cost.", cls: "nq-empty" }]);
        expect(missView(C, { val: "", miss: "", jobs: "" })).toEqual([{ kind: "p", text: "Enter your three numbers to see the cost.", cls: "nq-empty" }]);
    });
    test("the example numbers give the figures the legacy page shows", () => {
        const rows = devView(C, dev);
        expect(rows[0]).toEqual({ kind: "big", label: "of your time a year", value: "107.3 hours" });
        expect(rows[1]).toEqual({ kind: "big", label: "a year at your rate", value: "$6,440" });
        expect((rows[2] as { text: string }).text).toBe("That is about 2.68 full working weeks. Setup 12 hours, app and setting requests 52 hours, sign-ins and passwords 43.3 hours.");
        expect((rows[3] as { text: string }).text).toStartWith("Netquor Fleet for your devices lists at $475 a year. At $60 an hour");
        const m = missView(C, { val: "400", miss: "5", jobs: "2" });
        expect(m.slice(0, 2)).toEqual([{ kind: "big", label: "a month in jobs you did not get", value: "$3,467" }, { kind: "big", label: "a year", value: "$41,600" }]);
        expect((m[2] as { text: string }).text).toBe("Netquor Phone Starter has a planned launch price of $25 a month. One job a month would pay for it. Phone is in early access and not billed yet.");
    });
    test("the example buttons fill ids that exist in the markup", async () => {
        const { body } = await renderSvelte("lib/pages/index/Calculators.svelte", {}, data);
        for (const id of [...Object.keys(EXAMPLES.dev), ...Object.keys(EXAMPLES.miss), "dev-out", "miss-out", "dev-calc", "miss-calc"]) expect(body).toContain(`id="${id}"`);
    });
});

describe("bundle tool (same rows as the legacy script)", () => {
    test("the Solo owner preset", () => {
        const p = B.PRESETS.solo;
        const v = bundleView(B, { macs: String(p.macs), devices: String(p.devices), phone: p.phone, people: String(p.people), vpn: p.vpn });
        expect(v.rows.map((r) => `${r.label} ${r.value}`)).toEqual([
            "Netquor Fleet: 1 Mac and 1 iPhone or iPad $9.90", "Netquor VPN: Lite $5.00", "List price $14.90", "10% off, 2 products −$1.49", "Per month today $13.41",
            "Planned, not billed yet ", "Netquor Phone: Starter $25.00", "15% off at Phone launch, 3 products −$5.99", "Per month at Phone launch $33.91",
        ]);
        expect(v.peopleHidden).toBe(true);
        expect(v.save).toBe("The bundle discount is $17.88 a year today, and $71.88 a year at Phone launch.");
    });
    test("nothing chosen", () => {
        const v = bundleView(B, { macs: "0", devices: "0", phone: "none", people: "1", vpn: "none" });
        expect(v.rows).toEqual([{ label: "Choose a product to see a price", value: "$0.00", cls: "nq-bundle-sub" }]);
        expect(v.save + v.note).toBe("");
    });
    test("the people field shows for the Business phone plan only", () => {
        expect(bundleView(B, { macs: "4", devices: "4", phone: "business", people: "4", vpn: "fast" }).peopleHidden).toBe(false);
    });
});

describe("terminal", () => {
    const fake = () => {
        const classes = new Set<string>();
        const t = { classList: { add: (c: string) => classes.add(c) }, getBoundingClientRect: () => ({ top: 100, bottom: 300 }) } as unknown as HTMLElement;
        const html = { classList: { add: (c: string) => classes.add("html:" + c) } } as unknown as HTMLElement;
        const listeners: string[] = [];
        const win = { innerHeight: 800, addEventListener: (e: string) => listeners.push(e), removeEventListener: (e: string) => listeners.splice(listeners.indexOf(e), 1) } as unknown as Window;
        return { classes, listeners, doc: { querySelector: () => t, documentElement: html }, win };
    };
    test("marks the page as typing and plays at once when the terminal is on screen", () => {
        const f = fake();
        initTerminal(f.doc, f.win);
        expect([...f.classes].sort()).toEqual(["html:typing", "play"]);
        expect(f.listeners).toEqual([]);
    });
    test("does nothing without a terminal", () => {
        const f = fake();
        initTerminal({ ...f.doc, querySelector: () => null }, f.win);
        expect(f.classes.size).toBe(0);
    });
});

describe("the page", () => {
    test("renders every section, id and price on the server", async () => {
        const rendered = await renderSvelte(ROUTE, { data }, data, "http://localhost/");
        const body = rendered.body.replace(/<!--.*?-->/g, ""), head = rendered.head.replace(/<!--.*?-->/g, "");
        for (const id of ["who", "apps", "calculators", "dev-calc", "miss-calc", "ready", "phone", "homelab", "services", "pricing", "bundles", "bundle-tool", "b-rows", "compare", "local", "community", "faq", "contact", "nq-test-h"]) expect(body).toContain(`id="${id}"`);
        expect((body.match(/class="nq-who"/g) ?? []).length).toBe(6);
        expect((body.match(/class="nq-app"/g) ?? []).length).toBe(9);
        expect((body.match(/class="nq-prices-row"/g) ?? []).length).toBe(8);
        expect((body.match(/<details/g) ?? []).length).toBe(5);
        // the price cache wins over the text the legacy page had (Network Solutions at $7.99, the student half at $4)
        expect(body).toContain('data-price="network.from.month" data-fmt="usd0">$7.99<');
        expect(body).toContain("for about $4 a month");
        expect(body).toContain("from <span data-price=\"vpn.from.month\"");
        // a token inside <i> keeps its tags balanced (the price once rendered twice, large)
        expect(body).toMatch(/<i>paid from <span data-price="digitalaccess\.plus\.month" data-fmt="usd0">[^<]*<\/span>\/mo<\/i>/);
        expect(head).toContain('rel="canonical" href="https://www.netquor.com/"');
        expect(head).toContain('"price":"7.99"');
        expect(head).toContain("devices.css@0.2.0");
    });
    test("the built server answers 200 for / and redirects /index.html (when a build exists)", async () => {
        if (!existsSync(join(WEB, "build/index.js"))) return;
        const s = await startServer({ build: false });
        try {
            const r = await fetch(`${s.base}/`);
            expect(r.status).toBe(200);
            expect(await r.text()).toContain("Managed networks, devices and access for small business");
            const old = await fetch(`${s.base}/index.html`, { redirect: "manual" });
            expect(old.status).toBe(301);
        } finally { s.stop(); }
    }, 30000);
});
