// worker.test.ts: the backup poll worker. Scheduling with a fake clock and fake API fetch; delivery to the real webhook routes (in process and over a local HTTP server); backoff bounds; holding a refused version; and the worker as a real process (SIGTERM, idle without config, writes nothing).
import { afterEach, describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { Elysia } from "elysia";
import { createNudger } from "./prices/nudge";
import { createFetcher, type Fetcher } from "./prices/pull";
import { createPricing } from "./prices/real";
import { priceRoutes } from "./prices/routes";
import { MAX_BACKOFF_MS } from "./prices/schedule";
import { NOW_MS, snap, tempDir, world } from "./prices/testkit";
import { createWorker, type Poster } from "./worker";

const SECRET = "worker-secret-0123456789";
const INTERVAL = 900;
const ten = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k.p${i}`, 1000]));
const next = (v: number, a = 100 + v) => snap(v, { "a.one": a, "b.two": 200, "c.three": 300, "d.four": 400 });

type ApiAnswer = Response | Error;
/** A scripted API: each call takes the next answer (the last one repeats). Records what it was asked. */
const scriptedApi = (answers: ApiAnswer[]) => {
    const calls: { etag: string | undefined }[] = [];
    let i = 0;
    const fetch: Fetcher = async (_url, init) => {
        calls.push({ etag: init.headers["if-none-match"] });
        const a = answers[Math.min(i++, answers.length - 1)];
        if (a instanceof Error) throw a;
        return a.clone();
    };
    return { fetch, calls };
};
const snapRes = (s: unknown, etag = '"e"') => new Response(JSON.stringify(s), { headers: { etag } });

/** A fake clock: sleeping records the delay and returns at once; after `max` sleeps it stops the worker. */
const fakeClock = (stop: AbortController, max: number) => {
    const delays: number[] = [];
    return { delays, clock: { sleep: async (ms: number) => { delays.push(ms); if (delays.length >= max) stop.abort(); } } };
};

const build = (o: { api: Fetcher; post?: Poster; web?: ReturnType<typeof world>; sleeps?: number; random?: () => number; initial?: ReturnType<typeof snap> }) => {
    const w = o.web ?? world(o.initial ?? snap(1));
    const lines: string[] = [];
    const app = priceRoutes({ secrets: () => [SECRET], now: () => NOW_MS, ingest: w.ingest, cache: w.cache, nudge: createNudger({ pull: async () => ({ kind: "unchanged" }), now: () => NOW_MS }), log: (l) => lines.push(`web: ${l}`), limitPerMinute: 1000 });
    const posts: { body: unknown; status: number }[] = [];
    const post: Poster = o.post ?? (async (url, init) => { const res = await app.handle(new Request(url, init)); posts.push({ body: JSON.parse(init.body), status: res.status }); return res; });
    const stop = new AbortController();
    const fc = fakeClock(stop, o.sleeps ?? 3);
    const worker = createWorker({ api: createFetcher({ url: "https://api.example.com/prices", token: "api-token-xyz", fetch: o.api }), webUrl: "http://netquor-web:3000", secret: SECRET, post, intervalSeconds: INTERVAL, clock: fc.clock, random: o.random ?? (() => 0.5), now: () => NOW_MS, log: (l) => lines.push(l) });
    return { w, worker, stop, lines, posts, delays: fc.delays };
};

describe("delivery", () => {
    test("a new snapshot is delivered to the web process as a signed poll; the next poll sends the ETag, and a 304 sends the heartbeat", async () => {
        const api = scriptedApi([snapRes(next(2)), new Response(null, { status: 304 }), new Response(null, { status: 304 })]);
        const b = build({ api: api.fetch });
        await b.worker.run(b.stop.signal);
        expect(b.w.cache.get()).toMatchObject({ version: 2, source: "poll" });
        expect(api.calls.map((c) => c.etag)).toEqual([undefined, '"e"', '"e"']);
        expect(b.posts.map((p) => (p.body as { event?: string }).event ?? "snapshot")).toEqual(["snapshot", "poll.ok", "poll.ok"]);
        expect(b.posts[0].body).toMatchObject({ via: "poll", snapshot: { version: 2 } });
        expect(b.w.cache.status().lastPollOkAt).not.toBeNull();
        expect(b.delays).toEqual([INTERVAL * 1000, INTERVAL * 1000, INTERVAL * 1000]);
        expect(b.lines.filter((l) => l.startsWith("prices-worker:")).slice(0, 3)).toEqual(["prices-worker: delivered version 2 (applied)", "prices-worker: unchanged", "prices-worker: unchanged"]);
    });

    test("the same version the web already has is delivered as unchanged, not an error", async () => {
        const b = build({ api: scriptedApi([snapRes(snap(1))]).fetch, sleeps: 1 });
        await b.worker.run(b.stop.signal);
        expect(b.lines).toContain("prices-worker: delivered version 1 (unchanged)");
    });

    test("it delivers to a real HTTP server running the webhook routes", async () => {
        const w = world();
        const app = new Elysia().use(priceRoutes({ secrets: () => [SECRET], now: Date.now, ingest: w.ingest, cache: w.cache, nudge: createNudger({ pull: async () => ({ kind: "unchanged" }), now: Date.now }) }));
        const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: (req) => app.handle(req) });
        try {
            const stop = new AbortController();
            const lines: string[] = [];
            const worker = createWorker({
                api: createFetcher({ url: "https://api.example.com/p", fetch: scriptedApi([snapRes(next(2))]).fetch }),
                webUrl: `http://127.0.0.1:${server.port}`, secret: SECRET, post: (u, i) => fetch(u, i), intervalSeconds: INTERVAL,
                clock: { sleep: async () => { stop.abort(); } }, random: () => 0.5, now: Date.now, log: (l) => lines.push(l),
            });
            await worker.run(stop.signal);
            expect(w.cache.get()).toMatchObject({ version: 2, source: "poll" });
        } finally { server.stop(true); }
    });

    test("a wrong secret is refused by the web (401): a failure with backoff, nothing applied", async () => {
        const b = build({ api: scriptedApi([snapRes(next(2))]).fetch, sleeps: 1 });
        const bad = createWorker({ api: createFetcher({ url: "https://api.example.com/p", fetch: scriptedApi([snapRes(next(2))]).fetch }), webUrl: "http://netquor-web:3000", secret: "not-the-right-secret-xx", post: async (u, i) => b.w.cache && (await priceRoutes({ secrets: () => [SECRET], now: () => NOW_MS, ingest: b.w.ingest, cache: b.w.cache, nudge: createNudger({ pull: async () => ({ kind: "unchanged" }), now: () => 0 }) }).handle(new Request(u, i))), intervalSeconds: INTERVAL, clock: { sleep: async () => { b.stop.abort(); } }, random: () => 0.5, now: () => NOW_MS, log: (l) => b.lines.push(l) });
        await bad.run(b.stop.signal);
        expect(b.w.cache.get().version).toBe(1);
        expect(b.lines.some((l) => l.includes("the web process answered 401") && l.includes("retry in"))).toBe(true);
    });
});

