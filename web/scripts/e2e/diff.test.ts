import { describe, expect, test } from "bun:test";
import { applyAllow, diffObserved, diffTraces, formatDiff, formatReport, globToRegExp, reportOk, validateAllow, type ScenarioReport, type Trace } from "./diff";
import type { Observed, ObservedEl } from "./observe";

const el = (o: Partial<ObservedEl> = {}): ObservedEl => ({ tag: "li", attrs: {}, classes: [], box: { x: 0, y: 0, w: 100, h: 40 }, computed: {}, text: "", visible: true, ...o });
const obs = (items: ObservedEl[] = [el()], extra: Partial<Observed> = {}): Observed => ({ scroll: { x: 0, y: 0 }, focus: "body", elements: { ".a": { count: items.length, items } }, ...extra });

describe("diffObserved", () => {
    test("identical snapshots have no diffs", () => expect(diffObserved("s", obs(), obs())).toEqual([]));
    test("an attribute difference has a readable path", () => {
        const d = diffObserved("click", obs([el({ attrs: { "aria-expanded": "true" } })]), obs([el({ attrs: { "aria-expanded": "false" } })]));
        expect(d).toEqual([{ path: "click :: .a[0].attrs.aria-expanded", legacy: "true", svelte: "false" }]);
    });
    test("an attribute present on one side only", () => {
        const d = diffObserved("s", obs([el({ attrs: { role: "x" } })]), obs());
        expect(d).toEqual([{ path: "s :: .a[0].attrs.role", legacy: "x", svelte: undefined }]);
    });
    test("class lists are compared", () => {
        const d = diffObserved("s", obs([el({ classes: ["open"] })]), obs([el({ classes: [] })]));
        expect(d).toHaveLength(1);
        expect(d[0].path).toBe("s :: .a[0].classes");
    });
    test("box numbers use a tolerance of 1px by default", () => {
        expect(diffObserved("s", obs([el({ box: { x: 0, y: 0, w: 100, h: 40 } })]), obs([el({ box: { x: 1, y: 0, w: 101, h: 39 } })]))).toEqual([]);
        const d = diffObserved("s", obs([el({ box: { x: 0, y: 0, w: 100, h: 40 } })]), obs([el({ box: { x: 0, y: 0, w: 103, h: 40 } })]));
        expect(d).toEqual([{ path: "s :: .a[0].box.w", legacy: 100, svelte: 103 }]);
    });
    test("tolerance can be tightened or widened", () => {
        const a = obs([el({ box: { x: 0, y: 0, w: 100, h: 40 } })]), b = obs([el({ box: { x: 0, y: 0, w: 103, h: 40 } })]);
        expect(diffObserved("s", a, b, { tolerance: 3 })).toEqual([]);
        expect(diffObserved("s", a, b, { tolerance: 0 })).toHaveLength(1);
    });
    test("scroll has a 2px tolerance by default", () => {
        expect(diffObserved("s", obs(), obs(undefined, { scroll: { x: 0, y: 2 } }))).toEqual([]);
        expect(diffObserved("s", obs(), obs(undefined, { scroll: { x: 0, y: 3 } }))).toEqual([{ path: "s :: scroll.y", legacy: 0, svelte: 3 }]);
    });
    test("scrollTolerance can be set", () => {
        expect(diffObserved("s", obs(), obs(undefined, { scroll: { x: 0, y: 1 } }), { scrollTolerance: 0 })).toHaveLength(1);
        expect(diffObserved("s", obs(), obs(undefined, { scroll: { x: 0, y: 50 } }), { scrollTolerance: 50 })).toEqual([]);
    });
    test("focus differences", () => expect(diffObserved("s", obs(), obs(undefined, { focus: "a.nq-brand" }))).toEqual([{ path: "s :: focus", legacy: "body", svelte: "a.nq-brand" }]));
    test("a different match count is reported once, not once per item", () => {
        const d = diffObserved("s", obs([el(), el()]), obs([el()]));
        expect(d).toEqual([{ path: "s :: .a.count", legacy: 2, svelte: 1 }]);
    });
    test("a selector missing on one side", () => {
        const b = obs();
        delete (b.elements as Record<string, unknown>)[".a"];
        expect(diffObserved("s", obs(), b)).toEqual([{ path: "s :: .a", legacy: "1 found", svelte: undefined }]);
    });
    test("evals, storage, requests and console are compared", () => {
        const a = obs(undefined, { evals: { n: 1 }, storage: { local: { k: "1" }, session: {} }, requests: ["/a"], console: [] });
        const b = obs(undefined, { evals: { n: 2 }, storage: { local: { k: null }, session: {} }, requests: ["/a", "/b"], console: ["error: x"] });
        const paths = diffObserved("s", a, b).map((d) => d.path);
        expect(paths).toEqual(["s :: storage.local.k", "s :: evals.n", "s :: requests", "s :: console"]);
    });
    test("a missing optional section on both sides is not a diff", () => expect(diffObserved("s", obs(), obs())).toEqual([]));
    test("text differences", () => expect(diffObserved("s", obs([el({ text: "a" })]), obs([el({ text: "b" })]))[0].path).toBe("s :: .a[0].text"));
    test("visibility differences", () => expect(diffObserved("s", obs([el({ visible: true })]), obs([el({ visible: false })]))[0].path).toBe("s :: .a[0].visible"));
    test("box null vs a box", () => {
        const d = diffObserved("s", obs([el({ box: null })]), obs([el()]));
        expect(d).toHaveLength(1);
        expect(d[0].path).toBe("s :: .a[0].box");
    });
});

