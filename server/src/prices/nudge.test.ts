// nudge.test.ts: the nudge: single flight, one forced pull per 30 s, and the pull through ingest.
import { describe, expect, test } from "bun:test";
import { createNudger, createWebPull, type PullOutcome } from "./nudge";
import { createFetcher } from "./pull";
import { snap, world } from "./testkit";

/** A fake timer: collects what was scheduled; run(t) fires everything due at or before the fake clock. */
const fakeTime = () => {
    const w = { t: 0, queue: [] as { at: number; fn: () => void }[] };
    return {
        w,
        now: () => w.t,
        schedule: (fn: () => void, ms: number) => { w.queue.push({ at: w.t + ms, fn }); },
        /** Moves the clock to t, firing due timers in order, and lets the async pulls settle. */
        async advance(t: number) {
            for (;;) {
                const due = w.queue.filter((q) => q.at <= t).sort((a, b) => a.at - b.at)[0];
                if (!due) break;
                w.queue.splice(w.queue.indexOf(due), 1);
                w.t = Math.max(w.t, due.at);
                due.fn();
                await new Promise((r) => setTimeout(r, 0));
            }
            w.t = t;
        },
    };
};

describe("createNudger", () => {
    test("the first nudge pulls; others inside 30 s are coalesced; one after 30 s pulls again", async () => {
        const f = fakeTime();
        f.w.t = 1_000_000;
        let pulls = 0;
        const nudge = createNudger({ pull: async () => { pulls++; return { kind: "unchanged" }; }, now: f.now, schedule: f.schedule });
        expect(await nudge()).toEqual({ kind: "pulled", outcome: { kind: "unchanged" } });
        f.w.t += 29_999;
        expect(await nudge()).toEqual({ kind: "coalesced" });
        f.w.t = 1_030_000;
        f.w.queue.length = 0; // the trailing pull is covered by its own test; here only the direct path
        expect((await nudge()).kind).toBe("pulled");
        expect(pulls).toBe(2);
    });

    test("a nudge while a pull is running does not start a second at once (single flight), even with a zero gap; it earns one trailing pull", async () => {
        let release!: () => void, pulls = 0;
        const gate = new Promise<void>((r) => { release = r; });
        const f = fakeTime();
        const nudge = createNudger({ pull: async () => { pulls++; if (pulls === 1) await gate; return { kind: "unchanged" }; }, now: f.now, minGapMs: 0, schedule: f.schedule });
        const first = nudge();
        expect(await nudge()).toEqual({ kind: "coalesced" });
        expect(await nudge()).toEqual({ kind: "coalesced" });
        expect(pulls).toBe(1);
        release();
        expect((await first).kind).toBe("pulled");
        expect(pulls).toBe(1);
        await f.advance(0);
        expect(pulls).toBe(2); // exactly one trailing pull for any number of coalesced nudges
        await f.advance(100);
        expect(pulls).toBe(2);
    });

    test("trailing pull: a second nudge at t=10 s is answered coalesced and a pull at t=30 s sees v6", async () => {
        const f = fakeTime();
        let api = 5;
        const seen: number[] = [];
        const trailing: PullOutcome[] = [];
        const nudge = createNudger({ pull: async () => { seen.push(api); return { kind: "updated", version: api }; }, now: f.now, schedule: f.schedule, onTrailing: (o) => trailing.push(o) });
        expect(await nudge()).toEqual({ kind: "pulled", outcome: { kind: "updated", version: 5 } });
        await f.advance(10_000);
        api = 6;
        expect(await nudge()).toEqual({ kind: "coalesced" });
        await f.advance(29_999);
        expect(seen).toEqual([5]);
        await f.advance(30_000);
        expect(seen).toEqual([5, 6]);
        expect(trailing).toEqual([{ kind: "updated", version: 6 }]);
        await f.advance(120_000);
        expect(seen).toEqual([5, 6]); // nothing pending: no more pulls
    });

    test("many nudges in the window make one trailing pull, and that pull opens a new window", async () => {
        const f = fakeTime();
        let pulls = 0;
        const nudge = createNudger({ pull: async () => { pulls++; return { kind: "unchanged" }; }, now: f.now, schedule: f.schedule });
        await nudge();
        for (let i = 0; i < 10; i++) { await f.advance(1000 * (i + 1)); expect((await nudge()).kind).toBe("coalesced"); }
        await f.advance(30_000);
        expect(pulls).toBe(2);
        expect(await nudge()).toEqual({ kind: "coalesced" }); // inside the trailing pull's own window
        await f.advance(60_000);
        expect(pulls).toBe(3);
    });

    test("a nudge that finds the window already over pulls directly, and a stale timer then does nothing", async () => {
        const f = fakeTime();
        let pulls = 0;
        const nudge = createNudger({ pull: async () => { pulls++; return { kind: "unchanged" }; }, now: f.now, schedule: f.schedule });
        await nudge();
        f.w.t = 5000;
        await nudge(); // coalesced, trailing armed for t=30000
        f.w.t = 30_000;
        expect((await nudge()).kind).toBe("pulled"); // the timer has not fired yet but the window is over
        expect(pulls).toBe(2);
        await f.advance(31_000);
        expect(pulls).toBe(2);
    });

    test("a failed pull still counts toward the 30 s, and a throwing pull is a failure, not a crash", async () => {
        const f = fakeTime();
        let n = 0;
        const nudge = createNudger({ pull: async () => { n++; throw new Error("boom"); }, now: f.now, schedule: f.schedule });
        expect(await nudge()).toEqual({ kind: "pulled", outcome: { kind: "failed", reason: "unexpected error" } });
        expect(await nudge()).toEqual({ kind: "coalesced" });
        expect(n).toBe(1);
        await f.advance(30_000);
        expect(n).toBe(2); // the trailing pull, which also fails quietly
    });
});

