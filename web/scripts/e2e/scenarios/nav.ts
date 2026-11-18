// nav.ts: nav.js. The Products mega menu (click, hover, Escape, outside click, link click), the burger menu at phone width and keyboard focus order.
import type { Scenario, Step } from "../scenario";
import type { ObserveSpec } from "../observe";
import { attr, has, must, navReady, el } from "./helpers";

const ACTIVE = `(() => { const a = document.activeElement; if (!a || a === document.body) return "body"; return a.tagName.toLowerCase() + " " + (a.getAttribute("aria-label") || (a.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 40) || a.getAttribute("href")); })()`;

export const NAV_OBSERVE: ObserveSpec = {
    selectors: [".nq-dd", ".nq-dd-btn", ".nq-dd-menu", ".nq-burger", ".nq-menu"],
    attrs: ["aria-expanded", "aria-haspopup", "aria-controls", "aria-label", "id"],
    classes: ["open", "nq-js", "nq-dd", "nq-link", "nq-dd-btn", "nq-burger", "nq-menu", "nq-mega", "is-current"],
    computed: ["display", "visibility"],
    text: false,
    evals: { active: ACTIVE, htmlClass: `document.documentElement.classList.contains("nq-js")` },
};

const OUT = { x: 640, y: 700 }; // a point to move the pointer to when it should leave the menu (hover only, never clicked)

const ddOpen = (o: Parameters<NonNullable<Step["expect"]>>[0]) => has(o, ".nq-dd", "open");
const expectDd = (open: boolean): Step["expect"] => (o) => {
    must(ddOpen(o) === open, `.nq-dd should ${open ? "have" : "not have"} the open class`);
    must(attr(o, ".nq-dd-btn", "aria-expanded") === String(open), `aria-expanded on the Products button should be "${open}"`);
};

const desktop: Scenario = {
    name: "nav-desktop",
    description: "Products mega menu at 1280px: hover, click, Escape, outside click, link click",
    legacyPath: "/index.html",
    sveltePath: "/",
    viewport: { width: 1280, height: 900 },
    ready: navReady,
    observe: NAV_OBSERVE,
    steps: [
        { name: "hover opens", run: (p) => p.hover(".nq-dd-btn"), expect: expectDd(true) },
        { name: "leaving closes", run: (p) => p.moveMouse(OUT.x, OUT.y), expect: expectDd(false) },
        { name: "click opens", run: (p) => p.click(".nq-dd-btn"), expect: expectDd(true) },
        { name: "second click keeps it open", run: (p) => p.click(".nq-dd-btn"), expect: expectDd(true) },
        { name: "Escape closes", run: async (p) => { await p.moveMouse(OUT.x, OUT.y); await p.press("Escape"); }, expect: expectDd(false) },
        { name: "click again opens", run: (p) => p.click(".nq-dd-btn"), expect: expectDd(true) },
        { name: "outside click closes", run: async (p) => { await p.clickOutside(".nq-dd"); }, expect: expectDd(false) },
        { name: "open then link click closes", run: async (p) => { await p.click(".nq-dd-btn"); await p.click('.nq-mega-foot a[href$="#services"]'); }, expect: expectDd(false) },
    ],
};

const focus: Scenario = {
    name: "nav-focus",
    description: "Keyboard: Tab order through the bar, Enter on Products, Tab into the open menu, Escape",
    legacyPath: "/index.html",
    sveltePath: "/",
    viewport: { width: 1280, height: 900 },
    ready: navReady,
    observe: { ...NAV_OBSERVE, selectors: [".nq-dd", ".nq-dd-btn", ".nq-dd-menu"], evals: { active: ACTIVE } },
    steps: [
        { name: "tab 1", run: (p) => p.press("Tab") },
        { name: "tab 2", run: (p) => p.press("Tab") },
        { name: "tab 3", run: (p) => p.press("Tab") },
        { name: "tab 4", run: (p) => p.press("Tab") },
        { name: "tab 5", run: (p) => p.press("Tab") },
        { name: "shift tab", run: (p) => p.press("Shift+Tab") },
        { name: "shift tab to products", run: async (p) => { await p.press("Shift+Tab"); await p.press("Shift+Tab"); }, expect: (o) => must(o.evals?.active === "button Products", `focus should be on Products, was ${o.evals?.active}`) },
        { name: "Enter on Products", run: (p) => p.press("Enter"), expect: expectDd(true) },
        { name: "tab into menu", run: (p) => p.press("Tab") },
        { name: "Escape", run: (p) => p.press("Escape"), expect: expectDd(false) },
    ],
};

