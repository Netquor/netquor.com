// guards.test.ts: the sanity guards, rule by rule, with the boundaries.
import { describe, expect, test } from "bun:test";
import { largeChangeReasons } from "./guards";
import { snap } from "./testkit";

const ten = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k.p${i}`, 1000]));
const base = snap(1, ten);
const baselineKeys = Object.keys(ten);
const reasons = (next: ReturnType<typeof snap>, keys = baselineKeys) => largeChangeReasons({ current: base, next, baselineKeys: keys });

describe("largeChangeReasons", () => {
    test("a small change is fine", () => {
        expect(reasons(snap(2, { ...ten, "k.p0": 1100 }))).toEqual([]);
        expect(reasons(snap(2, ten))).toEqual([]);
    });

    test("one price moving by more than 50 percent is refused; exactly 50 percent passes", () => {
        expect(reasons(snap(2, { ...ten, "k.p0": 1500 }))).toEqual([]);
        expect(reasons(snap(2, { ...ten, "k.p0": 1501 }))[0]).toContain("more than 50 percent");
        expect(reasons(snap(2, { ...ten, "k.p0": 499 }))[0]).toContain("more than 50 percent");
        expect(reasons(snap(2, { ...ten, "k.p0": 500 }))).toEqual([]);
    });

    test("a non-zero price going to 0 is refused, naming the key", () => {
        const r = reasons(snap(2, { ...ten, "k.p3": 0 }));
        expect(r.some((x) => x.includes("k.p3") && x.includes("0"))).toBe(true);
    });

    test("a price that was 0 may change", () => {
        const cur = snap(1, { "a.free": 0, ...ten });
        expect(largeChangeReasons({ current: cur, next: snap(2, { "a.free": 5000, ...ten }), baselineKeys: [] })).toEqual([]);
    });

    test("more than 25 percent of the keys changing at once is refused; 25 percent passes", () => {
        const some = (n: number) => ({ ...ten, ...Object.fromEntries(Array.from({ length: n }, (_, i) => [`k.p${i}`, 1100])) });
        expect(reasons(snap(2, some(2)))).toEqual([]);
        expect(reasons(snap(2, some(3)))[0]).toContain("3 of 10 prices change at once");
        const four = snap(1, { "a.a": 100, "b.b": 100, "c.c": 100, "d.d": 100 });
        expect(largeChangeReasons({ current: four, next: snap(2, { "a.a": 110, "b.b": 100, "c.c": 100, "d.d": 100 }), baselineKeys: [] })).toEqual([]);
        expect(largeChangeReasons({ current: four, next: snap(2, { "a.a": 110, "b.b": 110, "c.c": 100, "d.d": 100 }), baselineKeys: [] })[0]).toContain("2 of 4");
    });

    test("removing more than 30 percent in one step is refused; 30 percent passes", () => {
        const drop = (n: number) => Object.fromEntries(Object.entries(ten).slice(n));
        expect(reasons(snap(2, drop(3)))).toEqual([]);
        expect(reasons(snap(2, drop(4)))[0]).toContain("removed at once");
    });

    test("removals add up against the baseline across several small steps", () => {
        // Each step removes one key (10 percent), so each is fine alone; against the baseline the fourth is not.
        let current = base;
        const steps: string[][] = [];
        for (let i = 0; i < 4; i++) {
            const next = snap(i + 2, Object.fromEntries(Object.entries(ten).slice(i + 1)));
            steps.push(largeChangeReasons({ current, next, baselineKeys }));
            current = next;
        }
        expect(steps[0]).toEqual([]);
        expect(steps[1]).toEqual([]);
        expect(steps[2]).toEqual([]);
        expect(steps[3].some((x) => x.includes("baseline"))).toBe(true);
    });

    test("with no baseline keys (empty) the cumulative rule does nothing", () => {
        expect(reasons(snap(2, { "k.p9": 1000 }), [])).not.toEqual([]); // the per-step rule still fires
        expect(largeChangeReasons({ current: snap(1, {}), next: snap(2, { "x.y": 5 }), baselineKeys: [] })).toEqual([]);
    });

    test("adding keys is never a problem", () => {
        expect(reasons(snap(2, { ...ten, "new.one": 100, "new.two": 200, "new.three": 300 }))).toEqual([]);
    });
});
