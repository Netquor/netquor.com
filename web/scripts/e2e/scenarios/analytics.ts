// analytics.ts: analytics.js. Google Analytics 4 (measurement id G-DDM7J28WFG) loads from googletagmanager.com on every page unless Global Privacy Control, Do Not Track or window["ga-disable-<id>"] says no. The harness answers every Google Analytics request with an empty 200 (see browser.ts), so no scenario ever sends a hit.
import type { Page } from "../browser";
import type { Scenario } from "../scenario";
import type { AllowEntry } from "../diff";
import type { ObserveSpec } from "../observe";
import { must } from "./helpers";

const ID = "G-DDM7J28WFG";

const OBSERVE: ObserveSpec = {
    selectors: ['script[src*="googletagmanager.com"]'],
    attrs: ["src", "async"],
    classes: false,
    text: false,
    box: false,
    requests: "external",
    console: true,
    evals: {
        hasGtag: `typeof window.gtag === "function"`,
        dataLayer: `JSON.stringify((window.dataLayer || []).map((a) => Array.from(a).map((x) => (x instanceof Date ? "Date" : x))))`,
        gtagScripts: `[...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")).filter((s) => /googletagmanager|google-analytics/.test(s))`,
        gtagInHead: `!!document.head.querySelector('script[src*="googletagmanager.com"]')`,
    },
};

const gtagRequests = (o: { requests?: string[] }) => (o.requests ?? []).filter((u) => /googletagmanager|google-analytics|doubleclick/.test(u));

// The legacy pages request the Bootstrap JavaScript bundle (every page but fleet and the tool pages), Bootstrap's and Bootstrap Icons' CSS from jsDelivr, and the Plex or Geist fonts from Google. The Svelte pages bundle all of it (a collapse component replaces the Bootstrap JavaScript; the CSS and fonts are Vite assets from our own origin), so their request list must hold no third party but Google's analytics. The Google requests themselves are asserted exactly, on each side, by the expectations below.
const NO_CDN: AllowEntry = { path: "* :: requests", reason: "IMPROVEMENT: the Svelte pages request no Bootstrap JavaScript, no stylesheet or icon font from a CDN and no Google font (all bundled, served from our own origin); the Google analytics request list is asserted exactly on both sides by the step expectation" };
const ANALYTICS_HOST = /^https:\/\/[^/]*\b(googletagmanager|google-analytics|doubleclick|googleadservices|analytics\.google)\.com\//;
const noThirdParty = (o: { requests?: string[] }, side: string) => {
    if (side !== "svelte") return;
    const rs = o.requests ?? [];
    must(!rs.some((u) => /bootstrap[^/]*\.js/.test(u)), `the Svelte page requests no Bootstrap JavaScript: ${JSON.stringify(rs)}`);
    const foreign = rs.filter((u) => /^https?:\/\//.test(u) && !ANALYTICS_HOST.test(u));
    must(foreign.length === 0, `the Svelte page requests nothing from a third party but analytics: ${JSON.stringify(foreign)}`);
};

const on = (page: string): Scenario => ({
    name: `analytics-${page === "/" ? "home" : page.replace(/^\//, "").replace(".html", "")}`,
    description: `${page}: gtag.js is requested once, dataLayer gets js and config`,
    legacyPath: page === "/" ? "/index.html" : page,
    sveltePath: page,
    ready: (p: Page) => p.waitFor(() => !!(window as unknown as { gtag?: unknown }).gtag, 10000),
    observe: OBSERVE,
    allow: [NO_CDN],
    steps: [{
        name: "after load",
        run: (p) => p.wait(300),
        expect: (o, side) => {
            noThirdParty(o, side);
            must(JSON.stringify(gtagRequests(o)) === JSON.stringify(["https://www.googletagmanager.com/gtag/js"]), `exactly one Google request, to gtag/js: ${JSON.stringify(gtagRequests(o))}`);
            must(o.evals?.hasGtag === true && o.evals?.gtagInHead === true, "window.gtag exists and the script is appended to <head>");
            const dl = JSON.parse(o.evals?.dataLayer as string) as unknown[][];
            must(dl.length === 2 && dl[0][0] === "js" && dl[0][1] === "Date", `first dataLayer entry is js with a Date: ${JSON.stringify(dl[0])}`);
            must(dl[1][0] === "config" && dl[1][1] === ID, "second entry is config with the measurement id");
            must(JSON.stringify(dl[1][2]) === JSON.stringify({ anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false }), `config options: ${JSON.stringify(dl[1][2])}`);
            const attrs = o.elements['script[src*="googletagmanager.com"]'].items[0]?.attrs;
            must(attrs?.src === `https://www.googletagmanager.com/gtag/js?id=${ID}` && attrs.async !== undefined, `script src and async: ${JSON.stringify(attrs)}`);
        },
    }],
});

const off = (name: string, why: string, init: string): Scenario => ({
    name,
    description: `/vpn.html: ${why}: nothing is loaded and nothing is sent`,
    legacyPath: "/vpn.html",
    viewport: { initScripts: [init] },
    ready: (p: Page) => p.waitFor(() => !!document.querySelector(".nq-nav")),
    observe: OBSERVE,
    allow: [NO_CDN],
    steps: [{
        name: "after load",
        run: (p) => p.wait(1200),
        expect: (o, side) => {
            noThirdParty(o, side);
            must(gtagRequests(o).length === 0, `no Google request: ${JSON.stringify(gtagRequests(o))}`);
            must(o.evals?.hasGtag === false && o.evals?.dataLayer === "[]" && o.evals?.gtagInHead === false, "no gtag, no dataLayer, no script element");
        },
    }],
});

export default [
    ...["/", "/vpn.html", "/fleet.html", "/subnet-calculator.html", "/readiness.html"].map(on),
    off("analytics-dnt", "navigator.doNotTrack is 1", `Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true });`),
    off("analytics-gpc", "navigator.globalPrivacyControl is true", `Object.defineProperty(navigator, "globalPrivacyControl", { value: true, configurable: true });`),
    off("analytics-optout", `window["ga-disable-${ID}"] is set`, `window["ga-disable-${ID}"] = true;`),
];
