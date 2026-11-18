import { describe, expect, test } from "bun:test";
import { assetEtag, conditional, contentTypeFor, etagMatches, pageEtag } from "./http";

describe("etagMatches", () => {
    test("weak comparison, lists and *", () => {
        expect(etagMatches('W/"a"', 'W/"a"')).toBe(true);
        expect(etagMatches('"a"', 'W/"a"')).toBe(true);
        expect(etagMatches('"x", W/"a"', 'W/"a"')).toBe(true);
        expect(etagMatches("*", 'W/"a"')).toBe(true);
        expect(etagMatches('W/"b"', 'W/"a"')).toBe(false);
        expect(etagMatches(null, 'W/"a"')).toBe(false);
    });
});

describe("etags", () => {
    test("a page etag changes with the mtime and with the price version", () => {
        expect(pageEtag(1000, 1)).toBe(pageEtag(1000.4, 1));
        expect(pageEtag(1000, 1)).not.toBe(pageEtag(2000, 1));
        expect(pageEtag(1000, 1)).not.toBe(pageEtag(1000, 2));
        expect(pageEtag(1, 1).startsWith('W/"')).toBe(true);
    });
    test("an asset etag changes with the size", () => expect(assetEtag(5, 10)).not.toBe(assetEtag(5, 11)));
});

describe("conditional", () => {
    const h = { "content-type": "text/html", "cache-control": "public, max-age=60" };
    test("200 with the body and etag", async () => {
        const r = conditional(new Request("http://x/"), "hello", h, 'W/"e"');
        expect(r.status).toBe(200);
        expect(r.headers.get("etag")).toBe('W/"e"');
        expect(await r.text()).toBe("hello");
    });
    test("304 with no body, no content-type, and the cache header kept", async () => {
        const r = conditional(new Request("http://x/", { headers: { "if-none-match": 'W/"e"' } }), "hello", h, 'W/"e"');
        expect(r.status).toBe(304);
        expect(r.headers.get("content-type")).toBeNull();
        expect(r.headers.get("cache-control")).toBe("public, max-age=60");
        expect(await r.text()).toBe("");
    });
    test("HEAD has headers and no body", async () => {
        const r = conditional(new Request("http://x/", { method: "HEAD" }), "hello", h, 'W/"e"');
        expect(r.status).toBe(200);
        expect(await r.text()).toBe("");
    });
});

test("content types", () => {
    expect(contentTypeFor("a.css")).toContain("text/css");
    expect(contentTypeFor("a.webmanifest")).toBe("application/manifest+json");
    expect(contentTypeFor("a.unknown")).toBe("application/octet-stream");
});
