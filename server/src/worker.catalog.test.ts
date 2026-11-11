// worker.catalog.test.ts: the worker in catalog mode, with the real price book fixtures, a fake catalog fetch, and the real webhook routes (in process and over a local HTTP server).
import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";
import { createCatalogPuller, type Fetcher } from "./prices/catalog";
import { fleetWith, phoneWith, realFleet, realMap, realPhone, seedSnapshot } from "./prices/catalog.testkit";
import { createNudger } from "./prices/nudge";
import { priceRoutes } from "./prices/routes";
import { NOW_MS, world } from "./prices/testkit";
import { createCatalogWorker, type Poster } from "./worker";

const V = seedSnapshot().version;
const SECRET = "worker-secret-0123456789";
const INTERVAL = 300;
type Answer = Response | Error | ((etag: string | undefined) => Response | Error);
/** A scripted catalog: per product, a queue of answers (the last repeats). */
const catalog = (script: Record<string, Answer[]>) => {
    const calls: { product: string; etag: string | undefined }[] = [];
    const idx: Record<string, number> = {};
    const fetch: Fetcher = async (url, init) => {
        const product = new URL(url).searchParams.get("product")!;
        calls.push({ product, etag: init.headers["if-none-match"] });
        const q = script[product], i = Math.min(idx[product] ?? 0, q.length - 1);
        idx[product] = (idx[product] ?? 0) + 1;
        const a = q[i];
        const r = typeof a === "function" ? a(init.headers["if-none-match"]) : a;
        if (r instanceof Error) throw r;
        return r.clone();
    };
    return { fetch, calls };
};
const book = (b: unknown, etag = '"e"') => new Response(JSON.stringify(b), { headers: { etag } });
const nm = () => new Response(null, { status: 304 });

const build = (cat: ReturnType<typeof catalog>, o: { limit?: number; products?: string[] } = {}) => {
    const w = world(seedSnapshot());
    const lines: string[] = [];
    const app = priceRoutes({ secrets: () => [SECRET], now: () => NOW_MS, ingest: w.ingest, cache: w.cache, nudge: createNudger({ pull: async () => ({ kind: "unchanged" }), now: () => NOW_MS }), log: (l) => lines.push(`web: ${l}`), limitPerMinute: o.limit ?? 1000 });
    const posts: { body: Record<string, unknown>; status: number }[] = [];
    const post: Poster = async (url, init) => { const res = await app.handle(new Request(url, init)); posts.push({ body: JSON.parse(init.body), status: res.status }); return res; };
    const clock = { ms: NOW_MS };
    const worker = createCatalogWorker({
        puller: createCatalogPuller({ baseUrl: "https://api.example.com", fetch: cat.fetch, now: () => clock.ms }),
        products: o.products ?? ["netquor-fleet", "netquor-phone"], map: realMap(), webUrl: "http://netquor-web:3000", secret: SECRET, post,
        get: (url, init) => app.handle(new Request(url, init)),
        intervalSeconds: INTERVAL, clock: { sleep: async () => {} }, random: () => 0.5, now: () => clock.ms, log: (l) => lines.push(l),
    });
    return { w, worker, lines, posts, clock, signal: new AbortController().signal };
};

