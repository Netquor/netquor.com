import { describe, expect, test } from "bun:test";
import { renderSvelte } from "../../server/svelteHarness";
import { pauseLabel, startBackground, type BgButton, type BgEnv } from "./background";
import { buildPaths, G, initialPulse, pathLength, pointAt, snap, stepPulse, svgMarkup } from "./geometry";

describe("geometry", () => {
    test("snap rounds to the 48 px grid", () => {
        expect([snap(0), snap(23), snap(24), snap(768), snap(770)]).toEqual([0, 0, 48, 768, 768]);
        expect(G).toBe(48);
    });
    test("1280 x 800 hero (the observed case): four traces from the documented seeds", () => {
        const p = buildPaths(1280, 800);
        expect(p.length).toBe(4);
        // base = snap(768) = 768; origin x = snap(1280 * 0.04) = 48
        expect(p[0]).toEqual([[48, 768], [144, 768], [144, 720], [288, 720]]);
        // trace two starts at y = 816 > 800 (its first two points are dropped) and keeps the last two
        expect(p[1]).toEqual([[576, 768], [768, 768]]);
        expect(p[2]).toEqual([[816, 768], [960, 768]]);
    });
    test("points past the right or bottom edge are dropped, short traces skipped", () => {
        const p = buildPaths(1280, 800);
        // trace two ends at y = 816 - 48 = 768, kept; trace three goes to y = 816 > 800 and is dropped from the point list
        expect(p[2].every((q) => q[1] <= 800)).toBe(true);
        expect(buildPaths(40, 40).length).toBe(0);
        expect(buildPaths(100, 100).length).toBe(1);
    });
    test("svg markup carries the grid pattern, the fade, one polyline and node per trace, fixed ids", () => {
        const m = svgMarkup(buildPaths(1280, 800));
        expect(m).toContain('<pattern id="nqg" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48"');
        expect(m).toContain('<linearGradient id="nqf" x1="0" y1="0" x2="0" y2="1">');
        expect((m.match(/<polyline /g) ?? []).length).toBe(4);
        expect((m.match(/<circle /g) ?? []).length).toBe(4);
        expect(m).toContain('<polyline points="48,768 144,768 144,720 288,720" fill="none" stroke="#2f8fe0" stroke-opacity=".3" stroke-width="1.5" stroke-linejoin="round"/>');
        expect(m).toContain('<circle cx="288" cy="720" r="3.5" fill="#12161c" stroke="#5eaaf0" stroke-opacity=".6" stroke-width="1.5"/>');
        expect(m.endsWith('<rect width="100%" height="100%" fill="url(#nqf)"/>')).toBe(true);
    });
    test("pathLength and pointAt", () => {
        const P = [[0, 0], [10, 0], [10, 10]] as const;
        expect(pathLength(P)).toBe(20);
        expect(pointAt(P, 5)).toEqual([5, 0]);
        expect(pointAt(P, 15)).toEqual([10, 5]);
        expect(pointAt(P, 99)).toEqual([10, 10]);
    });
});

