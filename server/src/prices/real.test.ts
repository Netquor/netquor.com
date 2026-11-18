// real.test.ts: createPricing(): the real wiring on a temp folder with a fake API: routes on or off by secret, a webhook that survives a restart, the nudge pull, the baked-in seed, and the public contract file.
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Elysia } from "elysia";
import * as contract from "./index";
import { createPricing } from "./real";
import { serverRoot } from "./env";
import { signBody } from "./signature";
import { serializeSnapshot } from "./snapshot";
import { snap, tempDir } from "./testkit";

const cleanups: (() => void)[] = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });
const SECRET = "real-secret-0123456789";

const folder = () => {
    const t = tempDir();
    cleanups.push(t.cleanup);
    const seed = join(t.dir, "seed.json");
    writeFileSync(seed, serializeSnapshot(snap(1, undefined, { source: "seed" })));
    const dir = join(t.dir, "data");
    mkdirSync(dir);
    return { dir, seedFile: seed };
};
const signed = (body: unknown) => {
    const raw = JSON.stringify(body), t = Math.floor(Date.now() / 1000);
    return new Request("http://localhost/hooks/pricing", { method: "POST", body: raw, headers: { "x-netquor-signature": `t=${t},v1=${signBody(SECRET, t, raw)}` } });
};

describe("createPricing", () => {
    test("with no secret there are no routes, but the cache still serves the seed", () => {
        const f = folder();
        const lines: string[] = [];
        const p = createPricing({ env: {}, ...f, log: (l) => lines.push(l) });
        expect(p.routes).toBeUndefined();
        expect(p.cache.get().version).toBe(1);
        expect(lines.some((l) => l.includes("loaded version 1 from seed"))).toBe(true);
    });

    test("a short secret is ignored with one warning and keeps the routes off", () => {
        const f = folder();
        const lines: string[] = [];
        const p = createPricing({ env: { PRICING_WEBHOOK_SECRET: "short" }, ...f, log: (l) => lines.push(l) });
        expect(p.routes).toBeUndefined();
        expect(lines.filter((l) => l.includes("shorter than 16"))).toHaveLength(1);
    });

    test("a webhook snapshot is applied, persisted, and a restart loads it from prices.json", async () => {
        const f = folder();
        const p = createPricing({ env: { PRICING_WEBHOOK_SECRET: SECRET }, ...f, log: () => {} });
        const r = await (p.routes as Elysia).handle(signed({ snapshot: snap(2, { "a.one": 105, "b.two": 200, "c.three": 300, "d.four": 400 }) }));
        expect(r.status).toBe(200);
        expect(p.cache.get().version).toBe(2);
        expect(JSON.parse(readFileSync(join(f.dir, "prices.json"), "utf8"))).toMatchObject({ version: 2, source: "webhook" });
        const again = createPricing({ env: {}, ...f, log: () => {} });
        expect(again.cache.get().version).toBe(2);
    });

    test("a nudge pulls from PRICING_API_URL with the token, once, and applies it", async () => {
        const f = folder();
        const seen: { url: string; auth: string | undefined }[] = [];
        const p = createPricing({
            env: { PRICING_WEBHOOK_SECRET: SECRET, PRICING_API_URL: "https://api.example.com/prices", PRICING_API_TOKEN: "tok-1" }, ...f, log: () => {},
            fetch: async (url, init) => { seen.push({ url, auth: init.headers.authorization }); return new Response(JSON.stringify(snap(2, { "a.one": 105, "b.two": 200, "c.three": 300, "d.four": 400 }))); },
        });
        const app = p.routes as Elysia;
        expect(await (await app.handle(signed({ event: "prices.changed" }))).json()).toEqual({ ok: true, status: "applied", version: 2 });
        expect(await (await app.handle(signed({ event: "prices.changed" }))).json()).toEqual({ ok: true, coalesced: true });
        expect(seen).toEqual([{ url: "https://api.example.com/prices", auth: "Bearer tok-1" }]);
        expect(p.cache.get().source).toBe("poll");
    });

    test("a nudge with no PRICING_API_URL is a 503, not a crash", async () => {
        const f = folder();
        const p = createPricing({ env: { PRICING_WEBHOOK_SECRET: SECRET }, ...f, log: () => {} });
        const r = await (p.routes as Elysia).handle(signed({ event: "prices.changed" }));
        expect(r.status).toBe(503);
    });

    test("the repo's own seed is what the default seed path points at, and it loads", () => {
        const t = tempDir();
        cleanups.push(t.cleanup);
        const p = createPricing({ env: {}, dir: t.dir, log: () => {} });
        expect(p.cache.get().source).toBe("seed");
        expect(JSON.parse(readFileSync(join(serverRoot, "data", "prices.seed.json"), "utf8")).version).toBe(p.cache.get().version);
    });
});

describe("startup warning without a secret", () => {
    test("one clear line when PRICING_WEBHOOK_SECRET is unset; none when it is set; the routes are off", () => {
        const f = folder();
        const lines: string[] = [];
        const off = createPricing({ env: {}, dir: f.dir, seedFile: f.seedFile, log: (l) => lines.push(l) });
        expect(off.routes).toBeUndefined();
        const warn = lines.filter((l) => l.includes("PRICING_WEBHOOK_SECRET"));
        expect(warn).toHaveLength(1);
        expect(warn[0]).toContain("pricing routes");
        expect(warn[0]).toContain("off");
        expect(warn[0]).toContain("prices stay at the last snapshot");
        const on: string[] = [];
        expect(createPricing({ env: { PRICING_WEBHOOK_SECRET: SECRET }, dir: f.dir, seedFile: f.seedFile, log: (l) => on.push(l) }).routes).toBeDefined();
        expect(on.some((l) => l.includes("PRICING_WEBHOOK_SECRET"))).toBe(false);
    });
    test("DATA_DIR is where the store reads and writes when PRICES_DIR is unset", async () => {
        const f = folder();
        const p = createPricing({ env: { DATA_DIR: f.dir, PRICES_SEED_FILE: f.seedFile, PRICING_WEBHOOK_SECRET: SECRET }, log: () => {} });
        await p.ingest(snap(2, { "a.one": 105, "b.two": 200, "c.three": 300, "d.four": 400 }));
        expect(readFileSync(join(f.dir, "prices.json"), "utf8")).toContain('"version": 2');
    });
});

describe("the public contract (index.ts)", () => {
    test("exports what the web process imports", () => {
        for (const name of ["createPriceCache", "stampHtml", "renderLlms", "createPricing", "fileStore", "webhookSecrets"]) expect(typeof (contract as Record<string, unknown>)[name]).toBe("function");
    });
    test("createPriceCache returns get, version, status, replace, subscribe, markPollOk, markRefusal, markCatalogSources", () => {
        const c = contract.createPriceCache({ store: { load: () => ({ snapshot: snap(1), from: "seed", problems: [] }) }, clock: () => 0 });
        expect(Object.keys(c).sort()).toEqual(["get", "markCatalogSources", "markPollOk", "markRefusal", "replace", "status", "subscribe", "version"]);
    });
});
