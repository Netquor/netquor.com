// lead/routes.test.ts: POST /api/lead end to end through the app: formats, honeypot, rate limit, CORS, size, delivery.
import { describe, expect, test } from "bun:test";
import { good, ORIGIN, world } from "./testkit";
import type { LeadSink } from "./types";

describe("accepting a lead", () => {
    test("JSON: 202 with an id, and the sink gets the clean lead", async () => {
        const w = world();
        const res = await w.postJson({ ...good, source: "fleet" });
        expect(res.status).toBe(202);
        const body = await res.json();
        expect(body).toEqual({ ok: true, id: expect.stringMatching(/^ld_[0-9a-f-]{36}$/) });
        expect(w.leads).toEqual([{ id: body.id, receivedAt: "2026-11-10T12:00:00.000Z", ...good, source: "fleet" }]);
    });
    test("page and utm reach the sink; a formula-looking name is defanged and a formula-looking email is a 422", async () => {
        const w = world();
        expect((await w.postJson({ ...good, name: "=HYPERLINK(1)", page: "/fleet.html?x=1", utm: { source: "news" } })).status).toBe(202);
        expect(w.leads[0]).toMatchObject({ name: "HYPERLINK(1)", page: "/fleet.html", utm: { source: "news" } });
        const bad = await w.postJson({ ...good, email: "=x@example.com" });
        expect(bad.status).toBe(422);
        expect(await bad.json()).toEqual({ ok: false, error: "invalid_email" });
        expect(w.leads).toHaveLength(1);
    });
    test("form-encoded, as the Fleet page sends it, with the honeypot empty and extra hidden fields", async () => {
        const w = world();
        const res = await w.postForm({ name: "Ada", email: "ada@example.com", company: "", macs: "4", ios: "0", message: "", term: "annual", dedicated: "0", website: "" });
        expect(res.status).toBe(202);
        expect(w.leads[0]).toMatchObject({ name: "Ada", macs: 4, ios: 0, term: "annual" });
        expect(w.leads[0]).not.toHaveProperty("dedicated");
    });
    test("a content type with a charset is fine", async () => {
        const w = world();
        expect((await w.postJson(good, { "content-type": "application/json; charset=utf-8" })).status).toBe(202);
    });
    test("unknown fields are ignored", async () => {
        const w = world();
        expect((await w.postJson({ ...good, isAdmin: true, nested: { a: 1 } })).status).toBe(202);
        expect(w.leads[0]).not.toHaveProperty("isAdmin");
    });
    test("no cookie is ever set, and nothing is cacheable", async () => {
        const res = await world().postJson(good);
        expect(res.headers.get("set-cookie")).toBeNull();
        expect(res.headers.get("cache-control")).toBe("no-store");
    });
});

describe("refusing a lead", () => {
    const cases: [string, unknown, number, string][] = [
        ["no name", { ...good, name: "" }, 422, "missing_name"],
        ["no email", { ...good, email: undefined }, 422, "missing_email"],
        ["bad email", { ...good, email: "not-an-email" }, 422, "invalid_email"],
        ["fractional count", { ...good, macs: 1.5 }, 422, "invalid_macs"],
        ["count too big", { ...good, ios: 100001 }, 422, "invalid_ios"],
        ["message too long", { ...good, message: "x".repeat(2001) }, 422, "invalid_message"],
        ["array body", [good], 400, "invalid_body"],
        ["a bare string", "hello", 400, "invalid_body"],
    ];
    test.each(cases)("%s", async (_n, payload, status, code) => {
        const w = world();
        const res = await w.postJson(payload);
        expect(res.status).toBe(status);
        expect(await res.json()).toEqual({ ok: false, error: code });
        expect(w.leads).toHaveLength(0);
    });
    test("malformed JSON", async () => {
        const res = await world().post("{nope");
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ ok: false, error: "invalid_json" });
    });
    test("invalid UTF-8", async () => {
        const w = world();
        const res = await w.app.handle(new Request("http://localhost/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]) }));
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ ok: false, error: "invalid_body" });
    });
    test("other content types are refused, including the 'simple' ones a cross-site form could send", async () => {
        const w = world();
        for (const ct of ["text/plain", "multipart/form-data; boundary=x", "application/xml", ""]) {
            const res = await w.post(JSON.stringify(good), { "content-type": ct });
            expect(res.status).toBe(415);
            expect(await res.json()).toEqual({ ok: false, error: "unsupported_media_type" });
        }
        expect(w.leads).toHaveLength(0);
    });
    test("an error never echoes what was sent", async () => {
        const w = world();
        const res = await w.postJson({ ...good, name: "SECRET-NAME-VALUE", email: "SECRET-EMAIL-VALUE" });
        const text = await res.text();
        expect(text).not.toContain("SECRET");
    });
});