describe("catalog worker cycles", () => {
    test("no change: nothing is delivered, a signed poll.ok heartbeat carries the sources", async () => {
        const b = build(catalog({ "netquor-fleet": [book(realFleet())], "netquor-phone": [book(realPhone())] }));
        expect((await b.worker.step(b.signal)).delayMs).toBe(INTERVAL * 1000);
        expect(b.posts).toHaveLength(1);
        expect(b.posts[0].body.event).toBe("poll.ok");
        expect(b.posts.some((p) => "snapshot" in p.body)).toBe(false);
        expect(b.w.cache.get().version).toBe(V);
        const src = b.w.cache.status().catalogSources;
        expect(src["netquor-fleet"]).toEqual({ version: 1, checksum: realFleet().checksum, fetchedAt: new Date(NOW_MS).toISOString() });
        expect(src["netquor-phone"].version).toBe(1);
        expect(b.w.cache.status().lastPollOkAt).not.toBeNull();
    });

    test("fleet-mac 595 to 645: one delivery of version 2 with year 6450 and lifetime 19350; the next cycle (304) is a heartbeat only", async () => {
        const b = build(catalog({ "netquor-fleet": [book(fleetWith(645, 395), '"f2"'), nm()], "netquor-phone": [book(realPhone(), '"p1"'), nm()] }));
        await b.worker.step(b.signal);
        const cur = b.w.cache.get();
        expect(cur).toMatchObject({ version: V + 1, source: "poll" });
        expect([cur.prices["fleet.mac.month"].amountCents, cur.prices["fleet.mac.year"].amountCents, cur.prices["fleet.mac.lifetime"].amountCents]).toEqual([645, 6450, 19350]);
        expect(cur.prices["fleet.mobile.month"].amountCents).toBe(395);
        expect(b.posts.map((p) => ("snapshot" in p.body ? "snapshot" : p.body.event))).toEqual(["snapshot"]);
        expect(b.w.cache.status().catalogSources["netquor-fleet"].version).toBe(2);
        await b.worker.step(b.signal);
        expect(b.posts.map((p) => ("snapshot" in p.body ? "snapshot" : p.body.event))).toEqual(["snapshot", "poll.ok"]);
        expect(b.w.cache.get().version).toBe(V + 1);
        expect(b.lines.filter((l) => l.startsWith("prices-worker: delivered"))).toHaveLength(1);
    });

    test("phone 25 to 29", async () => {
        const b = build(catalog({ "netquor-fleet": [book(realFleet())], "netquor-phone": [book(phoneWith(29_000_000))] }));
        await b.worker.step(b.signal);
        expect(b.w.cache.get().prices["phone.planned_launch.month"].amountCents).toBe(2900);
    });

    test("ETag is sent per product from the second cycle", async () => {
        const c = catalog({ "netquor-fleet": [book(realFleet(), '"f1"'), nm()], "netquor-phone": [book(realPhone(), '"p1"'), nm()] });
        const b = build(c);
        await b.worker.step(b.signal);
        await b.worker.step(b.signal);
        expect(c.calls.filter((x) => x.product === "netquor-fleet").map((x) => x.etag)).toEqual([undefined, '"f1"']);
        expect(c.calls.filter((x) => x.product === "netquor-phone").map((x) => x.etag)).toEqual([undefined, '"p1"']);
    });

    test("one product 500 and the other changes: a partial delivery; the failed product's keys are unchanged", async () => {
        const b = build(catalog({ "netquor-fleet": [new Response("x", { status: 500 })], "netquor-phone": [book(phoneWith(29_000_000))] }));
        expect((await b.worker.step(b.signal)).delayMs).toBe(INTERVAL * 1000);
        const cur = b.w.cache.get();
        expect(cur.version).toBe(V + 1);
        expect(cur.prices["phone.planned_launch.month"].amountCents).toBe(2900);
        expect(cur.prices["fleet.mac.month"].amountCents).toBe(595);
        expect(Object.keys(b.w.cache.status().catalogSources)).toEqual(["netquor-phone"]);
        expect(b.lines.some((l) => l.includes("netquor-fleet: the API answered 500"))).toBe(true);
    });

    test("every product failing is a failure with backoff, nothing sent to the web", async () => {
        const b = build(catalog({ "netquor-fleet": [new Error("down")], "netquor-phone": [new Error("down")] }));
        const r = await b.worker.step(b.signal);
        expect(r.delayMs).toBeGreaterThanOrEqual(INTERVAL * 1000);
        expect(b.worker.state().failures).toBe(1);
        expect(b.posts).toHaveLength(0);
    });

    test("429 with Retry-After: that product is not asked again before it passes, the delay honours it, the other product still delivers", async () => {
        const c = catalog({ "netquor-fleet": [new Response("", { status: 429, headers: { "retry-after": "900" } })], "netquor-phone": [book(phoneWith(29_000_000)), nm()] });
        const b = build(c);
        const r = await b.worker.step(b.signal);
        expect(r.delayMs).toBe(900_000);
        expect(b.w.cache.get().prices["phone.planned_launch.month"].amountCents).toBe(2900);
        b.clock.ms += 300_000;
        await b.worker.step(b.signal);
        expect(c.calls.filter((x) => x.product === "netquor-fleet")).toHaveLength(1);
    });

    test("a missing sku warns once and keeps the old value; no delivery", async () => {
        const b = build(catalog({ "netquor-fleet": [book(realFleet())], "netquor-phone": [book(phoneWith(null))] }));
        await b.worker.step(b.signal);
        await b.worker.step(b.signal);
        expect(b.lines.filter((l) => l.includes("phone.planned_launch.month") && l.includes("phone.starter.monthly"))).toHaveLength(1);
        expect(b.w.cache.get().prices["phone.planned_launch.month"].amountCents).toBe(2500);
        expect(b.posts.every((p) => p.body.event === "poll.ok")).toBe(true);
    });

    test("guard refusal (a 60 percent jump): logged once per book content with the operator hint, not retried until the book changes", async () => {
        const c = catalog({ "netquor-fleet": [book(realFleet())], "netquor-phone": [book(phoneWith(40_000_000, 2)), book(phoneWith(40_000_000, 2)), book(phoneWith(41_000_000, 3))] });
        const b = build(c);
        await b.worker.step(b.signal);
        expect(b.posts[0].status).toBe(422);
        expect(b.w.cache.get().version).toBe(V);
        const hint = b.lines.filter((l) => l.includes("change_too_large") && l.includes("--allow-large"));
        expect(hint).toHaveLength(1);
        await b.worker.step(b.signal);
        expect(b.posts.filter((p) => "snapshot" in p.body)).toHaveLength(1); // not resent
        expect(b.posts.at(-1)!.body.event).toBe("poll.ok");
        expect(b.lines.filter((l) => l.includes("--allow-large") && l.includes("refused the change"))).toHaveLength(1);
        await b.worker.step(b.signal); // the book changed (version 3): tried again
        expect(b.posts.filter((p) => "snapshot" in p.body)).toHaveLength(2);
        expect(b.lines.filter((l) => l.includes("refused the change"))).toHaveLength(2);
    });

    test("409 (the web moved on): the next cycle re-reads the web snapshot and delivers on top of it", async () => {
        const c = catalog({ "netquor-fleet": [book(realFleet())], "netquor-phone": [book(phoneWith(29_000_000))] });
        const b = build(c);
        let first = true;
        const realPost = (b.worker as unknown as { step: unknown }).step; void realPost;
        // The web process takes a manual change (version 2) between the worker's read of /api/prices and its delivery.
        const w2 = world(seedSnapshot());
        const app = priceRoutes({ secrets: () => [SECRET], now: () => NOW_MS, ingest: w2.ingest, cache: w2.cache, nudge: createNudger({ pull: async () => ({ kind: "unchanged" }), now: () => NOW_MS }), limitPerMinute: 1000 });
        const lines: string[] = [];
        const worker = createCatalogWorker({
            puller: createCatalogPuller({ baseUrl: "https://api.example.com", fetch: c.fetch, now: () => NOW_MS }), products: ["netquor-fleet", "netquor-phone"], map: realMap(), webUrl: "http://netquor-web:3000", secret: SECRET,
            post: async (u, i) => { if (first) { first = false; await w2.ingest({ ...w2.cache.get(), version: V + 1, updatedAt: "2026-11-10T01:00:00.000Z", prices: { ...w2.cache.get().prices, "vpn.from.month": { amountCents: 520, currency: "USD" } } }, { source: "webhook" }); } return app.handle(new Request(u, i)); },
            get: (u, i) => app.handle(new Request(u, i)), intervalSeconds: INTERVAL, clock: { sleep: async () => {} }, random: () => 0.5, now: () => NOW_MS, log: (l) => lines.push(l),
        });
        const signal = new AbortController().signal;
        await worker.step(signal);
        expect(lines.some((l) => l.includes("moved on (409"))).toBe(true);
        expect(w2.cache.get().version).toBe(V + 1);
        expect(w2.cache.get().prices["phone.planned_launch.month"].amountCents).toBe(2500);
        await worker.step(signal);
        expect(w2.cache.get()).toMatchObject({ version: V + 2 });
        expect(w2.cache.get().prices["phone.planned_launch.month"].amountCents).toBe(2900);
        expect(w2.cache.get().prices["vpn.from.month"].amountCents).toBe(520);
        void b;
    });

    test("a web process behind (restarted from the seed) is brought up: the candidate is built from what the web holds now", async () => {
        const c = catalog({ "netquor-fleet": [book(realFleet()), nm()], "netquor-phone": [book(phoneWith(29_000_000)), nm()] });
        const b = build(c);
        await b.worker.step(b.signal);
        expect(b.w.cache.get().prices["phone.planned_launch.month"].amountCents).toBe(2900);
        b.w.cache.replace(seedSnapshot(), "seed"); // the web comes back from its seed
        await b.worker.step(b.signal); // the books are 304, the kept ones are used
        expect(b.w.cache.get().prices["phone.planned_launch.month"].amountCents).toBe(2900);
    });

    test("an unreachable or refusing web process is a failure with backoff", async () => {
        const w = world(seedSnapshot());
        const worker = createCatalogWorker({
            puller: createCatalogPuller({ baseUrl: "https://api.example.com", fetch: catalog({ "netquor-fleet": [book(realFleet())], "netquor-phone": [book(realPhone())] }).fetch, now: () => NOW_MS }),
            products: ["netquor-fleet", "netquor-phone"], map: realMap(), webUrl: "http://netquor-web:3000", secret: SECRET,
            post: async () => new Response("", { status: 401 }), get: async () => { const s = (await import("./prices/snapshot")).serializeSnapshot(w.cache.get()); return new Response(s); },
            intervalSeconds: INTERVAL, clock: { sleep: async () => {} }, random: () => 0.5, now: () => NOW_MS, log: () => {},
        });
        const r = await worker.step(new AbortController().signal);
        expect(r.delayMs).toBeGreaterThanOrEqual(INTERVAL * 1000);
        expect(worker.state().failures).toBe(1);
    });
});

