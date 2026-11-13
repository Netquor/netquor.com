import { describe, expect, test } from "bun:test";
import { formatObserved, formatTrace } from "./trace";
import type { Observed } from "./observe";

const o: Observed = {
    scroll: { x: 0, y: 12 },
    focus: "button.nq-link",
    elements: {
        ".a": { count: 4, items: [{ tag: "li", attrs: { "aria-expanded": "true" }, classes: ["open"], box: { x: 1, y: 2, w: 3, h: 4 }, computed: { display: "block" }, text: "Products", visible: true }] },
        ".none": { count: 0, items: [] },
        ".h": { count: 1, items: [{ tag: "div", attrs: {}, classes: [], box: null, computed: {}, text: "", visible: false }] },
    },
    storage: { local: { k: "1" }, session: {} },
    evals: { n: 1 },
    requests: ["/a", "/b"],
    console: ["error: x"],
};

describe("formatObserved", () => {
    const text = formatObserved(o).join("\n");
    test("scroll and focus", () => expect(text).toContain("scroll 0,12  focus button.nq-link"));
    test("an element line carries tag, classes, attrs, computed, box and text", () => expect(text).toContain('.a[0] <li> .open aria-expanded="true" {display:block} @1,2 3x4 "Products"'));
    test("a selector that matched nothing", () => expect(text).toContain(".none: none"));
    test("a hidden element without a box", () => expect(text).toContain(".h[0] <div> no-box hidden"));
    test("a truncated list says so", () => expect(text).toContain(".a: 4 in all, 1 shown"));
    test("storage, evals, requests and console", () => {
        expect(text).toContain('storage {"local":{"k":"1"},"session":{}}');
        expect(text).toContain('evals {"n":1}');
        expect(text).toContain("requests /a /b");
        expect(text).toContain('console ["error: x"]');
    });
});

describe("formatTrace", () => {
    test("numbers the steps, shows timing and errors", () => {
        const t = formatTrace([{ name: "load", observed: o, ms: 12 }, { name: "boom", error: "no element" }]);
        expect(t).toContain("0. load  (12 ms)");
        expect(t).toContain("1. boom  ERROR no element");
    });
});
