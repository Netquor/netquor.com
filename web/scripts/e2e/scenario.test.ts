import { describe, expect, test } from "bun:test";
import { compareTraces, mergeObserve, stepNames, validateScenario, type Scenario, type SideRun } from "./scenario";
import type { Trace } from "./diff";
import type { Observed } from "./observe";
import { SCENARIOS, selectScenarios } from "./scenarios";

const base = (o: Partial<Scenario> = {}): Scenario => ({ name: "demo", legacyPath: "/x.html", observe: { selectors: [".a"] }, steps: [{ name: "one" }], ...o });

describe("mergeObserve", () => {
    test("selectors, attrs and computed are unioned without duplicates", () => {
        const m = mergeObserve({ selectors: [".a", ".b"], attrs: ["x"], computed: ["display"] }, { selectors: [".b", ".c"], attrs: ["y"], computed: ["opacity"] });
        expect(m.selectors).toEqual([".a", ".b", ".c"]);
        expect(m.attrs).toEqual(["x", "y"]);
        expect(m.computed).toEqual(["display", "opacity"]);
    });
    test("scalar settings of the step replace the scenario's", () => expect(mergeObserve({ box: true, classes: true }, { box: false }).box).toBe(false));
    test("undefined in the step does not erase the scenario's setting", () => expect(mergeObserve({ box: false }, { box: undefined }).box).toBe(false));
    test("evals and storage are merged", () => {
        const m = mergeObserve({ evals: { a: "1" }, storage: { local: ["k"] } }, { evals: { b: "2" }, storage: { local: ["k", "j"], session: ["s"] } });
        expect(m.evals).toEqual({ a: "1", b: "2" });
        expect(m.storage).toEqual({ local: ["k", "j"], session: ["s"] });
    });
    test("no step spec leaves the base", () => expect(mergeObserve({ selectors: [".a"] })).toEqual({ selectors: [".a"] }));
    test("a step can start from nothing", () => expect(mergeObserve({}, { selectors: [".z"] }).selectors).toEqual([".z"]));
});

describe("validateScenario", () => {
    test("accepts a good scenario", () => expect(() => validateScenario(base())).not.toThrow());
    test("step names must be unique", () => expect(() => validateScenario(base({ steps: [{ name: "a" }, { name: "a" }] }))).toThrow(/used twice/));
    test('"load" is reserved', () => expect(() => validateScenario(base({ steps: [{ name: "load" }] }))).toThrow(/reserved/));
    test("a step needs a name", () => expect(() => validateScenario(base({ steps: [{ name: " " }] }))).toThrow(/no name/));
    test("names are lower-case words with hyphens", () => {
        expect(() => validateScenario(base({ name: "Bad Name" }))).toThrow(/lower-case/);
        expect(() => validateScenario(base({ name: "" }))).toThrow(/lower-case/);
    });
    test("legacyPath starts with a slash", () => expect(() => validateScenario(base({ legacyPath: "x.html" }))).toThrow(/legacyPath/));
    test("a bad allowlist entry is caught before any browser starts", () => expect(() => validateScenario(base({ allow: [{ path: "x", reason: "" }] }))).toThrow(/needs a reason/));
    test("stepNames starts with load", () => expect(stepNames(base({ steps: [{ name: "a" }, { name: "b" }] }))).toEqual(["load", "a", "b"]));
});

const o = (text = "a"): Observed => ({ scroll: { x: 0, y: 0 }, focus: "body", elements: { ".a": { count: 1, items: [{ tag: "p", attrs: {}, classes: [], box: null, computed: {}, text, visible: true }] } } });
const run = (text: string, errors: string[] = []): SideRun => { const trace: Trace = [{ name: "load", observed: o(text) }]; return { trace, errors }; };

describe("compareTraces", () => {
    test("equal runs pass", () => {
        const r = compareTraces({ name: "demo" }, run("a"), run("a"));
        expect(r.ok).toBe(true);
        expect(r.text).toBe("demo: ok (1 steps, 0 allowed differences)");
    });
    test("a difference fails and is printed", () => {
        const r = compareTraces({ name: "demo" }, run("a"), run("b"));
        expect(r.ok).toBe(false);
        expect(r.text).toContain("load :: .a[0].text");
    });
    test("an allowlisted difference passes and is counted", () => {
        const r = compareTraces({ name: "demo", allow: [{ path: "load :: .a[0].text", reason: "the copy changed on purpose" }] }, run("a"), run("b"));
        expect(r.ok).toBe(true);
        expect(r.report.allowed).toHaveLength(1);
    });
    test("errors fail even when the traces are equal", () => {
        const r = compareTraces({ name: "demo" }, run("a", ["legacy, step x: expectation failed: nope"]), run("a"));
        expect(r.ok).toBe(false);
        expect(r.text).toContain("expectation failed: nope");
    });
    test("an unused allow entry is a note, not a failure", () => {
        const r = compareTraces({ name: "demo", allow: [{ path: "gone :: *", reason: "was needed once, fixed since" }] }, run("a"), run("a"));
        expect(r.ok).toBe(true);
        expect(r.text).toContain("gone :: *");
    });
});

describe("the registered scenarios", () => {
    test("there are scenarios for every legacy behaviour in the brief", () => {
        const names = SCENARIOS.map((s) => s.name);
        for (const prefix of ["nav", "fx", "bg", "nudge", "analytics", "readiness", "collapse", "subnet", "fleet"]) expect(names.some((n) => n === prefix || n.startsWith(`${prefix}-`))).toBe(true);
    });
    test("names are unique", () => {
        const names = SCENARIOS.map((s) => s.name);
        expect(new Set(names).size).toBe(names.length);
    });
    test("every scenario validates, observes something and has steps", () => {
        for (const s of SCENARIOS) {
            expect(() => validateScenario(s)).not.toThrow();
            expect(s.steps.length).toBeGreaterThan(0);
            expect((s.observe.selectors?.length ?? 0) + Object.keys(s.observe.evals ?? {}).length).toBeGreaterThan(0);
        }
    });
    test("every allowlist entry carries a reason", () => {
        for (const s of SCENARIOS) for (const a of s.allow ?? []) expect(a.reason.trim().length).toBeGreaterThanOrEqual(8);
    });
    test("every legacy path is a page of the site", () => {
        for (const s of SCENARIOS) expect(s.legacyPath === "/" || /^\/[a-z-]+\.html$/.test(s.legacyPath)).toBe(true);
    });
    test("selectScenarios takes a name or a prefix", () => {
        expect(selectScenarios(["nav"]).every((s) => s.name.startsWith("nav-"))).toBe(true);
        expect(selectScenarios(["nav"]).length).toBeGreaterThan(1);
        expect(selectScenarios(["nav-mobile"]).map((s) => s.name)).toEqual(["nav-mobile"]);
        expect(selectScenarios(["nope"])).toEqual([]);
    });
    test("a prefix does not match a longer word (nav is not navigation)", () => {
        const fake = [base({ name: "navigation" }), base({ name: "nav-x" }), base({ name: "nav" })];
        expect(selectScenarios(["nav"], fake).map((s) => s.name)).toEqual(["nav-x", "nav"]);
    });
});
