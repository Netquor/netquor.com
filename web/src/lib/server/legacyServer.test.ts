import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { assetFingerprint, createLegacyServer } from "./legacyServer";
import { tempLegacy } from "./testkit";

let t: ReturnType<typeof tempLegacy> | undefined;
afterEach(() => t?.cleanup());

const setup = (files: Record<string, string> = {}) => {
    t = tempLegacy({ "cost-calc.js": "calc", "favicon.svg": "<svg/>", "brand/og.png": "PNG", ...files });
    const server = createLegacyServer({ legacyDir: t.dir });
    const get = (path: string, headers: Record<string, string> = {}, method = "GET") => server.serve(new Request(`http://x${path}`, { method, headers }), new URL(`http://x${path}`));
    return { server, get };
};

describe("assets", () => {
    test("?v= is immutable only when it is the file's own fingerprint (md5, 8 hex); everything else is one hour", () => {
        const { get } = setup();
        const v = createHash("md5").update("calc").digest("hex").slice(0, 8);
        expect(assetFingerprint(new TextEncoder().encode("calc"))).toBe(v);
        expect(get(`/cost-calc.js?v=${v}`)!.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
        expect(get("/cost-calc.js?v=abc")!.headers.get("cache-control")).toBe("public, max-age=3600");
        expect(get("/cost-calc.js?v=")!.headers.get("cache-control")).toBe("public, max-age=3600");
        expect(get("/cost-calc.js")!.headers.get("cache-control")).toBe("public, max-age=3600");
        expect(get("/brand/og.png")!.headers.get("content-type")).toBe("image/png");
        expect(get("/favicon.svg")!.headers.get("content-type")).toContain("image/svg+xml");
    });
    test("an edited asset is no longer immutable under its old ?v=", () => {
        const { get } = setup();
        const v = createHash("md5").update("calc").digest("hex").slice(0, 8);
        t!.write("cost-calc.js", "calc2", 2_000_000_300);
        expect(get(`/cost-calc.js?v=${v}`)!.headers.get("cache-control")).toBe("public, max-age=3600");
    });
    test("304 on a matching etag", () => {
        const { get } = setup();
        const etag = get("/cost-calc.js")!.headers.get("etag")!;
        expect(get("/cost-calc.js", { "if-none-match": etag })!.status).toBe(304);
    });
    test("HEAD answers headers only", async () => {
        const r = setup().get("/cost-calc.js", {}, "HEAD")!;
        expect(r.status).toBe(200);
        expect(await r.text()).toBe("");
    });
    test("assets are served as written, never stamped", async () => {
        const { get } = setup({ "bundle-calc.js": 'var a = "<b data-price=\\"nope\\">1</b>";' });
        expect(await get("/bundle-calc.js")!.text()).toContain("data-price");
    });
});

describe("not served", () => {
    test("null for unknown, denied, missing and non-GET", () => {
        const { server, get } = setup({ "llms.template.txt": "x", "index.html": "<p>home</p>", "fleet.html": "<p>f</p>", "nq.css": "a{}", "nav.js": "x", "readiness-data.json": "{}" });
        for (const p of ["/", "/nope.html", "/index.html.bak", "/llms.template.txt", "/nq.css", "/nav.js", "/readiness-data.json", "/brand/", "/missing.png", "/fleet.html"]) expect(get(p)).toBeNull();
        expect(server.serve(new Request("http://x/cost-calc.js", { method: "POST" }), new URL("http://x/cost-calc.js"))).toBeNull();
    });
});

describe("one URL per page (registry only, no HTML on disk)", () => {
    test("/index.html is a 301 to / and keeps the query string", () => {
        const { get } = setup();
        const r = get("/index.html?utm_source=x&a=1")!;
        expect(r.status).toBe(301);
        expect(r.headers.get("location")).toBe("/?utm_source=x&a=1");
        expect(get("/index.html")!.headers.get("location")).toBe("/");
        expect(get("/index.html/")!.status).toBe(301);
        expect(get("/")).toBeNull();
    });
    test("a trailing slash on a page is a 308 to the .html URL, query kept", () => {
        const { get } = setup();
        const r = get("/fleet.html/?ref=a")!;
        expect([r.status, r.headers.get("location")]).toEqual([308, "/fleet.html?ref=a"]);
        expect(get("/fleet.html//")!.headers.get("location")).toBe("/fleet.html");
        expect(get("/fleet.html")).toBeNull();
    });
    test("no redirect for things that are not registered pages", () => {
        const { get } = setup();
        expect(get("/unregistered.html/")).toBeNull();
        expect(get("/brand/")).toBeNull();
        expect(get("/cost-calc.js/")).toBeNull();
        expect(get("//")).toBeNull();
    });
});
