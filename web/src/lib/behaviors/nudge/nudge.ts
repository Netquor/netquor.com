// nudge.ts: a port of nudge.js, the quiet "Looking at X? See the readiness checklist" card on product pages. The gates are pure (gates.ts); this file is the DOM wiring.
import { nudgeFor, readyToShow, scrollRatio, type Nudge, type GateState } from "./gates.ts";

export const SHOW_AFTER_MS = 25000;
export const REMOVE_AFTER_MS = 250;
export const STORAGE_KEY = "nq-nudge";

/** Minimal element surface the card needs, so a hand-written fake can stand in. */
export interface NodeLike {
    className: string;
    textContent: string | null;
    href?: string;
    type?: string;
    classList: { add(c: string): void; remove(c: string): void };
    setAttribute(name: string, value: string): void;
    appendChild(child: NodeLike): unknown;
    addEventListener(type: string, fn: () => void): void;
    remove(): void;
}
export interface NudgeDoc {
    createElement(tag: string): NodeLike;
    body: { appendChild(node: unknown): unknown; contains(node: unknown): boolean };
    documentElement: { scrollTop: number; scrollHeight: number };
    addEventListener(type: "keydown", fn: (e: { key: string }) => void): void;
    removeEventListener(type: "keydown", fn: (e: { key: string }) => void): void;
}
export interface NudgeWin {
    innerHeight: number;
    addEventListener(type: "keydown" | "scroll", fn: (e: { key: string }) => void, opts?: { passive: boolean }): void;
    removeEventListener(type: "keydown" | "scroll", fn: (e: { key: string }) => void): void;
    matchMedia?(q: string): { matches: boolean };
    requestAnimationFrame(cb: () => void): number;
    cancelAnimationFrame(id: number): void;
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(id: unknown): void;
    sessionStorage?: { getItem(k: string): string | null; setItem(k: string, v: string): void };
}

/** Builds the card exactly as nudge.js does: aside.nq-nudge[role=complementary][aria-label] with the close button, title, text and the row (link, Not now). Returns the box and the buttons that dismiss it. */
export const buildCard = (doc: NudgeDoc, hit: Nudge): { box: NodeLike; dismissers: NodeLike[] } => {
    const box = doc.createElement("aside"); box.className = "nq-nudge"; box.setAttribute("role", "complementary"); box.setAttribute("aria-label", "Suggested checklist");
    const t = doc.createElement("b"); t.textContent = hit.title;
    const p = doc.createElement("p"); p.textContent = hit.body;
    const go = doc.createElement("a"); go.href = "readiness.html#" + hit.key; go.textContent = "Open the checklist"; go.className = "nq-nudge-go";
    const no = doc.createElement("button"); no.type = "button"; no.textContent = "Not now"; no.className = "nq-nudge-no";
    const x = doc.createElement("button"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.textContent = "×"; x.className = "nq-nudge-x";
    const row = doc.createElement("div"); row.className = "nq-nudge-row"; row.appendChild(go); row.appendChild(no);
    box.appendChild(x); box.appendChild(t); box.appendChild(p); box.appendChild(row);
    return { box, dismissers: [no, x] };
};

/** Starts the nudge for a page ("vpn.html"). Returns the cleanup: timers, listeners and the card (if any) are removed. Does nothing for a page without an entry, after a dismissal this session, under reduced motion, or without a fine pointer. */
export const startNudge = (page: string, doc: NudgeDoc, win: NudgeWin): (() => void) => {
    const hit = nudgeFor(page);
    if (!hit) return () => {};
    try { if (win.sessionStorage?.getItem(STORAGE_KEY) === "1") return () => {}; } catch { /* storage blocked */ }
    const reduce = !!(win.matchMedia && win.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const fine = !!(win.matchMedia && win.matchMedia("(pointer: fine)").matches);
    if (reduce || !fine) return () => {};

    const g: GateState = { keyboard: false, ready: false, scrolled: false, shown: false };
    let box: NodeLike | undefined, raf = 0, removeTimer: unknown, onEsc: ((e: { key: string }) => void) | undefined;

    const onKey = (e: { key: string }) => { if (e.key === "Tab") g.keyboard = true; };
    const onScroll = () => {
        const h = doc.documentElement;
        if (scrollRatio(h.scrollTop, win.innerHeight, h.scrollHeight) >= 0.4) { g.scrolled = true; maybe(); }
    };
    const timer = win.setTimeout(() => { g.ready = true; maybe(); }, SHOW_AFTER_MS);
    win.addEventListener("keydown", onKey);
    win.addEventListener("scroll", onScroll, { passive: true });

    function maybe() { if (!readyToShow(g)) return; g.shown = true; show(); }
    function dismiss(card: NodeLike) {
        try { win.sessionStorage?.setItem(STORAGE_KEY, "1"); } catch { /* storage blocked */ }
        card.classList.remove("in");
        removeTimer = win.setTimeout(() => card.remove(), REMOVE_AFTER_MS);
    }
    function show() {
        const built = buildCard(doc, hit!);
        const card = box = built.box;
        built.dismissers.forEach((b) => b.addEventListener("click", () => dismiss(card)));
        onEsc = (e) => { if (e.key === "Escape" && doc.body.contains(card)) dismiss(card); };
        doc.addEventListener("keydown", onEsc);
        doc.body.appendChild(card);
        raf = win.requestAnimationFrame(() => card.classList.add("in"));
    }
    return () => {
        win.clearTimeout(timer);
        win.clearTimeout(removeTimer);
        if (raf) win.cancelAnimationFrame(raf);
        win.removeEventListener("keydown", onKey);
        win.removeEventListener("scroll", onScroll);
        if (onEsc) doc.removeEventListener("keydown", onEsc);
        box?.remove();
    };
};