describe("size", () => {
    test("a body over 16 KB is refused with 413, by its declared length", async () => {
        const w = world();
        const res = await w.postJson({ ...good, message: "x".repeat(17 * 1024) });
        expect(res.status).toBe(413);
        expect(await res.json()).toEqual({ ok: false, error: "payload_too_large" });
    });
    test("exactly under the cap passes; a lie about the length does not help (chunked stream over the cap)", async () => {
        const w = world();
        const big = new ReadableStream<Uint8Array>({ start(c) { for (let i = 0; i < 40; i++) c.enqueue(new Uint8Array(1024).fill(0x61)); c.close(); } });
        const res = await w.app.handle(new Request("http://localhost/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: big, duplex: "half" } as RequestInit));
        expect(res.status).toBe(413);
        expect((await w.postJson({ ...good, message: "x".repeat(2000) })).status).toBe(202);
    });
});

describe("honeypot", () => {
    test("a filled website field gets a plain 200 and nothing is stored; the answer has no id", async () => {
        const w = world();
        const res = await w.postJson({ ...good, website: "http://spam.example" });
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true });
        expect(w.leads).toHaveLength(0);
    });
    test("also for a form post, and even when the rest is invalid (so a bot learns nothing)", async () => {
        const w = world();
        const res = await w.postForm({ name: "", email: "x", website: "bot" });
        expect(res.status).toBe(200);
        expect(w.leads).toHaveLength(0);
    });
    test("a blank website field is a real visitor", async () => {
        const w = world();
        expect((await w.postJson({ ...good, website: "  " })).status).toBe(202);
    });
});

