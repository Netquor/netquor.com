import { afterEach, describe, expect, test } from "bun:test";
import { handleRequest, isApiPath, withClientIp, type HandleEvent, type HandleRuntime } from "./handle";
import { createLegacyServer } from "./legacyServer";
import { mutablePrices, PAGE, snap, tempLegacy } from "./testkit";

let t: ReturnType<typeof tempLegacy> | undefined;
afterEach(() => t?.cleanup());

const world = (o: { routeIds?: Record<string, string>; cachePages?: boolean; address?: string | Error } = {}) => {
    t = tempLegacy({ "fleet.html": PAGE(), "subnet-calculator.html": "<p>LEGACY subnet</p>", "nq.css": "a{}" });
    const prices = mutablePrices(snap(1));
    const seen: { api: Request[]; resolved: string[] } = { api: [], resolved: [] };
    const rt: HandleRuntime = {
        prices,
        legacy: createLegacyServer({ legacyDir: t.dir, prices }),
        api: async (r) => { seen.api.push(r); return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } }); },
        cachePages: o.cachePages ?? true,
    };
    const resolve = async (e: HandleEvent) => {
        seen.resolved.push(e.url.pathname);
        const price = e.locals.prices?.prices["fleet.mac.month"].amountCents;
        return e.url.pathname === "/subnet-calculator.html" ? new Response(`<p>SVELTE subnet ${price}</p>`, { headers: { "content-type": "text/html; charset=utf-8" } })
            : e.url.pathname === "/sitemap.xml" ? new Response("<x/>", { headers: { "content-type": "application/xml" } })
            : new Response("<p>not found</p>", { status: 404, headers: { "content-type": "text/html" } });
    };
    const run = (path: string, init: RequestInit = {}) => {
        const url = new URL(`http://x${path}`);
        const event: HandleEvent = {
            request: new Request(url, init), url,
            route: { id: o.routeIds?.[url.pathname] ?? null },
            getClientAddress: () => { if (o.address instanceof Error) throw o.address; return o.address ?? "203.0.113.9"; },
            locals: {},
        };
        return handleRequest(rt, event, resolve);
    };
    return { prices, seen, run };
};

describe("routing", () => {
    test("isApiPath", () => {
        for (const p of ["/api/lead", "/api/prices", "/hooks/pricing", "/health", "/health/detail", "/api"]) expect(isApiPath(p)).toBe(true);
        for (const p of ["/", "/fleet.html", "/apiary.html", "/healthy.css", "/hooksbar", "/sitemap.xml"]) expect(isApiPath(p)).toBe(false);
    });
    test("/api, /hooks and /health go to Elysia and never to SvelteKit", async () => {
        const { run, seen } = world();
        for (const p of ["/api/lead", "/hooks/pricing", "/health"]) expect((await run(p, { method: p === "/health" ? "GET" : "POST", body: p === "/health" ? undefined : "{}" })).status).toBe(200);
        expect(seen.api.length).toBe(3);
        expect(seen.resolved).toEqual([]);
    });
    test("a legacy page is served stamped, without SvelteKit", async () => {
        const { run, seen } = world();
        const r = await run("/fleet.html");
        expect(r.status).toBe(200);
        expect(await r.text()).toContain(">$5.95<");
        expect(seen.resolved).toEqual([]);
    });
    test("route group ids still take precedence over a legacy file of the same name", async () => {
        for (const id of ["/(site)/subnet-calculator.html", "/(fleet)/subnet-calculator.html"]) {
            const { run, seen } = world({ routeIds: { "/subnet-calculator.html": id } });
            expect(await (await run("/subnet-calculator.html")).text()).toBe("<p>SVELTE subnet 595</p>");
            expect(seen.resolved).toEqual(["/subnet-calculator.html"]);
        }
    });
    test("a SvelteKit route takes precedence over a legacy file of the same name", async () => {
        const { run, seen } = world({ routeIds: { "/subnet-calculator.html": "/subnet-calculator.html" } });
        const r = await run("/subnet-calculator.html");
        expect(await r.text()).toBe("<p>SVELTE subnet 595</p>");
        expect(seen.resolved).toEqual(["/subnet-calculator.html"]);
    });
    test("without the route the legacy file is served", async () => {
        const { run } = world();
        expect(await (await run("/subnet-calculator.html")).text()).toBe("<p>LEGACY subnet</p>");
    });
    test("an unlisted path is a SvelteKit 404, never a file", async () => {
        const { run, seen } = world();
        for (const p of ["/server/.env", "/%2e%2e/server/.env", "/.git/config", "/unknown.html"]) expect((await run(p)).status).toBe(404);
        expect(seen.resolved.length).toBe(4);
    });
    test("the price snapshot is put in locals for SvelteKit", async () => {
        const { run, prices } = world({ routeIds: { "/subnet-calculator.html": "x" } });
        prices.set(snap(2, { "fleet.mac.month": 777 }));
        expect(await (await run("/subnet-calculator.html")).text()).toBe("<p>SVELTE subnet 777</p>");
    });
});

