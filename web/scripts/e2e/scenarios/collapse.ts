// collapse.ts: the Bootstrap collapse accordions (data-bs-toggle="collapse" with data-bs-parent="#faq") on vpn, network, sdn and homeassistant. The behaviour comes from bootstrap.bundle.min.js 5.3.3 on a CDN today; a port has to reproduce it without that script.
import type { Page } from "../browser";
import type { Scenario, Step } from "../scenario";
import type { Observed } from "../observe";
import { must } from "./helpers";

const TOGGLE = '[data-bs-toggle="collapse"]';

const shown = (o: Observed): string[] => o.elements[".accordion-collapse"].items.filter((e) => e.classes.includes("show")).map((e) => e.attrs.id);
const trigger = (o: Observed, i: number) => o.elements[TOGGLE].items[i];

const expectOpen = (ids: string[]): NonNullable<Step["expect"]> => (o) => {
    must(JSON.stringify(shown(o)) === JSON.stringify(ids), `open panels should be ${JSON.stringify(ids)}, got ${JSON.stringify(shown(o))}`);
    for (const [i, t] of o.elements[TOGGLE].items.entries()) {
        const id = t.attrs["data-bs-target"].slice(1);
        const open = ids.includes(id);
        if (t.attrs["aria-expanded"] !== undefined) must(t.attrs["aria-expanded"] === String(open), `aria-expanded of trigger ${i} should be ${open}`);
        must(t.classes.includes("collapsed") === !open, `trigger ${i} has class "collapsed" exactly when closed`);
    }
};

const run = (page: string, ids: string[]): Scenario => ({
    name: `collapse-${page.replace(".html", "")}`,
    description: `${page}: accordion open, close, one open at a time (data-bs-parent), keyboard, aria-expanded`,
    legacyPath: `/${page}`,
    allow: [
        { path: "*[data-bs-toggle=\"collapse\"][*].attrs.aria-controls", reason: "IMPROVEMENT: the port gives every toggle aria-controls (the id of its panel) from the first paint; Bootstrap 5.3.3 never adds it on these hand-written toggles" },
        { path: "*[data-bs-toggle=\"collapse\"][*].attrs.aria-expanded", reason: "IMPROVEMENT: the port gives every toggle aria-expanded=\"false\" from the first paint and keeps it true or false after; Bootstrap only adds the attribute on a toggle's first use (the absolute expectation in each step still checks the value)" },
    ],
    viewport: { width: 1280, height: 900 },
    // Legacy is ready when the Bootstrap bundle has loaded; the port (no Bootstrap JS) is ready when the collapse action has given the toggles aria-controls.
    ready: (p: Page) => p.waitFor(() => !!document.querySelector('[data-bs-toggle="collapse"]') && (!!(window as unknown as { bootstrap?: unknown }).bootstrap || !!document.querySelector('[data-bs-toggle="collapse"][aria-controls]')), 15000),
    observe: {
        selectors: [TOGGLE, ".accordion-collapse"],
        attrs: ["aria-expanded", "aria-controls", "data-bs-target", "data-bs-parent", "data-bs-toggle", "id", "type"],
        classes: ["collapsed", "show", "collapse", "collapsing", "accordion-button", "accordion-collapse"],
        computed: ["display"],
        text: false,
        box: false,
        limit: 10,
        evals: { open: `[...document.querySelectorAll(".accordion-collapse.show")].map((e) => e.id)`, focus: `document.activeElement && document.activeElement.getAttribute("data-bs-target")` },
    },
    steps: [
        { name: "all closed", expect: (o) => { expectOpen([])(o, "legacy", null as never); must(o.elements[TOGGLE].count === ids.length, `${ids.length} triggers`); must([undefined, "false"].includes(trigger(o, 0).attrs["aria-expanded"]), "closed triggers carry no aria-expanded (Bootstrap, until first used) or aria-expanded=false (the port, from the start)"); } },
        { name: "open the first", run: async (p) => { await p.click(`${TOGGLE}[data-bs-target="#${ids[0]}"]`); await p.wait(600); }, expect: expectOpen([ids[0]]) },
        { name: "open the second: the first closes", run: async (p) => { await p.click(`${TOGGLE}[data-bs-target="#${ids[1]}"]`); await p.wait(700); }, expect: expectOpen([ids[1]]) },
        { name: "click the open one: closes", run: async (p) => { await p.click(`${TOGGLE}[data-bs-target="#${ids[1]}"]`); await p.wait(600); }, expect: expectOpen([]) },
        { name: "mid transition", run: (p) => p.click(`${TOGGLE}[data-bs-target="#${ids[2]}"]`), observe: { classes: ["collapsed", "show", "collapse", "collapsing"] } },
        { name: "keyboard: Enter on the last", run: async (p) => { await p.wait(600); await p.eval(`document.querySelector('${TOGGLE}[data-bs-target="#${ids[ids.length - 1]}"]').focus()`); await p.press("Enter"); await p.wait(700); }, expect: expectOpen([ids[ids.length - 1]]) },
        { name: "keyboard: Space on the first", run: async (p) => { await p.eval(`document.querySelector('${TOGGLE}[data-bs-target="#${ids[0]}"]').focus()`); await p.press("Space"); await p.wait(700); }, expect: expectOpen([ids[0]]) },
        { name: "every trigger once, in order", run: async (p) => { for (const id of ids) { await p.click(`${TOGGLE}[data-bs-target="#${id}"]`); await p.wait(450); } await p.wait(400); }, expect: expectOpen([ids[ids.length - 1]]) },
    ],
});

export default [
    run("vpn.html", ["v0", "v1", "v2", "v3", "v4", "v5"]),
    run("network.html", ["q0", "q1", "q2", "q3", "q4", "q5"]),
    run("sdn.html", ["f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7"]),
    run("homeassistant.html", ["h0", "h1", "h2", "h3", "h4", "h5", "h6"]),
];
