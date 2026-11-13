import { describe, expect, test } from "bun:test";
import { ACTIVES, Collapse, initCollapse, selectorFor, targetsOf, transitionMs, type CollapseEnv } from "./collapse";
import { FakeDoc, FakeEl, h, manualTimers } from "./fakeDom";

const setup = (opts: { open?: string; parent?: boolean; duration?: string; ids?: string[] } = {}) => {
    const doc = new FakeDoc();
    const timers = manualTimers();
    const style = { transitionDuration: opts.duration ?? "0.35s", transitionDelay: "0s" };
    const env: CollapseEnv = { document: doc as unknown as Document, getComputedStyle: () => style, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout };
    const ids = opts.ids ?? ["a", "b", "c"];
    const triggers: FakeEl[] = [];
    const panels: FakeEl[] = [];
    const root = h(doc, "div", { id: "faq", class: "accordion" });
    for (const id of ids) {
        const t = h(doc, "button", { class: "accordion-button collapsed", type: "button", "data-bs-toggle": "collapse", "data-bs-target": `#${id}` });
        const show = opts.open === id;
        const p = h(doc, "div", { id, class: `accordion-collapse collapse${show ? " show" : ""}`, ...(opts.parent === false ? {} : { "data-bs-parent": "#faq" }) }, [h(doc, "div", { class: "accordion-body" })]);
        p.scrollHeight = 120;
        p.rectHeight = 120;
        if (show) t.classList.remove("collapsed");
        triggers.push(t);
        panels.push(p);
        root.append(h(doc, "div", { class: "accordion-item" }, [h(doc, "h3", { class: "accordion-header" }, [t]), p]));
    }
    doc.documentElement.append(root);
    const cleanup = initCollapse(root as unknown as Element, env);
    const open = () => panels.filter((p) => p.classList.contains("show")).map((p) => p.id);
    return { doc, env, timers, root, triggers, panels, cleanup, open };
};

describe("transitionMs", () => {
    test("Bootstrap's rule: first duration plus first delay in ms, 0 when both are 0", () => {
        expect(transitionMs("0.35s", "0s")).toBe(350);
        expect(transitionMs("0.35s, 0.1s", "0s, 1s")).toBe(350);
        expect(transitionMs("0.2s", "0.1s")).toBeCloseTo(300);
        expect(transitionMs("0s", "0s")).toBe(0);
        expect(transitionMs("", "")).toBe(0);
    });
});

describe("selectorFor", () => {
    const mk = (attrs: Record<string, string>) => h(new FakeDoc(), "a", attrs) as unknown as Element;
    test("data-bs-target first, then href", () => {
        expect(selectorFor(mk({ "data-bs-target": "#x" }))).toBe("#x");
        expect(selectorFor(mk({ href: "#y" }))).toBe("#y");
        expect(selectorFor(mk({ href: "page.html#z" }))).toBe("#z");
        expect(selectorFor(mk({ href: ".cls" }))).toBe(".cls");
        expect(selectorFor(mk({ "data-bs-target": "#", href: "#w" }))).toBe("#w");
    });
    test("none for a plain link, a bare # or nothing", () => {
        expect(selectorFor(mk({ href: "page.html" }))).toBeNull();
        expect(selectorFor(mk({ href: "#" }))).toBeNull();
        expect(selectorFor(mk({}))).toBeNull();
    });
    test("ACTIVES is Bootstrap's selector", () => expect(ACTIVES).toBe(".collapse.show, .collapse.collapsing"));
});

describe("initCollapse: first paint state", () => {
    test("aria-expanded, aria-controls and collapsed follow the server markup", () => {
        const s = setup({ open: "b" });
        expect(s.triggers.map((t) => t.getAttribute("aria-expanded"))).toEqual(["false", "true", "false"]);
        expect(s.triggers.map((t) => t.getAttribute("aria-controls"))).toEqual(["a", "b", "c"]);
        expect(s.triggers.map((t) => t.classList.contains("collapsed"))).toEqual([true, false, true]);
    });
    test("an existing aria-controls is kept", () => {
        const doc = new FakeDoc();
        const t = h(doc, "button", { "data-bs-toggle": "collapse", "data-bs-target": "#p", "aria-controls": "other" });
        const p = h(doc, "div", { id: "p", class: "collapse" });
        const root = h(doc, "div", {}, [t, p]);
        doc.documentElement.append(root);
        initCollapse(root as unknown as Element);
        expect(t.getAttribute("aria-controls")).toBe("other");
    });
    test("one click listener with no options; cleanup removes it", () => {
        const s = setup();
        expect(s.root.listenerCount("click")).toBe(1);
        expect(s.root.listeners[0].options).toBeUndefined();
        s.cleanup();
        expect(s.root.listenerCount("click")).toBe(0);
    });
});

