// bg.ts: bg.js, the hero background on the home page: SVG grid and traces, a canvas pulse, a pause control that persists in localStorage, reduced motion and Save-Data.
import type { Page } from "../browser";
import type { Scenario } from "../scenario";
import type { AllowEntry } from "../diff";
import type { ObserveSpec } from "../observe";
import { attr, count, el, must } from "./helpers";

/** Resolves true when the canvas shows at least one painted pixel within maxMs (polled every 40 ms), else false. */
const ANIMATES = (maxMs: number) => `new Promise((res) => { const cv = document.querySelector(".nq-bg canvas"); const ctx = cv.getContext("2d"); const end = performance.now() + ${maxMs};
  const painted = () => { const d = ctx.getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true; return false; };
  const tick = () => { if (painted()) return res(true); if (performance.now() > end) return res(false); setTimeout(tick, 40); }; tick(); })`;

const BG_OBSERVE: ObserveSpec = {
    selectors: [".hero-section > :first-child", ".nq-bg svg", ".nq-bg canvas", ".nq-bg-pause", ".nq-bg svg polyline", ".nq-bg svg circle", ".nq-bg svg pattern", ".nq-bg svg linearGradient"],
    attrs: ["aria-hidden", "aria-pressed", "viewBox", "type", "width", "height", "points", "id", "cx", "cy"],
    classes: true,
    text: true,
    limit: 6,
    storage: { local: ["nq-bg-paused"] },
    evals: {
        heroChildren: `[...document.querySelector(".hero-section").children].slice(-1).map((e) => e.className)`,
        wrapIsFirst: `document.querySelector(".hero-section").firstElementChild === document.querySelector(".nq-bg")`,
        canvasDpr: `(() => { const c = document.querySelector(".nq-bg canvas"); const h = document.querySelector(".hero-section"); return [c.width / (window.devicePixelRatio || 1) === h.clientWidth, c.height / (window.devicePixelRatio || 1) === h.clientHeight]; })()`,
    },
};

// bg.js measures the hero once, at start. The legacy page starts at DOMContentLoaded, when its CDN fonts are still loading and the fallback face makes the hero 2 px taller (800, against the 798 it settles at); the Svelte page starts after hydration, and its fonts come from our own origin and are in by then, so it measures the settled height. The final hero is the same on both (798.05 px in the scenario viewport); only the one-off measurement differs, and the Svelte canvas now fills the hero exactly (canvasDpr true on both axes).
const HERO_MEASURED_AFTER_FONTS = "IMPROVEMENT: the Svelte page measures the hero after its own-origin fonts are in (798 px, the settled height); the legacy page measures before its CDN fonts load (800 px, fallback face), which is a transient value";
const BG_ALLOW: AllowEntry[] = [
    { path: "* :: .nq-bg svg[*].attrs.viewBox", reason: HERO_MEASURED_AFTER_FONTS },
    { path: "* :: .nq-bg canvas[*].attrs.height", reason: HERO_MEASURED_AFTER_FONTS },
    { path: "* :: .nq-bg svg polyline[*].box.*", reason: HERO_MEASURED_AFTER_FONTS },
    { path: "* :: .nq-bg svg circle[*].box.*", reason: HERO_MEASURED_AFTER_FONTS },
    { path: "* :: evals.canvasDpr", reason: HERO_MEASURED_AFTER_FONTS + "; the legacy canvas is 2 px taller than its settled hero (false), the Svelte canvas fills it (true)" },
];

const ready = (p: Page) => p.waitFor(".nq-bg svg polyline", 15000);
const readyWithButton = (p: Page) => p.waitFor(".nq-bg-pause", 15000);

