// app.test.ts: the app as a whole: health, plugins, errors, and a real listening server (socket address, body cap).
import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createApp } from "./app";
import { slidingWindowLimiter } from "./lib/rateLimit";
import { good, memorySink, world } from "./lead/testkit";

describe("health", () => {
    test("GET /health is 200 {ok:true}, not cacheable", async () => {
        const res = await world().app.handle(new Request("http://localhost/health"));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });
        expect(res.headers.get("cache-control")).toBe("no-store");
    });
});

describe("plugins", () => {
    test("extra plugins are mounted as given, and get the same error handling", async () => {
        const prices = new Elysia().get("/api/prices", () => ({ ok: true, prices: [] })).get("/api/boom", () => { throw new Error("secret stack detail"); });
        const w = world({ plugins: [prices] });
        expect(await (await w.app.handle(new Request("http://localhost/api/prices"))).json()).toEqual({ ok: true, prices: [] });
        const boom = await w.app.handle(new Request("http://localhost/api/boom"));
        expect(boom.status).toBe(500);
        const text = await boom.text();
        expect(JSON.parse(text)).toEqual({ ok: false, error: "internal_error" });
        expect(text).not.toContain("secret");
        expect(w.logs.join()).not.toContain("secret stack detail");
        expect((await w.postJson(good)).status).toBe(202); // the lead route still works beside it
    });
    test("an unknown path is a JSON 404", async () => {
        const res = await world().app.handle(new Request("http://localhost/nothing"));
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ ok: false, error: "not_found" });
    });
    test("a wrong method on the lead route is a 404 or 405, never a lead", async () => {
        const w = world();
        const res = await w.app.handle(new Request("http://localhost/api/lead", { method: "GET" }));
        expect([404, 405]).toContain(res.status);
        expect(w.leads).toHaveLength(0);
    });
});

describe("mounted with no socket", () => {
    test("app.handle works with no socket: the lead route answers and uses 'unknown'", async () => {
        const w = world({ trustPeerIpHeader: false });
        expect((await w.postJson(good)).status).toBe(202);
    });
    test("an Elysia app can be called from another server's handler", async () => {
        const w = world();
        const outer = async (req: Request) => (new URL(req.url).pathname.startsWith("/api/") ? w.app.handle(req) : new Response("page"));
        expect(await (await outer(new Request("http://localhost/health"))).text()).toBe("page"); // /health is not /api/: the outer server decides what to hand over
        expect((await outer(new Request("http://localhost/api/lead", { method: "POST", headers: { "content-type": "application/json", "x-nq-client-ip": "203.0.113.5" }, body: JSON.stringify(good) }))).status).toBe(202);
    });
});

describe("health detail", () => {
    const status = { version: 7, updatedAt: "2026-11-10T11:00:00.000Z", ageSeconds: 3600, lastIngestAt: "2026-11-10T11:00:01.000Z", lastIngestSource: "webhook", lastPollOkAt: null, lastRefusal: { version: 8, code: "change_too_large", at: "2026-11-10T11:30:00.000Z" }, stale: false };
    test("reports uptime, the price cache status and which sinks exist as booleans, nothing else", async () => {
        const w = world({ health: { startedAt: Date.parse("2026-11-10T11:59:00Z"), prices: () => ({ ...status, secret: "leak" } as never), leads: { file: true, webhook: false } } });
        const res = await w.app.handle(new Request("http://localhost/health/detail"));
        expect(res.status).toBe(200);
        expect(res.headers.get("cache-control")).toBe("no-store");
        expect(await res.json()).toEqual({ ok: true, uptimeSeconds: 60, prices: { ...status, catalogSources: {} }, leadSinks: { file: true, webhook: false } });
    });
    test("with no providers: prices null, sinks false; a throwing provider reads as null", async () => {
        expect(await (await world().app.handle(new Request("http://localhost/health/detail"))).json()).toMatchObject({ ok: true, prices: null, leadSinks: { file: false, webhook: false } });
        const w = world({ health: { prices: () => { throw new Error("boom"); } } });
        expect((await (await w.app.handle(new Request("http://localhost/health/detail"))).json()).prices).toBeNull();
    });
    test("GET /health stays {ok:true} and never carries detail", async () => {
        const w = world({ health: { prices: () => status } });
        expect(await (await w.app.handle(new Request("http://localhost/health"))).json()).toEqual({ ok: true });
    });
});

describe("a real server", () => {
    const start = (trustPeerIpHeader: boolean, max = 5) => {
        const mem = memorySink();
        const app = createApp({
            config: { allowedOrigins: ["https://www.netquor.com"], maxBodyBytes: 16384, deliveryDeadlineMs: 8000 },
            trustPeerIpHeader,
            leadSink: mem.sink, clock: Date.now, rateLimiter: slidingWindowLimiter({ max, windowMs: 60_000, now: Date.now }), log: () => {},
        }).listen({ port: 0, hostname: "127.0.0.1" });
        return { app, mem, url: `http://127.0.0.1:${app.server!.port}` };
    };
    const send = (url: string, headers: Record<string, string> = {}, body: unknown = good) =>
        fetch(url + "/api/lead", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

    test("trust off: the socket address is the rate-limit key, so a spoofed header changes nothing", async () => {
        const s = start(false, 2);
        try {
            expect((await send(s.url, { "x-nq-client-ip": "203.0.113.1" })).status).toBe(202);
            expect((await send(s.url, { "x-nq-client-ip": "203.0.113.2", "x-real-ip": "203.0.113.4" })).status).toBe(202);
            expect((await send(s.url, { "x-nq-client-ip": "203.0.113.3" })).status).toBe(429);
        } finally { s.app.stop(true); }
    });
    test("trust on (the hooks entry): x-nq-client-ip decides, X-Real-IP and CF-Connecting-IP never do", async () => {
        const s = start(true, 1);
        try {
            expect((await send(s.url, { "x-nq-client-ip": "203.0.113.1" })).status).toBe(202);
            expect((await send(s.url, { "x-nq-client-ip": "203.0.113.1" })).status).toBe(429);
            expect((await send(s.url, { "x-nq-client-ip": "203.0.113.2" })).status).toBe(202);
            expect((await send(s.url, { "x-nq-client-ip": "203.0.113.2", "cf-connecting-ip": "203.0.113.9", "x-real-ip": "203.0.113.8" })).status).toBe(429);
        } finally { s.app.stop(true); }
    });
    test("an oversize body over a real connection is refused and nothing is stored", async () => {
        const s = start(false);
        try {
            const res = await send(s.url, {}, { ...good, message: "x".repeat(20_000) });
            expect(res.status).toBe(413);
            expect(s.mem.leads).toHaveLength(0);
        } finally { s.app.stop(true); }
    });
    test("a form post over a real connection", async () => {
        const s = start(false);
        try {
            const res = await fetch(s.url + "/api/lead", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://www.netquor.com" }, body: new URLSearchParams({ name: "Ada", email: "ada@example.com", macs: "2" }) });
            expect(res.status).toBe(202);
            expect(res.headers.get("access-control-allow-origin")).toBe("https://www.netquor.com");
            expect(s.mem.leads[0]).toMatchObject({ name: "Ada", macs: 2 });
        } finally { s.app.stop(true); }
    });
});