describe("pulse state machine", () => {
    const paths = [[[0, 0], [100, 0]], [[0, 50], [100, 50]]] as const;
    test("skips frames while inactive and only tracks time", () => {
        const s = initialPulse();
        expect(stepPulse(s, 5000, paths, false)).toBeNull();
        expect(s.last).toBe(5000);
        expect(s.pulse).toBeNull();
    });
    test("the first pulse starts only after 1200 ms, then moves 0.16 px/ms, step capped at 50 ms", () => {
        const s = initialPulse();
        expect(stepPulse(s, 1200, paths, true)).toEqual({ dots: [], clearAfter: false });
        expect(s.pulse).toBeNull();
        s.last = 1200;
        const dots = stepPulse(s, 1201, paths, true)!.dots;
        expect(s.pulse!.d).toBeCloseTo(0.16);
        expect(dots.length).toBe(1);
        expect(dots[0]).toEqual({ x: -1.5 + 0.16, y: -1.5, size: 3, fill: "rgba(94,170,240,0.85)" });
        stepPulse(s, 5000, paths, true);
        expect(s.pulse!.d).toBeCloseTo(0.16 + 50 * 0.16);
    });
    test("tail is sampled every 3 px with fading alpha", () => {
        const s = initialPulse();
        s.pulse = { P: paths[0], L: 100, d: 40 };
        s.last = 0;
        const dots = stepPulse(s, 0, paths, true)!.dots;
        expect(dots.length).toBe(14);
        expect(dots[13].fill).toBe("rgba(94,170,240," + (1 - 39 / 60) * 0.85 + ")");
    });
    test("ends 60 px past the path, paints nothing, schedules the next 6000 ms later, round robin over traces", () => {
        const s = initialPulse();
        stepPulse(s, 1300, paths, true);
        expect(s.pulse!.P).toBe(paths[0]);
        s.pulse!.d = 100 + 61;
        expect(stepPulse(s, 2000, paths, true)).toEqual({ dots: [], clearAfter: true });
        expect(s.pulse).toBeNull();
        expect(s.nextAt).toBe(8000);
        stepPulse(s, 7999, paths, true);
        expect(s.pulse).toBeNull();
        stepPulse(s, 8001, paths, true);
        expect(s.pulse!.P).toBe(paths[1]);
    });
});

// A minimal fake DOM and environment.
const fake = (over: Partial<BgEnv> = {}, stored = false) => {
    const log: string[] = [];
    const rafs = new Map<number, (t: number) => void>();
    let nextId = 1;
    const writes: boolean[] = [];
    const attrs: Record<string, string> = {};
    const svg = { innerHTML: "", setAttribute: (k: string, v: string) => { attrs[k] = v; } };
    const ctx = { setTransform: (...a: number[]) => log.push("tf " + a.join()), clearRect: () => log.push("clear"), fillStyle: "", fillRect: () => log.push("fill " + ctx.fillStyle) };
    const cv = { width: 0, height: 0, getContext: () => ctx };
    const appended: unknown[] = [];
    const hero = { clientWidth: 1280, clientHeight: 800, getBoundingClientRect: () => ({}), appendChild: (n: unknown) => appended.push(n) };
    const buttons: (BgButton & { click(): void; attrs: Record<string, string>; removed: boolean })[] = [];
    let resize: (() => void) | undefined, offResize = 0, intersect: ((v: boolean) => void) | undefined, disconnected = 0;
    const timers = new Map<number, () => void>();
    let tid = 1, hidden = false;
    const env: BgEnv = {
        createButton: () => {
            let click = () => {};
            const b = { type: "", className: "", textContent: "", attrs: {} as Record<string, string>, removed: false, setAttribute(k: string, v: string) { b.attrs[k] = v; }, addEventListener(_t: "click", fn: () => void) { click = fn; }, remove() { b.removed = true; }, click: () => click() };
            buttons.push(b);
            return b;
        },
        reduceMotion: () => false, saveData: () => false, hidden: () => hidden, dpr: () => 2,
        readPaused: () => stored, writePaused: (p) => writes.push(p),
        raf: (cb) => { const id = nextId++; rafs.set(id, cb); return id; },
        caf: (id) => { rafs.delete(id); },
        onResize: (fn) => { resize = fn; return () => { offResize++; resize = undefined; }; },
        setTimeout: (fn) => { const id = tid++; timers.set(id, fn); return id; },
        clearTimeout: (id) => { timers.delete(id as number); },
        observe: (_h, cb) => { intersect = cb; return () => { disconnected++; }; },
        ...over,
    };
    const tick = (t: number) => { const [id, cb] = [...rafs][0]; rafs.delete(id); cb(t); };
    return { env, hero, svg, cv, ctx, log, attrs, appended, buttons, writes, rafs, tick, timers, setHidden: (h: boolean) => { hidden = h; }, get resize() { return resize; }, get intersect() { return intersect; }, get offResize() { return offResize; }, get disconnected() { return disconnected; } };
};