describe("diffTraces", () => {
    const t = (...names: string[]): Trace => names.map((name) => ({ name, observed: obs() }));
    test("equal traces", () => expect(diffTraces(t("load", "a"), t("load", "a"))).toEqual([]));
    test("a step that ran on one side only", () => {
        expect(diffTraces(t("load", "a"), t("load"))).toEqual([{ path: "a :: step", legacy: "ran", svelte: "did not run" }]);
        expect(diffTraces(t("load"), t("load", "a"))).toEqual([{ path: "a :: step", legacy: "did not run", svelte: "ran" }]);
    });
    test("different step names at the same position", () => expect(diffTraces(t("load", "a"), t("load", "b"))[0].path).toBe("step 2 :: name"));
    test("an error on one side is a diff and its snapshot is not compared", () => {
        const a: Trace = [{ name: "load", observed: obs() }, { name: "x", error: "boom" }];
        const b: Trace = [{ name: "load", observed: obs() }, { name: "x", observed: obs([el({ text: "different" })]) }];
        expect(diffTraces(a, b)).toEqual([{ path: "x :: error", legacy: "boom", svelte: undefined }]);
    });
    test("the same error on both sides is not a diff (the runner reports it as an error)", () => {
        const a: Trace = [{ name: "x", error: "boom" }];
        expect(diffTraces(a, [{ name: "x", error: "boom" }])).toEqual([]);
    });
    test("tolerance is passed through", () => {
        const a: Trace = [{ name: "load", observed: obs([el({ box: { x: 0, y: 0, w: 100, h: 40 } })]) }];
        const b: Trace = [{ name: "load", observed: obs([el({ box: { x: 0, y: 0, w: 105, h: 40 } })]) }];
        expect(diffTraces(a, b)).toHaveLength(1);
        expect(diffTraces(a, b, { tolerance: 5 })).toEqual([]);
    });
    test("the step duration is not compared", () => {
        const a: Trace = [{ name: "load", observed: obs(), ms: 10 }], b: Trace = [{ name: "load", observed: obs(), ms: 9000 }];
        expect(diffTraces(a, b)).toEqual([]);
    });
});

