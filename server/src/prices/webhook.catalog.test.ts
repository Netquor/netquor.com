// webhook.catalog.test.ts: the Netquor API's own webhook ("price.changed" with {id,type,at,data}), both signature header forms, replay of an id, wrong and rotated secrets; the nudge pulling from the CATALOG in the web process (createPricing); the sources in cache status and /health/detail.
import { afterEach, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Elysia } from "elysia";
import { healthRoutes } from "../health/routes";
import { fleetWith, phoneWith, realFleet, realMap, realPhone, seedSnapshot } from "./catalog.testkit";
import { createSeenIds, createNudger } from "./nudge";
import { createPricing } from "./real";
import { priceRoutes, signatureHeader } from "./routes";
import { signBody } from "./signature";
import { serializeSnapshot } from "./snapshot";
import { NOW_MS, tempDir, world } from "./testkit";

const SECRET = "s3cret-s3cret-s3cret", NEXT = "next-next-next-next";
const t = Math.floor(NOW_MS / 1000);
const event = (id: string) => ({ id, type: "price.changed", at: "2026-11-10T12:00:00.000Z", data: { product: "netquor-fleet" } });

const setup = (o: { limit?: number } = {}) => {
    const w = world(seedSnapshot());
    let pulls = 0;
    const lines: string[] = [];
    const nudge = createNudger({ pull: async () => { pulls++; return { kind: "unchanged" }; }, now: () => NOW_MS, minGapMs: 0, schedule: () => {} });
    const app = priceRoutes({ secrets: () => [SECRET, NEXT], now: () => NOW_MS, ingest: w.ingest, cache: w.cache, nudge, log: (l) => lines.push(l), limitPerMinute: o.limit ?? 1000 });
    const send = (body: unknown, headers: Record<string, string>) => app.handle(new Request("http://localhost/hooks/pricing", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers: { "content-type": "application/json", ...headers } }));
    const std = (body: unknown, secret = SECRET) => { const raw = JSON.stringify(body); return send(raw, { "x-netquor-signature": `t=${t},v1=${signBody(secret, t, raw)}` }); };
    const bare = (body: unknown, secret = SECRET, ts = t) => { const raw = JSON.stringify(body); return send(raw, { "x-netquor-signature-256": createHmac("sha256", secret).update(`${ts}.${raw}`).digest("hex"), "x-netquor-timestamp": String(ts) }); };
    return { ...w, app, std, bare, send, pulls: () => pulls, lines };
};