describe("startBackground", () => {
    test("builds the svg, sizes the canvas by dpr, appends a Pause button and starts the loop", () => {
        const f = fake();
        startBackground(f.hero, f.svg, f.cv, f.env);
        expect(f.attrs.viewBox).toBe("0 0 1280 800");
        expect([f.cv.width, f.cv.height]).toEqual([2560, 1600]);
        expect(f.log[0]).toBe("tf 2,0,0,2,0,0");
        expect(f.svg.innerHTML).toContain('id="nqg"');
        const b = f.buttons[0];
        expect([b.type, b.className, b.textContent, b.attrs["aria-pressed"]]).toEqual(["button", "nq-bg-pause", "Pause background motion", "false"]);
        expect(f.appended).toEqual([b]);
        expect(f.rafs.size).toBe(1);
    });
    test("does nothing for a hero that cannot be measured", () => {
        const f = fake();
        startBackground(null, f.svg, f.cv, f.env);
        startBackground({ ...f.hero, getBoundingClientRect: undefined }, f.svg, f.cv, f.env);
        expect(f.svg.innerHTML).toBe("");
        expect(f.buttons.length).toBe(0);
    });
    test("reduced motion and Save-Data: static build, resize listener kept, no button, no loop, no observer", () => {
        for (const over of [{ reduceMotion: () => true }, { saveData: () => true }]) {
            const f = fake(over);
            const off = startBackground(f.hero, f.svg, f.cv, f.env);
            expect(f.svg.innerHTML).toContain("polyline");
            expect(f.buttons.length).toBe(0);
            expect(f.rafs.size).toBe(0);
            expect(f.intersect).toBeUndefined();
            expect(f.resize).toBeDefined();
            off();
            expect(f.offResize).toBe(1);
        }
    });
    test("the pulse paints once rAF passes 1200 ms and is skipped while off-screen, hidden or paused", () => {
        const f = fake();
        startBackground(f.hero, f.svg, f.cv, f.env);
        f.log.length = 0;
        f.tick(1000);
        expect(f.log).toEqual(["clear"]);
        f.tick(1300);
        f.tick(1350);
        expect(f.log.some((l) => l.startsWith("fill rgba(94,170,240,"))).toBe(true);
        f.log.length = 0;
        f.intersect!(false);
        f.tick(1400);
        expect(f.log).toEqual([]);
        f.intersect!(true);
        f.setHidden(true);
        f.tick(1450);
        expect(f.log).toEqual([]);
        f.setHidden(false);
        f.tick(1500);
        expect(f.log[0]).toBe("clear");
    });
    test("the control flips, relabels, stores, stops (clears the canvas) and resumes", () => {
        const f = fake();
        startBackground(f.hero, f.svg, f.cv, f.env);
        const b = f.buttons[0];
        f.log.length = 0;
        b.click();
        expect([b.textContent, b.attrs["aria-pressed"]]).toEqual(["Play background motion", "true"]);
        expect(f.writes).toEqual([true]);
        expect(f.rafs.size).toBe(0);
        expect(f.log).toEqual(["clear"]);
        b.click();
        expect([b.textContent, b.attrs["aria-pressed"]]).toEqual(["Pause background motion", "false"]);
        expect(f.writes).toEqual([true, false]);
        expect(f.rafs.size).toBe(1);
    });
    test("a stored pause comes back as Play with aria-pressed true and no loop", () => {
        const f = fake({}, true);
        startBackground(f.hero, f.svg, f.cv, f.env);
        expect([f.buttons[0].textContent, f.buttons[0].attrs["aria-pressed"]]).toEqual(["Play background motion", "true"]);
        expect(f.rafs.size).toBe(0);
        expect(f.writes).toEqual([]);
    });
    test("resize rebuilds after a 150 ms debounce", () => {
        const f = fake();
        startBackground(f.hero, f.svg, f.cv, f.env);
        f.resize!(); f.resize!();
        expect(f.timers.size).toBe(1);
        f.hero.clientWidth = 640;
        [...f.timers.values()][0]();
        expect(f.attrs.viewBox).toBe("0 0 640 800");
    });
    test("cleanup cancels the frame, the timer, the listener and the observer, and removes the button", () => {
        const f = fake();
        const off = startBackground(f.hero, f.svg, f.cv, f.env);
        f.resize!();
        off();
        expect(f.rafs.size).toBe(0);
        expect(f.timers.size).toBe(0);
        expect(f.offResize).toBe(1);
        expect(f.disconnected).toBe(1);
        expect(f.buttons[0].removed).toBe(true);
    });
    test("no IntersectionObserver: still runs", () => {
        const f = fake({ observe: undefined });
        startBackground(f.hero, f.svg, f.cv, f.env);
        expect(f.rafs.size).toBe(1);
    });
    test("pauseLabel", () => {
        expect(pauseLabel(true)).toEqual({ text: "Play background motion", pressed: "true" });
        expect(pauseLabel(false).text).toBe("Pause background motion");
    });
});