describe("healing a web process that is behind the API", () => {
    const ok304 = () => new Response(null, { status: 304 });
    test("the web restarts from the seed (version 1) while the API stays at 2 and answers 304: the next cycle re-fetches without the ETag and re-delivers at once", async () => {
        const api = scriptedApi([snapRes(next(2)), ok304(), snapRes(next(2)), ok304()]);
        const b = build({ api: api.fetch });
        expect((await b.worker.step(b.stop.signal)).delayMs).toBe(INTERVAL * 1000);
        expect(b.w.cache.get().version).toBe(2);
        b.w.cache.replace(snap(1), "seed"); // the web process came back from its seed
        const heal = await b.worker.step(b.stop.signal);
        expect(heal.delayMs).toBe(0); // immediately, not after the interval
        expect(b.worker.state().etag).toBeUndefined();
        expect(b.lines.some((l) => l.includes("web process is at version 1 but the API is at 2"))).toBe(true);
        expect((await b.worker.step(b.stop.signal)).delayMs).toBe(INTERVAL * 1000);
        expect(api.calls.map((c) => c.etag)).toEqual([undefined, '"e"', undefined]);
        expect(b.w.cache.get().version).toBe(2);
        // healed: the next 304 is an ordinary heartbeat
        expect((await b.worker.step(b.stop.signal)).delayMs).toBe(INTERVAL * 1000);
    });

    test("through run(): the sleep after the lagging heartbeat is 0 and the web is at the API's version one cycle later", async () => {
        const api = scriptedApi([snapRes(next(2)), ok304(), snapRes(next(2))]);
        const b = build({ api: api.fetch, sleeps: 3 });
        let n = 0;
        // restart the web right after the first delivery by wrapping the clock's first sleep
        const clock = { sleep: async (ms: number, signal: AbortSignal) => { b.delays.push(ms); if (++n === 1) b.w.cache.replace(snap(1), "seed"); if (n >= 3) b.stop.abort(); void signal; } };
        const worker = createWorker({ api: createFetcher({ url: "https://api.example.com/prices", fetch: api.fetch }), webUrl: "http://netquor-web:3000", secret: SECRET, post: async (url, init) => priceRoutes({ secrets: () => [SECRET], now: () => NOW_MS, ingest: b.w.ingest, cache: b.w.cache, nudge: createNudger({ pull: async () => ({ kind: "unchanged" }), now: () => NOW_MS }), limitPerMinute: 1000 }).handle(new Request(url, init)), intervalSeconds: INTERVAL, clock, random: () => 0.5, now: () => NOW_MS, log: () => {} });
        await worker.run(b.stop.signal);
        expect(b.delays).toEqual([INTERVAL * 1000, 0, INTERVAL * 1000]);
        expect(b.w.cache.get().version).toBe(2);
    });

    test("a web that stays behind after the re-delivery does not make the worker spin: one immediate retry per (API, web) pair", async () => {
        const api = scriptedApi([snapRes(next(2)), ok304()]);
        const lagging: Poster = async (_u, init) => {
            const body = JSON.parse(init.body);
            return new Response(JSON.stringify({ ok: true, version: 1, ...(body.snapshot ? { status: "unchanged" } : {}) }), { status: 200 });
        };
        const b = build({ api: api.fetch, post: lagging });
        expect((await b.worker.step(b.stop.signal)).delayMs).toBe(INTERVAL * 1000); // delivered
        expect((await b.worker.step(b.stop.signal)).delayMs).toBe(0); // 304, web says 1: heal once
        expect((await b.worker.step(b.stop.signal)).delayMs).toBe(INTERVAL * 1000); // delivered again (200 body), etag stored
        expect((await b.worker.step(b.stop.signal)).delayMs).toBe(INTERVAL * 1000); // 304, same pair: no second heal
    });

    test("no heal when the web is ahead, equal, silent about its version, or has refused the API's version", async () => {
        for (const reply of [{ ok: true, version: 9 }, { ok: true, version: 2 }, { ok: true }]) {
            const api = scriptedApi([snapRes(next(2)), ok304()]);
            const post: Poster = async (_u, init) => new Response(JSON.stringify(JSON.parse(init.body).snapshot ? { ok: true, status: "applied", version: 2 } : reply), { status: 200 });
            const b = build({ api: api.fetch, post });
            await b.worker.step(b.stop.signal);
            expect((await b.worker.step(b.stop.signal)).delayMs).toBe(INTERVAL * 1000);
        }
        // the web refused version 3 (too large): it is held, and the web being at 2 is the point, not a fault
        const w = world(snap(1, ten));
        const api = scriptedApi([snapRes(snap(2, { ...ten, "k.p0": 0 })), ok304()]);
        const b = build({ api: api.fetch, web: w });
        await b.worker.step(b.stop.signal);
        expect(b.worker.state().held).not.toBeNull();
        expect((await b.worker.step(b.stop.signal)).delayMs).toBe(INTERVAL * 1000);
    });
});