const play: Scenario = {
    name: "bg-play",
    description: "bg.js: structure, animation, pause control, persistence across reload, resume, resize rebuild",
    legacyPath: "/index.html",
    sveltePath: "/",
    viewport: { width: 1280, height: 900 },
    ready: async (p) => { await ready(p); await readyWithButton(p); },
    observe: BG_OBSERVE,
    allow: BG_ALLOW,
    steps: [
        {
            name: "playing",
            observe: { evals: { animates: ANIMATES(12000) } },
            expect: (o) => {
                must(o.evals?.animates === true, "the canvas paints a pulse within 12 s");
                must(o.evals?.wrapIsFirst === true, ".nq-bg is the first child of .hero-section");
                must(attr(o, ".nq-bg-pause", "aria-pressed") === "false" && el(o, ".nq-bg-pause").text === "Pause background motion", "button says Pause background motion, aria-pressed=false");
                must(count(o, ".nq-bg svg pattern") === 1 && count(o, ".nq-bg svg linearGradient") === 1, "svg has the grid pattern and the fade gradient");
                must(o.storage?.local["nq-bg-paused"] === null, "nothing is stored until the control is used");
                must(attr(o, ".hero-section > :first-child", "aria-hidden") === "true", "the wrapper is aria-hidden");
            },
        },
        {
            name: "pause",
            run: (p) => p.click(".nq-bg-pause", { scroll: false }),
            observe: { evals: { animatesAfterPause: `new Promise((r) => setTimeout(r, 300)).then(() => (${ANIMATES(1500)}))` } },
            expect: (o) => {
                must(el(o, ".nq-bg-pause").text === "Play background motion" && attr(o, ".nq-bg-pause", "aria-pressed") === "true", "button says Play background motion, aria-pressed=true");
                must(o.storage?.local["nq-bg-paused"] === "1", "localStorage nq-bg-paused = 1");
                must(o.evals?.animatesAfterPause === false, "the canvas is cleared and stays blank while paused");
            },
        },
        {
            name: "reload keeps it paused",
            run: async (p) => { await p.scrollTo(0); await p.reload(); await readyWithButton(p); },
            observe: { evals: { animatesAfterReload: ANIMATES(2500) } },
            expect: (o) => {
                must(el(o, ".nq-bg-pause").text === "Play background motion" && attr(o, ".nq-bg-pause", "aria-pressed") === "true", "paused state restored from localStorage");
                must(o.evals?.animatesAfterReload === false, "no animation after reload while paused");
            },
        },
        {
            name: "resume",
            run: (p) => p.click(".nq-bg-pause", { scroll: false }),
            observe: { evals: { animatesAfterResume: ANIMATES(12000) } },
            expect: (o) => {
                must(el(o, ".nq-bg-pause").text === "Pause background motion" && attr(o, ".nq-bg-pause", "aria-pressed") === "false", "button back to Pause");
                must(o.storage?.local["nq-bg-paused"] === "0", "localStorage nq-bg-paused = 0");
                must(o.evals?.animatesAfterResume === true, "the pulse runs again");
            },
        },
        {
            name: "resize rebuilds the svg after 150 ms",
            run: async (p) => { await p.setViewport({ width: 900, height: 900 }); await p.wait(500); },
            expect: (o) => must(o.evals?.canvasDpr && (o.evals.canvasDpr as boolean[]).every(Boolean), "canvas bitmap follows the hero size"),
        },
    ],
};

const reduced: Scenario = {
    name: "bg-reduced",
    description: "bg.js under prefers-reduced-motion: static grid and traces, no control, nothing animates",
    legacyPath: "/index.html",
    sveltePath: "/",
    viewport: { width: 1280, height: 900, reducedMotion: true },
    ready,
    observe: BG_OBSERVE,
    allow: BG_ALLOW,
    steps: [
        {
            name: "static",
            run: (p) => p.wait(2500),
            observe: { evals: { animates: ANIMATES(3000) } },
            expect: (o) => {
                must(count(o, ".nq-bg-pause") === 0, "no pause control under reduced motion");
                must(o.evals?.animates === false, "nothing is painted on the canvas");
                must(count(o, ".nq-bg svg polyline") > 0, "the static traces are still drawn");
            },
        },
    ],
};

const saveData: Scenario = {
    name: "bg-savedata",
    description: "bg.js with navigator.connection.saveData: static, no control",
    legacyPath: "/index.html",
    sveltePath: "/",
    viewport: { width: 1280, height: 900, initScripts: [`Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });`] },
    ready,
    observe: BG_OBSERVE,
    allow: BG_ALLOW,
    steps: [{ name: "static", run: (p) => p.wait(2500), observe: { evals: { animates: ANIMATES(3000) } }, expect: (o) => { must(count(o, ".nq-bg-pause") === 0 && o.evals?.animates === false, "Save-Data: no control and no animation"); } }],
};

export default [play, reduced, saveData];
