// Hero circuit map. Ported from fx.js section 2: pulse clones of every trace, an invisible tap rect per label, and hover/focus on a label lighting its trace and pulse. Runs under reduced motion too (CSS hides the pulses there).
import type { Action } from "svelte/action";
import { CLASSES, PATH_LENGTH, pulseDelay, tapRect, traceIndexForLabel } from "./core";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Wires one map element (the svg.nq-map). Returns the cleanup: listeners, clones, tap rects and `hot` classes are removed and pathLength is restored. */
export const initHeroMap = (map: Element): (() => void) => {
    const doc = map.ownerDocument;
    const lines = Array.from(map.querySelectorAll(".nq-map-lines path")) as SVGPathElement[];
    const labels = Array.from(map.querySelectorAll(".nq-map-labels > a")) as SVGAElement[];
    const pulses: SVGPathElement[] = [];
    const undo: (() => void)[] = [];

    lines.forEach((p, i) => {
        const had = p.getAttribute("pathLength");
        p.setAttribute("pathLength", PATH_LENGTH);
        const c = p.cloneNode() as SVGPathElement;
        c.setAttribute("class", CLASSES.pulse);
        c.setAttribute("pathLength", PATH_LENGTH);
        c.style.animationDelay = pulseDelay(i);
        p.parentNode!.appendChild(c);
        pulses.push(c);
        undo.push(() => { c.remove(); if (had === null) p.removeAttribute("pathLength"); else p.setAttribute("pathLength", had); });
    });

    // Tap area: an invisible rect behind each label so the link is easy to hit on a phone. getBBox can throw (element not rendered); that label just gets no rect.
    labels.forEach((a) => {
        try {
            const b = a.getBBox(), t = tapRect(b);
            const r = doc.createElementNS(SVG_NS, "rect");
            r.setAttribute("x", String(t.x));
            r.setAttribute("y", String(t.y));
            r.setAttribute("width", String(t.width));
            r.setAttribute("height", String(t.height));
            r.setAttribute("fill", "transparent");
            a.insertBefore(r, a.firstChild);
            undo.push(() => r.remove());
        } catch { /* not rendered */ }
    });

    labels.forEach((a, i) => {
        const set = (hot: boolean) => () => {
            const k = traceIndexForLabel(i);
            if (k !== undefined && lines[k]) { lines[k].classList.toggle(CLASSES.hot, hot); pulses[k].classList.toggle(CLASSES.hot, hot); }
        };
        const on = set(true), off = set(false);
        a.addEventListener("mouseenter", on); a.addEventListener("focus", on);
        a.addEventListener("mouseleave", off); a.addEventListener("blur", off);
        undo.push(() => {
            a.removeEventListener("mouseenter", on); a.removeEventListener("focus", on);
            a.removeEventListener("mouseleave", off); a.removeEventListener("blur", off);
            off();
        });
    });

    return () => { for (const u of undo.reverse()) u(); };
};

/** `use:heroMap` on the svg.nq-map element. */
export const heroMap: Action<Element> = (node) => {
    const stop = initHeroMap(node);
    return { destroy: stop };
};