describe("backoff", () => {
    test("API failures back off within bounds, up to an hour, and a success returns to the interval", async () => {
        const answers: ApiAnswer[] = [...Array.from({ length: 12 }, () => new Response("", { status: 503 })), new Response(null, { status: 304 })];
        for (const rnd of [0, 0.5, 0.999]) {
            const b = build({ api: scriptedApi(answers).fetch, sleeps: 13, random: () => rnd });
            await b.worker.run(b.stop.signal);
            const failures = b.delays.slice(0, 12);
            for (const [i, ms] of failures.entries()) {
                expect(ms).toBeGreaterThanOrEqual(INTERVAL * 1000);
                expect(ms).toBeLessThanOrEqual(MAX_BACKOFF_MS);
                if (i < 2) expect(ms).toBeLessThanOrEqual(INTERVAL * 1000 * 2 ** (i + 1));
            }
            expect(failures[11]).toBeGreaterThanOrEqual(MAX_BACKOFF_MS / 2); // it did climb
            expect(b.delays[12]).toBe(INTERVAL * 1000); // success: back to the interval
            expect(b.lines.some((l) => l.includes("poll failed: the API answered 503; retry in"))).toBe(true);
        }
    });

    test("network errors and an unreachable web process are failures with backoff, and the ETag is kept until delivery works", async () => {
        const api = scriptedApi([snapRes(next(2))]);
        let calls = 0;
        const b = build({ api: api.fetch, sleeps: 3, post: async (url, init) => { calls++; if (calls < 3) throw new Error("ECONNREFUSED netquor-web:3000"); return new Response(JSON.stringify({ ok: true, status: "applied", version: 2 })); } });
        await b.worker.run(b.stop.signal);
        expect(b.lines.filter((l) => l.includes("could not reach the web process")).length).toBe(2);
        expect(b.lines.some((l) => l.includes("delivered version 2"))).toBe(true);
        expect(api.calls.map((c) => c.etag)).toEqual([undefined, undefined, undefined]); // no ETag stored until it was delivered
        expect(b.delays[0]).toBeGreaterThan(INTERVAL * 1000);
        expect(b.delays[2]).toBe(INTERVAL * 1000);
    });

    test("a web 5xx or 429 is a failure, not a hold", async () => {
        for (const status of [500, 503, 429]) {
            const b = build({ api: scriptedApi([snapRes(next(2))]).fetch, sleeps: 2, post: async () => new Response("{}", { status }) });
            await b.worker.run(b.stop.signal);
            expect(b.worker.state().held).toBeNull();
            expect(b.worker.state().failures).toBeGreaterThan(0);
        }
    });
});