describe("HeroBackground.svelte", () => {
    test("server-renders the empty aria-hidden wrapper with an svg and a canvas, in that order", async () => {
        const { body } = await renderSvelte("lib/behaviors/bg/HeroBackground.svelte", {}, {});
        expect(body.replace(/<!--.*?-->/g, "")).toBe('<div class="nq-bg" aria-hidden="true"><svg></svg><canvas></canvas></div>');
    });
});

describe("matches the legacy script", () => {
    test("same svg markup and same painted squares, frame by frame, as bg.js run on the same fake DOM", async () => {
        const { runInNewContext } = await import("node:vm");
        const { baselineText } = await import("../../baselineFiles");
        const legacy = baselineText("bg.js");
        for (const [w, h] of [[1280, 800], [390, 700], [1920, 1000]]) {
            // legacy
            const lp: string[] = [];
            let cb: ((t: number) => void) | undefined;
            const ctxL = { setTransform() {}, clearRect: () => lp.push("clear"), fillStyle: "", fillRect(...a: number[]) { lp.push(this.fillStyle + " " + a.join()); } };
            const mk = (tag: string): Record<string, unknown> => ({ tag, children: [] as unknown[], style: {}, setAttribute() {}, addEventListener() {}, appendChild(c: unknown) { (this.children as unknown[]).push(c); }, getContext: () => ctxL, innerHTML: "" });
            const svgL = mk("svg");
            const hero = { clientWidth: w, clientHeight: h, getBoundingClientRect: () => ({}), insertBefore() {}, appendChild() {} };
            runInNewContext(legacy, {
                document: { querySelector: () => hero, createElement: (t: string) => mk(t), createElementNS: () => svgL, hidden: false },
                window: { devicePixelRatio: 1, addEventListener() {} },
                navigator: {}, localStorage: { getItem: () => null, setItem() {} },
                requestAnimationFrame: (f: (t: number) => void) => { cb = f; return 1; }, cancelAnimationFrame() {}, clearTimeout() {}, setTimeout() {}, Math,
            });
            // port
            const pp: string[] = [];
            const f = fake();
            const ctxP = { setTransform() {}, clearRect: () => pp.push("clear"), fillStyle: "", fillRect(...a: number[]) { pp.push(this.fillStyle + " " + a.join()); } };
            const svgP = { innerHTML: "", setAttribute() {} };
            startBackground({ clientWidth: w, clientHeight: h, getBoundingClientRect: () => ({}), appendChild() {} }, svgP, { width: 0, height: 0, getContext: () => ctxP }, { ...f.env, observe: undefined });
            expect(svgP.innerHTML).toBe(svgL.innerHTML as string);
            for (let t = 100; t < 30000; t += 16.7) {
                cb!(t);
                f.tick(t);
            }
            expect(pp).toEqual(lp);
            expect(pp.length).toBeGreaterThan(100);
        }
    });
});
