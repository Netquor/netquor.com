// nav.ts: DOM wiring of nav.js (mega menu, Products dropdown, burger menu). Same hooks, listeners, class names and aria strings as the legacy script; the decisions live in navState.ts.
import { DESKTOP_QUERY, reduceNav, touches, type NavEvent, type NavState } from "./navState";

/** Inline snippet for <head>: nav.js adds `nq-js` the moment it runs, before first paint (CSS hides the menu below 992 px only when it is present). An action runs after hydration, so the layout should also emit this. */
export const NQ_JS_SNIPPET = "document.documentElement.classList.add('nq-js');"; // the real head script lives in src/app.html and adds a failsafe timer to this

export const markJs = (doc: Document): void => {
    // nq-hydrated tells the head script's 5 second failsafe that the burger is alive.
    doc.documentElement.classList.add("nq-js", "nq-hydrated");
};

/** Wires the nav (`.nq-nav` element). Returns the cleanup that removes every listener. Missing parts are skipped (nav.js would throw without a burger or menu; a dropdown is optional in both). */
export const initNav = (nav: Element): (() => void) => {
    const doc = nav.ownerDocument;
    const win = doc.defaultView;
    markJs(doc);
    const burger = nav.querySelector<HTMLElement>(".nq-burger");
    const menu = nav.querySelector<HTMLElement>(".nq-menu");
    const dd = nav.querySelector<HTMLElement>(".nq-dd");
    const btn = dd ? dd.querySelector<HTMLElement>(".nq-dd-btn") : null;
    const mq = win && typeof win.matchMedia === "function" ? win.matchMedia(DESKTOP_QUERY) : null;
    const desktop = () => !!mq && mq.matches;
    const cleanups: (() => void)[] = [];
    const on = <T extends EventTarget>(t: T, type: string, fn: (e: Event) => void) => {
        t.addEventListener(type, fn);
        cleanups.push(() => t.removeEventListener(type, fn));
    };

    const read = (): NavState => ({ dd: !!dd && dd.classList.contains("open"), menu: !!menu && menu.classList.contains("open") });
    const apply = (s: NavState, ev: NavEvent) => {
        const t = touches(ev);
        if (t.dd && dd && btn) {
            dd.classList.toggle("open", s.dd);
            btn.setAttribute("aria-expanded", String(s.dd));
        }
        if (t.menu && menu && burger) {
            menu.classList.toggle("open", s.menu);
            burger.setAttribute("aria-expanded", String(s.menu));
        }
    };
    const dispatch = (ev: NavEvent) => apply(reduceNav(read(), ev, desktop()), ev);

    if (burger && menu) on(burger, "click", () => dispatch({ type: "burger-click" }));
    if (dd && btn) {
        on(btn, "click", (e) => {
            e.stopPropagation();
            dispatch({ type: "dd-click" });
        });
        on(dd, "mouseenter", () => dispatch({ type: "dd-enter" }));
        on(dd, "mouseleave", () => dispatch({ type: "dd-leave" }));
        on(doc, "click", (e) => dispatch({ type: "doc-click", insideDd: dd.contains(e.target as Node | null) }));
    }
    on(doc, "keydown", (e) => {
        if ((e as KeyboardEvent).key !== "Escape") return;
        dispatch({ type: "escape" });
    });
    on(nav, "click", (e) => {
        const t = e.target as Element | null;
        dispatch({ type: "nav-click", onLink: !!t && typeof t.closest === "function" && !!t.closest("a") });
    });
    return () => {
        for (const c of cleanups.splice(0)) c();
    };
};

/** Svelte action: `<nav class="nq-nav" use:navMenu>`. */
export const navMenu = (node: HTMLElement) => {
    const destroy = initNav(node);
    return { destroy };
};