describe("client address", () => {
    test("x-nq-client-ip is the resolved address and overwrites what the visitor sent", async () => {
        const { run, seen } = world({ address: "198.51.100.7" });
        await run("/api/lead", { method: "POST", body: "{}", headers: { "x-nq-client-ip": "1.2.3.4", "content-type": "application/json" } });
        expect(seen.api[0].headers.get("x-nq-client-ip")).toBe("198.51.100.7");
    });
    test("when no address can be resolved the visitor's header is dropped, not trusted", async () => {
        const { run, seen } = world({ address: new Error("no address") });
        await run("/api/lead", { method: "POST", body: "{}", headers: { "x-nq-client-ip": "1.2.3.4" } });
        expect(seen.api[0].headers.has("x-nq-client-ip")).toBe(false);
    });
    test("the body, method and other headers pass through", async () => {
        const req = withClientIp(new Request("http://x/api/lead", { method: "POST", body: '{"a":1}', headers: { "content-type": "application/json", origin: "https://www.netquor.com" } }), "10.0.0.1");
        expect(req.method).toBe("POST");
        expect(req.headers.get("origin")).toBe("https://www.netquor.com");
        expect(await req.json()).toEqual({ a: 1 });
    });
    test("a GET has no body", () => {
        expect(withClientIp(new Request("http://x/health"), "10.0.0.1").body).toBeNull();
    });
});

describe("headers and page caching", () => {
    test("security headers on pages, assets and API answers", async () => {
        const { run } = world();
        for (const p of ["/fleet.html", "/nq.css", "/health"]) {
            const r = await run(p);
            expect(r.headers.get("x-content-type-options")).toBe("nosniff");
            expect(r.headers.get("x-frame-options")).toBe("SAMEORIGIN");
            expect(r.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
        }
    });
    test("a rendered route gets an etag, no-cache, and a 304 for the same bytes", async () => {
        const { run } = world({ routeIds: { "/subnet-calculator.html": "x" } });
        const r = await run("/subnet-calculator.html");
        expect(r.headers.get("cache-control")).toBe("no-cache");
        const etag = r.headers.get("etag")!;
        expect(etag).toMatch(/^W\//);
        expect((await run("/subnet-calculator.html", { headers: { "if-none-match": etag } })).status).toBe(304);
    });
    test("the etag of a rendered route changes when the price makes the page change", async () => {
        const { run, prices } = world({ routeIds: { "/subnet-calculator.html": "x" } });
        const etag = (await run("/subnet-calculator.html")).headers.get("etag")!;
        prices.set(snap(2, { "fleet.mac.month": 700 }));
        const next = await run("/subnet-calculator.html", { headers: { "if-none-match": etag } });
        expect(next.status).toBe(200);
        expect(next.headers.get("etag")).not.toBe(etag);
    });
    test("a 404 or a non-html route is not given no-cache", async () => {
        const { run } = world({ routeIds: { "/sitemap.xml": "x" } });
        expect((await run("/sitemap.xml")).headers.get("cache-control")).toBeNull();
        expect((await run("/nothing")).headers.get("cache-control")).toBeNull();
    });
    test("in dev (cachePages off) pages are not cached", async () => {
        const { run } = world({ routeIds: { "/subnet-calculator.html": "x" }, cachePages: false });
        expect((await run("/subnet-calculator.html")).headers.get("cache-control")).toBeNull();
    });
});