const order: Scenario = {
    name: "nav-focus-order",
    description: "Keyboard: the first 22 Tab stops of a fresh page, and Shift+Tab back",
    legacyPath: "/index.html",
    sveltePath: "/",
    viewport: { width: 1280, height: 900 },
    ready: navReady,
    observe: { selectors: [".nq-dd"], classes: ["open"], text: false, box: false, evals: { active: ACTIVE } },
    steps: [
        {
            name: "tab order of the first 22 stops",
            run: async (p) => {
                await p.eval(`window.__e2e.order = []`);
                for (let i = 0; i < 22; i++) { await p.press("Tab"); await p.eval(`window.__e2e.order.push(${ACTIVE})`); }
            },
            observe: { evals: { order: "window.__e2e.order" } },
            expect: (o) => {
                const order = o.evals?.order as string[];
                must(order[0] === "a Netquor Technologies, home" && order[1] === "button Products", `the bar is brand, then Products; got ${order.slice(0, 2).join(" | ")}`);
            },
        },
        {
            name: "shift tab back 6 stops",
            run: async (p) => { await p.eval(`window.__e2e.order = []`); for (let i = 0; i < 6; i++) { await p.press("Shift+Tab"); await p.eval(`window.__e2e.order.push(${ACTIVE})`); } },
            observe: { evals: { order: "window.__e2e.order" } },
        },
    ],
};

const mobile: Scenario = {
    name: "nav-mobile",
    description: "Burger menu at 390px: open, Products toggles, Escape, link click, outside click",
    legacyPath: "/index.html",
    sveltePath: "/",
    viewport: { width: 390, height: 844 },
    ready: navReady,
    observe: NAV_OBSERVE,
    steps: [
        { name: "burger opens", run: (p) => p.click(".nq-burger"), expect: (o) => { must(has(o, ".nq-menu", "open") && attr(o, ".nq-burger", "aria-expanded") === "true", "menu gets .open and the burger aria-expanded=true"); must(attr(o, ".nq-burger", "aria-controls") === "nq-menu" && attr(o, ".nq-menu", "id") === "nq-menu", "burger controls #nq-menu"); } },
        { name: "burger closes", run: (p) => p.click(".nq-burger"), expect: (o) => must(!has(o, ".nq-menu", "open") && attr(o, ".nq-burger", "aria-expanded") === "false", "closed again") },
        { name: "burger opens again", run: (p) => p.click(".nq-burger") },
        { name: "Products opens", run: (p) => p.click(".nq-dd-btn") },
        { name: "Products closes", run: (p) => p.click(".nq-dd-btn") },
        { name: "Products opens again", run: (p) => p.click(".nq-dd-btn") },
        { name: "Escape closes both", run: (p) => p.press("Escape"), expect: (o) => must(!has(o, ".nq-menu", "open") && !has(o, ".nq-dd", "open"), "Escape closes the phone menu and the Products list") },
        { name: "open both then link", run: async (p) => { await p.click(".nq-burger"); await p.click(".nq-dd-btn"); await p.click('.nq-mega-foot a[href$="#services"]'); } },
        { name: "burger then Products, then an outside click closes only Products", run: async (p) => { await p.click(".nq-burger"); await p.click(".nq-dd-btn"); await p.clickOutside(".nq-nav"); }, expect: (o) => { must(has(o, ".nq-menu", "open") && !has(o, ".nq-dd", "open"), "the phone menu stays open, the Products list closes"); must(attr(o, ".nq-burger", "aria-expanded") === "true" && attr(o, ".nq-dd-btn", "aria-expanded") === "false", "aria-expanded follows"); } },
    ],
};

export default [desktop, focus, order, mobile];
