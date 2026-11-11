// Reveal on scroll. Ported from fx.js section 3. Not under reduced motion and only with IntersectionObserver (otherwise nothing is touched and the page is fully visible). Adds html.nq-reveal-on, gives each target (document order) the class nq-r and a staggered transition-delay, and adds nq-shown the first time it intersects. Classes are never removed on scroll.
import type { Action } from "svelte/action";
import { CLASSES, prefersReducedMotion, REVEAL_OPTIONS, REVEAL_SELECTOR, revealDelay } from "./core";

export interface RevealScope { querySelectorAll(sel: string): ArrayLike<HTMLElement> }
export interface RevealWin {
    matchMedia?: (q: string) => { matches: boolean };
    IntersectionObserver?: typeof IntersectionObserver;
    innerHeight?: number;
}
export interface RevealDoc { documentElement: { classList: { add(c: string): void; remove(c: string): void } } }

/** scope: where the targets are queried (the document by default). Returns the cleanup: disconnects the observer and removes every class and delay it added. */
export const initReveal = (scope: RevealScope, doc: RevealDoc, win: RevealWin = window): (() => void) => {
    if (prefersReducedMotion(win)) return () => {};
    if (!("IntersectionObserver" in win) || !win.IntersectionObserver) return () => {};
    const root = doc.documentElement;
    root.classList.add(CLASSES.revealOn);
    const targets = Array.from(scope.querySelectorAll(REVEAL_SELECTOR));
    const vh = win.innerHeight ?? 0;
    targets.forEach((t, i) => {
        t.classList.add(CLASSES.reveal);
        // Server-rendered content is already painted when this runs after hydration. A target that is on screen right now gets its shown class in the same pass, so its opacity never changes (no hide, no fade back in). Targets below the fold keep the staggered reveal on scroll.
        const r = typeof t.getBoundingClientRect === "function" ? t.getBoundingClientRect() : null;
        t.style.transitionDelay = revealDelay(i);
        if (r && vh > 0 && r.bottom > 0 && r.top < vh) t.classList.add(CLASSES.shown);
    });
    const io = new win.IntersectionObserver((es) => {
        es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add(CLASSES.shown); io.unobserve(e.target); } });
    }, REVEAL_OPTIONS);
    targets.forEach((t) => io.observe(t));
    return () => {
        io.disconnect();
        targets.forEach((t) => { t.classList.remove(CLASSES.reveal, CLASSES.shown); t.style.transitionDelay = ""; });
        root.classList.remove(CLASSES.revealOn);
    };
};

/** `use:reveal` on an element (targets inside it) or on `<svelte:document>` (the whole page, as fx.js did). */
export const reveal: Action<HTMLElement | Document> = (node) => {
    const doc = (node.nodeType === 9 ? node : node.ownerDocument) as Document;
    const stop = initReveal(node as unknown as RevealScope, doc, window);
    return { destroy: stop };
};
