import { describe, expect, test } from "bun:test";
import { FakeDoc, FakeEl, h } from "../accordion/fakeDom";
import { initNav, navMenu, NQ_JS_SNIPPET } from "./nav";

const build = (opts: { dropdown?: boolean; desktop?: boolean } = {}) => {
    const doc = new FakeDoc();
    doc.desktop = opts.desktop ?? true;
    const link = h(doc, "a", { href: "/x" });
    const inner = h(doc, "span");
    link.append(inner);
    const btn = h(doc, "button", { class: "nq-link nq-dd-btn", "aria-expanded": "false", "aria-haspopup": "true" });
    const panel = h(doc, "div", { class: "nq-dd-menu nq-mega" }, [link]);
    const dd = h(doc, "li", { class: "nq-dd" }, [btn, panel]);
    const burger = h(doc, "button", { class: "nq-burger", "aria-expanded": "false", "aria-controls": "nq-menu" });
    const menu = h(doc, "div", { class: "nq-menu", id: "nq-menu" }, [h(doc, "ul", {}, opts.dropdown === false ? [] : [dd])]);
    const nav = h(doc, "nav", { class: "nq-nav" }, [burger, menu]);
    const outside = h(doc, "p");
    doc.documentElement.append(nav, outside);
    const cleanup = initNav(nav as unknown as Element);
    const state = () => ({ dd: dd.classList.contains("open"), ddAria: btn.getAttribute("aria-expanded"), menu: menu.classList.contains("open"), menuAria: burger.getAttribute("aria-expanded") });
    return { doc, nav, burger, menu, dd, btn, link, inner, outside, cleanup, state };
};

