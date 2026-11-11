// fx.ts: fx.js on the home page. The scroll progress line, reveal classes as sections scroll into view, the hero map (traces, pulses, tap areas, hover and focus on a label), the card spotlight, and reduced motion.
import type { Scenario } from "../scenario";
import type { AllowEntry } from "../diff";
import type { ObserveSpec } from "../observe";
import { attr, count, el, must } from "./helpers";

const FX_READY = (p: import("../browser").Page) => p.waitFor(() => !!document.querySelector(".nq-progress") && !!document.querySelector(".nq-map-lines .nq-pulse") && !!document.querySelector(".nq-bg"), 15000);

const FX_OBSERVE: ObserveSpec = {
    selectors: [".nq-progress", ".nq-map-lines path:not(.nq-pulse)", ".nq-pulse", ".nq-map-labels > a", ".nq-map-labels > a > rect", ".nq-section-head", ".nq-app", ".nq-cmp-list details"],
    attrs: ["aria-hidden", "pathLength", "style", "x", "y", "width", "height", "fill"],
    classes: ["nq-r", "nq-shown", "hot", "nq-pulse"],
    computed: [],
    text: false,
    box: false,
    limit: 3,
    evals: {
        revealOn: `document.documentElement.classList.contains("nq-reveal-on")`,
        targets: `document.querySelectorAll(".nq-r").length`,
        shown: `document.querySelectorAll(".nq-shown").length`,
        hotPaths: `[...document.querySelectorAll(".nq-map-lines path")].map((p, i) => p.classList.contains("hot") ? i : -1).filter((i) => i >= 0)`,
        progress: `getComputedStyle(document.querySelector(".nq-progress")).transform`,
        delays: `[...document.querySelectorAll(".nq-r")].slice(0, 7).map((e) => e.style.transitionDelay)`,
        pulseDelays: `[...document.querySelectorAll(".nq-pulse")].map((e) => e.style.animationDelay)`,
        pathLengths: `[...document.querySelectorAll(".nq-map-lines path")].map((e) => e.getAttribute("pathLength"))`,
        scrollMax: `document.documentElement.scrollHeight - innerHeight`,
    },
};

// The hover rectangles of the map labels are measured with getBBox of the label text, which comes from the font's vertical metrics (the Plex Mono sub line in particular). The npm Plex files differ slightly from the ones Google serves, so the boxes are 1 to 3 px different; the labels are drawn in the same place (the visual diff of the home page is 0.01 percent) and the hover and tap behavior is asserted by the steps below.
const LABEL_BOX_FROM_FONT_METRICS = "the label hit rectangles come from getBBox of the text, which follows the font file's vertical metrics; the npm Plex files differ from Google's by a few px of ascent and descent, the labels are drawn in the same place";
const FX_ALLOW: AllowEntry[] = ["x", "y", "width", "height"].map((a) => ({ path: `* :: .nq-map-labels > a > rect[*].attrs.${a}`, reason: LABEL_BOX_FROM_FONT_METRICS })).concat([
    // The legacy script ran before first paint, so it hid the first-screen sections and faded them in. The Svelte page is server-rendered and already painted when the reveal starts, so hiding and re-showing on-screen sections would be a visible flash. They are marked shown in the same pass instead (their opacity never changes); sections below the fold reveal on scroll exactly as before.
    { path: "load :: evals.shown", reason: "on-screen sections are shown in the same pass as the reveal setup (no hide-then-fade flash after hydration)" },
    { path: "first screen :: evals.shown", reason: "on-screen sections are shown in the same pass as the reveal setup (no hide-then-fade flash after hydration)" },
]);

