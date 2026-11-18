import { describe, expect, test } from "bun:test";
import { emptySide, formatReport, grand, inlineParts, kindOfType, originOf, summarize, totals, weigh, type Loaded } from "./payloadReport";

const OWN = "http://127.0.0.1:4000";
const b = (raw: number, gzip: number) => ({ raw, gzip });

describe("originOf", () => {
    test("own, analytics, third and none", () => {
        expect(originOf(`${OWN}/a.js`, OWN)).toBe("own");
        expect(originOf("https://www.googletagmanager.com/gtag/js?id=G-X", OWN)).toBe("analytics");
        expect(originOf("https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js", OWN)).toBe("third");
        expect(originOf("data:text/css;base64,AA", OWN)).toBe("none");
        expect(originOf("not a url", OWN)).toBe("none");
    });
    test("a host that only contains an analytics name is not analytics", () => expect(originOf("https://googletagmanager.com.evil.test/x.js", OWN)).toBe("third"));
});

test("kindOfType maps Chrome resource types", () => {
    expect([kindOfType("Script"), kindOfType("Stylesheet"), kindOfType("Font"), kindOfType("Image")]).toEqual(["js", "css", null, null]);
});

test("weigh gives raw and gzip lengths", () => {
    const w = weigh(new TextEncoder().encode("a".repeat(1000)));
    expect(w.raw).toBe(1000);
    expect(w.gzip).toBeLessThan(100);
});

describe("inlineParts", () => {
    test("counts inline scripts and styles, not JSON-LD, external scripts or importmaps", () => {
        const html = `<style>a{}</style><script>var x=1</script><script src="/a.js"></script><script type="application/ld+json">{"a":1}</script><script type="importmap">{}</script><style media="x">b{}</style>`;
        expect(inlineParts(html)).toEqual({ js: "var x=1", css: "a{}\nb{}" });
    });
});

describe("summarize", () => {
    const loaded: Loaded[] = [
        { url: `${OWN}/_app/a.js`, type: "Script", status: 200, bytes: b(1000, 400) },
        { url: `${OWN}/_app/a.js`, type: "Script", status: 200, bytes: b(1000, 400) },
        { url: "https://cdn.test/b.js", type: "Script", status: 200, bytes: b(5000, 2000) },
        { url: `${OWN}/a.css`, type: "Stylesheet", status: 200, bytes: b(3000, 900) },
        { url: `${OWN}/missing.css`, type: "Stylesheet", status: 404, bytes: null },
        { url: "https://cdn.test/slow.css", type: "Stylesheet", bytes: null },
        { url: "https://www.googletagmanager.com/gtag/js", type: "Script", status: 200, bytes: null },
        { url: `${OWN}/f.woff2`, type: "Font", status: 200, bytes: b(9, 9) },
    ];
    const s = summarize(loaded, "<script>abc</script><style>p{}</style>", OWN);
    test("splits first and third party, dedupes, ignores fonts", () => {
        expect(s.js.first).toEqual({ files: 1, raw: 1000, gzip: 400 });
        expect(s.js.third).toEqual({ files: 1, raw: 5000, gzip: 2000 });
        expect(s.css.first).toEqual({ files: 1, raw: 3000, gzip: 900 });
    });
    test("analytics is counted apart, a 404 is failed, an unweighed fetch is listed and not counted as zero bytes", () => {
        expect(s.analytics).toBe(1);
        expect(s.failed).toEqual(["/missing.css"]);
        expect(s.unweighed).toEqual(["https://cdn.test/slow.css"]);
        expect(s.css.third.files).toBe(1);
        expect(s.css.third.raw).toBe(0);
    });
    test("inline script and style are counted", () => {
        expect(s.js.inline.files).toBe(1);
        expect(s.css.inline.files).toBe(1);
        expect(totals(s, "js").files).toBe(2);
        expect(totals(s, "js").raw).toBe(1000 + 5000 + 3);
    });
});

describe("formatReport and grand", () => {
    const side = summarize([{ url: `${OWN}/a.js`, type: "Script", status: 200, bytes: b(2048, 1024) }, { url: "https://cdn.test/x.css", type: "Stylesheet", status: 200, bytes: b(4096, 2048) }], "", OWN);
    const rows = [{ page: "/vpn.html", legacy: side, svelte: emptySide() }, { page: "/story.html", legacy: null, svelte: side }];
    test("one line per page and side, with a no-legacy marker", () => {
        const out = formatReport(rows).split("\n");
        expect(out[0]).toContain("js files 1p+3p");
        expect(out[1]).toBe("/vpn.html | legacy | 1+0 | 1.0 | 0+1 | 2.0 | 1 | 0");
        expect(out[2]).toBe("/vpn.html | svelte | 0+0 | 0.0 | 0+0 | 0.0 | 0 | 0");
        expect(out[3]).toContain("no legacy page");
    });
    test("grand sums a side across pages", () => {
        expect(grand(rows, "legacy")).toEqual({ js: { files: 1, raw: 2048, gzip: 1024 }, css: { files: 1, raw: 4096, gzip: 2048 }, third: 1 });
        expect(grand(rows, "svelte").js.files).toBe(1);
    });
});