describe("allowlist", () => {
    const diffs = [
        { path: "click :: .a[0].attrs.x", legacy: 1, svelte: 2 },
        { path: "hover :: .a[0].box.w", legacy: 1, svelte: 5 },
        { path: "hover :: .b[0].text", legacy: "a", svelte: "b" },
    ];
    test("globToRegExp: * matches any run, the rest is literal", () => {
        expect(globToRegExp("a :: *.box.*").test("a :: .x[0].box.w")).toBe(true);
        expect(globToRegExp("a.b").test("aXb")).toBe(false);
        expect(globToRegExp("a [0]").test("a [0]")).toBe(true);
        expect(globToRegExp("*").test("anything at all")).toBe(true);
        expect(globToRegExp("exact").test("not exact")).toBe(false);
    });
    test("applyAllow splits remaining and allowed and reports unused entries", () => {
        const r = applyAllow(diffs, [
            { path: "hover :: *.box.*", reason: "the Svelte nav is 2px narrower (known)" },
            { path: "never :: *", reason: "a stale entry that matches nothing" },
        ]);
        expect(r.allowed.map((a) => a.diff.path)).toEqual(["hover :: .a[0].box.w"]);
        expect(r.remaining.map((d) => d.path)).toEqual(["click :: .a[0].attrs.x", "hover :: .b[0].text"]);
        expect(r.unused.map((u) => u.path)).toEqual(["never :: *"]);
    });
    test("the first matching entry takes the diff", () => {
        const r = applyAllow(diffs, [{ path: "*", reason: "everything, on purpose" }, { path: "hover :: *", reason: "shadowed by the first entry" }]);
        expect(r.remaining).toEqual([]);
        expect(r.unused.map((u) => u.path)).toEqual(["hover :: *"]);
    });
    test("an entry without a reason is rejected", () => {
        expect(() => validateAllow([{ path: "x", reason: "" }])).toThrow(/needs a reason/);
        expect(() => validateAllow([{ path: "x", reason: "short" }])).toThrow(/needs a reason/);
        expect(() => applyAllow(diffs, [{ path: "x", reason: " " }])).toThrow(/needs a reason/);
    });
    test("an entry without a path is rejected", () => expect(() => validateAllow([{ path: " ", reason: "a fine long reason" }])).toThrow(/no path/));
    test("no allowlist: everything remains", () => expect(applyAllow(diffs).remaining).toHaveLength(3));
});

describe("reports", () => {
    const base: ScenarioReport = { name: "nav", steps: 3, diffs: [], allowed: [], unused: [], errors: [] };
    test("ok when no diffs and no errors", () => {
        expect(reportOk(base)).toBe(true);
        expect(formatReport(base)).toBe("nav: ok (3 steps, 0 allowed differences)");
    });
    test("errors fail the scenario even without diffs", () => expect(reportOk({ ...base, errors: ["legacy, step x: boom"] })).toBe(false));
    test("formatDiff shows both sides and the set difference of arrays", () => {
        const s = formatDiff({ path: "s :: .a[0].classes", legacy: ["a", "b"], svelte: ["b", "c"] });
        expect(s).toContain("- legacy: [\"a\",\"b\"]");
        expect(s).toContain("+ svelte: [\"b\",\"c\"]");
        expect(s).toContain("only legacy: \"a\"");
        expect(s).toContain("only svelte: \"c\"");
    });
    test("an absent value prints as (absent)", () => expect(formatDiff({ path: "p", legacy: undefined, svelte: 1 })).toContain("- legacy: (absent)"));
    test("a failing report lists errors, differences, allowed reasons and unused entries", () => {
        const text = formatReport({
            ...base,
            diffs: [{ path: "s :: focus", legacy: "a", svelte: "b" }],
            errors: ["svelte, step s: boom"],
            allowed: [{ diff: { path: "t :: x", legacy: 1, svelte: 2 }, entry: { path: "t :: *", reason: "known and tracked" } }],
            unused: [{ path: "u :: *", reason: "stale entry here" }],
        });
        expect(text).toContain("nav: FAIL");
        expect(text).toContain("svelte, step s: boom");
        expect(text).toContain("1 difference (- legacy, + svelte):");
        expect(text).toContain("t :: *: known and tracked (1)");
        expect(text).toContain("u :: *");
    });
});
