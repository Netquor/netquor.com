// background.ts: the DOM wiring of bg.js. The hero's grid and traces always; the travelling pulse and the pause control unless reduced motion or Save-Data. Pass the .nq-bg wrapper's svg and canvas (the component renders them); the pause button is appended to the hero like the legacy script does.
import { buildPaths, initialPulse, stepPulse, svgMarkup, type Path } from "./geometry.ts";

export const STORAGE_KEY = "nq-bg-paused";
export const resizeDelay = 150;

export const pauseLabel = (paused: boolean): { text: string; pressed: "true" | "false" } =>
    paused ? { text: "Play background motion", pressed: "true" } : { text: "Pause background motion", pressed: "false" };

/** What the script touches, narrowed so tests can fake it. */
export interface BgHero {
    clientWidth: number;
    clientHeight: number;
    getBoundingClientRect?: unknown;
    appendChild(node: unknown): unknown;
}
export interface BgCtx {
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
    clearRect(x: number, y: number, w: number, h: number): void;
    fillStyle: string;
    fillRect(x: number, y: number, w: number, h: number): void;
}
export interface BgCanvas { width: number; height: number; getContext(kind: "2d"): BgCtx | null }
export interface BgSvg { setAttribute(name: string, value: string): void; innerHTML: string }
export interface BgButton {
    type: string;
    className: string;
    textContent: string | null;
    setAttribute(name: string, value: string): void;
    addEventListener(type: "click", fn: () => void): void;
    remove(): void;
}
export interface BgEnv {
    createButton(): BgButton;
    reduceMotion(): boolean;
    saveData(): boolean;
    hidden(): boolean;
    dpr(): number;
    readPaused(): boolean;
    writePaused(paused: boolean): void;
    raf(cb: (t: number) => void): number;
    caf(id: number): void;
    onResize(fn: () => void): () => void;
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(id: unknown): void;
    /** Observes the hero's visibility; undefined when IntersectionObserver does not exist. */
    observe?(hero: BgHero, cb: (isIntersecting: boolean) => void): () => void;
}

export const browserEnv = (): BgEnv => {
    const env: BgEnv = {
        createButton: () => document.createElement("button") as unknown as BgButton,
        reduceMotion: () => !!(typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches),
        saveData: () => !!((navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData),
        hidden: () => document.hidden,
        dpr: () => window.devicePixelRatio || 1,
        readPaused: () => { try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; } },
        writePaused: (p) => { try { localStorage.setItem(STORAGE_KEY, p ? "1" : "0"); } catch { /* storage blocked */ } },
        raf: (cb) => requestAnimationFrame(cb),
        caf: (id) => cancelAnimationFrame(id),
        onResize: (fn) => { window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn); },
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
        observe: (hero, cb) => { const o = new IntersectionObserver((e) => cb(e[0].isIntersecting)); o.observe(hero as unknown as Element); return () => o.disconnect(); },
    };
    if (!("IntersectionObserver" in window)) env.observe = undefined;
    return env;
};

/** Builds the background; returns the cleanup (listeners, frame, observer, timer and the pause button are removed). Does nothing when `hero` cannot be measured, like bg.js. */
export const startBackground = (hero: BgHero | null | undefined, svg: BgSvg, cv: BgCanvas, env: BgEnv = browserEnv()): (() => void) => {
    if (!hero || !hero.getBoundingClientRect) return () => {};
    const ctx = cv.getContext("2d");
    if (!ctx) return () => {};
    let W = 0, H = 0, paths: Path[] = [], visible = true, raf = 0, paused = env.readPaused(), rt: unknown;
    const state = initialPulse();

    function build() {
        W = hero!.clientWidth; H = hero!.clientHeight;
        svg.setAttribute("viewBox", "0 0 " + W + " " + H);
        const dpr = env.dpr();
        cv.width = W * dpr; cv.height = H * dpr; ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
        paths = buildPaths(W, H);
        svg.innerHTML = svgMarkup(paths);
    }
    function frame(t: number) {
        raf = env.raf(frame);
        const f = stepPulse(state, t, paths, visible && !env.hidden() && !paused);
        if (!f) return;
        ctx!.clearRect(0, 0, W, H);
        for (const d of f.dots) { ctx!.fillStyle = d.fill; ctx!.fillRect(d.x, d.y, d.size, d.size); }
        if (f.clearAfter) ctx!.clearRect(0, 0, W, H);
    }
    const start = () => { if (!raf) raf = env.raf(frame); };
    const stop = () => { if (raf) env.caf(raf); raf = 0; ctx.clearRect(0, 0, W, H); state.pulse = null; };

    build();
    const offResize = env.onResize(() => { env.clearTimeout(rt); rt = env.setTimeout(build, resizeDelay); });
    let offObserve: (() => void) | undefined;
    let btn: BgButton | undefined;
    const cleanup = () => {
        env.clearTimeout(rt);
        offResize();
        offObserve?.();
        if (raf) env.caf(raf);
        raf = 0;
        btn?.remove();
    };
    if (env.reduceMotion() || env.saveData()) return cleanup; // static grid and traces only, no control needed
    offObserve = env.observe?.(hero, (v) => { visible = v; });

    const b = btn = env.createButton();
    b.type = "button"; b.className = "nq-bg-pause";
    const label = () => { const l = pauseLabel(paused); b.textContent = l.text; b.setAttribute("aria-pressed", l.pressed); };
    b.addEventListener("click", () => {
        paused = !paused; label();
        env.writePaused(paused);
        if (paused) stop(); else start();
    });
    label(); hero.appendChild(b);
    if (!paused) start();
    return cleanup;
};
