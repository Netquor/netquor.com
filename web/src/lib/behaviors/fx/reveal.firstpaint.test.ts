import { describe, expect, test } from "bun:test";
import { initReveal } from "./reveal";

// Fake targets with real classList semantics and a controllable box.
const target = (top: number, bottom: number) => {
    const set = new Set<string>();
    return { classList: { add: (...c: string[]) => c.forEach((x) => set.add(x)), remove: (...c: string[]) => c.forEach((x) => set.delete(x)), contains: (c: string) => set.has(c) }, style: { transitionDelay: "" }, getBoundingClientRect: () => ({ top, bottom }), set } as unknown as HTMLElement & { set: Set<string> };
};
const rig = (targets: Array<HTMLElement & { set: Set<string> }>) => {
    const html = new Set<string>();
    const doc = { documentElement: { classList: { add: (c: string) => html.add(c), remove: (c: string) => html.delete(c) } } };
    class IO { constructor(public cb: unknown) {} observe() {} unobserve() {} disconnect() {} }
    const win = { matchMedia: () => ({ matches: false }), IntersectionObserver: IO as unknown as typeof IntersectionObserver, innerHeight: 800 };
    const stop = initReveal({ querySelectorAll: () => targets }, doc, win);
    return { html, stop };
};

describe("reveal after hydration", () => {
    test("a target already on screen is shown in the same pass (no hide-then-fade flash), one below the fold is not", () => {
        const visible = target(100, 300), below = target(1200, 1400);
        rig([visible, below]);
        expect([...visible.set].sort()).toEqual(["nq-r", "nq-shown"]);
        expect([...below.set]).toEqual(["nq-r"]);
        expect(below.style.transitionDelay).not.toBe(""); // every target keeps the legacy stagger delay (index mod 3 x 70ms)
    });
    test("cleanup removes everything it added", () => {
        const t = target(10, 50);
        const { stop, html } = rig([t]);
        expect(html.has("nq-reveal-on")).toBe(true);
        stop();
        expect(t.set.size).toBe(0);
        expect(html.has("nq-reveal-on")).toBe(false);
    });
});
