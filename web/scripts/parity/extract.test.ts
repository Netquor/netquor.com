import { describe, expect, test } from "bun:test";
import { decodeEntities, extractFacts, normalizeText, referencedIds, resolveUrl, textBlocks, tokenize } from "./extract";

const doc = (body: string, head = "") => `<!doctype html><html><head><title>T &amp; U</title>${head}</head><body>${body}</body></html>`;

describe("text blocks", () => {
    test("script, style, noscript, template and head text are dropped; whitespace and entities are normalised", () => {
        const html = doc(`<h1>Hello&nbsp;  world</h1><script>var x = "no";</script><style>a{}</style><noscript>no js</noscript><template>tpl</template><p>A &amp; B&#33; &mdash; ok</p>`);
        expect(textBlocks(tokenize(html))).toEqual(["Hello world", "A & B! \u2014 ok"]);
    });
    test("inline tags join into one block, block tags and <br> split", () => {
        const html = doc(`<p>one <b>two</b> <a href="/x">three</a></p><div>four<br>five</div><ul><li>six</li><li>seven</li></ul>`);
        expect(textBlocks(tokenize(html))).toEqual(["one two three", "four", "five", "six", "seven"]);
    });
    test("comments (including Svelte hydration markers) do not split or add text", () => {
        expect(textBlocks(tokenize(doc(`<p>a<!--[-->b<!----> c<!--]--></p>`)))).toEqual(["ab c"]);
    });
    test("a script containing '<' does not leak into the text", () => {
        expect(textBlocks(tokenize(doc(`<p>x</p><script>if (a < b && c > d) { document.write("<p>no</p>"); }</script><p>y</p>`)))).toEqual(["x", "y"]);
    });
    test("quoted '>' in an attribute does not end the tag early", () => {
        expect(textBlocks(tokenize(doc(`<p title="a > b">text</p>`)))).toEqual(["text"]);
    });
    test("decodeEntities handles named, decimal and hex; unknown ones stay", () => {
        expect(decodeEntities("&lt;&#65;&#x42;&bogus;&copy;")).toBe("<AB&bogus;\u00a9");
        expect(normalizeText(" a \n\u00a0 b ")).toBe("a b");
    });
});

describe("facts", () => {
    const page = doc(
        `<a href="fleet.html#x">F</a><a href="index.html">H</a><a href="https://x.test/a?b=1">E</a><a href="mailto:a@b.c">M</a><img src="brand/og.png" alt=""><div id="calc"></div><script src="cost-calc.js?v=1"></script><script>document.getElementById("calc")</script><script type="application/ld+json">{"a":[1,2]}</script>`,
        `<meta name="Description" content="  Hi &amp; bye "><meta property="og:title" content="T"><meta charset="utf-8"><link rel="canonical" href="https://www.netquor.com/p.html"><link rel="stylesheet" href="nq.css?v=abc&x=1"><link rel="stylesheet" href="/_app/immutable/assets/0.css"><script src="/nav.js?v=2" defer></script><script type="importmap">{}</script>`,
    );
    const f = extractFacts(page, "/p.html");
    test("links and images in order, relative URLs resolved, /index.html is /", () => {
        expect(f.links).toEqual(["a:/fleet.html#x", "a:/", "a:https://x.test/a?b=1", "a:mailto:a@b.c", "img:/brand/og.png"]);
    });
    test("meta, title and canonical", () => {
        expect(f.meta).toContain("title = T & U");
        expect(f.meta).toContain("name:description = Hi & bye");
        expect(f.meta).toContain("property:og:title = T");
        expect(f.meta).toContain("canonical = https://www.netquor.com/p.html");
        expect(f.meta.some((m) => m.includes("charset"))).toBe(false);
    });
    test("assets: external scripts and stylesheets, ?v= removed other query kept, SvelteKit's /_app files left out", () => {
        expect(f.assets).toEqual(["stylesheet:/nq.css?x=1", "script:/nav.js", "script:/cost-calc.js"]);
        expect(f.assets).toContain("script:/nav.js");
        expect(f.assets.some((x) => x.includes("_app"))).toBe(false);
    });
    test("JSON-LD is parsed; inline scripts and ids are collected", () => {
        expect(f.jsonLd).toEqual([{ a: [1, 2] }]);
        expect(f.inlineScripts).toEqual([`document.getElementById("calc")`]);
        expect(f.ids.has("calc")).toBe(true);
        expect(f.localScriptSrcs).toContain("/cost-calc.js");
    });
    test("invalid JSON-LD is recorded, not thrown", () => {
        expect(extractFacts(doc(`<script type="application/ld+json">{nope</script>`), "/p.html").jsonLdInvalid).toEqual([0]);
    });
    test("resolveUrl leaves fragments and schemes alone", () => {
        expect(resolveUrl("#a", "/p.html")).toBe("#a");
        expect(resolveUrl("tel:+1", "/p.html")).toBe("tel:+1");
        expect(resolveUrl("../x.png", "/a/b.html")).toBe("/x.png");
    });
});

describe("referencedIds", () => {
    test("finds getElementById and #ids in querySelector strings, skips template ids", () => {
        const ids = referencedIds([`$("x"); document.getElementById('a-1'); el.querySelector("#b .c, #d"); document.querySelectorAll('[id="e"]'); document.getElementById(\`p-\${n}\`); q.closest("#f")`]);
        expect([...ids].sort()).toEqual(["a-1", "b", "d", "e", "f"]);
    });
});
