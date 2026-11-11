// collapse.ts: Bootstrap 5.3.3's Collapse (bootstrap.bundle.min.js), re-implemented for the markup the site already has: `[data-bs-toggle="collapse"]` with `data-bs-target` (or `href`), panels `.collapse`, optional `data-bs-parent` for one-open-at-a-time. The CSS (bootstrap.min.css 5.3.3) is unchanged: `.collapse:not(.show) { display: none }`, `.collapsing { height: 0; overflow: hidden; transition: height .35s ease }` (no transition under prefers-reduced-motion). The sequence of class, style and aria writes follows the Bootstrap source, quirks included.

export const TOGGLE = '[data-bs-toggle="collapse"]';
/** Bootstrap 5.3.3 SELECTOR_ACTIVES. Quirk kept: while a panel is `.collapsing` it has no `.collapse` class, so it is not an "active sibling" (a fast second click on another item lets both open). */
export const ACTIVES = ".collapse.show, .collapse.collapsing";

/** Bootstrap's getTransitionDurationFromElement: milliseconds of the first transition-duration plus the first transition-delay, 0 when both are 0. */
export const transitionMs = (duration: string, delay: string): number => {
    const d = Number.parseFloat(duration);
    const l = Number.parseFloat(delay);
    if (!d && !l) return 0;
    return (Number.parseFloat(duration.split(",")[0]) + Number.parseFloat(delay.split(",")[0])) * 1000;
};

/** Bootstrap pads the wait for `transitionend` by 5 ms and then completes anyway. */
export const TRANSITION_PADDING_MS = 5;

