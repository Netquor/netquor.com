// nudge.ts: nudge.js. A corner card on seven product pages: shown once the 25 s timer has fired AND the visitor has scrolled to 40% of the page, only for fine pointers, never after a Tab key or under reduced motion. Dismissed with "Not now", the close button or Escape; dismissal is remembered in sessionStorage for the session. The 25 s timer runs 50 times faster here (timers: scale 0.02), so a scenario takes seconds.
import type { Page } from "../browser";
import type { Scenario, Step } from "../scenario";
import type { ObserveSpec } from "../observe";
import { attr, count, el, must } from "./helpers";

/** What nudge.js shows per page (read from nudge.js): checklist key, title, body. */
export const NUDGES: Record<string, { key: string; title: string; body: string }> = {
    "fleet.html": { key: "devices", title: "Looking at Netquor Fleet?", body: "See the Apple device readiness checklist. Seven questions, about two minutes." },
    "vpn.html": { key: "network", title: "Looking at remote access?", body: "See the network and remote access checklist. Seven questions, about two minutes." },
    "network.html": { key: "network", title: "Looking at routable IPs?", body: "See the network and remote access checklist. Seven questions, about two minutes." },
    "sdn.html": { key: "network", title: "Looking at managed networking?", body: "See the network readiness checklist. Seven questions, about two minutes." },
    "homeassistant.html": { key: "people", title: "Looking at a smarter building?", body: "See the people and access checklist. Seven questions, about two minutes." },
    "digitalaccess.html": { key: "people", title: "Looking at building access?", body: "See the people and access checklist. Seven questions, about two minutes." },
    "central.html": { key: "people", title: "Looking at Netquor Central?", body: "See the people and access checklist. Seven questions, about two minutes." },
};

const TIMERS = { scale: 0.02 };

export const NUDGE_OBSERVE: ObserveSpec = {
    selectors: [".nq-nudge", ".nq-nudge > b", ".nq-nudge > p", ".nq-nudge-go", ".nq-nudge-no", ".nq-nudge-x"],
    attrs: ["role", "aria-label", "href", "type"],
    classes: ["in", "nq-nudge", "nq-nudge-go", "nq-nudge-no", "nq-nudge-x"],
    computed: ["position", "opacity"],
    text: true,
    box: false,
    limit: 2,
    storage: { session: ["nq-nudge"] },
    evals: {
        ratio: `Math.round(((document.documentElement.scrollTop + innerHeight) / document.documentElement.scrollHeight) * 100) / 100`,
        nudgeTimer: `(window.__e2e.timers || []).some((t) => t.kind === "timeout" && t.ms === 25000)`,
        nudges: `document.querySelectorAll(".nq-nudge").length`,
    },
};

const toRatio = (frac: number) => async (p: Page) => {
    await p.waitForStableLayout(700);
    await p.eval(`(() => { const h = document.documentElement; const y = Math.max(0, Math.ceil(${frac} * h.scrollHeight - innerHeight)); window.scrollTo({ top: y, behavior: "instant" }); })()`);
    await p.settle();
    await p.wait(150);
};

const expectNone: Step["expect"] = (o) => must(count(o, ".nq-nudge") === 0, "no nudge is shown");
const expectShown = (page: string, styled = true): Step["expect"] => (o) => {
    const n = NUDGES[page];
    must(count(o, ".nq-nudge") === 1, `one nudge is shown (found ${count(o, ".nq-nudge")})`);
    must(attr(o, ".nq-nudge", "role") === "complementary" && attr(o, ".nq-nudge", "aria-label") === "Suggested checklist", "aside has role=complementary and aria-label 'Suggested checklist'");
    must(el(o, ".nq-nudge").tag === "aside" && el(o, ".nq-nudge").classes.includes("in"), "an <aside> that gets the 'in' class");
    must(el(o, ".nq-nudge > b").text === n.title, `title is "${n.title}"`);
    must(el(o, ".nq-nudge > p").text === n.body, `text is "${n.body}"`);
    must(attr(o, ".nq-nudge-go", "href") === `readiness.html#${n.key}` && el(o, ".nq-nudge-go").text === "Open the checklist", `link goes to readiness.html#${n.key}`);
    must(el(o, ".nq-nudge-no").text === "Not now" && attr(o, ".nq-nudge-no", "type") === "button", "Not now button");
    must(attr(o, ".nq-nudge-x", "aria-label") === "Close" && attr(o, ".nq-nudge-x", "type") === "button", "Close button with aria-label");
    if (styled) must(el(o, ".nq-nudge").computed.position === "fixed" && el(o, ".nq-nudge").computed.opacity === "1", "fixed card, faded in");
    else must(el(o, ".nq-nudge").computed.position === "static", "fleet.html does not load nq.css, so the card is unstyled (position static)");
    must(o.evals?.nudgeTimer === true, "a 25000 ms timer was set");
};
const expectGone = (stored: boolean): Step["expect"] => (o) => {
    must(count(o, ".nq-nudge") === 0, "the card is removed");
    must(o.storage?.session["nq-nudge"] === (stored ? "1" : null), `sessionStorage nq-nudge is ${stored ? '"1"' : "unset"}`);
};