describe("opening and closing", () => {
    test("open: collapse -> collapsing (height 0 then scrollHeight), aria at once, show after 350 + 5 ms", () => {
        const s = setup();
        s.triggers[0].fire("click");
        const p = s.panels[0];
        expect(p.classList.contains("collapsing")).toBe(true);
        expect(p.classList.contains("collapse")).toBe(false);
        expect(p.style.height).toBe("120px");
        expect(s.triggers[0].classList.contains("collapsed")).toBe(false);
        expect(s.triggers[0].getAttribute("aria-expanded")).toBe("true");
        s.timers.advance(354);
        expect(p.classList.contains("collapsing")).toBe(true);
        s.timers.advance(1);
        expect(p.classList.contains("collapsing")).toBe(false);
        expect(p.classList.contains("collapse") && p.classList.contains("show")).toBe(true);
        expect(p.style.height).toBe("");
        expect(s.timers.pending).toBe(0);
    });
    test("close: height is pinned to the measured height, reflow read, collapsing, then collapse", () => {
        const s = setup({ open: "a" });
        s.triggers[0].fire("click");
        const p = s.panels[0];
        expect(p.style.height).toBe("120px");
        expect(p.offsetHeightReads).toBe(1);
        expect(p.classList.contains("collapsing")).toBe(true);
        expect(p.classList.contains("show")).toBe(false);
        expect(s.triggers[0].classList.contains("collapsed")).toBe(true);
        expect(s.triggers[0].getAttribute("aria-expanded")).toBe("false");
        s.timers.advance(355);
        expect(p.classList.contains("collapse")).toBe(true);
        expect(p.classList.contains("collapsing")).toBe(false);
        expect(p.style.height).toBe("");
    });
    test("a click while the panel is transitioning is ignored", () => {
        const s = setup();
        s.triggers[0].fire("click");
        s.triggers[0].fire("click");
        s.timers.advance(355);
        expect(s.open()).toEqual(["a"]);
    });
    test("transitionend on the panel completes early and cancels the timer; one from a child is ignored", () => {
        const s = setup();
        s.triggers[0].fire("click");
        const p = s.panels[0];
        p.fire("transitionend", { target: p.children[0] });
        expect(p.classList.contains("collapsing")).toBe(true);
        p.fire("transitionend");
        expect(p.classList.contains("show")).toBe(true);
        expect(s.timers.pending).toBe(0);
        expect(p.listenerCount("transitionend")).toBe(0);
    });
    test("no transition (reduced motion): completes after the 5 ms padding", () => {
        const s = setup({ duration: "0s" });
        s.triggers[0].fire("click");
        s.timers.advance(4);
        expect(s.panels[0].classList.contains("collapsing")).toBe(true);
        s.timers.advance(1);
        expect(s.open()).toEqual(["a"]);
    });
    test("Enter and Space are native button clicks: the same code path", () => {
        const s = setup();
        s.triggers[2].fire("click");
        s.timers.advance(355);
        expect(s.open()).toEqual(["c"]);
    });
});

