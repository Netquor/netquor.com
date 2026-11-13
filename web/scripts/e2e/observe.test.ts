import { describe, expect, test } from "bun:test";
import { COLLAPSE_HOSTS, isExternal, normaliseAttrs, normaliseClasses, normaliseCssValue, normaliseObserved, normaliseRequestUrl, normaliseText, roundBox, stripVersion, type RawObserved } from "./observe";

describe("normaliseText", () => {
    test("collapses whitespace and trims", () => expect(normaliseText("  Hello \n\t  world  ")).toBe("Hello world"));
    test("cuts long text with an ellipsis", () => expect(normaliseText("abcdefghij", 5)).toBe("abcde..."));
    test("leaves short text alone", () => expect(normaliseText("abc", 5)).toBe("abc"));
    test("empty stays empty", () => expect(normaliseText("   ")).toBe(""));
});

describe("normaliseCssValue", () => {
    test("rounds float noise", () => expect(normaliseCssValue("matrix(1, 0, 0, 1, 0, 0.0000001)")).toBe("matrix(1, 0, 0, 1, 0, 0)"));
    test("keeps two decimals", () => expect(normaliseCssValue("matrix(0.0553978, 0, 0, 1, 0, 0)")).toBe("matrix(0.06, 0, 0, 1, 0, 0)"));
    test("negative zero becomes 0", () => expect(normaliseCssValue("-0.0001px")).toBe("0px"));
    test("collapses spaces", () => expect(normaliseCssValue("a   b")).toBe("a b"));
    test("integers are untouched", () => expect(normaliseCssValue("12px 3px")).toBe("12px 3px"));
});

describe("stripVersion", () => {
    test("drops ?v=", () => expect(stripVersion("/nq.css?v=ab12cd34")).toBe("/nq.css"));
    test("keeps other query parameters", () => {
        expect(stripVersion("/a.js?x=1&v=2")).toBe("/a.js?x=1");
        expect(stripVersion("/a.js?v=2&x=1")).toBe("/a.js?x=1");
    });
    test("no version, no change", () => expect(stripVersion("/a.js")).toBe("/a.js"));
    test("keeps a hash", () => expect(stripVersion("/a.js?v=1#top")).toBe("/a.js#top"));
});

describe("normaliseClasses", () => {
    test("sorts, dedupes and drops svelte hash classes", () => expect(normaliseClasses(["b", "svelte-abc123", "a", "b"])).toEqual(["a", "b"]));
    test("a list keeps only the named classes", () => expect(normaliseClasses(["open", "nq-dd", "x"], ["open", "x"])).toEqual(["open", "x"]));
    test("a trailing * is a prefix", () => expect(normaliseClasses(["nq-a", "nq-b", "c"], ["nq-*"])).toEqual(["nq-a", "nq-b"]));
    test("false keeps none", () => expect(normaliseClasses(["a"], false)).toEqual([]));
    test("a class that only looks like a hash is kept", () => expect(normaliseClasses(["svelte-icon-set", "svelte-"])).toEqual(["svelte-", "svelte-icon-set"]));
    test("empty names are dropped", () => expect(normaliseClasses(["", "a"])).toEqual(["a"]));
});

describe("normaliseAttrs", () => {
    test("sorts keys, collapses whitespace, strips ?v= from urls", () => {
        expect(normaliseAttrs({ href: "/nq.css?v=1", "aria-label": "  A   B " })).toEqual({ "aria-label": "A B", href: "/nq.css" });
    });
    test("drops svelte data attributes", () => expect(normaliseAttrs({ "data-svelte-h": "x", "data-sveltekit-reload": "", id: "a" })).toEqual({ id: "a" }));
    test("a non-url attribute keeps its ?v=", () => expect(normaliseAttrs({ title: "a?v=1" })).toEqual({ title: "a?v=1" }));
});

