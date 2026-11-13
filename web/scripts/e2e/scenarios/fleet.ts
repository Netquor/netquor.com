// fleet.ts: fleet/site.js (a module) and fleet/pricing.js on /fleet.html: the price calculator (annual, monthly and lifetime cards, a breakdown, a verdict, a dedicated-instance option, sliders and number boxes linked, a 120 ms debounce) and the demo form (validation, then a mailto: link; nothing is posted).
import type { Page } from "../browser";
import type { Scenario } from "../scenario";
import type { Observed, ObserveSpec } from "../observe";
import { must } from "./helpers";

const OBSERVE: ObserveSpec = {
    selectors: ["#calc", "#term-annual", "#term-monthly", "#term-lifetime", "#annual-tag", "#monthly-tag", "#lifetime-tag", "#calc-error", "#verdict"],
    attrs: ["aria-pressed", "hidden", "role", "aria-live", "type"],
    classes: ["on", "plan-card", "status", "ok", "bad"],
    text: true,
    textMax: 300,
    box: false,
    limit: 1,
    evals: {
        cards: `["annual", "monthly", "lifetime"].map((t) => [document.getElementById(t + "-main").textContent, document.getElementById(t + "-sub").textContent, document.getElementById(t + "-tag").textContent + (document.getElementById(t + "-tag").hidden ? " (hidden)" : "")])`,
        verdict: `document.getElementById("verdict").textContent`,
        breakdown: `[...document.querySelectorAll("#breakdown li")].map((li) => li.textContent)`,
        inputs: `["calc-mac", "calc-mac-r", "calc-ios", "calc-ios-r"].map((id) => document.getElementById(id).value)`,
        dedicated: `document.getElementById("calc-dedicated").checked`,
        pressed: `["annual", "monthly", "lifetime"].map((t) => document.getElementById("term-" + t).getAttribute("aria-pressed") + "/" + document.getElementById("term-" + t).classList.contains("on"))`,
        form: `(() => { const f = document.getElementById("lead-form").elements; return { macs: f.macs.value, ios: f.ios.value, term: f.term.value, dedicated: f.dedicated.value, touched: document.getElementById("lead-form").dataset.touched || null }; })()`,
        status: `[document.getElementById("lead-status").textContent, document.getElementById("lead-status").className]`,
        error: `document.getElementById("calc-error").textContent`,
        hash: `location.hash`,
    },
};

const ready = (p: Page) => p.waitFor(() => (document.getElementById("annual-main")?.textContent ?? "—") !== "—" && !!document.getElementById("lead-form"), 15000);
const settle = async (p: Page) => { await p.wait(350); };
const num = (id: string, v: string) => async (p: Page) => { await p.fill(id, v); await settle(p); };

const ev = (o: Observed, k: string) => o.evals?.[k];
const cards = (o: Observed) => ev(o, "cards") as string[][];

const calc: Scenario = {
    name: "fleet-calc",
    description: "Fleet calculator: defaults, typing, sliders, clamping, empty state, term cards, dedicated instance, lead form mirroring",
    legacyPath: "/fleet.html",
    viewport: { width: 1280, height: 900 },
    ready,
    observe: OBSERVE,
    steps: [
        { name: "defaults: 25 Macs, 10 iPhones", expect: (o) => {
            must(JSON.stringify(ev(o, "inputs")) === JSON.stringify(["25", "25", "10", "10"]), `defaults ${JSON.stringify(ev(o, "inputs"))}`);
            must(JSON.stringify(ev(o, "pressed")) === JSON.stringify(["true/true", "false/false", "false/false"]), "annual is the selected plan");
            must(cards(o)[0][0].startsWith("$") && cards(o)[1][0].startsWith("$") && cards(o)[2][0].startsWith("$"), "all three cards show a dollar amount");
            must(JSON.stringify(ev(o, "form")) === JSON.stringify({ macs: "25", ios: "10", term: "annual", dedicated: "0", touched: null }), `the lead form mirrors the calculator: ${JSON.stringify(ev(o, "form"))}`);
        } },
        { name: "type 40 Macs", run: num("#calc-mac", "40"), expect: (o) => must(ev(o, "inputs") !== undefined && (ev(o, "inputs") as string[])[0] === "40" && (ev(o, "inputs") as string[])[1] === "40", "slider follows the number box") },
        { name: "slider to 60 iPhones", run: async (p) => { await p.setValue("#calc-ios-r", "60"); await settle(p); }, expect: (o) => must((ev(o, "inputs") as string[])[2] === "60", "number box follows the slider") },
        { name: "800 Macs: past the slider end", run: num("#calc-mac", "800"), expect: (o) => must((ev(o, "inputs") as string[])[0] === "800" && (ev(o, "inputs") as string[])[1] === "500", "slider stops at 500, the number stays 800") },
        { name: "0 and 0: empty state", run: async (p) => { await num("#calc-mac", "0")(p); await num("#calc-ios", "0")(p); }, expect: (o) => { must(ev(o, "verdict") === "Enter your devices to compare the plans.", "empty verdict"); must(cards(o).every((c) => c[1] === "enter your devices" && c[0] === "$0.00"), `cards say enter your devices: ${JSON.stringify(cards(o))}`); must((ev(o, "breakdown") as string[]).length === 0, "no breakdown"); } },
        { name: "1 Mac", run: async (p) => { await num("#calc-mac", "1")(p); }, expect: (o) => must(typeof ev(o, "verdict") === "string" && (ev(o, "verdict") as string).length > 0, "a verdict is shown") },
        { name: "monthly card", run: async (p) => { await num("#calc-mac", "25")(p); await num("#calc-ios", "10")(p); await p.click("#term-monthly"); await settle(p); }, expect: (o) => must(JSON.stringify(ev(o, "pressed")) === JSON.stringify(["false/false", "true/true", "false/false"]) && (ev(o, "form") as { term: string }).term === "monthly", "monthly is pressed and the form follows") },
        { name: "lifetime card", run: async (p) => { await p.click("#term-lifetime"); await settle(p); }, expect: (o) => must(JSON.stringify(ev(o, "pressed")) === JSON.stringify(["false/false", "false/false", "true/true"]) && (ev(o, "form") as { term: string }).term === "lifetime", "lifetime is pressed and the form follows") },
        { name: "annual card again", run: async (p) => { await p.click("#term-annual"); await settle(p); }, expect: (o) => must(JSON.stringify(ev(o, "pressed")) === JSON.stringify(["true/true", "false/false", "false/false"]), "annual pressed") },
        { name: "dedicated instance", run: async (p) => { await p.click("#calc-dedicated"); await settle(p); }, expect: (o) => { must(ev(o, "dedicated") === true && (ev(o, "form") as { dedicated: string }).dedicated === "1", "box ticked, form follows"); must((ev(o, "breakdown") as string[]).some((l) => l.startsWith("Dedicated instance: ")), "breakdown lists the dedicated instance"); } },
        { name: "dedicated on monthly", run: async (p) => { await p.click("#term-monthly"); await settle(p); }, expect: (o) => must((ev(o, "breakdown") as string[]).some((l) => /a month, on your own URL\.$/.test(l)), "monthly shows the instance per month") },
        { name: "dedicated on lifetime", run: async (p) => { await p.click("#term-lifetime"); await settle(p); } },
        { name: "untick dedicated", run: async (p) => { await p.click("#calc-dedicated"); await settle(p); }, expect: (o) => must(ev(o, "dedicated") === false && (ev(o, "form") as { dedicated: string }).dedicated === "0", "form follows") },
        { name: "form macs touched: calculator stops mirroring", run: async (p) => { await p.fill('#lead-form input[name="macs"]', "7"); await num("#calc-mac", "33")(p); }, expect: (o) => must((ev(o, "form") as { macs: string; touched: string }).macs === "7" && (ev(o, "form") as { touched: string }).touched === "1", "the form keeps 7 once edited by hand") },
        { name: "Add it to my estimate", run: async (p) => { await p.click('[data-add-dedicated]'); await p.wait(1000); }, expect: (o) => must(ev(o, "dedicated") === true && ev(o, "hash") === "#calc", "ticks the box and jumps to #calc") },
    ],
};

