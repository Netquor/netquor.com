// Card spotlight. Ported from fx.js section 4: a passive pointermove listener; the card under the pointer gets --mx and --my (pointer offset inside the card, px). Not under reduced motion.
import type { Action } from "svelte/action";
import { prefersReducedMotion, SPOTLIGHT_SELECTOR, spotlightOffset } from "./core";

export interface SpotTarget {
    addEventListener(type: "pointermove", fn: (e: PointerEvent) => void, opts: { passive: boolean }): void;
    removeEventListener(type: "pointermove", fn: (e: PointerEvent) => void): void;
}

/** Returns the cleanup (removes the listener). */
export const initSpotlight = (target: SpotTarget, win: { matchMedia?: (q: string) => { matches: boolean } } = window): (() => void) => {
    if (prefersReducedMotion(win)) return () => {};
    const move = (e: PointerEvent) => {
        const t = e.target as Element | null;
        const card = t && t.closest && (t.closest(SPOTLIGHT_SELECTOR) as HTMLElement | null);
        if (!card) return;
        const { mx, my } = spotlightOffset(e.clientX, e.clientY, card.getBoundingClientRect());
        card.style.setProperty("--mx", mx);
        card.style.setProperty("--my", my);
    };
    target.addEventListener("pointermove", move, { passive: true });
    return () => target.removeEventListener("pointermove", move);
};

/** `use:spotlight` on `<svelte:document>` (as fx.js: one listener on document) or on any element to scope it. */
export const spotlight: Action<HTMLElement | Document> = (node) => {
    const stop = initSpotlight(node as unknown as SpotTarget, window);
    return { destroy: stop };
};
