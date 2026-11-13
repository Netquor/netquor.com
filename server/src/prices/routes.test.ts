// routes.test.ts: the webhook and the public snapshot through Elysia's handle(): the auth matrix, every status code, snapshot options, the heartbeat, the nudge, the global limit, and that the body is what was signed.
import { describe, expect, test } from "bun:test";
import { createNudger, type PullOutcome } from "./nudge";
import { MAX_BODY_BYTES, priceRoutes } from "./routes";
import { signBody } from "./signature";
import { snapshotEtag } from "./snapshot";
import { NOW_MS, snap, world } from "./testkit";
import type { Snapshot } from "./types";

const t = Math.floor(NOW_MS / 1000);
const next = (v: number, a = 100 + v) => snap(v, { "a.one": a, "b.two": 200, "c.three": 300, "d.four": 400 });
const ten = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k.p${i}`, 1000]));

const setup = (o: { initial?: Snapshot; pull?: PullOutcome; secrets?: string[]; limit?: number; gap?: number; refusalGapMs?: number } = {}) => {
    const w = world(o.initial ?? snap(1));
    const clock = { ms: NOW_MS };
    const lines: string[] = [];
    let pulls = 0;
    const nudge = createNudger({ pull: async () => { pulls++; return o.pull ?? { kind: "unchanged" }; }, now: () => clock.ms, minGapMs: o.gap, schedule: () => {} });
    const app = priceRoutes({ secrets: () => o.secrets ?? ["s3cret-s3cret-s3cret", "next-next-next-next"], now: () => clock.ms, ingest: w.ingest, cache: w.cache, nudge, log: (l) => lines.push(l), limitPerMinute: o.limit, refusalLogGapMs: o.refusalGapMs });
    const SECRET = "s3cret-s3cret-s3cret";
    const post = (body: unknown, opts: { secret?: string | null; ts?: number; headers?: Record<string, string> } = {}) => {
        const raw = typeof body === "string" ? body : JSON.stringify(body);
        const secret = opts.secret === undefined ? SECRET : opts.secret;
        const ts = opts.ts ?? Math.floor(clock.ms / 1000);
        const sig: Record<string, string> = secret === null ? {} : { "x-netquor-signature": `t=${ts},v1=${signBody(secret, ts, raw)}` };
        return app.handle(new Request("http://localhost/hooks/pricing", { method: "POST", body: raw, headers: { "content-type": "application/json", ...sig, ...opts.headers } }));
    };
    return { ...w, app, post, clock, hookLines: lines, pulls: () => pulls, SECRET };
};

describe("POST /hooks/pricing: auth matrix", () => {
    test("no signature, wrong secret, tampered body, stale time, future time, malformed header: a bare 401 and nothing happens", async () => {
        const x = setup();
        const body = { snapshot: next(2) };
        const raw = JSON.stringify(body);
        const cases = [
            await x.post(body, { secret: null }),
            await x.post(body, { secret: "wrong-wrong-wrong-wrong" }),
            await x.post(body, { ts: t - 301 }),
            await x.post(body, { ts: t + 301 }),
            await x.app.handle(new Request("http://localhost/hooks/pricing", { method: "POST", body: raw + " ", headers: { "x-netquor-signature": `t=${t},v1=${signBody(x.SECRET, t, raw)}` } })),
            await x.app.handle(new Request("http://localhost/hooks/pricing", { method: "POST", body: raw, headers: { "x-netquor-signature": "garbage" } })),
            await x.app.handle(new Request("http://localhost/hooks/pricing", { method: "POST", body: raw, headers: { "x-netquor-signature": `t=${t},v1=zz` } })),
        ];
        for (const r of cases) { expect(r.status).toBe(401); expect(await r.text()).toBe(""); }
        expect(x.state.writes).toBe(0);
        expect(x.pulls()).toBe(0);
        expect(x.hookLines.every((l) => l.includes("refused"))).toBe(true);
    });

    test("valid: the current secret, and the rotation secret; the edge of the time window is accepted", async () => {
        const x = setup();
        expect((await x.post({ snapshot: next(2) })).status).toBe(200);
        expect((await x.post({ snapshot: next(3) }, { secret: "next-next-next-next" })).status).toBe(200);
        expect((await x.post({ snapshot: next(4) }, { ts: t - 300 })).status).toBe(200);
        expect((await x.post({ snapshot: next(5) }, { ts: t + 300 })).status).toBe(200);
    });

    test("with no secret in force nothing is accepted, whatever it is signed with", async () => {
        const x = setup({ secrets: [] });
        expect((await x.post({ snapshot: next(2) }, { secret: "" })).status).toBe(401);
        expect((await x.post({ snapshot: next(2) })).status).toBe(401);
    });

    test("a signature over a different body (replayed header) is refused", async () => {
        const x = setup();
        const good = JSON.stringify({ snapshot: next(2) });
        const header = `t=${t},v1=${signBody(x.SECRET, t, good)}`;
        const r = await x.app.handle(new Request("http://localhost/hooks/pricing", { method: "POST", body: JSON.stringify({ snapshot: next(9) }), headers: { "x-netquor-signature": header } }));
        expect(r.status).toBe(401);
        expect(x.cache.get().version).toBe(1);
    });

    test("a body over 256 KB is 413 before anything else, by declared length and by actual size", async () => {
        const x = setup();
        const big = "x".repeat(MAX_BODY_BYTES + 1);
        const r1 = await x.app.handle(new Request("http://localhost/hooks/pricing", { method: "POST", body: big, headers: { "content-length": String(big.length) } }));
        expect(r1.status).toBe(413);
        const r2 = await x.app.handle(new Request("http://localhost/hooks/pricing", { method: "POST", body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(big)); c.close(); } }), headers: {}, duplex: "half" } as RequestInit));
        expect(r2.status).toBe(413);
    });
});

describe("POST /hooks/pricing: a snapshot", () => {
    test("applied: 200 with the version, and the cache serves it", async () => {
        const x = setup();
        const r = await x.post({ snapshot: next(2) });
        expect(r.status).toBe(200);
        expect(await r.json()).toEqual({ ok: true, status: "applied", version: 2 });
        expect(x.cache.get()).toMatchObject({ version: 2, source: "webhook" });
    });

    test("the same snapshot again is 200 unchanged", async () => {
        const x = setup();
        await x.post({ snapshot: next(2) });
        const r = await x.post({ snapshot: next(2) });
        expect(await r.json()).toEqual({ ok: true, status: "unchanged", version: 2 });
        expect(x.state.writes).toBe(1);
    });

    test("409 for an older version and for the same version with other content", async () => {
        const x = setup({ initial: snap(5) });
        const old = await x.post({ snapshot: snap(4) });
        expect(old.status).toBe(409);
        expect((await old.json()).error).toBe("stale");
        const same = await x.post({ snapshot: snap(5, { "a.one": 1, "b.two": 200, "c.three": 300, "d.four": 400 }) });
        expect(same.status).toBe(409);
        expect((await same.json()).error).toBe("conflict");
    });

    test("422 for an invalid snapshot (with details) and for a change that is too large", async () => {
        const x = setup({ initial: snap(1, ten) });
        const bad = await x.post({ snapshot: { schema: 1 } });
        expect(bad.status).toBe(422);
        expect(Array.isArray((await bad.json()).details)).toBe(true);
        const big = await x.post({ snapshot: snap(2, { ...ten, "k.p0": 0 }) });
        expect(big.status).toBe(422);
        const j = await big.json();
        expect(j.error).toBe("change_too_large");
        expect(x.cache.get().version).toBe(1);
    });

    test("allowLargeChange in the signed body accepts the large change", async () => {
        const x = setup({ initial: snap(1, ten) });
        const r = await x.post({ snapshot: snap(2, { ...ten, "k.p0": 0 }), allowLargeChange: true, reason: "k.p0 is free now" });
        expect(r.status).toBe(200);
        expect(x.cache.get().prices["k.p0"].amountCents).toBe(0);
        expect(x.hookLines.concat(x.lines).some((l) => l.includes("k.p0 is free now"))).toBe(true);
    });

    test("allowRemovals (the old flag) does not bypass the guard", async () => {
        const x = setup({ initial: snap(1, ten) });
        const r = await x.post({ snapshot: snap(2, Object.fromEntries(Object.entries(ten).slice(5))), allowRemovals: true });
        expect(r.status).toBe(422);
    });

    test("rebaseVersion needs a reason (422) and then lowers the version", async () => {
        const x = setup({ initial: snap(12) });
        expect((await x.post({ snapshot: next(5), rebaseVersion: true })).status).toBe(422);
        expect((await x.post({ snapshot: next(5), rebaseVersion: true, reason: "counter reset" })).status).toBe(200);
        expect(x.cache.get().version).toBe(5);
    });

    test("via poll is recorded as the source and counts as a poll that worked; via operator is recorded too", async () => {
        const x = setup();
        await x.post({ snapshot: next(2), via: "poll" });
        expect(x.cache.get().source).toBe("poll");
        expect(x.cache.status().lastPollOkAt).not.toBeNull();
        await x.post({ snapshot: next(3), via: "operator", reason: "by hand" });
        expect(x.cache.get().source).toBe("operator");
    });

    test("a snapshot that could not be saved is 500 and the old one stays in force", async () => {
        const x = setup();
        x.state.failWrites = true;
        const r = await x.post({ snapshot: next(2) });
        expect(r.status).toBe(500);
        expect((await r.json()).error).toBe("persist_failed");
        expect(x.cache.get().version).toBe(1);
    });

    test("a snapshot in the body that also has an event is treated as a snapshot", async () => {
        const x = setup();
        const r = await x.post({ snapshot: next(2), event: "poll.ok" });
        expect((await r.json()).status).toBe("applied");
    });
});

describe("POST /hooks/pricing: bad bodies are 400", () => {
    test("not JSON, an array, an unknown body, bad option types, invalid UTF-8", async () => {
        const x = setup();
        for (const body of ["not json", "[]", "null", "{}", { event: "something.else" }, { snapshot: next(2), via: "email" }, { snapshot: next(2), allowLargeChange: "yes" }, { snapshot: next(2), rebaseVersion: 1 }, { snapshot: next(2), reason: 5 }, { snapshot: next(2), reason: "x".repeat(201) }]) {
            const r = await x.post(body);
            expect(r.status).toBe(400);
        }
        const raw = Buffer.concat([Buffer.from('{"event":"poll.ok","x":"'), Buffer.from([0xff]), Buffer.from('"}')]);
        const r = await x.app.handle(new Request("http://localhost/hooks/pricing", { method: "POST", body: raw, headers: { "x-netquor-signature": `t=${t},v1=${signBody(x.SECRET, t, raw)}` } }));
        expect(r.status).toBe(400);
        expect(x.state.writes).toBe(0);
    });
});

describe("POST /hooks/pricing: events", () => {
    test("poll.ok marks the heartbeat and writes nothing", async () => {
        const x = setup();
        expect(x.cache.status().lastPollOkAt).toBeNull();
        const r = await x.post({ event: "poll.ok" });
        expect(r.status).toBe(200);
        expect(await r.json()).toEqual({ ok: true, version: 1 });
        expect(x.cache.status().lastPollOkAt).toBe(new Date(NOW_MS).toISOString());
        expect(x.state.writes).toBe(0);
        expect(x.pulls()).toBe(0);
    });

    test("prices.changed pulls once; the answer says what happened", async () => {
        const x = setup({ pull: { kind: "updated", version: 7 } });
        const r = await x.post({ event: "prices.changed" });
        expect(await r.json()).toEqual({ ok: true, status: "applied", version: 7 });
        const y = setup({ pull: { kind: "unchanged" } });
        expect(await (await y.post({ event: "prices.changed" })).json()).toEqual({ ok: true, status: "unchanged" });
    });

    test("extra nudges inside 30 s are 200 coalesced and do not pull; after 30 s one pulls again", async () => {
        const x = setup();
        await x.post({ event: "prices.changed" });
        for (let i = 0; i < 5; i++) {
            const r = await x.post({ event: "prices.changed" });
            expect(r.status).toBe(200);
            expect(await r.json()).toEqual({ ok: true, coalesced: true });
        }
        expect(x.pulls()).toBe(1);
        x.clock.ms += 30_000;
        await x.post({ event: "prices.changed" });
        expect(x.pulls()).toBe(2);
    });

    test("a failed nudge pull is 503", async () => {
        const x = setup({ pull: { kind: "failed", reason: "the API answered 500" } });
        const r = await x.post({ event: "prices.changed" });
        expect(r.status).toBe(503);
        expect((await r.json()).error).toBe("pull_failed");
    });
});

describe("POST /hooks/pricing: the global limit", () => {
    test("30 signed requests a minute, then 429; it frees up as the minute passes", async () => {
        const x = setup();
        for (let i = 0; i < 30; i++) expect((await x.post({ event: "poll.ok" })).status).toBe(200);
        const r = await x.post({ event: "poll.ok" });
        expect(r.status).toBe(429);
        expect(r.headers.get("retry-after")).toBe("60");
        x.clock.ms += 60_001;
        expect((await x.post({ event: "poll.ok" })).status).toBe(200);
    });

    test("unsigned requests never use up the allowance, so nobody without the secret can lock the worker out", async () => {
        const x = setup({ limit: 3 });
        for (let i = 0; i < 50; i++) expect((await x.post({ event: "poll.ok" }, { secret: "wrong-wrong-wrong-wrong" })).status).toBe(401);
        expect((await x.post({ event: "poll.ok" })).status).toBe(200);
    });

    test("the limit is shared by every kind of request and every sender", async () => {
        const x = setup({ limit: 2 });
        expect((await x.post({ snapshot: next(2) })).status).toBe(200);
        expect((await x.post({ event: "prices.changed" })).status).toBe(200);
        expect((await x.post({ event: "poll.ok" }, { secret: "next-next-next-next" })).status).toBe(429);
    });
});

describe("GET /api/prices", () => {
    test("serves the snapshot in force with a strong ETag and a short cache; 304 on a match; follows replace", async () => {
        const x = setup();
        const get = (h: Record<string, string> = {}) => x.app.handle(new Request("http://localhost/api/prices", { headers: h }));
        const r = await get();
        expect(r.status).toBe(200);
        expect(r.headers.get("cache-control")).toBe("public, max-age=60");
        const etag = r.headers.get("etag") as string;
        expect(etag).toBe(snapshotEtag(x.cache.get()));
        expect((await r.json()).version).toBe(1);
        expect((await get({ "if-none-match": etag })).status).toBe(304);
        expect((await get({ "if-none-match": `W/${etag}` })).status).toBe(304);
        await x.post({ snapshot: next(2) });
        const r2 = await get({ "if-none-match": etag });
        expect(r2.status).toBe(200);
        expect((await r2.json()).version).toBe(2);
    });
});


describe("POST /hooks/pricing: heartbeat answer", () => {
    test("poll.ok carries the version in force here, which follows ingest", async () => {
        const x = setup({ initial: snap(4) });
        expect(await (await x.post({ event: "poll.ok" })).json()).toEqual({ ok: true, version: 4 });
        await x.post({ snapshot: next(5) });
        expect(await (await x.post({ event: "poll.ok" })).json()).toEqual({ ok: true, version: 5 });
    });
    test("a heartbeat signed more than 60 s ago is refused as unauthorised; 60 s is fine and a fresh one marks the poll", async () => {
        const x = setup();
        expect((await x.post({ event: "poll.ok" }, { ts: t - 61 })).status).toBe(401);
        expect(x.cache.status().lastPollOkAt).toBeNull();
        expect((await x.post({ event: "poll.ok" }, { ts: t - 60 })).status).toBe(200);
        expect(x.cache.status().lastPollOkAt).not.toBeNull();
    });
});

describe("POST /hooks/pricing: replay limits for dangerous bodies", () => {
    const big = (v: number) => ({ snapshot: snap(v, { ...ten, "k.p0": 0 }), allowLargeChange: true, reason: "intended" });
    test("allowLargeChange and rebaseVersion are honoured within 60 s of the signature, refused beyond it, while a plain body keeps 300 s", async () => {
        const x = setup({ initial: snap(1, ten) });
        expect((await x.post(big(2), { ts: t - 61 })).status).toBe(401);
        expect((await x.post(big(2), { ts: t + 61 })).status).toBe(401);
        expect(x.cache.get().version).toBe(1);
        expect((await x.post(big(2), { ts: t - 60 })).status).toBe(200);
        expect(x.cache.get().version).toBe(2);
        const y = setup({ initial: snap(12) });
        expect((await y.post({ snapshot: next(5), rebaseVersion: true, reason: "r" }, { ts: t - 61 })).status).toBe(401);
        expect((await y.post({ snapshot: next(13) }, { ts: t - 299 })).status).toBe(200);
    });
    test("the same (timestamp, signature) is accepted once; the replay is a bare 401 even if the first one failed validation", async () => {
        const x = setup({ initial: snap(1, ten) });
        const first = await x.post(big(2));
        expect(first.status).toBe(200);
        const replay = await x.post(big(2));
        expect(replay.status).toBe(401);
        expect(await replay.text()).toBe("");
        // a different timestamp gives a different signature, so it is a new pair
        const again = await x.post({ snapshot: snap(3, { ...ten, "k.p1": 0 }), allowLargeChange: true }, { ts: t - 1 });
        expect(again.status).toBe(200);
        const rb = { snapshot: next(1), rebaseVersion: true };
        expect((await x.post(rb)).status).toBe(422); // reason_required: accepted into the replay memory anyway
        expect((await x.post(rb)).status).toBe(401);
    });
    test("a plain snapshot or heartbeat can be sent again with the same signature", async () => {
        const x = setup();
        expect((await x.post({ snapshot: next(2) })).status).toBe(200);
        expect((await x.post({ snapshot: next(2) })).status).toBe(200);
        expect((await x.post({ event: "poll.ok" })).status).toBe(200);
        expect((await x.post({ event: "poll.ok" })).status).toBe(200);
    });
    test("allowLargeChange: false is not dangerous", async () => {
        const x = setup();
        expect((await x.post({ snapshot: next(2), allowLargeChange: false }, { ts: t - 200 })).status).toBe(200);
    });
});

describe("POST /hooks/pricing: refusal logging is bounded", () => {
    test("at most one line per 10 s, with the count of the ones held back", async () => {
        const x = setup();
        for (let i = 0; i < 50; i++) await x.post({ snapshot: next(2) }, { secret: "wrong-wrong-wrong-wrong" });
        expect(x.hookLines).toHaveLength(1);
        x.clock.ms += 10_000;
        await x.post({ snapshot: next(2) }, { secret: null });
        expect(x.hookLines).toHaveLength(2);
        expect(x.hookLines[1]).toContain("49 similar refusals not logged in the last 10 s");
        x.clock.ms += 5_000;
        await x.post({ snapshot: next(2) }, { secret: null });
        expect(x.hookLines).toHaveLength(2);
    });
    test("an oversize flood is bounded too", async () => {
        const x = setup();
        const big = "x".repeat(MAX_BODY_BYTES + 1);
        for (let i = 0; i < 20; i++) await x.app.handle(new Request("http://localhost/hooks/pricing", { method: "POST", body: big, headers: { "content-length": String(big.length) } }));
        expect(x.hookLines).toHaveLength(1);
    });
});

describe("POST /hooks/pricing: a coalesced nudge is still answered 200 and the trailing pull happens", () => {
    test("200 coalesced now; the pull for it runs when the window ends (fake scheduler)", async () => {
        const w = world();
        const clock = { ms: NOW_MS };
        const timers: { at: number; fn: () => void }[] = [];
        let api = 5; const seen: number[] = [];
        const nudge = createNudger({ pull: async () => { seen.push(api); return { kind: "updated", version: api }; }, now: () => clock.ms, schedule: (fn, ms) => timers.push({ at: clock.ms + ms, fn }) });
        const app = priceRoutes({ secrets: () => ["s3cret-s3cret-s3cret"], now: () => clock.ms, ingest: w.ingest, cache: w.cache, nudge, limitPerMinute: 100 });
        const post = (b: unknown) => { const raw = JSON.stringify(b), ts = Math.floor(clock.ms / 1000); return app.handle(new Request("http://localhost/hooks/pricing", { method: "POST", body: raw, headers: { "x-netquor-signature": `t=${ts},v1=${signBody("s3cret-s3cret-s3cret", ts, raw)}` } })); };
        expect((await post({ event: "prices.changed" })).status).toBe(200);
        clock.ms += 10_000; api = 6;
        const r = await post({ event: "prices.changed" });
        expect(r.status).toBe(200);
        expect(await r.json()).toEqual({ ok: true, coalesced: true });
        expect(seen).toEqual([5]);
        clock.ms += 20_000;
        timers.shift()!.fn();
        await new Promise((res) => setTimeout(res, 0));
        expect(seen).toEqual([5, 6]);
    });
});