describe("roundBox", () => {
    test("rounds to integers", () => expect(roundBox({ x: 1.4, y: 2.6, width: 100.5, height: 36.49 })).toEqual({ x: 1, y: 3, w: 101, h: 36 }));
    test("a box without area is null", () => expect(roundBox({ x: 5, y: 5, width: 0, height: 0 })).toBeNull());
    test("null stays null", () => expect(roundBox(null)).toBeNull());
    test("a zero-height but wide box (a hairline) is kept", () => expect(roundBox({ x: 0, y: 0, width: 10, height: 0 })).toEqual({ x: 0, y: 0, w: 10, h: 0 }));
});

describe("request urls", () => {
    const own = ["http://127.0.0.1:4000"];
    test("own origin: path with the version stripped", () => expect(normaliseRequestUrl("http://127.0.0.1:4000/nq.css?v=ab12", own)).toBe("/nq.css"));
    test("own origin keeps other query parameters", () => expect(normaliseRequestUrl("http://127.0.0.1:4000/x?a=1&v=2", own)).toBe("/x?a=1"));
    test("other origin: origin and path, no query", () => expect(normaliseRequestUrl("https://www.googletagmanager.com/gtag/js?id=G-1", own)).toBe("https://www.googletagmanager.com/gtag/js"));
    test("web font subsets collapse to one entry", () => {
        expect(normaliseRequestUrl("https://fonts.gstatic.com/s/ibmplexsans/v23/a.woff2", own)).toBe("https://fonts.gstatic.com/*");
        expect(COLLAPSE_HOSTS.has("fonts.gstatic.com")).toBe(true);
    });
    test("data urls", () => expect(normaliseRequestUrl("data:image/png;base64,AAAA", own)).toBe("data:"));
    test("garbage is cut, not thrown", () => expect(normaliseRequestUrl("not a url".repeat(20), own).length).toBeLessThanOrEqual(80));
    test("isExternal", () => {
        expect(isExternal("https://cdn.jsdelivr.net/x.js", own)).toBe(true);
        expect(isExternal("http://127.0.0.1:4000/x.js", own)).toBe(false);
        expect(isExternal("data:text/plain,hi", own)).toBe(false);
        expect(isExternal("about:blank", own)).toBe(false);
        expect(isExternal("blob:http://127.0.0.1:4000/1", own)).toBe(false);
        expect(isExternal("nonsense", own)).toBe(false);
    });
});

describe("normaliseObserved", () => {
    const raw: RawObserved = {
        scroll: { x: 0.2, y: 99.6 },
        focus: "button.nq-link",
        elements: {
            ".a": { count: 2, items: [{ tag: "LI", attrs: { "aria-expanded": "true", href: "/x?v=9" }, classes: ["svelte-q1", "open", "a"], box: { x: 1.2, y: 3.5, width: 10.4, height: 20.5 }, computed: { opacity: "0.5000001", display: "block" }, text: "  hi \n there ", visible: true }] },
            ".none": { count: 0, items: [] },
        },
    };
    test("normalises every part", () => {
        const o = normaliseObserved(raw, {});
        expect(o.scroll).toEqual({ x: 0, y: 100 });
        expect(o.focus).toBe("button.nq-link");
        expect(o.elements[".a"].count).toBe(2);
        expect(o.elements[".a"].items[0]).toEqual({ tag: "li", attrs: { "aria-expanded": "true", href: "/x" }, classes: ["a", "open"], box: { x: 1, y: 4, w: 10, h: 21 }, computed: { display: "block", opacity: "0.5" }, text: "hi there", visible: true });
        expect(o.elements[".none"]).toEqual({ count: 0, items: [] });
    });
    test("box false drops boxes, text false drops text, classes filter", () => {
        const e = normaliseObserved(raw, { box: false, text: false, classes: ["open"] }).elements[".a"].items[0];
        expect(e.box).toBeNull();
        expect(e.text).toBe("");
        expect(e.classes).toEqual(["open"]);
    });
    test("computed keys come out sorted", () => expect(Object.keys(normaliseObserved(raw, {}).elements[".a"].items[0].computed)).toEqual(["display", "opacity"]));
    test("textMax is honoured", () => expect(normaliseObserved(raw, { textMax: 4 }).elements[".a"].items[0].text).toBe("hi t..."));
});