describe("catalog worker over real HTTP", () => {
    test("a local fake catalog (http on loopback) and a local web server running the real routes", async () => {
        const w = world(seedSnapshot());
        const app = new Elysia().use(priceRoutes({ secrets: () => [SECRET], now: Date.now, ingest: w.ingest, cache: w.cache, nudge: createNudger({ pull: async () => ({ kind: "unchanged" }), now: Date.now }) }));
        const web = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: (r) => app.handle(r) });
        const seenUa: string[] = [];
        const api = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: (r) => {
            seenUa.push(r.headers.get("user-agent") ?? "");
            const product = new URL(r.url).searchParams.get("product");
            return new Response(JSON.stringify(product === "netquor-fleet" ? fleetWith(645, 395) : realPhone()), { headers: { etag: '"x"' } });
        } });
        try {
            const lines: string[] = [];
            const worker = createCatalogWorker({
                puller: createCatalogPuller({ baseUrl: `http://127.0.0.1:${api.port}`, fetch: (u, i) => fetch(u, i), now: Date.now }),
                products: ["netquor-fleet", "netquor-phone"], map: realMap(), webUrl: `http://127.0.0.1:${web.port}`, secret: SECRET,
                post: (u, i) => fetch(u, i), get: (u, i) => fetch(u, i), intervalSeconds: INTERVAL, clock: { sleep: async () => {} }, random: () => 0.5, now: Date.now, log: (l) => lines.push(l),
            });
            await worker.step(new AbortController().signal);
            expect(w.cache.get()).toMatchObject({ version: V + 1, source: "poll" });
            expect(w.cache.get().prices["fleet.mac.lifetime"].amountCents).toBe(19350);
            expect(seenUa.every((u) => u === "netquor-web-worker")).toBe(true);
            await worker.step(new AbortController().signal);
            expect(w.cache.get().version).toBe(V + 1); // same books: nothing new
        } finally { web.stop(true); api.stop(true); }
    });
});