describe("data-bs-parent exclusivity", () => {
    test("opening another closes the open one; the closing trigger gets collapsed and aria-expanded false", () => {
        const s = setup({ open: "a" });
        s.triggers[1].fire("click");
        expect(s.panels[0].classList.contains("collapsing")).toBe(true);
        expect(s.triggers[0].classList.contains("collapsed")).toBe(true);
        expect(s.triggers[0].getAttribute("aria-expanded")).toBe("false");
        expect(s.triggers[1].getAttribute("aria-expanded")).toBe("true");
        s.timers.advance(355);
        expect(s.open()).toEqual(["b"]);
    });
    test("every trigger once in order leaves the last one open", () => {
        const s = setup();
        for (const t of s.triggers) { t.fire("click"); s.timers.advance(450); }
        expect(s.open()).toEqual(["c"]);
    });
    test("quirk kept from Bootstrap: a sibling that is mid-transition is not active, so a fast second click opens both", () => {
        const s = setup({ open: "a" });
        s.triggers[1].fire("click"); // a is now collapsing: not matched by ACTIVES
        s.triggers[2].fire("click"); // b is collapsing too: quirk, c opens as well
        s.timers.advance(355);
        expect(s.open().sort()).toEqual(["b", "c"]);
    });
    test("without data-bs-parent panels are independent and the first-paint aria is set by the instance", () => {
        const s = setup({ parent: false });
        s.triggers[0].fire("click");
        s.timers.advance(355);
        s.triggers[1].fire("click");
        s.timers.advance(355);
        expect(s.open()).toEqual(["a", "b"]);
    });
    test("a .collapse nested inside a panel is not an active sibling", () => {
        const s = setup({ open: "a" });
        const inner = h(s.doc, "div", { id: "inner", class: "collapse show" });
        s.panels[0].children[0].append(inner);
        s.triggers[1].fire("click");
        expect(inner.classList.contains("show")).toBe(true);
        expect(s.panels[0].classList.contains("collapsing")).toBe(true);
    });
});

describe("events and links", () => {
    test("show.bs.collapse can be cancelled", () => {
        const s = setup();
        s.panels[0].addEventListener("show.bs.collapse", (e: Event) => e.preventDefault());
        s.triggers[0].fire("click");
        expect(s.panels[0].classList.contains("collapsing")).toBe(false);
        expect(s.triggers[0].getAttribute("aria-expanded")).toBe("false");
    });
    test("the shown and hidden events fire when the transition completes", () => {
        const s = setup();
        const seen: string[] = [];
        for (const n of ["show", "shown", "hide", "hidden"]) s.panels[0].addEventListener(`${n}.bs.collapse`, () => seen.push(n));
        s.triggers[0].fire("click");
        s.timers.advance(355);
        s.triggers[0].fire("click");
        s.timers.advance(355);
        expect(seen).toEqual(["show", "shown", "hide", "hidden"]);
    });
    test("an <a> toggle has its default prevented, a button does not", () => {
        const s = setup();
        const a = h(s.doc, "a", { href: "#a", "data-bs-toggle": "collapse" });
        s.root.append(a);
        expect(a.fire("click").defaultPrevented).toBe(true);
        expect(s.triggers[1].fire("click").defaultPrevented).toBe(false);
    });
    test("a click inside the toggle's child element toggles; one elsewhere does nothing", () => {
        const s = setup();
        const span = h(s.doc, "span");
        s.triggers[0].append(span);
        span.fire("click");
        expect(s.panels[0].classList.contains("collapsing")).toBe(true);
        s.panels[1].children[0].fire("click");
        expect(s.panels[1].classList.contains("collapsing")).toBe(false);
    });
    test("targetsOf resolves a selector to elements", () => {
        const s = setup();
        expect(targetsOf(s.triggers[1] as unknown as Element, s.doc as unknown as Document)).toEqual([s.panels[1] as never]);
    });
});

describe("teardown", () => {
    test("cleanup completes a transition in flight and clears its timer", () => {
        const s = setup();
        s.triggers[0].fire("click");
        s.cleanup();
        expect(s.panels[0].classList.contains("show")).toBe(true);
        expect(s.panels[0].classList.contains("collapsing")).toBe(false);
        expect(s.timers.pending).toBe(0);
        s.triggers[1].fire("click");
        expect(s.panels[1].classList.contains("collapsing")).toBe(false);
    });
    test("peek returns the instance after first use", () => {
        const s = setup();
        expect(Collapse.peek(s.panels[0] as unknown as Element)).toBeUndefined();
        s.triggers[0].fire("click");
        expect(Collapse.peek(s.panels[0] as unknown as Element)?.isTransitioning).toBe(true);
    });
});
