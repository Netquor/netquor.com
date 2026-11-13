import { describe, expect, test } from "bun:test";
import { reduceNav, touches, type NavEvent, type NavState } from "./navState";

const S = (dd: boolean, menu: boolean): NavState => ({ dd, menu });

describe("reduceNav", () => {
    test("burger toggles the menu only", () => {
        expect(reduceNav(S(true, false), { type: "burger-click" }, true)).toEqual(S(true, true));
        expect(reduceNav(S(false, true), { type: "burger-click" }, false)).toEqual(S(false, false));
    });
    test("Products click: desktop always opens, mobile toggles", () => {
        expect(reduceNav(S(true, false), { type: "dd-click" }, true)).toEqual(S(true, false));
        expect(reduceNav(S(false, false), { type: "dd-click" }, true)).toEqual(S(true, false));
        expect(reduceNav(S(false, false), { type: "dd-click" }, false)).toEqual(S(true, false));
        expect(reduceNav(S(true, false), { type: "dd-click" }, false)).toEqual(S(false, false));
    });
    test("hover enter and leave act on desktop only", () => {
        expect(reduceNav(S(false, false), { type: "dd-enter" }, true).dd).toBe(true);
        expect(reduceNav(S(true, false), { type: "dd-leave" }, true).dd).toBe(false);
        expect(reduceNav(S(false, false), { type: "dd-enter" }, false).dd).toBe(false);
        expect(reduceNav(S(true, false), { type: "dd-leave" }, false).dd).toBe(true);
    });
    test("document click outside Products closes Products and never the menu", () => {
        expect(reduceNav(S(true, true), { type: "doc-click", insideDd: false }, true)).toEqual(S(false, true));
        expect(reduceNav(S(true, true), { type: "doc-click", insideDd: true }, true)).toEqual(S(true, true));
    });
    test("Escape closes both, wherever it is on both viewports", () => {
        for (const desktop of [true, false]) expect(reduceNav(S(true, true), { type: "escape" }, desktop)).toEqual(S(false, false));
    });
    test("a click on a link closes both, other nav clicks do nothing", () => {
        expect(reduceNav(S(true, true), { type: "nav-click", onLink: true }, true)).toEqual(S(false, false));
        expect(reduceNav(S(true, true), { type: "nav-click", onLink: false }, true)).toEqual(S(true, true));
    });
    test("the input state is not mutated", () => {
        const s = S(true, true);
        reduceNav(s, { type: "escape" }, true);
        expect(s).toEqual(S(true, true));
    });
});

describe("touches", () => {
    const cases: [NavEvent, { dd: boolean; menu: boolean }][] = [
        [{ type: "burger-click" }, { dd: false, menu: true }],
        [{ type: "dd-click" }, { dd: true, menu: false }],
        [{ type: "doc-click", insideDd: true }, { dd: true, menu: false }],
        [{ type: "escape" }, { dd: true, menu: true }],
        [{ type: "nav-click", onLink: true }, { dd: true, menu: true }],
        [{ type: "nav-click", onLink: false }, { dd: false, menu: false }],
    ];
    for (const [e, t] of cases) test(`${e.type}`, () => expect(touches(e)).toEqual(t));
});
