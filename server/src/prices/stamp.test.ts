// stamp.test.ts: the stamper: formats, escaping, errors, idempotence, JSON-LD, llms.txt, and the real site files with the real seed.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { serverRoot } from "./env";
import { StampError, decodeUtf8Strict, escapeHtml, formatPrice, hasPriceMarkers, locateJsonValue, renderLlms, stampHtml, stampHtmlBytes } from "./stamp";
import { validateSnapshot } from "./snapshot";
import { snap } from "./testkit";
import { baselineDirSync } from "../../../web/scripts/baseline/dir";
import { applyIntentionalLlms } from "../../../web/scripts/baseline/intentional";

const S = snap(1, { "fleet.mac.month": 595, "vpn.from.month": 500, "big.amount": 123456789 % 10_000_000, "zero.free": 0, "x.html": 100 });
const issuesOf = (fn: () => unknown) => { try { fn(); return []; } catch (e) { if (e instanceof StampError) return e.issues; throw e; } };

describe("formatPrice", () => {
    test("usd always has cents, usd0 drops them only when zero, int is the cents, plain has no symbol", () => {
        const p = (c: number) => ({ amountCents: c, currency: "USD" as const });
        expect(formatPrice(p(595), "usd")).toBe("$5.95");
        expect(formatPrice(p(500), "usd")).toBe("$5.00");
        expect(formatPrice(p(500), "usd0")).toBe("$5");
        expect(formatPrice(p(595), "usd0")).toBe("$5.95");
        expect(formatPrice(p(5), "usd")).toBe("$0.05");
        expect(formatPrice(p(0), "usd0")).toBe("$0");
        expect(formatPrice(p(595), "int")).toBe("595");
        expect(formatPrice(p(500), "plain")).toBe("5");
        expect(formatPrice(p(599), "plain")).toBe("5.99");
        expect(formatPrice(p(1_234_567), "usd")).toBe("$12,345.67");
        expect(formatPrice(p(10_000_000), "usd0")).toBe("$100,000");
    });
});

describe("stampHtml", () => {
    test("replaces the text of an element and leaves every other byte alone", () => {
        const html = '<!doctype html>\n<p class="a">Fleet <b data-price="fleet.mac.month">$1.00</b> per Mac &amp; more</p>\n';
        expect(stampHtml(html, S)).toBe('<!doctype html>\n<p class="a">Fleet <b data-price="fleet.mac.month">$5.95</b> per Mac &amp; more</p>\n');
    });

    test("data-fmt picks the format; the default is usd0", () => {
        const html = '<i data-price="vpn.from.month"></i><i data-price="vpn.from.month" data-fmt="usd"></i><i data-price="vpn.from.month" data-fmt="int"></i><i data-price="fleet.mac.month"></i>';
        expect(stampHtml(html, S)).toBe('<i data-price="vpn.from.month">$5</i><i data-price="vpn.from.month" data-fmt="usd">$5.00</i><i data-price="vpn.from.month" data-fmt="int">500</i><i data-price="fleet.mac.month">$5.95</i>');
    });

    test("output is HTML-escaped", () => {
        expect(escapeHtml(`<b a="1" b='2'>&`)).toBe("&lt;b a=&quot;1&quot; b=&#39;2&#39;&gt;&amp;");
        expect(stampHtml('<span data-price="x.html"></span>', S)).toBe('<span data-price="x.html">$1</span>');
    });

    test("a missing key is an error that names the file and the key, and nothing is returned", () => {
        const issues = issuesOf(() => stampHtml('<b data-price="nope.key">$1</b>', S, "index.html"));
        expect(issues).toEqual([{ file: "index.html", key: "nope.key", reason: "key is not in the snapshot" }]);
    });

    test("every problem is reported, not just the first", () => {
        const issues = issuesOf(() => stampHtml('<b data-price="a.x">1</b><b data-price="b.y">2</b><b data-price="fleet.mac.month" data-fmt="eur">3</b>', S, "p.html"));
        expect(issues.map((i) => i.key)).toEqual(["a.x", "b.y", "fleet.mac.month"]);
        expect(issues[2].reason).toContain("unknown format");
    });

    test("an element with child elements, an empty key, or no close is refused", () => {
        expect(issuesOf(() => stampHtml('<p data-price="fleet.mac.month">from <b>$5</b></p>', S))[0].reason).toContain("only text");
        expect(issuesOf(() => stampHtml('<p data-price="">$5</p>', S))[0].reason).toContain("empty");
        expect(issuesOf(() => stampHtml('<p data-price="fleet.mac.month">$5', S))[0].reason).toContain("only text");
        expect(issuesOf(() => stampHtml('<p data-price="fleet.mac.month"/>', S))).toHaveLength(1);
        expect(issuesOf(() => stampHtml('<script data-price="fleet.mac.month">x</script>', S))[0].reason).toContain("not allowed");
    });

    test("markers in comments, scripts and styles are not touched; '>' inside an attribute is fine", () => {
        const html = '<!-- <b data-price="nope.key">x</b> --><script>var s = \'<b data-price="nope.key">\';</script><style>/* data-price="nope.key" */</style><a title="a > b" data-price="fleet.mac.month">$0</a>';
        expect(stampHtml(html, S)).toBe(html.replace(">$0<", ">$5.95<"));
    });

    test("it is idempotent", () => {
        const html = '<b data-price="fleet.mac.month">$1</b> and <b data-price="vpn.from.month">x</b>';
        const once = stampHtml(html, S);
        expect(stampHtml(once, S)).toBe(once);
    });

    test("a page with no markers is returned unchanged", () => {
        const html = "<p>Price $5.95 &amp; <b>more</b></p><br/>\n";
        expect(stampHtml(html, S)).toBe(html);
    });
});