const full = (page: string, dismiss: "x" | "no" | "escape"): Scenario => {
    const styled = page !== "fleet.html";
    const how = { x: ".nq-nudge-x", no: ".nq-nudge-no", escape: "" }[dismiss];
    const close = async (p: Page) => { if (dismiss === "escape") await p.press("Escape"); else await p.click(how); await p.wait(450); };
    return {
        name: `nudge-${page.replace(".html", "")}`,
        description: `${page}: timer and 40% scroll gate, content, dismissal by ${dismiss === "x" ? "the close button" : dismiss === "no" ? "Not now" : "Escape"}, session memory`,
        legacyPath: `/${page}`,
        viewport: { width: 1280, height: 900, timers: TIMERS },
        ready: (p) => p.waitFor(() => !!document.querySelector(".nq-nav")),
        observe: NUDGE_OBSERVE,
        steps: [
            { name: "timer fired, no scroll", run: (p) => p.wait(900), expect: expectNone },
            { name: "scroll to 10%", run: toRatio(0.1), expect: (o) => { if ((o.evals?.ratio as number) < 0.4) expectNone(o, "legacy", null as never); } },
            { name: "scroll to 40%", run: toRatio(0.4), observe: {}, expect: expectShown(page, styled) },
            { name: "reload without dismissing", run: async (p) => { await p.scrollTo(0); await p.reload(); await p.wait(900); }, expect: (o) => must(count(o, ".nq-nudge") === 0 && o.storage?.session["nq-nudge"] === null, "showing the card is not remembered, only dismissing it is") },
            { name: "scroll again: shown again", run: toRatio(0.5), expect: expectShown(page, styled) },
            { name: `dismiss (${dismiss})`, run: close, expect: expectGone(true) },
            { name: "reload and scroll: stays away", run: async (p) => { await p.reload(); await p.wait(900); await toRatio(0.6)(p); }, expect: expectGone(true) },
        ],
    };
};

const gated = (name: string, page: string, why: string, viewport: Scenario["viewport"], before?: (p: Page) => Promise<void>): Scenario => ({
    name,
    description: `${page}: ${why}`,
    legacyPath: `/${page}`,
    viewport: { width: 1280, height: 900, timers: TIMERS, ...viewport },
    ready: (p) => p.waitFor(() => !!document.querySelector(".nq-nav")),
    observe: NUDGE_OBSERVE,
    steps: [
        { name: "interact", run: async (p) => { await before?.(p); }, expect: expectNone },
        { name: "timer fired and scrolled to 60%", run: async (p) => { await p.wait(900); await toRatio(0.6)(p); await p.wait(300); }, expect: expectNone },
    ],
});

export default [
    full("vpn.html", "x"),
    full("fleet.html", "escape"),
    full("network.html", "no"),
    ...["sdn.html", "homeassistant.html", "digitalaccess.html", "central.html"].map((p): Scenario => ({
        name: `nudge-${p.replace(".html", "")}`,
        description: `${p}: content and link after the timer and 40% scroll`,
        legacyPath: `/${p}`,
        viewport: { width: 1280, height: 900, timers: TIMERS },
        ready: (pg) => pg.waitFor(() => !!document.querySelector(".nq-nav")),
        observe: NUDGE_OBSERVE,
        steps: [{ name: "timer and scroll", run: async (pg) => { await pg.wait(900); await toRatio(0.5)(pg); }, expect: expectShown(p) }],
    })),
    gated("nudge-keyboard", "sdn.html", "a Tab key press anywhere keeps the card away for the rest of the page view", {}, async (p) => { await p.press("Tab"); }),
    gated("nudge-reduced", "central.html", "never shown under prefers-reduced-motion", { reducedMotion: true }),
    gated("nudge-touch", "homeassistant.html", "never shown without a fine pointer (touch device)", { width: 390, height: 844, touch: true }),
];