describe("the worker as a real process in catalog mode", () => {
    const run = async (env: Record<string, string>, until: (out: string) => boolean) => {
        const proc = Bun.spawn(["bun", `${import.meta.dir}/worker.ts`], { env: { ...process.env, PRICING_API_URL: "", PRICING_WEBHOOK_SECRET: "", PRICING_WEBHOOK_SECRET_NEXT: "", WEB_INTERNAL_URL: "", PRICING_POLL_SECONDS: "", NETQUOR_CATALOG_PRODUCTS: "", CATALOG_MAP_FILE: "", ...env }, stdout: "pipe", stderr: "pipe" });
        let out = "";
        const reader = proc.stdout.getReader();
        const deadline = Date.now() + 8000;
        while (!until(out) && Date.now() < deadline) {
            const r = await Promise.race([reader.read(), new Promise<null>((res) => setTimeout(() => res(null), 200))]);
            if (r && !r.done) out += new TextDecoder().decode(r.value);
            if (r && r.done) break;
        }
        proc.kill("SIGTERM");
        await proc.exited;
        return out;
    };

    test("catalog mode wins over PRICING_API_URL, says so, polls the catalog and delivers to the web process (every 300 s by default)", async () => {
        const w = world(seedSnapshot());
        const app = new Elysia().use(priceRoutes({ secrets: () => [SECRET], now: Date.now, ingest: w.ingest, cache: w.cache, nudge: createNudger({ pull: async () => ({ kind: "unchanged" }), now: Date.now }) }));
        const web = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: (r) => app.handle(r) });
        const api = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: (r) => new Response(JSON.stringify(new URL(r.url).searchParams.get("product") === "netquor-fleet" ? fleetWith(645, 395) : realPhone())) });
        try {
            const out = await run({ NETQUOR_CATALOG_URL: `http://127.0.0.1:${api.port}`, PRICING_API_URL: "https://other.example.com/p", PRICING_WEBHOOK_SECRET: SECRET, WEB_INTERNAL_URL: `http://127.0.0.1:${web.port}` }, (o) => o.includes("delivered version"));
            expect(out).toContain("catalog mode wins");
            expect(out).toContain("every 300 s");
            expect(w.cache.get().prices["fleet.mac.month"].amountCents).toBe(645);
        } finally { web.stop(true); api.stop(true); }
    });

    test("it idles with a clear line when the secret is missing, the map is unreadable, or no product is in the map", async () => {
        expect(await run({ NETQUOR_CATALOG_URL: "https://api.example.com" }, (o) => o.includes("polling is off"))).toContain("PRICING_WEBHOOK_SECRET is not set");
        expect(await run({ NETQUOR_CATALOG_URL: "https://api.example.com", PRICING_WEBHOOK_SECRET: SECRET, CATALOG_MAP_FILE: "data/nope.json" }, (o) => o.includes("polling is off"))).toContain("polling is off");
        expect(await run({ NETQUOR_CATALOG_URL: "https://api.example.com", PRICING_WEBHOOK_SECRET: SECRET, NETQUOR_CATALOG_PRODUCTS: "netquor-sdn" }, (o) => o.includes("polling is off"))).toContain("none of NETQUOR_CATALOG_PRODUCTS is in the catalog map");
        expect(await run({ NETQUOR_CATALOG_URL: "http://api.example.com", PRICING_WEBHOOK_SECRET: SECRET }, (o) => o.includes("polling is off"))).toContain("NETQUOR_CATALOG_URL must be https");
    });
});