describe("price.changed webhook", () => {
    test("with the standard header (t=,v1=): treated as a nudge", async () => {
        const x = setup();
        const r = await x.std(event("evt_1"));
        expect(r.status).toBe(200);
        expect(x.pulls()).toBe(1);
    });
    test("with the bare digest header and X-Netquor-Timestamp: treated as a nudge", async () => {
        const x = setup();
        expect((await x.bare(event("evt_1"))).status).toBe(200);
        expect(x.pulls()).toBe(1);
    });
    test("the existing { event: prices.changed } nudge still works", async () => {
        const x = setup();
        expect((await x.std({ event: "prices.changed" })).status).toBe(200);
        expect(x.pulls()).toBe(1);
    });
    test("a replay of the same id (either header form) is answered 200 duplicate and does not pull again", async () => {
        const x = setup();
        await x.std(event("evt_1"));
        const again = await x.bare(event("evt_1"));
        expect(again.status).toBe(200);
        expect(await again.json()).toEqual({ ok: true, duplicate: true });
        expect(x.pulls()).toBe(1);
        expect((await x.std(event("evt_2"))).status).toBe(200);
        expect(x.pulls()).toBe(2);
    });
    test("an id whose pull failed may be redelivered", async () => {
        const w = world(seedSnapshot());
        let n = 0;
        const app = priceRoutes({ secrets: () => [SECRET], now: () => NOW_MS, ingest: w.ingest, cache: w.cache, nudge: createNudger({ pull: async () => (++n === 1 ? { kind: "failed", reason: "down" } : { kind: "unchanged" }), now: () => NOW_MS, minGapMs: 0, schedule: () => {} }), limitPerMinute: 1000 });
        const raw = JSON.stringify(event("evt_9"));
        const call = () => app.handle(new Request("http://localhost/hooks/pricing", { method: "POST", body: raw, headers: { "x-netquor-signature": `t=${t},v1=${signBody(SECRET, t, raw)}` } }));
        expect((await call()).status).toBe(503);
        expect((await call()).status).toBe(200);
        expect(n).toBe(2);
    });
    test("wrong secret: 401 in both forms, nothing pulled", async () => {
        const x = setup();
        expect((await x.std(event("a"), "wrong-wrong-wrong-wrong")).status).toBe(401);
        expect((await x.bare(event("b"), "wrong-wrong-wrong-wrong")).status).toBe(401);
        expect(x.pulls()).toBe(0);
    });
    test("the rotation secret (PRICING_WEBHOOK_SECRET_NEXT) verifies in both forms", async () => {
        const x = setup();
        expect((await x.std(event("a"), NEXT)).status).toBe(200);
        expect((await x.bare(event("b"), NEXT)).status).toBe(200);
    });
    test("the bare form needs both headers, a numeric timestamp within 300 s, and a body that was signed", async () => {
        const x = setup();
        const raw = JSON.stringify(event("c"));
        const hex = createHmac("sha256", SECRET).update(`${t}.${raw}`).digest("hex");
        expect((await x.send(raw, { "x-netquor-signature-256": hex })).status).toBe(401);
        expect((await x.send(raw, { "x-netquor-timestamp": String(t) })).status).toBe(401);
        expect((await x.bare(event("d"), SECRET, t - 301)).status).toBe(401);
        expect((await x.send(raw + " ", { "x-netquor-signature-256": hex, "x-netquor-timestamp": String(t) })).status).toBe(401);
        expect((await x.send(raw, { "x-netquor-signature-256": `sha256=${hex}`, "x-netquor-timestamp": String(t) })).status).toBe(200);
        expect(signatureHeader(new Headers({ "x-netquor-signature-256": hex, "x-netquor-timestamp": "12ab" }))).toBeNull();
    });
    test("a signed price.changed that also carries a snapshot is not a nudge (it is ingested as a snapshot)", async () => {
        const x = setup();
        const s = { ...x.cache.get(), version: x.cache.get().version + 1 };
        const r = await x.std({ type: "price.changed", id: "z", snapshot: JSON.parse(serializeSnapshot(s)) });
        expect(r.status).toBe(200);
        expect(x.pulls()).toBe(0);
        expect(x.cache.get().version).toBe(s.version);
    });
    test("the seen-id memory is bounded and expires after 24 h", () => {
        const c = { ms: 0 };
        const ids = createSeenIds({ now: () => c.ms, max: 3 });
        for (const id of ["a", "b", "c", "d"]) expect(ids.accept(id)).toBe(true);
        expect(ids.size()).toBe(3);
        expect(ids.accept("a")).toBe(true); // forgotten: pushed out
        const day = createSeenIds({ now: () => c.ms });
        expect(day.accept("x")).toBe(true);
        c.ms += 24 * 3600_000;
        expect(day.accept("x")).toBe(false);
        c.ms += 1;
        expect(day.accept("x")).toBe(true);
    });
});

describe("catalog sources reach cache status and /health/detail", () => {
    test("a heartbeat or delivery carries sources; malformed entries are dropped; GET /health/detail shows them", async () => {
        const x = setup();
        const good = { "netquor-fleet": { version: 4, checksum: "abc", fetchedAt: "2026-11-10T12:00:00.000Z" } };
        expect((await x.std({ event: "poll.ok", sources: { ...good, "Bad Product": { version: 1 }, x: "y" } })).status).toBe(200);
        expect(x.cache.status().catalogSources).toEqual(good);
        const health = healthRoutes({ prices: () => x.cache.status() });
        const body = await (await health.handle(new Request("http://localhost/health/detail"))).json() as { prices: { catalogSources: unknown } };
        expect(body.prices.catalogSources).toEqual(good);
        // later report for another product merges
        await x.std({ event: "poll.ok", sources: { "netquor-phone": { version: 2, checksum: "d", fetchedAt: "2026-11-10T12:05:00.000Z" } } });
        expect(Object.keys(x.cache.status().catalogSources).sort()).toEqual(["netquor-fleet", "netquor-phone"]);
    });
});

