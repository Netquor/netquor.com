import { describe, expect, test } from "bun:test";
import { cssBlocks, cssImports, normalizeBlock, stripComments } from "./cssBlocks";

describe("cssBlocks", () => {
    test("strips comments and collapses layout, so differently formatted equal CSS is equal", () => {
        expect(cssBlocks("/* c */ a { b: c; }\n\n@media (x) { d { e: f } }")).toEqual(cssBlocks("a{b:c}@media (x){d{e:f}}"));
        expect(cssBlocks("a { b: c; }")).toEqual(["a{b:c}"]);
    });
    test("keeps a nested block whole and in order, and finds @import statements", () => {
        const css = `@import "./a.css"; @media (max-width: 1px) { a { b: c } d { e: f } } @keyframes k { from { x: 1 } to { x: 2 } } g { h: i }`;
        expect(cssBlocks(css)).toEqual(['@import "./a.css";', "@media (max-width:1px){a{b:c}d{e:f}}", "@keyframes k{from{x:1}to{x:2}}", "g{h:i}"]);
    });
    test("different declarations or a different order are different", () => {
        expect(cssBlocks("a{b:c}d{e:f}")).not.toEqual(cssBlocks("d{e:f}a{b:c}"));
        expect(cssBlocks("a{b:c}")).not.toEqual(cssBlocks("a{b:d}"));
    });
    test("helpers", () => {
        expect(stripComments("a/* x */b")).toBe("ab");
        expect(normalizeBlock(" a , b {  c : d ;  } ")).toBe("a,b{c:d}");
        expect(cssImports('/* @import "no.css"; */ @import "./a.css"; @import url("b.css");')).toEqual(["./a.css", "b.css"]);
    });
});