describe("rate limit", () => {
    const ip = (a: string) => ({ "x-nq-client-ip": a });
    test("5 in the window, the 6th is 429 with Retry-After, and the window slides", async () => {
        const w = world();
        for (let i = 0; i < 5; i++) expect((await w.postJson(good, ip("203.0.113.7"))).status).toBe(202);
        const res = await w.postJson(good, ip("203.0.113.7"));
        expect(res.status).toBe(429);
        expect(await res.json()).toEqual({ ok: false, error: "rate_limited" });
        expect(Number(res.headers.get("retry-after"))).toBe(600);
        expect(w.leads).toHaveLength(5);
        w.time.now += 601_000;
        expect((await w.postJson(good, ip("203.0.113.7"))).status).toBe(202);
    });
    test("another address is not affected", async () => {
        const w = world({ max: 1 });
        expect((await w.postJson(good, ip("203.0.113.7"))).status).toBe(202);
        expect((await w.postJson(good, ip("203.0.113.7"))).status).toBe(429);
        expect((await w.postJson(good, ip("203.0.113.8"))).status).toBe(202);
        expect((await w.postJson(good, ip("2001:db8::1"))).status).toBe(202);
    });
    test("IPv6 is limited by its /64: other addresses in the same /64 share the allowance, another /64 does not", async () => {
        const w = world({ max: 1 });
        expect((await w.postJson(good, ip("2001:db8:1:2::1"))).status).toBe(202);
        expect((await w.postJson(good, ip("2001:db8:1:2:aaaa:bbbb:cccc:dddd"))).status).toBe(429);
        expect((await w.postJson(good, ip("2001:db8:1:3::1"))).status).toBe(202);
    });
    test("invalid and honeypot posts count too", async () => {
        const w = world({ max: 2 });
        await w.postJson({ ...good, website: "x" }, ip("198.51.100.1"));
        await w.postJson({}, ip("198.51.100.1"));
        expect((await w.postJson(good, ip("198.51.100.1"))).status).toBe(429);
    });
    test("with trustPeerIpHeader off, x-nq-client-ip is ignored: with no socket everyone shares the 'unknown' bucket (20x the limit)", async () => {
        const w = world({ max: 1, trustPeerIpHeader: false });
        for (let i = 0; i < 20; i++) expect((await w.postJson(good, ip(`203.0.113.${i + 1}`))).status).toBe(202);
        expect((await w.postJson(good, ip("203.0.113.99"))).status).toBe(429);
    });
    test("X-Real-IP, CF-Connecting-IP and X-Forwarded-For are never used, even with the header trusted", async () => {
        const w = world({ max: 1 });
        const other = { "x-real-ip": "1.1.1.1", "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "1.1.1.1" };
        expect((await w.postJson(good, { ...ip("203.0.113.1"), ...other })).status).toBe(202);
        expect((await w.postJson(good, { ...ip("203.0.113.1"), "x-real-ip": "2.2.2.2" })).status).toBe(429); // same x-nq-client-ip
        expect((await w.postJson(good, { ...ip("203.0.113.2"), ...other })).status).toBe(202);
    });
    test("a malformed x-nq-client-ip falls back to the shared 'unknown' bucket", async () => {
        const w = world({ max: 1 });
        for (const bad of ["not an ip", "<script>", "1.2.3.4, 5.6.7.8"]) expect((await w.postJson(good, ip(bad))).status).toBe(202); // 20 allowed in unknown
    });
    test("with no address, requests share an 'unknown' bucket with a much higher limit, so it cannot lock everyone out", async () => {
        const w = world({ max: 2 });
        for (let i = 0; i < 40; i++) expect((await w.postJson(good)).status).toBe(202);
        expect((await w.postJson(good)).status).toBe(429);
        // addressed visitors are unaffected by the exhausted bucket
        expect((await w.postJson(good, ip("203.0.113.5"))).status).toBe(202);
    });
    test("the client address reaches the sink as meta only when known", async () => {
        const seen: unknown[] = [];
        const w = world({ sink: { deliver: async (_l, m) => void seen.push(m) } });
        await w.postJson(good, ip("203.0.113.7"));
        await w.postJson(good);
        expect(seen).toEqual([{ clientIp: "203.0.113.7" }, { clientIp: undefined }]);
    });
});

describe("CORS", () => {
    test("an allowed origin gets its own origin back, Vary, and no credentials", async () => {
        const res = await world().postJson(good, { origin: ORIGIN });
        expect(res.status).toBe(202);
        expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
        expect(res.headers.get("vary")).toBe("Origin");
        expect(res.headers.get("access-control-allow-credentials")).toBeNull();
    });
    test("errors carry the CORS header too, so the page can read the code", async () => {
        const res = await world().postJson({}, { origin: ORIGIN });
        expect(res.status).toBe(422);
        expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    });
    test("another origin is refused with 403 and nothing is stored", async () => {
        const w = world();
        for (const origin of ["https://evil.example", "http://www.netquor.com", "https://www.netquor.com.evil.example", "null"]) {
            const res = await w.postJson(good, { origin });
            expect(res.status).toBe(403);
            expect(await res.json()).toEqual({ ok: false, error: "origin_not_allowed" });
            expect(res.headers.get("access-control-allow-origin")).toBeNull();
        }
        expect(w.leads).toHaveLength(0);
    });
    test("a refused origin does not use up anyone's rate limit", async () => {
        const w = world({ max: 1 });
        await w.postJson(good, { origin: "https://evil.example", "x-nq-client-ip": "203.0.113.9" });
        expect((await w.postJson(good, { "x-nq-client-ip": "203.0.113.9" })).status).toBe(202);
    });
    test("no Origin header (curl, a server) is allowed", async () => {
        expect((await world().postJson(good)).status).toBe(202);
    });
    test("preflight: allowed origin gets 204 with methods and headers; others get 403 with no CORS headers", async () => {
        const w = world();
        const pre = (origin: string) => w.app.handle(new Request("http://localhost/api/lead", { method: "OPTIONS", headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type" } }));
        const ok = await pre("https://netquor.com");
        expect(ok.status).toBe(204);
        expect(ok.headers.get("access-control-allow-origin")).toBe("https://netquor.com");
        expect(ok.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
        expect(ok.headers.get("access-control-allow-headers")).toBe("content-type");
        expect(ok.headers.get("access-control-allow-credentials")).toBeNull();
        const bad = await pre("https://evil.example");
        expect(bad.status).toBe(403);
        expect(bad.headers.get("access-control-allow-origin")).toBeNull();
    });
});

describe("delivery", () => {
    test("a failing sink is 503 delivery_failed, logged without the lead", async () => {
        const sink: LeadSink = { deliver: async () => { throw new Error("disk full for ada@example.com"); } };
        const w = world({ sink });
        const res = await w.postJson(good);
        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ ok: false, error: "delivery_failed" });
        expect(w.logs.join()).not.toContain("ada@example.com");
        expect(w.logs.join()).not.toContain("disk full");
    });
    test("the lead is delivered before the 202 is sent", async () => {
        let delivered = false;
        const sink: LeadSink = { deliver: async () => { await new Promise((r) => setTimeout(r, 20)); delivered = true; } };
        const res = await world({ sink }).postJson(good);
        expect(res.status).toBe(202);
        expect(delivered).toBe(true);
    });
    test("a slow sink does not hold the request past the deadline: 503 delivery_timeout", async () => {
        const sink: LeadSink = { deliver: () => new Promise(() => {}) };
        const w = world({ sink, config: { deliveryDeadlineMs: 50 } });
        const started = Date.now();
        const res = await w.postJson(good);
        expect(Date.now() - started).toBeLessThan(1000);
        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ ok: false, error: "delivery_timeout" });
    });
});