describe("the nudge in catalog mode (createPricing)", () => {
    const cleanups: (() => void)[] = [];
    afterEach(() => { while (cleanups.length) cleanups.pop()!(); });
    const folder = () => {
        const f = tempDir(); cleanups.push(f.cleanup);
        const seed = join(f.dir, "seed.json");
        writeFileSync(seed, serializeSnapshot(seedSnapshot()));
        const dir = join(f.dir, "data"); mkdirSync(dir);
        return { dir, seedFile: seed };
    };
    const hook = async (routes: Elysia | undefined, body: unknown) => {
        const raw = JSON.stringify(body), ts = Math.floor(Date.now() / 1000);
        return routes!.handle(new Request("http://localhost/hooks/pricing", { method: "POST", body: raw, headers: { "x-netquor-signature": `t=${ts},v1=${signBody(SECRET, ts, raw)}` } }));
    };
    const env = { PRICING_WEBHOOK_SECRET: SECRET, NETQUOR_CATALOG_URL: "https://api.example.com" };

    test("price.changed pulls the catalog (not PRICING_API_URL), applies the change and records the sources", async () => {
        const f = folder();
        const urls: string[] = [];
        const log: string[] = [];
        const p = createPricing({ ...f, env: { ...env, PRICING_API_URL: "https://other.example.com/p" }, catalogMap: realMap(), log: (l) => log.push(l), fetch: async (url) => { urls.push(url); const product = new URL(url).searchParams.get("product"); return new Response(JSON.stringify(product === "netquor-fleet" ? fleetWith(645, 395) : realPhone())); } });
        const r = await hook(p.routes, event("evt_1"));
        expect(r.status).toBe(200);
        expect(urls.every((u) => u.startsWith("https://api.example.com/v1/catalog/price-books/current?product=netquor-"))).toBe(true);
        expect(urls).toHaveLength(2);
        expect(p.cache.get().prices["fleet.mac.year"].amountCents).toBe(6450);
        expect(p.cache.get().source).toBe("poll");
        expect(p.cache.status().catalogSources["netquor-fleet"].version).toBe(2);
        expect(log.some((l) => l.includes("catalog mode wins"))).toBe(true);
    });

    test("a catalog that answers with the same prices: unchanged, version stays", async () => {
        const f = folder();
        const p = createPricing({ ...f, env, catalogMap: realMap(), log: () => {}, fetch: async (url) => new Response(JSON.stringify(new URL(url).searchParams.get("product") === "netquor-fleet" ? realFleet() : realPhone())) });
        const v = p.cache.get().version;
        const r = await hook(p.routes, event("evt_1"));
        expect(await r.json()).toMatchObject({ ok: true, status: "unchanged" });
        expect(p.cache.get().version).toBe(v);
    });

    test("every product down: 503; a big change is refused by the guards (503 with the reason logged), nothing applied", async () => {
        const f = folder();
        const down = createPricing({ ...f, env, catalogMap: realMap(), log: () => {}, fetch: async () => new Response("x", { status: 500 }) });
        expect((await hook(down.routes, event("evt_1"))).status).toBe(503);
        const f2 = folder();
        const big = createPricing({ ...f2, env, catalogMap: realMap(), log: () => {}, fetch: async (url) => new Response(JSON.stringify(new URL(url).searchParams.get("product") === "netquor-phone" ? phoneWith(90_000_000) : realFleet())) });
        const r = await hook(big.routes, event("evt_2"));
        expect(r.status).toBe(503);
        expect(big.cache.get().prices["phone.planned_launch.month"].amountCents).toBe(2500);
    });

    test("an unreadable map turns catalog mode off with a log line and falls back to PRICING_API_URL", async () => {
        const f = folder();
        const log: string[] = [];
        const urls: string[] = [];
        const p = createPricing({ ...f, env: { ...env, CATALOG_MAP_FILE: "data/does-not-exist.json", PRICING_API_URL: "https://other.example.com/p" }, log: (l) => log.push(l), fetch: async (u) => { urls.push(u); return new Response("x", { status: 500 }); } });
        expect(log.some((l) => l.includes("catalog mode is off"))).toBe(true);
        await hook(p.routes, { event: "prices.changed" });
        expect(urls).toEqual(["https://other.example.com/p"]);
    });
});