describe("createWebPull", () => {
    const pull = (answer: () => Response, w = world()) => {
        const fetcher = createFetcher({ url: "https://api.example.com/p", fetch: async () => answer() });
        return { run: createWebPull({ fetch: fetcher, ingest: w.ingest }), w };
    };

    test("a newer snapshot is ingested with source poll and no ETag is sent", async () => {
        let inm: string | undefined = "unset";
        const w = world();
        const fetcher = createFetcher({ url: "https://api.example.com/p", fetch: async (_u, init) => { inm = init.headers["if-none-match"]; return new Response(JSON.stringify(snap(2, { "a.one": 105, "b.two": 200, "c.three": 300, "d.four": 400 }))); } });
        const out = await createWebPull({ fetch: fetcher, ingest: w.ingest })();
        expect(out).toEqual({ kind: "updated", version: 2 });
        expect(w.cache.get().source).toBe("poll");
        expect(inm).toBeUndefined();
    });

    test("the same version is unchanged; 304 is unchanged", async () => {
        expect((await pull(() => new Response(JSON.stringify(snap(1)))).run()).kind).toBe("unchanged");
        expect((await pull(() => new Response(null, { status: 304 })).run()).kind).toBe("unchanged");
    });

    test("a snapshot the guards refuse is a failure naming the code, and the cache is untouched", async () => {
        const r = pull(() => new Response(JSON.stringify(snap(2, { "a.one": 0, "b.two": 200, "c.three": 300, "d.four": 400 }))));
        const out: PullOutcome = await r.run();
        expect(out).toMatchObject({ kind: "failed" });
        expect((out as { reason: string }).reason).toContain("change_too_large");
        expect(r.w.cache.get().version).toBe(1);
    });

    test("an API wrapper cannot switch the guards off", async () => {
        const r = pull(() => new Response(JSON.stringify({ snapshot: snap(2, { "a.one": 0, "b.two": 200, "c.three": 300, "d.four": 400 }), allowLargeChange: true })));
        expect((await r.run()).kind).toBe("failed");
    });

    test("an API failure is passed on", async () => {
        expect(await pull(() => new Response("", { status: 500 })).run()).toEqual({ kind: "failed", reason: "the API answered 500" });
    });
});
