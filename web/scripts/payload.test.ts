import { describe, expect, test } from "bun:test";
import { formatRow, inlineStyles, thirdParty, weigh } from "./payload";

describe("payload", () => {
    test("weigh gives the raw and the gzip length", () => {
        const body = new TextEncoder().encode("a{b:c}".repeat(500));
        const w = weigh("/x.css", "Stylesheet", body);
        expect(w.raw).toBe(3000);
        expect(w.gzip).toBeLessThan(100);
        expect(w.url).toBe("/x.css");
    });
    test("inlineStyles joins every <style> block and ignores the rest", () => {
        expect(inlineStyles(`<p>x</p><style>a{b:c}</style><style media="print">d{e:f}</style><script>var s="<p>"</script>`)).toBe("a{b:c}\nd{e:f}");
        expect(inlineStyles("<p>no styles</p>")).toBe("");
    });
    test("thirdParty splits analytics from everything else and ignores the own origin, data: and blob:", () => {
        const own = "http://127.0.0.1:4000";
        const r = thirdParty([`${own}/a.css`, "data:image/png;base64,AA", "blob:http://x/1", "https://www.googletagmanager.com/gtag/js?id=G-1", "https://www.google-analytics.com/g/collect?v=2", "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css", "https://fonts.gstatic.com/s/x.woff2"], own);
        expect(r.analytics).toEqual(["https://www.google-analytics.com/g/collect", "https://www.googletagmanager.com/gtag/js"]);
        expect(r.other).toEqual(["https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css", "https://fonts.gstatic.com/s/x.woff2"]);
    });
    test("a look-alike host is not analytics", () => {
        expect(thirdParty(["https://googletagmanager.com.evil.test/x.js"], "http://own").other).toEqual(["https://googletagmanager.com.evil.test/x.js"]);
    });
    test("formatRow totals the sheets (inline style included) and counts third parties", () => {
        const w = (url: string, raw: number, gzip: number) => ({ url, type: "Stylesheet", raw, gzip });
        const out = formatRow({ path: "/", css: [w("/a.css", 2048, 512)], fonts: [w("/f.woff2", 1024, 1000)], inlineCss: w("(inline <style>)", 1024, 256), thirdParty: ["https://www.googletagmanager.com/gtag/js"], thirdPartyOther: [] });
        expect(out).toContain("css total       3.0 KB raw");
        expect(out).toContain("(2 sheets)");
        expect(out).toContain("fonts total     1.0 KB raw");
        expect(out).toContain("third-party: 0 non-analytics; 1 analytics");
    });
});