describe("initNav", () => {
    test("adds nq-js to <html> immediately", () => {
        const n = build();
        expect(n.doc.documentElement.classList.contains("nq-js")).toBe(true);
        expect(NQ_JS_SNIPPET).toContain("nq-js");
    });
    test("burger toggles .open and aria-expanded as strings", () => {
        const n = build();
        n.burger.fire("click");
        expect(n.state()).toMatchObject({ menu: true, menuAria: "true" });
        n.burger.fire("click");
        expect(n.state()).toMatchObject({ menu: false, menuAria: "false" });
    });
    test("desktop: Products click opens, a second click keeps it open; the click does not reach the document", () => {
        const n = build();
        let docClicks = 0;
        n.doc.addEventListener("click", () => docClicks++);
        n.btn.fire("click");
        n.btn.fire("click");
        expect(n.state()).toMatchObject({ dd: true, ddAria: "true" });
        expect(docClicks).toBe(0);
    });
    test("mobile: Products click toggles; hover does nothing", () => {
        const n = build({ desktop: false });
        n.dd.fire("mouseenter");
        expect(n.state().dd).toBe(false);
        n.btn.fire("click");
        expect(n.state().dd).toBe(true);
        n.dd.fire("mouseleave");
        expect(n.state().dd).toBe(true);
        n.btn.fire("click");
        expect(n.state()).toMatchObject({ dd: false, ddAria: "false" });
    });
    test("desktop hover opens and leaves close", () => {
        const n = build();
        n.dd.fire("mouseenter");
        expect(n.state()).toMatchObject({ dd: true, ddAria: "true" });
        n.dd.fire("mouseleave");
        expect(n.state()).toMatchObject({ dd: false, ddAria: "false" });
    });
    test("the media query is created once and read at each event", () => {
        const n = build();
        expect(n.doc.mediaQueries).toEqual(["(min-width: 992px)"]);
        n.btn.fire("click");
        n.doc.desktop = false; // a resize across 992 px closes nothing and changes the next event
        expect(n.state().dd).toBe(true);
        n.btn.fire("click");
        expect(n.state().dd).toBe(false);
    });
    test("an outside click closes Products and leaves the burger menu open; a click inside Products keeps it", () => {
        const n = build();
        n.burger.fire("click");
        n.btn.fire("click");
        n.dd.children[1].fire("click", { target: n.dd.children[1] });
        // the panel click bubbles through the nav (no link), then to the document: inside .nq-dd, stays open
        expect(n.state().dd).toBe(true);
        n.outside.fire("click");
        expect(n.state()).toMatchObject({ dd: false, ddAria: "false", menu: true, menuAria: "true" });
    });
    test("Escape anywhere closes both and does not move focus (no focus code at all)", () => {
        const n = build();
        n.burger.fire("click");
        n.btn.fire("click");
        n.outside.fire("keydown", { key: "Escape" });
        expect(n.state()).toEqual({ dd: false, ddAria: "false", menu: false, menuAria: "false" });
    });
    test("other keys do nothing", () => {
        const n = build();
        n.btn.fire("click");
        n.outside.fire("keydown", { key: "Tab" });
        n.outside.fire("keydown", { key: "ArrowDown" });
        expect(n.state().dd).toBe(true);
    });
    test("a click on a link, or inside it, closes both", () => {
        const n = build();
        n.burger.fire("click");
        n.btn.fire("click");
        n.inner.fire("click");
        expect(n.state()).toEqual({ dd: false, ddAria: "false", menu: false, menuAria: "false" });
    });
    test("a nav click that is not a link leaves both alone", () => {
        const n = build();
        n.burger.fire("click");
        n.menu.fire("click");
        expect(n.state().menu).toBe(true);
    });
    test("listeners: plain (no options), on the legacy targets", () => {
        const n = build();
        expect(n.burger.listenerCount("click")).toBe(1);
        expect(n.btn.listenerCount("click")).toBe(1);
        expect(n.dd.listenerCount("mouseenter")).toBe(1);
        expect(n.dd.listenerCount("mouseleave")).toBe(1);
        expect(n.nav.listenerCount("click")).toBe(1);
        expect(n.doc.listenerCount("click")).toBe(1);
        expect(n.doc.listenerCount("keydown")).toBe(1);
        for (const e of [n.burger, n.btn, n.dd, n.nav, n.doc]) for (const l of e.listeners) expect(l.options).toBeUndefined();
    });
    test("cleanup removes every listener", () => {
        const n = build();
        n.cleanup();
        for (const e of [n.burger, n.btn, n.dd, n.nav, n.doc]) expect(e.listenerCount()).toBe(0);
        n.burger.fire("click");
        expect(n.state().menu).toBe(false);
    });
    test("without a dropdown only the burger, Escape and link clicks are wired (no throw)", () => {
        const n = build({ dropdown: false });
        expect(n.doc.listenerCount("click")).toBe(0);
        n.burger.fire("click");
        expect(n.state().menu).toBe(true);
        n.outside.fire("keydown", { key: "Escape" });
        expect(n.state().menu).toBe(false);
    });
    test("a nav without burger or menu does not throw", () => {
        const doc = new FakeDoc();
        const nav = h(doc, "nav", { class: "nq-nav" });
        doc.documentElement.append(nav);
        const c = initNav(nav as unknown as Element);
        c();
        expect(doc.listenerCount()).toBe(0);
    });
    test("the action returns a destroy", () => {
        const doc = new FakeDoc();
        const nav = h(doc, "nav", { class: "nq-nav" }, [h(doc, "button", { class: "nq-burger" }), h(doc, "div", { class: "nq-menu" })]);
        doc.documentElement.append(nav);
        const a = navMenu(nav as unknown as HTMLElement);
        expect(nav.children[0].listenerCount("click")).toBe(1);
        a.destroy();
        expect(nav.children[0].listenerCount("click")).toBe(0);
        expect(nav instanceof FakeEl).toBe(true);
    });
});

describe("nav failsafe handshake", () => {
    test("starting the nav marks the page nq-hydrated so the head script's 5 second failsafe keeps nq-js", async () => {
        const { markJs } = await import("./nav");
        const set = new Set<string>();
        markJs({ documentElement: { classList: { add: (...c: string[]) => c.forEach((x) => set.add(x)) } } } as unknown as Document);
        expect([...set].sort()).toEqual(["nq-hydrated", "nq-js"]);
    });
    test("the head script drops nq-js after 5 seconds unless nq-hydrated is set", async () => {
        const html = await Bun.file(new URL("../../../app.html", import.meta.url)).text();
        expect(html).toContain('classList.add("nq-js")');
        expect(html).toContain("setTimeout");
        expect(html).toContain('contains("nq-hydrated")');
        expect(html).toContain("5000");
    });
});