const escapeId = (selector: string): string => {
    const esc = (globalThis as { CSS?: { escape?: (s: string) => string } }).CSS?.escape;
    return esc ? selector.replace(/#([^\s"#']+)/g, (_m, id: string) => `#${esc(id)}`) : selector;
};

/** Bootstrap's getSelectorFromElement: `data-bs-target`, else `href` ("#id", "page#id" or ".class"); null when there is none. */
export const selectorFor = (el: Element): string | null => {
    let selector = el.getAttribute("data-bs-target");
    if (!selector || selector === "#") {
        let href = el.getAttribute("href");
        if (!href || (!href.includes("#") && !href.startsWith("."))) return null;
        if (href.includes("#") && !href.startsWith("#")) href = `#${href.split("#")[1]}`;
        selector = href && href !== "#" ? href.trim() : null;
    }
    return selector ? selector.split(",").map(escapeId).join(",") : null;
};

export interface CollapseEnv {
    document: Document;
    getComputedStyle(el: Element): { transitionDuration: string; transitionDelay: string };
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(id: unknown): void;
}

export const browserEnv = (win: Window = window): CollapseEnv => ({
    document: win.document,
    getComputedStyle: (el) => win.getComputedStyle(el),
    setTimeout: (fn, ms) => win.setTimeout(fn, ms),
    clearTimeout: (id) => win.clearTimeout(id as number),
});

const instances = new WeakMap<Element, Collapse>();

const emit = (el: Element, name: string): boolean => {
    if (typeof Event !== "function") return true;
    const ev = new Event(`${name}.bs.collapse`, { bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return !ev.defaultPrevented;
};

export class Collapse {
    private transitioning = false;
    private timer: unknown = null;
    private pending: (() => void) | null = null;
    private readonly parent: HTMLElement | null;
    private readonly triggers: HTMLElement[] = [];

    private constructor(readonly element: HTMLElement, private readonly env: CollapseEnv) {
        const sel = element.getAttribute("data-bs-parent");
        this.parent = sel ? env.document.querySelector<HTMLElement>(sel) : null;
        // Every toggle on the page whose target selector resolves to this element (Bootstrap's _triggerArray).
        for (const t of env.document.querySelectorAll<HTMLElement>(TOGGLE)) {
            const s = selectorFor(t);
            if (s && [...env.document.querySelectorAll(s)].includes(element)) this.triggers.push(t);
        }
        if (!this.parent) this.syncTriggers(this.triggers, this.shown());
    }

    /** The instance of an element (created on first use, with the parent read from `data-bs-parent` at that moment). */
    static get(element: HTMLElement, env: CollapseEnv): Collapse {
        let c = instances.get(element);
        if (!c) {
            c = new Collapse(element, env);
            instances.set(element, c);
        }
        return c;
    }

    static peek(element: Element): Collapse | undefined {
        return instances.get(element);
    }

    private shown(el: Element = this.element): boolean {
        return el.classList.contains("show");
    }

    get isShown(): boolean {
        return this.shown();
    }

    get isTransitioning(): boolean {
        return this.transitioning;
    }

    toggle(): void {
        if (this.shown()) this.hide();
        else this.show();
    }

    show(): void {
        if (this.transitioning || this.shown()) return;
        let active: Collapse[] = [];
        if (this.parent) {
            active = this.firstLevel(this.parent, ACTIVES)
                .filter((e) => e !== this.element)
                .map((e) => Collapse.get(e, this.env));
        }
        if (active.length && active[0].transitioning) return;
        if (!emit(this.element, "show")) return;
        for (const a of active) a.hide();
        const el = this.element;
        el.classList.remove("collapse");
        el.classList.add("collapsing");
        el.style.height = "0";
        this.syncTriggers(this.triggers, true);
        this.transitioning = true;
        this.after(() => {
            this.transitioning = false;
            el.classList.remove("collapsing");
            el.classList.add("collapse", "show");
            el.style.height = "";
            emit(el, "shown");
        });
        el.style.height = `${el.scrollHeight}px`;
    }

    hide(): void {
        if (this.transitioning || !this.shown()) return;
        if (!emit(this.element, "hide")) return;
        const el = this.element;
        el.style.height = `${el.getBoundingClientRect().height}px`;
        void el.offsetHeight; // reflow, so the transition starts from the measured height
        el.classList.add("collapsing");
        el.classList.remove("collapse", "show");
        for (const t of this.triggers) {
            const s = selectorFor(t);
            const target = s ? this.env.document.querySelector(s) : null;
            if (target && !this.shown(target)) this.syncTriggers([t], false);
        }
        this.transitioning = true;
        this.after(() => {
            this.transitioning = false;
            el.classList.remove("collapsing");
            el.classList.add("collapse");
            emit(el, "hidden");
            el.style.height = "";
        });
    }

    /** Completes a transition in flight at once (used on teardown). */
    finish(): void {
        this.pending?.();
    }

    /** Bootstrap's executeAfterTransition: run `done` on the element's own `transitionend`, or after the computed duration + 5 ms. */
    private after(done: () => void): void {
        const el = this.element;
        const style = this.env.getComputedStyle(el);
        const wait = transitionMs(style.transitionDuration, style.transitionDelay) + TRANSITION_PADDING_MS;
        let settled = false;
        const settle = () => {
            if (settled) return;
            settled = true;
            this.pending = null;
            el.removeEventListener("transitionend", handler);
            if (this.timer !== null) this.env.clearTimeout(this.timer);
            this.timer = null;
            done();
        };
        const handler = (e: Event) => {
            if (e.target === el) settle();
        };
        this.pending = settle;
        el.addEventListener("transitionend", handler);
        this.timer = this.env.setTimeout(settle, wait);
    }

    /** Bootstrap's _addAriaAndCollapsedClass. */
    private syncTriggers(triggers: HTMLElement[], open: boolean): void {
        for (const t of triggers) {
            t.classList.toggle("collapsed", !open);
            t.setAttribute("aria-expanded", String(open));
        }
    }

    /** Bootstrap's _getFirstLevelChildren: matches inside `parent` that are not nested in another `.collapse` below it. */
    private firstLevel(parent: Element, selector: string): HTMLElement[] {
        return [...parent.querySelectorAll<HTMLElement>(selector)].filter((e) => {
            for (let p = e.parentElement; p && p !== parent; p = p.parentElement) if (p.classList.contains("collapse")) return false;
            return true;
        });
    }
}

/** The panels a toggle points at (Bootstrap's getMultipleElementsFromSelector). */
export const targetsOf = (trigger: Element, doc: Document): HTMLElement[] => {
    const s = selectorFor(trigger);
    return s ? [...doc.querySelectorAll<HTMLElement>(s)] : [];
};

/**
 * Wires collapse for everything inside `root` (an element, or the document):
 * 1. sets `aria-expanded` (the real state) and `aria-controls` (when the target has an id and the toggle has none) and the `collapsed` class on every toggle, so the markup is right before the first click (Bootstrap only does this for panels without data-bs-parent);
 * 2. one delegated `click` listener (no options) on `root` for `[data-bs-toggle="collapse"]`, `preventDefault` when the toggle or the click target is an `a`, then `toggle()` on each target.
 * Returns the cleanup: removes the listener and completes transitions in flight.
 */
export const initCollapse = (root: Document | Element, env?: CollapseEnv): (() => void) => {
    const doc = root.nodeType === 9 ? (root as Document) : (root as Element).ownerDocument;
    const e = env ?? browserEnv(doc.defaultView as Window);
    for (const t of root.querySelectorAll<HTMLElement>(TOGGLE)) {
        const target = targetsOf(t, doc)[0];
        if (!target) continue;
        const open = target.classList.contains("show");
        t.classList.toggle("collapsed", !open);
        t.setAttribute("aria-expanded", String(open));
        if (target.id && !t.hasAttribute("aria-controls")) t.setAttribute("aria-controls", target.id);
    }
    const onClick = (ev: Event) => {
        const target = ev.target as Element | null;
        if (!target || typeof target.closest !== "function") return;
        const trigger = target.closest(TOGGLE);
        if (!trigger || !root.contains(trigger)) return;
        if (target.tagName === "A" || trigger.tagName === "A") ev.preventDefault();
        for (const panel of targetsOf(trigger, doc)) Collapse.get(panel, e).toggle();
    };
    root.addEventListener("click", onClick);
    return () => {
        root.removeEventListener("click", onClick);
        for (const panel of root.querySelectorAll<HTMLElement>(".collapse, .collapsing")) Collapse.peek(panel)?.finish();
    };
};