describe("JSON-LD", () => {
    const ld = (extra = "") => `<script type="application/ld+json" data-price-map='{"/offers/0/price":"fleet.mac.month","/offers/1/price":"vpn.from.month|int"${extra}}'>{"@type": "X", "offers": [{"price": "1", "priceCurrency": "USD"}, {"price": 2, "n": "a,b]", "ok": true}]}</script>`;

    test("values are replaced in place and keep their JSON type; the rest of the block is untouched", () => {
        expect(stampHtml(ld(), S)).toBe(ld().replace('"price": "1"', '"price": "5.95"').replace('"price": 2', '"price": 500'));
    });

    test("the result is still valid JSON", () => {
        const out = stampHtml(ld(), S);
        const json = out.slice(out.indexOf("}'>") + 3, out.lastIndexOf("</script>"));
        expect(JSON.parse(json).offers[0].price).toBe("5.95");
    });

    test("a pointer that does not exist, or a key not in the snapshot, is an error", () => {
        expect(issuesOf(() => stampHtml(ld(',"/offers/9/price":"fleet.mac.month"'), S, "i.html"))[0].reason).toContain("does not exist");
        expect(issuesOf(() => stampHtml(ld(',"/offers/1/ok":"vpn.from.month"'), S, "i.html"))[0].reason).toContain("not a string or a number");
        expect(issuesOf(() => stampHtml(ld().replace("fleet.mac.month", "gone.key"), S, "i.html"))).toEqual([{ file: "i.html", key: "gone.key", reason: "key is not in the snapshot" }]);
        expect(issuesOf(() => stampHtml('<script type="application/ld+json" data-price-map="nope">{}</script>', S))[0].reason).toContain("not valid JSON");
    });

    test("locateJsonValue finds nested values, escaped pointers and skips strings with brackets", () => {
        const t = '{"a/b": {"c~d": [10, {"x": "]}"}, 30]}, "z": true}';
        const at = (p: string) => { const s = locateJsonValue(t, p); return s && t.slice(s[0], s[1]); };
        expect(at("/a~1b/c~0d/0")).toBe("10");
        expect(at("/a~1b/c~0d/1/x")).toBe('"]}"');
        expect(at("/a~1b/c~0d/2")).toBe("30");
        expect(at("/z")).toBe("true");
        expect(at("/a~1b/c~0d/3")).toBeNull();
        expect(at("/nope")).toBeNull();
    });
});

describe("llms.txt template", () => {
    test("tokens become prices; other text is kept", () => {
        expect(renderLlms("Fleet {{price:fleet.mac.month}}/mo and {{price:vpn.from.month|usd}}.\n", S)).toBe("Fleet $5.95/mo and $5.00.\n");
    });
    test("a missing key or a stray {{ is an error", () => {
        expect(issuesOf(() => renderLlms("{{price:nope.x}}", S, "t"))).toEqual([{ file: "t", key: "nope.x", reason: "key is not in the snapshot" }]);
        expect(issuesOf(() => renderLlms("{{price:Bad Key}}", S))[0].reason).toContain("not a valid price token");
    });
    test("idempotent: the published file holds no tokens, the template is the source", () => {
        const out = renderLlms("A {{price:fleet.mac.month}}", S);
        expect(out).not.toContain("{{");
        expect(renderLlms("A {{price:fleet.mac.month}}", S)).toBe(out);
    });
});