const form: Scenario = {
    name: "fleet-form",
    description: "Fleet demo form: validation messages, then a mailto: navigation with the filled-in details (nothing is posted)",
    legacyPath: "/fleet.html",
    viewport: { width: 1280, height: 900 },
    ready,
    observe: { ...OBSERVE, selectors: ["#lead-form", '#lead-form button[type="submit"]', "#lead-status"], attrs: ["disabled", "role", "aria-live", "novalidate"], evals: { ...OBSERVE.evals, navs: `window.__navs || []` } },
    steps: [
        { name: "submit empty", run: (p) => p.click('#lead-form button[type="submit"]'), expect: (o) => must(JSON.stringify(ev(o, "status")) === JSON.stringify(["Please tell us your name.", "status bad"]), `name message: ${JSON.stringify(ev(o, "status"))}`) },
        { name: "name only", run: async (p) => { await p.fill('#lead-form input[name="name"]', "  Ada Lovelace "); await p.click('#lead-form button[type="submit"]'); }, expect: (o) => must(JSON.stringify(ev(o, "status")) === JSON.stringify(["Please enter a valid email address.", "status bad"]), "email message") },
        { name: "bad email", run: async (p) => { await p.fill('#lead-form input[name="email"]', "ada@example"); await p.click('#lead-form button[type="submit"]'); }, expect: (o) => must((ev(o, "status") as string[])[0] === "Please enter a valid email address.", "a dotless domain is refused") },
        {
            name: "valid: opens mailto",
            run: async (p) => {
                await p.fill('#lead-form input[name="email"]', "ada@example.com");
                await p.fill('#lead-form input[name="company"]', "Analytical Engines");
                await p.fill('#lead-form textarea[name="message"]', "Hello");
                p.clearNavigations();
                await p.click('#lead-form button[type="submit"]');
                await p.wait(300);
                await p.eval(`window.__navs = ${JSON.stringify(p.requestedNavigations().map((n) => decodeURIComponent(n.url)))}`);
            },
            expect: (o) => {
                must(JSON.stringify(ev(o, "status")) === JSON.stringify(["Opening your email app. If nothing opens, write to hello@netquor.com.", "status ok"]), `ok message: ${JSON.stringify(ev(o, "status"))}`);
                const navs = ev(o, "navs") as string[];
                must(navs.length === 1 && navs[0] === "mailto:hello@netquor.com?subject=Netquor Fleet free trial&body=Name: Ada Lovelace\nEmail: ada@example.com\nCompany: Analytical Engines\nMacs: 25\niPhones and iPads: 10\nPlan looked at: annual\n\nHello", `one mailto navigation with the form details: ${JSON.stringify(navs)}`);
                must(o.elements['#lead-form button[type="submit"]'].items[0].attrs.disabled === undefined, "the submit button is enabled again");
            },
        },
    ],
};

export default [calc, form];