const desktop: Scenario = {
    name: "fx-desktop",
    description: "fx.js on the home page at 1280px",
    legacyPath: "/index.html",
    sveltePath: "/",
    viewport: { width: 1280, height: 900 },
    ready: FX_READY,
    observe: FX_OBSERVE,
    allow: FX_ALLOW,
    steps: [
        { name: "first screen", expect: (o) => {
            must(o.evals?.revealOn === true, "html gets nq-reveal-on");
            must((o.evals?.targets as number) > 20, "reveal targets get nq-r");
            must(count(o, ".nq-progress") === 1 && attr(o, ".nq-progress", "aria-hidden") === "true", "one aria-hidden progress bar");
            must(count(o, ".nq-pulse") === 9 && count(o, ".nq-map-lines path:not(.nq-pulse)") === 9, "9 traces and 9 pulse clones");
            must((o.evals?.pathLengths as string[]).every((l) => l === "100"), "pathLength is 100 on every trace and pulse");
            must(JSON.stringify(o.evals?.pulseDelays) === JSON.stringify(["0s", "0.55s", "1.1s", "1.65s", "2.2s", "2.75s", "3.3s", "3.85s", "4.4s"]), `pulse delays step by 0.55s: ${JSON.stringify(o.evals?.pulseDelays)}`);
            must(JSON.stringify(o.evals?.delays) === JSON.stringify(["0ms", "70ms", "140ms", "0ms", "70ms", "140ms", "0ms"]), `reveal stagger is (index mod 3) * 70ms: ${JSON.stringify(o.evals?.delays)}`);
        } },
        { name: "scroll 800", run: (p) => p.scrollTo(800) },
        { name: "scroll 3000", run: async (p) => { await p.scrollTo(3000); await p.wait(700); } },
        { name: "scroll to the end", run: async (p) => { await p.scrollTo(1e6); await p.wait(700); }, expect: (o) => must(/^matrix\(1, 0, 0, 1, 0, 0\)$/.test(o.evals?.progress as string), `progress is full at the end: ${o.evals?.progress}`) },
        { name: "back to the top", run: async (p) => { await p.scrollTo(0); await p.wait(300); }, expect: (o) => must(/^matrix\(0, 0, 0, 1, 0, 0\)$/.test(o.evals?.progress as string), `progress is empty at the top: ${o.evals?.progress}`) },
        { name: "hover a map label", run: async (p) => { await p.scrollTo(0); await p.hover(".nq-map-labels > a:nth-child(2)"); }, expect: (o) => must(JSON.stringify(o.evals?.hotPaths) === "[0,9]", `hovering the second label lights trace 0 and its pulse (9): ${JSON.stringify(o.evals?.hotPaths)}`) },
        { name: "leave the label", run: (p) => p.moveMouse(5, 5), expect: (o) => must((o.evals?.hotPaths as number[]).length === 0, "no trace stays lit") },
        { name: "hover the first label (centre)", run: (p) => p.hover(".nq-map-labels > a:nth-child(1)"), expect: (o) => must(JSON.stringify(o.evals?.hotPaths) === "[8,17]", `the centre label lights trace 8 and its pulse (17): ${JSON.stringify(o.evals?.hotPaths)}`) },
        { name: "focus a label", run: async (p) => { await p.moveMouse(5, 5); await p.eval(`document.querySelector(".nq-map-labels > a:nth-child(4)").focus()`); } },
        { name: "blur it", run: (p) => p.eval(`document.activeElement.blur()`) },
        { name: "spotlight follows the pointer", run: async (p) => { await p.scrollTo(1500); await p.eval(`window.__card = document.querySelector(".nq-app, .nq-who, .nq-calc, .nq-check, .nq-prices-row")`); await p.hover(".nq-app"); }, observe: { evals: { spot: `(() => { const c = document.querySelector(".nq-app"); return [c.style.getPropertyValue("--mx"), c.style.getPropertyValue("--my")].map((v) => /^[0-9.]+px$/.test(v) ? "px" : v); })()` } }, expect: (o) => must(JSON.stringify(o.evals?.spot) === '["px","px"]', `--mx and --my are set in px: ${JSON.stringify(o.evals?.spot)}`) },
    ],
};

const reduced: Scenario = {
    name: "fx-reduced",
    description: "fx.js with prefers-reduced-motion: the progress bar exists, pulses are created, nothing is revealed late",
    legacyPath: "/index.html",
    sveltePath: "/",
    viewport: { width: 1280, height: 900, reducedMotion: true },
    ready: (p) => p.waitFor(() => !!document.querySelector(".nq-progress") && !!document.querySelector(".nq-map-lines .nq-pulse"), 15000),
    observe: { ...FX_OBSERVE, computed: ["display", "opacity"], selectors: [".nq-progress", ".nq-pulse", ".nq-section-head"] },
    steps: [
        { name: "first screen", expect: (o) => {
            must(o.evals?.revealOn === false, "no nq-reveal-on under reduced motion");
            must(o.evals?.targets === 0, "no nq-r targets under reduced motion");
            must(el(o, ".nq-progress").computed.display === "none", "the progress line is hidden by CSS");
            must(count(o, ".nq-pulse") === 9, "pulse clones are still created");
        } },
        { name: "scroll", run: (p) => p.scrollTo(2000) },
    ],
};

export default [desktop, reduced];