describe("byte safety", () => {
    test("valid UTF-8 round-trips byte for byte, including a BOM, multibyte text and CRLF", () => {
        const text = '\uFEFF<p>caf\u00e9 \u2603 \u{1F600}\r\n<b data-price="fleet.mac.month">$1</b></p>\r\n';
        const out = stampHtmlBytes(new TextEncoder().encode(text), S);
        expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(out)).toBe(text.replace("$1", "$5.95"));
        const same = new TextEncoder().encode(text.replace("$1", "$5.95"));
        expect(Buffer.from(stampHtmlBytes(same, S)).equals(Buffer.from(same))).toBe(true);
    });

    test("invalid UTF-8 is refused, never repaired", () => {
        const bad = Buffer.concat([Buffer.from('<b data-price="fleet.mac.month">'), Buffer.from([0xff, 0xfe]), Buffer.from("</b>")]);
        expect(issuesOf(() => stampHtmlBytes(bad, S, "x.html"))).toEqual([{ file: "x.html", key: "", reason: "not valid UTF-8" }]);
        expect(() => decodeUtf8Strict(Buffer.from([0xc3, 0x28]))).toThrow(StampError);
        expect(() => decodeUtf8Strict(Buffer.from([0xed, 0xa0, 0x80]))).toThrow(StampError); // an encoded surrogate
    });

    test("a string with an unpaired surrogate is refused too", () => {
        expect(issuesOf(() => stampHtml("<p>\uD800</p>", S))[0].reason).toContain("unpaired surrogate");
        expect(issuesOf(() => renderLlms("x\uDC00", S))[0].reason).toContain("unpaired surrogate");
        expect(stampHtml("<p>\u{1F600}</p>", S)).toBe("<p>\u{1F600}</p>");
    });

    test("prototype names are not prices: an unknown key errors", () => {
        for (const key of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
            expect(issuesOf(() => stampHtml(`<b data-price="${key}">x</b>`, S))[0].reason).toBe("key is not in the snapshot");
        }
    });

    test("usd, usd0 and int are the formats; an unknown one errors", () => {
        expect(stampHtml('<i data-price="fleet.mac.month" data-fmt="usd0"></i>', S)).toContain("$5.95");
        expect(issuesOf(() => stampHtml('<i data-price="fleet.mac.month" data-fmt="eur"></i>', S))[0].reason).toContain("unknown format");
    });

    test("hasPriceMarkers is a cheap pre-check", () => {
        expect(hasPriceMarkers('<b data-price="a.b">1</b>')).toBe(true);
        expect(hasPriceMarkers("<p>none</p>")).toBe(false);
    });
});

describe("the real site with the real seed", () => {
    // The pages and llms.txt come from the legacy-baseline tag (the stale root files are gone from the tree); the template is still in the tree.
    const siteRoot = join(serverRoot, "..");
    const baseRoot = baselineDirSync();
    const seed = (() => { const v = validateSnapshot(JSON.parse(readFileSync(join(serverRoot, "data", "prices.seed.json"), "utf8"))); if (!v.ok) throw new Error(v.errors.join()); return v.snapshot; })();

    test("the seed is a valid seed snapshot", () => {
        expect(seed.version).toBeGreaterThanOrEqual(1);
        expect(seed.source).toBe("seed");
        expect(Object.keys(seed.prices).length).toBeGreaterThan(10);
    });

    test("every top-level page with markers stamps to itself, byte for byte (zero diff, no missing keys)", () => {
        const pages = readdirSync(baseRoot).filter((n) => n.endsWith(".html"));
        let withMarkers = 0;
        for (const name of pages) {
            const bytes = readFileSync(join(baseRoot, name));
            const text = decodeUtf8Strict(bytes, name);
            if (!hasPriceMarkers(text)) continue;
            withMarkers++;
            expect(Buffer.from(stampHtmlBytes(bytes, seed, name)).equals(bytes)).toBe(true);
        }
        expect(withMarkers).toBeGreaterThan(0);
    });

    test("the template renders with no tokens left, and matches a checked-in llms.txt when there is one", () => {
        const out = renderLlms(readFileSync(join(siteRoot, "llms.template.txt"), "utf8"), seed);
        expect(out).not.toContain("{{");
        if (existsSync(join(baseRoot, "llms.txt"))) expect(applyIntentionalLlms(readFileSync(join(baseRoot, "llms.txt"), "utf8")) === out).toBe(true);
    });

    test("a price change reaches the visible text, the JSON-LD and llms.txt together", () => {
        const next = { ...seed, version: seed.version + 1, prices: { ...seed.prices, "fleet.mac.month": { amountCents: 625, currency: "USD" as const } } };
        const html = stampHtml(readFileSync(join(baseRoot, "index.html"), "utf8"), next);
        expect(html).toContain('<span data-price="fleet.mac.month">$6.25</span>/Mac');
        expect(html).toContain('"price": "6.25"');
        expect(renderLlms(readFileSync(join(siteRoot, "llms.template.txt"), "utf8"), next)).toContain("$6.25 per Mac per month");
    });

    test("Phone stays a planned price, not a billed one", () => {
        const html = readFileSync(join(baseRoot, "index.html"), "utf8");
        expect(html).toContain("Early access, not billed yet");
        expect(renderLlms(readFileSync(join(siteRoot, "llms.template.txt"), "utf8"), seed)).toContain("nobody is charged during early access");
    });
});