describe("a version the web refused is not retried", () => {
    test("422 change_too_large: held; the same and older versions are not sent again; a newer version is", async () => {
        const web = world(snap(1, ten));
        const bad = snap(2, { ...ten, "k.p0": 0 });
        const api = scriptedApi([snapRes(bad, '"a"'), snapRes(bad, '"b"'), snapRes(snap(2, { ...ten, "k.p0": 0 }, { updatedAt: "2026-11-10T09:00:00.000Z" }), '"c"'), snapRes(snap(3, { ...ten, "k.p0": 1100 }), '"d"')]);
        const b = build({ api: api.fetch, web, sleeps: 4 });
        await b.worker.run(b.stop.signal);
        const snapshotPosts = b.posts.filter((p) => "snapshot" in (p.body as object));
        expect(snapshotPosts.map((p) => [p.status, (p.body as { snapshot: { version: number } }).snapshot.version])).toEqual([[422, 2], [200, 3]]);
        expect(b.posts.filter((p) => (p.body as { event?: string }).event === "poll.ok")).toHaveLength(2); // heartbeats while holding
        expect(b.lines.filter((l) => l.includes("still holding version 2"))).toHaveLength(2);
        expect(web.cache.get().version).toBe(3);
        expect(b.lines.some((l) => l.includes("not retrying it until a newer version appears"))).toBe(true);
    });

    test("409 (the web already has a newer version): held until the API gets past it", async () => {
        const web = world(snap(10));
        const api = scriptedApi([snapRes(next(4), '"a"'), snapRes(next(4), '"b"'), snapRes(next(9), '"c"'), snapRes(next(11), '"d"')]);
        const b = build({ api: api.fetch, web, sleeps: 4 });
        await b.worker.run(b.stop.signal);
        const versions = b.posts.filter((p) => "snapshot" in (p.body as object)).map((p) => [p.status, (p.body as { snapshot: { version: number } }).snapshot.version]);
        expect(versions).toEqual([[409, 4], [409, 9], [200, 11]]); // 9 is newer than the held 4, so it is tried once and held in turn
        expect(web.cache.get().version).toBe(11);
    });

    test("an invalid snapshot (422 invalid) is held by content: the same bytes are not resent, a fixed one is", async () => {
        const broken = { schema: 1, version: 2 };
        const api = scriptedApi([snapRes(broken, '"a"'), snapRes(broken, '"b"'), snapRes(next(2), '"c"')]);
        const b = build({ api: api.fetch, sleeps: 3 });
        await b.worker.run(b.stop.signal);
        const sent = b.posts.filter((p) => "snapshot" in (p.body as object)).map((p) => p.status);
        expect(sent).toEqual([422, 200]);
        expect(b.w.cache.get().version).toBe(2);
    });

    test("an operator accepting the large change lets the poll agree again (the web has it, so the delivery is unchanged)", async () => {
        const web = world(snap(1, ten));
        const bad = snap(2, { ...ten, "k.p0": 0 });
        const b = build({ api: scriptedApi([snapRes(bad)]).fetch, web, sleeps: 1 });
        await b.worker.run(b.stop.signal);
        await web.ingest({ ...bad }, { source: "operator", allowLargeChange: true, reason: "ok" });
        const c = build({ api: scriptedApi([snapRes(bad)]).fetch, web, sleeps: 1 });
        await c.worker.run(c.stop.signal);
        expect(c.lines).toContain("prices-worker: delivered version 2 (unchanged)");
    });
});

