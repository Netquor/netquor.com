import { describe, expect, test } from "bun:test";
import { CLASSES, LABEL_TRACE_ORDER, prefersReducedMotion, progressScale, progressTransform, pulseDelay, REVEAL_OPTIONS, REVEAL_SELECTOR, revealDelay, SPOTLIGHT_SELECTOR, spotlightOffset, tapRect, traceIndexForLabel } from "./core";
import { asAny, FakeDoc, FakeEl } from "./fakeDom";
import { initHeroMap } from "./heroMap";
import { initProgress, mountProgress } from "./progress";
import { initReveal } from "./reveal";
import { initSpotlight } from "./spotlight";
import { renderSvelte } from "../../server/svelteHarness";

describe("core", () => {
    test("progress scale is scrollY over the scrollable height, clamped to 1, 0 without scroll room", () => {
        expect(progressScale(15341, 900, 0)).toBe(0);
        expect(progressScale(15341, 900, 800)).toBeCloseTo(0.0553978, 6);
        expect(progressScale(15341, 900, 14441)).toBe(1);
        expect(progressScale(15341, 900, 99999)).toBe(1);
        expect(progressScale(900, 900, 50)).toBe(0);
        expect(progressScale(500, 900, 50)).toBe(0);
        expect(progressTransform(0.5)).toBe("scaleX(0.5)");
    });
    test("label to trace mapping: centre label first, trace last", () => {
        expect(LABEL_TRACE_ORDER).toEqual([8, 0, 1, 2, 3, 4, 5, 6, 7]);
        expect(traceIndexForLabel(0)).toBe(8);
        expect(traceIndexForLabel(1)).toBe(0);
        expect(traceIndexForLabel(8)).toBe(7);
        expect(traceIndexForLabel(9)).toBeUndefined();
    });
    test("pulse delays step by 0.55 s, as the browser reports them", () => {
        expect(Array.from({ length: 9 }, (_, i) => pulseDelay(i))).toEqual(["0s", "0.55s", "1.1s", "1.65s", "2.2s", "2.75s", "3.3s", "3.85s", "4.4s"]);
    });
    test("reveal stagger is (index mod 3) * 70 ms", () => {
        expect(Array.from({ length: 7 }, (_, i) => revealDelay(i))).toEqual(["0ms", "70ms", "140ms", "0ms", "70ms", "140ms", "0ms"]);
    });
    test("tap rect pads the label box by 14 px sideways and 22 px vertically", () => {
        expect(tapRect({ x: 229.5, y: 100, width: 80, height: 40 })).toEqual({ x: 215.5, y: 78, width: 108, height: 84 });
    });
    test("spotlight offsets are px from the card's top left", () => {
        expect(spotlightOffset(150, 90, { left: 100, top: 40 })).toEqual({ mx: "50px", my: "50px" });
    });
    test("selectors and observer options are the legacy ones", () => {
        expect(REVEAL_SELECTOR).toBe(".nq-section-head, .nq-who, .nq-app, .nq-calc, .nq-start, .nq-bundle, .nq-prices, .nq-cmp-list details, .nq-facts li, .nq-together li, .nq-check");
        expect(SPOTLIGHT_SELECTOR).toBe(".nq-app, .nq-who, .nq-calc, .nq-check, .nq-prices-row");
        expect(REVEAL_OPTIONS).toEqual({ threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    });
    test("reduced motion is read from matchMedia, false without it", () => {
        expect(prefersReducedMotion(undefined)).toBe(false);
        expect(prefersReducedMotion({})).toBe(false);
        expect(prefersReducedMotion({ matchMedia: (q) => ({ matches: q === "(prefers-reduced-motion: reduce)" }) })).toBe(true);
        expect(prefersReducedMotion({ matchMedia: () => ({ matches: false }) })).toBe(false);
    });
});

describe("progress", () => {
    const rig = (scrollHeight = 2000, innerHeight = 1000) => {
        const handlers: { fn: () => void; opts: unknown }[] = [];
        const win = { innerHeight, scrollY: 0, addEventListener: (_t: string, fn: () => void, opts: unknown) => handlers.push({ fn, opts }), removeEventListener: (_t: string, fn: () => void) => { const i = handlers.findIndex((h) => h.fn === fn); if (i >= 0) handlers.splice(i, 1); } };
        const doc = { documentElement: { scrollHeight } };
        return { win, doc, handlers };
    };
    test("sets the transform at start and on every scroll, with a passive listener", () => {
        const { win, doc, handlers } = rig();
        const bar = { style: { transform: "" } };
        initProgress(bar, doc, win);
        expect(bar.style.transform).toBe("scaleX(0)");
        expect(handlers.length).toBe(1);
        expect(handlers[0].opts).toEqual({ passive: true });
        win.scrollY = 500; handlers[0].fn();
        expect(bar.style.transform).toBe("scaleX(0.5)");
        win.scrollY = 5000; handlers[0].fn();
        expect(bar.style.transform).toBe("scaleX(1)");
    });
    test("cleanup removes the listener", () => {
        const { win, doc, handlers } = rig();
        initProgress({ style: { transform: "" } }, doc, win)();
        expect(handlers.length).toBe(0);
    });
    test("mountProgress appends an aria-hidden .nq-progress to body and removes it on cleanup", () => {
        const { win, handlers } = rig();
        const doc = new FakeDoc();
        (doc.documentElement as unknown as { scrollHeight: number }).scrollHeight = 2000;
        const stop = mountProgress(asAny(doc), asAny(win));
        const bar = doc.body.children[0];
        expect(bar.attrs.class).toBe("nq-progress");
        expect(bar.attrs["aria-hidden"]).toBe("true");
        expect(bar.style.transform).toBe("scaleX(0)");
        stop();
        expect(doc.body.children.length).toBe(0);
        expect(handlers.length).toBe(0);
    });
});

describe("heroMap", () => {
    const build = (nLines = 9, nLabels = 9, bbox = true) => {
        const doc = new FakeDoc();
        const map = new FakeEl("svg", doc);
        const group = new FakeEl("g", doc);
        const lines = Array.from({ length: nLines }, () => group.appendChild(new FakeEl("path", doc)));
        const labels = Array.from({ length: nLabels }, (_, i) => { const a = new FakeEl("a", doc); a.appendChild(new FakeEl("text", doc)); if (bbox) a.bbox = { x: 100 + i, y: 50, width: 60, height: 30 }; return a; });
        map.queries[".nq-map-lines path"] = [...lines];
        map.queries[".nq-map-labels > a"] = labels;
        return { map, group, lines, labels };
    };
    test("every trace gets pathLength 100 and a pulse clone with a stepped delay, appended to the same parent", () => {
        const { map, group, lines } = build();
        initHeroMap(asAny(map));
        expect(group.children.length).toBe(18);
        expect(lines.every((l) => l.attrs.pathLength === "100")).toBe(true);
        const pulses = group.children.slice(9);
        expect(pulses.every((p) => p.attrs.class === "nq-pulse" && p.attrs.pathLength === "100")).toBe(true);
        expect(pulses.map((p) => p.style.animationDelay)).toEqual(["0s", "0.55s", "1.1s", "1.65s", "2.2s", "2.75s", "3.3s", "3.85s", "4.4s"]);
    });
    test("each label gets a transparent rect as its first child", () => {
        const { map, labels } = build();
        initHeroMap(asAny(map));
        const r = labels[0].children[0];
        expect(r.tag).toBe("rect");
        expect(r.attrs).toEqual({ x: "86", y: "28", width: "88", height: "74", fill: "transparent" });
        expect(labels[0].children[1].tag).toBe("text");
    });
    test("a label whose getBBox throws gets no rect and the rest still work", () => {
        const { map, labels } = build(9, 9, false);
        labels[3].bbox = { x: 1, y: 2, width: 3, height: 4 };
        initHeroMap(asAny(map));
        expect(labels[0].children.length).toBe(1);
        expect(labels[3].children[0].tag).toBe("rect");
        labels[0].fire("mouseenter");
        expect(map.queries[".nq-map-lines path"][8].classList.contains("hot")).toBe(true);
    });
    test("mouseenter and focus light the trace and its pulse, mouseleave and blur clear them (label 0 is trace 8, label 1 is trace 0)", () => {
        const { map, group, lines, labels } = build();
        initHeroMap(asAny(map));
        labels[1].fire("mouseenter");
        expect(lines[0].classList.contains("hot") && group.children[9].classList.contains("hot")).toBe(true);
        labels[1].fire("mouseleave");
        expect(lines[0].classList.contains("hot") || group.children[9].classList.contains("hot")).toBe(false);
        labels[0].fire("focus");
        expect(lines[8].classList.contains("hot") && group.children[17].classList.contains("hot")).toBe(true);
        expect(lines.filter((l) => l.classList.contains("hot")).length).toBe(1);
        labels[0].fire("blur");
        expect(lines[8].classList.contains("hot")).toBe(false);
    });
    test("a label with no matching trace does nothing", () => {
        const { map, labels } = build(3, 9);
        initHeroMap(asAny(map));
        expect(() => { labels[0].fire("mouseenter"); labels[8].fire("focus"); }).not.toThrow();
    });
    test("a map without labels (the Central diagram) still gets pulses", () => {
        const { map, group } = build(6, 0);
        initHeroMap(asAny(map));
        expect(group.children.length).toBe(12);
    });
    test("cleanup removes listeners, clones, rects and hot, and restores pathLength", () => {
        const { map, group, lines, labels } = build();
        lines[2].setAttribute("pathLength", "50");
        const stop = initHeroMap(asAny(map));
        labels[2].fire("mouseenter");
        stop();
        expect(group.children.length).toBe(9);
        expect(lines[0].getAttribute("pathLength")).toBeNull();
        expect(lines[2].attrs.pathLength).toBe("50");
        expect(labels.every((a) => a.children.length === 1)).toBe(true);
        expect(labels.every((a) => ["mouseenter", "focus", "mouseleave", "blur"].every((t) => a.count(t) === 0))).toBe(true);
        expect(lines.some((l) => l.classList.contains("hot"))).toBe(false);
    });
});

describe("reveal", () => {
    class FakeIO {
        static last: FakeIO;
        observed: FakeEl[] = []; unobserved: FakeEl[] = []; disconnected = false;
        constructor(public cb: (es: { target: FakeEl; isIntersecting: boolean }[]) => void, public opts: unknown) { FakeIO.last = this; }
        observe(t: FakeEl) { this.observed.push(t); }
        unobserve(t: FakeEl) { this.unobserved.push(t); }
        disconnect() { this.disconnected = true; }
    }
    const rig = (n = 7) => {
        const doc = new FakeDoc();
        const scope = new FakeEl("main", doc);
        const targets = Array.from({ length: n }, () => new FakeEl("section", doc));
        scope.queries[REVEAL_SELECTOR] = targets;
        return { doc, scope, targets };
    };
    const win = (reduce = false) => ({ matchMedia: () => ({ matches: reduce }), IntersectionObserver: FakeIO });

    test("adds nq-reveal-on, nq-r and the stagger, and observes every target with the legacy options", () => {
        const { doc, scope, targets } = rig();
        initReveal(asAny(scope), asAny(doc), asAny(win()));
        expect(doc.documentElement.classList.contains("nq-reveal-on")).toBe(true);
        expect(targets.every((t) => t.classList.contains("nq-r"))).toBe(true);
        expect(targets.map((t) => t.style.transitionDelay)).toEqual(["0ms", "70ms", "140ms", "0ms", "70ms", "140ms", "0ms"]);
        expect(FakeIO.last.observed).toEqual(targets);
        expect(FakeIO.last.opts).toEqual({ threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    });
    test("an intersecting target gets nq-shown once and is unobserved; others stay hidden and nothing is ever removed", () => {
        const { doc, scope, targets } = rig(3);
        initReveal(asAny(scope), asAny(doc), asAny(win()));
        FakeIO.last.cb([{ target: targets[0], isIntersecting: true }, { target: targets[1], isIntersecting: false }]);
        expect(targets.map((t) => t.classList.contains("nq-shown"))).toEqual([true, false, false]);
        expect(FakeIO.last.unobserved).toEqual([targets[0]]);
        FakeIO.last.cb([{ target: targets[0], isIntersecting: false }]);
        expect(targets[0].classList.contains("nq-shown")).toBe(true);
    });
    test("reduced motion touches nothing", () => {
        const { doc, scope, targets } = rig();
        initReveal(asAny(scope), asAny(doc), asAny(win(true)));
        expect(doc.documentElement.classList.contains("nq-reveal-on")).toBe(false);
        expect(targets.some((t) => t.classList.contains("nq-r"))).toBe(false);
    });
    test("without IntersectionObserver nothing is hidden", () => {
        const { doc, scope, targets } = rig();
        initReveal(asAny(scope), asAny(doc), asAny({ matchMedia: () => ({ matches: false }) }));
        expect(doc.documentElement.classList.contains("nq-reveal-on")).toBe(false);
        expect(targets.some((t) => t.classList.contains("nq-r"))).toBe(false);
    });
    test("cleanup disconnects the observer and removes every class and delay", () => {
        const { doc, scope, targets } = rig();
        const stop = initReveal(asAny(scope), asAny(doc), asAny(win()));
        FakeIO.last.cb([{ target: targets[0], isIntersecting: true }]);
        stop();
        expect(FakeIO.last.disconnected).toBe(true);
        expect(doc.documentElement.classList.contains("nq-reveal-on")).toBe(false);
        expect(targets.every((t) => t.classList.set.size === 0 && t.style.transitionDelay === "")).toBe(true);
    });
});

describe("spotlight", () => {
    const rig = () => {
        const doc = new FakeDoc();
        const card = new FakeEl("div", doc);
        card.rect = { left: 100, top: 40 };
        return { doc, card };
    };
    const ev = (target: unknown, x = 150, y = 90) => ({ target, clientX: x, clientY: y });
    test("a passive pointermove on a card sets --mx and --my in px", () => {
        const { doc, card } = rig();
        initSpotlight(asAny(doc), { matchMedia: () => ({ matches: false }) });
        expect(doc.listeners.pointermove[0].opts).toEqual({ passive: true });
        const inner = new FakeEl("span", doc);
        inner.cardOf = card;
        doc.fire("pointermove", ev(inner));
        expect(card.style.getPropertyValue("--mx")).toBe("50px");
        expect(card.style.getPropertyValue("--my")).toBe("50px");
    });
    test("outside a card, or with a target that has no closest, nothing happens", () => {
        const { doc, card } = rig();
        initSpotlight(asAny(doc), {});
        const out = new FakeEl("p", doc);
        doc.fire("pointermove", ev(out));
        doc.fire("pointermove", ev({}));
        doc.fire("pointermove", ev(null));
        expect(card.style.props).toEqual({});
    });
    test("reduced motion adds no listener; cleanup removes it", () => {
        const { doc } = rig();
        initSpotlight(asAny(doc), { matchMedia: () => ({ matches: true }) });
        expect(doc.count("pointermove")).toBe(0);
        const stop = initSpotlight(asAny(doc), {});
        expect(doc.count("pointermove")).toBe(1);
        stop();
        expect(doc.count("pointermove")).toBe(0);
    });
});

describe("server markup", () => {
    test("ScrollProgress renders the complete bar without JavaScript", async () => {
        const { body } = await renderSvelte("lib/behaviors/fx/ScrollProgress.svelte", {}, {});
        expect(body).toContain('class="nq-progress"');
        expect(body).toContain('aria-hidden="true"');
        expect(body).not.toContain("style=");
    });
    test("Fx renders only the bar on the server", async () => {
        const { body } = await renderSvelte("lib/behaviors/fx/Fx.svelte", {}, {});
        expect(body.match(/nq-progress/g)?.length).toBe(1);
        expect(body).not.toContain("nq-r");
    });
});
