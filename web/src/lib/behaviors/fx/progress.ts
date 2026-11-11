// Scroll progress line. fx.js appended div.nq-progress[aria-hidden=true] to <body> and set transform: scaleX(v) on every passive scroll event and once at start (not on resize). It runs under reduced motion too; the CSS hides the bar there.
import type { Action } from "svelte/action";
import { CLASSES, progressScale, progressTransform } from "./core";

export interface ProgressWin {
    innerHeight: number;
    scrollY: number;
    addEventListener(type: "scroll", fn: () => void, opts: { passive: boolean }): void;
    removeEventListener(type: "scroll", fn: () => void): void;
}
export interface ProgressDoc { documentElement: { scrollHeight: number } }
export interface BarLike { style: { transform: string } }

/** Drives an existing bar. Returns the cleanup (removes the listener). */
export const initProgress = (bar: BarLike, doc: ProgressDoc, win: ProgressWin): (() => void) => {
    const update = () => { bar.style.transform = progressTransform(progressScale(doc.documentElement.scrollHeight, win.innerHeight, win.scrollY)); };
    win.addEventListener("scroll", update, { passive: true });
    update();
    return () => win.removeEventListener("scroll", update);
};

/** `use:progressBar` on an element (the ScrollProgress component does this). Cleanup removes the listener and resets the transform. */
export const progressBar: Action<HTMLElement> = (node) => {
    const stop = initProgress(node, node.ownerDocument, window);
    return { destroy() { stop(); node.style.transform = ""; } };
};

/** The legacy way, for a page that has no markup for it: creates the bar and appends it to <body>. Returns the cleanup (removes the bar too). */
export const mountProgress = (doc: Document = document, win: Window = window): (() => void) => {
    const bar = doc.createElement("div");
    bar.setAttribute("class", CLASSES.progress);
    bar.setAttribute("aria-hidden", "true");
    doc.body.appendChild(bar);
    const stop = initProgress(bar, doc, win);
    return () => { stop(); bar.remove(); };
};