describe("stopping", () => {
    test("aborting during the sleep ends the loop at once with a log line", async () => {
        const stop = new AbortController();
        const lines: string[] = [];
        const worker = createWorker({ api: createFetcher({ url: "https://api.example.com/p", fetch: scriptedApi([new Response(null, { status: 304 })]).fetch }), webUrl: "http://netquor-web:3000", secret: SECRET, post: async () => new Response("{}"), intervalSeconds: INTERVAL, clock: { sleep: (_ms, signal) => new Promise<void>((r) => signal.addEventListener("abort", () => r())) }, random: () => 0.5, now: () => NOW_MS, log: (l) => lines.push(l) });
        const run = worker.run(stop.signal);
        await new Promise((r) => setTimeout(r, 20));
        stop.abort();
        await run;
        expect(lines.at(-1)).toBe("prices-worker: stopped");
    });

    test("aborting during an in-flight API call cancels it and ends without a failure or a delivery", async () => {
        const stop = new AbortController();
        const lines: string[] = [];
        let posted = 0, sawAbort = false;
        const hang: Fetcher = (_u, init) => new Promise<Response>((_res, rej) => init.signal.addEventListener("abort", () => { sawAbort = true; rej(new Error("aborted")); }));
        const worker = createWorker({ api: createFetcher({ url: "https://api.example.com/p", fetch: hang }), webUrl: "http://netquor-web:3000", secret: SECRET, post: async () => { posted++; return new Response("{}"); }, intervalSeconds: INTERVAL, clock: { sleep: async () => {} }, random: () => 0.5, now: () => NOW_MS, log: (l) => lines.push(l) });
        const run = worker.run(stop.signal);
        await new Promise((r) => setTimeout(r, 20));
        stop.abort();
        await run;
        expect(sawAbort).toBe(true);
        expect(posted).toBe(0);
        expect(lines).toEqual(["prices-worker: stopped"]);
    });

    test("aborting while delivering ends cleanly", async () => {
        const stop = new AbortController();
        const lines: string[] = [];
        const worker = createWorker({ api: createFetcher({ url: "https://api.example.com/p", fetch: scriptedApi([snapRes(next(2))]).fetch }), webUrl: "http://netquor-web:3000", secret: SECRET, post: (_u, init) => new Promise<Response>((_r, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted")))), intervalSeconds: INTERVAL, clock: { sleep: async () => {} }, random: () => 0.5, now: () => NOW_MS, log: (l) => lines.push(l) });
        const run = worker.run(stop.signal);
        await new Promise((r) => setTimeout(r, 20));
        stop.abort();
        await run;
        expect(lines).toEqual(["prices-worker: stopped"]);
    });
});

describe("what it never logs", () => {
    test("no secret, token or address appears in any line", async () => {
        const api = scriptedApi([new Response("", { status: 500 }), snapRes(next(2)), new Response(null, { status: 304 })]);
        const b = build({ api: api.fetch, sleeps: 3 });
        await b.worker.run(b.stop.signal);
        const all = b.lines.filter((l) => l.startsWith("prices-worker:")).join("\n");
        for (const secret of [SECRET, "api-token-xyz", "api.example.com", "netquor-web"]) expect(all).not.toContain(secret);
    });
});

describe("the worker as a process", () => {
    const cleanups: (() => void)[] = [];
    afterEach(() => { while (cleanups.length) cleanups.pop()!(); });
    const spawn = (env: Record<string, string>) => {
        const data = tempDir();
        cleanups.push(data.cleanup);
        const proc = Bun.spawn(["bun", join(import.meta.dir, "worker.ts")], { env: { ...process.env, PRICES_DIR: data.dir, PRICING_API_URL: "", PRICING_API_TOKEN: "", PRICING_POLL_SECONDS: "", PRICING_WEBHOOK_SECRET: "", PRICING_WEBHOOK_SECRET_NEXT: "", WEB_INTERNAL_URL: "", ...env }, stdout: "pipe", stderr: "pipe" });
        const out = { text: "" };
        (async () => { for await (const c of proc.stdout) out.text += new TextDecoder().decode(c); })();
        return { proc, out, data };
    };
    const waitFor = async (read: () => string, text: string) => { for (let i = 0; i < 300; i++) { if (read().includes(text)) return; await new Promise((r) => setTimeout(r, 25)); } throw new Error(`never saw "${text}" in:\n${read()}`); };

    test("with no PRICING_API_URL it logs once, stays alive (no restart loop), and exits 0 on SIGTERM", async () => {
        const w = spawn({});
        await waitFor(() => w.out.text, "PRICING_API_URL is not set");
        await new Promise((r) => setTimeout(r, 300));
        expect(w.proc.exitCode).toBeNull(); // still running
        w.proc.kill("SIGTERM");
        expect(await w.proc.exited).toBe(0);
        expect(w.out.text.match(/polling is off/g)?.length).toBe(1);
    });

    test("a too-short secret, a bad API address or a bad web address keep polling off", async () => {
        const cases: [Record<string, string>, string][] = [
            [{ PRICING_API_URL: "https://account.netquor.com/p", PRICING_WEBHOOK_SECRET: "short" }, "cannot be signed"],
            [{ PRICING_API_URL: "http://evil.example/p", PRICING_WEBHOOK_SECRET: SECRET }, "PRICING_API_URL must be https"],
            [{ PRICING_API_URL: "https://u:p@account.netquor.com/p", PRICING_WEBHOOK_SECRET: SECRET }, "user name or password"],
            [{ PRICING_API_URL: "https://account.netquor.com/p", PRICING_WEBHOOK_SECRET: SECRET, WEB_INTERNAL_URL: "ftp://x" }, "WEB_INTERNAL_URL"],
        ];
        for (const [env, text] of cases) {
            const w = spawn(env);
            await waitFor(() => w.out.text, text);
            expect(w.out.text).toContain("polling is off");
            expect(w.out.text).not.toContain(SECRET);
            w.proc.kill("SIGTERM");
            expect(await w.proc.exited).toBe(0);
        }
    });

    test("end to end: it polls a fake API with its token, delivers to a real web process, writes no file, and stops on SIGTERM", async () => {
        const seen: { auth: string | null; inm: string | null }[] = [];
        const api = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: (req) => { seen.push({ auth: req.headers.get("authorization"), inm: req.headers.get("if-none-match") }); return new Response(JSON.stringify(snap(2, { "a.one": 105, "b.two": 200, "c.three": 300, "d.four": 400 })), { headers: { etag: '"x"' } }); } });
        const webData = tempDir();
        cleanups.push(webData.cleanup);
        const seed = join(webData.dir, "seed.json");
        await Bun.write(seed, JSON.stringify(snap(1, { "a.one": 100, "b.two": 200, "c.three": 300, "d.four": 400 }, { source: "seed" })));
        const pricing = createPricing({ env: { PRICING_WEBHOOK_SECRET: SECRET }, dir: webData.dir, seedFile: seed, log: () => {} });
        const web = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: (req) => (pricing.routes as unknown as Elysia).handle(req) });
        try {
            const w = spawn({ PRICING_API_URL: `http://127.0.0.1:${api.port}/`, PRICING_API_TOKEN: "tok-abc-def", PRICING_WEBHOOK_SECRET: SECRET, WEB_INTERNAL_URL: `http://127.0.0.1:${web.port}` });
            await waitFor(() => w.out.text, "delivered version 2 (applied)");
            expect(pricing.cache.get()).toMatchObject({ version: 2, source: "poll" });
            expect(pricing.cache.status().lastPollOkAt).not.toBeNull();
            expect(seen[0]).toEqual({ auth: "Bearer tok-abc-def", inm: null });
            expect(readdirSync(w.data.dir)).toEqual([]); // the worker wrote nothing
            w.proc.kill("SIGTERM");
            expect(await w.proc.exited).toBe(0);
            expect(w.out.text).toContain("stopped");
            for (const secret of [SECRET, "tok-abc-def"]) expect(w.out.text).not.toContain(secret);
        } finally { api.stop(true); web.stop(true); }
    });
});
