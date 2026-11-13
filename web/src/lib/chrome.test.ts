import { describe, expect, test } from "bun:test";
import { resolveChrome } from "./chrome";

describe("resolveChrome", () => {
    test("defaults: nav on, current is the page's own path, simple footer, not static", () => {
        expect(resolveChrome(undefined, "/subnet-calculator.html")).toEqual({ nav: true, navCurrent: "/subnet-calculator.html", navStatic: false, footer: "simple" });
    });
    test("/index.html counts as the home page", () => {
        expect(resolveChrome({}, "/index.html").navCurrent).toBe("/");
    });
    test("a page can override each choice", () => {
        expect(resolveChrome({ nav: false, navCurrent: "/fleet.html", navStatic: true, footer: "full" }, "/x.html")).toEqual({ nav: false, navCurrent: "/fleet.html", navStatic: true, footer: "full" });
        expect(resolveChrome({ footer: "none" }, "/x.html").footer).toBe("none");
    });
    test("an unknown footer value falls back to simple", () => {
        expect(resolveChrome({ footer: "huge" as never }, "/x.html").footer).toBe("simple");
    });
});
