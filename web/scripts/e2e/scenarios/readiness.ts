// readiness.ts: readiness.js on readiness.html. Four checklists of seven yes / not-yet questions; the result box under each fills in as the form changes: a progress line, then a score, a band, the gaps, three actions and a mailto link. Nothing is stored or sent.
import type { Page } from "../browser";
import type { Scenario } from "../scenario";
import type { ObserveSpec } from "../observe";
import { count, el, must } from "./helpers";

const section = (key: string) => `#${key}`;
const answer = (key: string, i: number, yes: boolean) => (p: Page) => p.click(`${section(key)} input[name="${key}-${i}"][value="${yes ? 1 : 0}"]`);
const answerAll = (key: string, yes: boolean[]) => async (p: Page) => { for (let i = 0; i < yes.length; i++) await answer(key, i, yes[i])(p); };

const spec = (key: string): ObserveSpec => ({
    selectors: [`${section(key)} .nq-check-result`, `${section(key)} .nq-check-prog`, `${section(key)} .nq-check-score b`, `${section(key)} .nq-check-score span`, `${section(key)} .nq-note`, `${section(key)} .nq-gaps li`, `${section(key)} .nq-gaps li b`, `${section(key)} .nq-gaps a`, `${section(key)} .nq-check-actions a`, `${section(key)} .nq-check-actions button`, `${section(key)} .nq-who-cta`, `${section(key)} input:checked`],
    attrs: ["hidden", "aria-live", "href", "type", "name", "value"],
    classes: ["btn", "btn-primary-cyber", "btn-outline-info", "nq-linkbtn", "nq-who-cta", "nq-check-prog", "nq-check-score", "nq-note", "nq-gaps"],
    text: true,
    textMax: 200,
    box: false,
    limit: 8,
    evals: { prints: `window.__e2e.prints` },
});

const run = (key: string): Scenario => ({
    name: `readiness-${key}`,
    description: `${key}: progress line, score bands, gaps, actions, print and mailto, changing answers`,
    legacyPath: "/readiness.html",
    viewport: { width: 1280, height: 900 },
    ready: (p) => p.waitFor(() => document.querySelectorAll(".nq-check").length === 4 && document.querySelector("html")!.classList.contains("nq-reveal-on"), 15000),
    observe: spec(key),
    steps: [
        { name: "untouched", expect: (o) => must(el(o, `${section(key)} .nq-check-result`).attrs.hidden !== undefined && el(o, `${section(key)} .nq-check-result`).attrs["aria-live"] === "polite", "result box is hidden with aria-live=polite") },
        { name: "first answer", run: answer(key, 0, true), expect: (o) => must(el(o, `${section(key)} .nq-check-prog`).text === "1 of 7 answered" && el(o, `${section(key)} .nq-check-result`).attrs.hidden === undefined, "shows '1 of 7 answered'") },
        { name: "six answered", run: async (p) => { for (let i = 1; i < 6; i++) await answer(key, i, true)(p); }, expect: (o) => must(el(o, `${section(key)} .nq-check-prog`).text === "6 of 7 answered", "shows '6 of 7 answered'") },
        { name: "seventh: not yet", run: answer(key, 6, false), expect: (o) => { must(count(o, `${section(key)} .nq-check-score b`) === 1 && el(o, `${section(key)} .nq-check-score b`).text === "6 of 7", "score 6 of 7"); must(el(o, `${section(key)} .nq-check-score span`).text === "In good shape (a simple count of your answers)", "band: In good shape"); must(count(o, `${section(key)} .nq-gaps li`) === 1, "one gap listed"); } },
        { name: "change first to not yet", run: answer(key, 0, false), expect: (o) => { must(el(o, `${section(key)} .nq-check-score span`).text === "Partly in place (a simple count of your answers)", "band: Partly in place"); must(count(o, `${section(key)} .nq-gaps li`) === 2, "two gaps"); } },
        { name: "all yes", run: answerAll(key, [true, true, true, true, true, true, true]), expect: (o) => { must(el(o, `${section(key)} .nq-check-score b`).text === "7 of 7", "7 of 7"); must(el(o, `${section(key)} .nq-note`).text === "Every practice is in place. Revisit this when your team or setup changes.", "all-in-place note"); must(count(o, `${section(key)} .nq-gaps li`) === 0, "no gaps list"); } },
        { name: "all not yet", run: answerAll(key, [false, false, false, false, false, false, false]), expect: (o) => { must(el(o, `${section(key)} .nq-check-score span`).text.startsWith("Mostly manual today"), "band: Mostly manual today"); must(count(o, `${section(key)} .nq-gaps li`) === 7, "seven gaps"); must(el(o, `${section(key)} .nq-note`).text === "What to look at next:", "'What to look at next:' note"); } },
        { name: "three yes: boundary", run: answerAll(key, [true, true, true, false, false, false, false]), expect: (o) => must(el(o, `${section(key)} .nq-check-score span`).text.startsWith("Partly in place"), "3 of 7 is Partly in place (2 and below is Mostly manual)") },
        { name: "two yes: boundary", run: answer(key, 2, false), expect: (o) => must(el(o, `${section(key)} .nq-check-score span`).text.startsWith("Mostly manual today"), "2 of 7 is Mostly manual today") },
        { name: "print", run: (p) => p.click(`${section(key)} .nq-check-actions button`), expect: (o) => must(o.evals?.prints === 1, "Print this result calls window.print once") },
        { name: "actions and mailto", expect: (o) => { must(count(o, `${section(key)} .nq-check-actions a`) === 2 && el(o, `${section(key)} .nq-check-actions button`).text === "Print this result", "two links and the print button"); must(el(o, `${section(key)} .nq-who-cta`).attrs.href.startsWith("mailto:hello@netquor.com?subject=Readiness%20result%3A%20"), `mailto link: ${el(o, `${section(key)} .nq-who-cta`).attrs.href}`); must(el(o, `${section(key)} .nq-who-cta`).text === "Send us this result and we will reply with a plan", "send-us-this-result link text"); } },
    ],
});

const independent: Scenario = {
    name: "readiness-independent",
    description: "answering in one checklist does not touch another; the tab links are plain anchors",
    legacyPath: "/readiness.html",
    viewport: { width: 1280, height: 900 },
    ready: (p) => p.waitFor(() => document.querySelectorAll(".nq-check").length === 4 && document.querySelector("html")!.classList.contains("nq-reveal-on"), 15000),
    observe: { selectors: [".nq-check-result", ".nq-check-tabs a", "input:checked"], attrs: ["hidden", "href"], classes: false, text: true, textMax: 80, box: false, limit: 8, evals: { hash: "location.hash" } },
    steps: [
        { name: "answer in devices", run: answer("devices", 0, true), expect: (o) => must(o.elements[".nq-check-result"].items.map((e) => e.attrs.hidden !== undefined).join() === "false,true,true,true", "only the devices box is visible") },
        { name: "answer in people", run: answer("people", 3, false), expect: (o) => must(o.elements[".nq-check-result"].items.map((e) => e.attrs.hidden !== undefined).join() === "false,true,true,false", "devices and people boxes are visible") },
        { name: "tab link", run: async (p) => { await p.click('.nq-check-tabs a[href="#network"]'); await p.wait(800); }, expect: (o) => must(o.evals?.hash === "#network", "tab links are plain #anchors") },
    ],
};

export default [...["devices", "calls", "network", "people"].map(run), independent];
