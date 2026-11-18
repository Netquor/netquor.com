// ingest.test.ts: taking in a snapshot: validation, version rules, the sanity guards, baseline, rebase, persistence before the cache, one at a time.
import { describe, expect, test } from "bun:test";
import { IngestError } from "./ingest";
import { snap, world } from "./testkit";

const code = async (p: Promise<unknown>): Promise<string> => { try { await p; return "ok"; } catch (e) { return e instanceof IngestError ? e.code : `other:${String(e)}`; } };
const ten = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k.p${i}`, 1000]));

describe("versions", () => {
    test("a newer valid snapshot is persisted, then put in force, with the arrival source", async () => {
        const w = world();
        const r = await w.ingest(snap(2, { "a.one": 110, "b.two": 200, "c.three": 300, "d.four": 400 }), { source: "poll" });
        expect(r).toMatchObject({ status: "applied", version: 2 });
        expect(w.state.persisted).toMatchObject({ version: 2, source: "poll" });
        expect(w.cache.get()).toMatchObject({ version: 2, source: "poll" });
        expect(w.cache.status().lastIngestSource).toBe("poll");
    });

    test("the same snapshot again is unchanged and writes nothing", async () => {
        const w = world();
        await w.ingest(snap(2, { "a.one": 110, "b.two": 200, "c.three": 300, "d.four": 400 }));
        const r = await w.ingest(snap(2, { "a.one": 110, "b.two": 200, "c.three": 300, "d.four": 400 }), { source: "poll" });
        expect(r.status).toBe("unchanged");
        expect(w.state.writes).toBe(1);
        expect(w.cache.get().source).toBe("webhook"); // how it first arrived
    });

    test("an older version is stale; the same version with other content is a conflict; nothing changes", async () => {
        const w = world(snap(5));
        expect(await code(w.ingest(snap(4)))).toBe("stale");
        expect(await code(w.ingest(snap(5, { "a.one": 101, "b.two": 200, "c.three": 300, "d.four": 400 })))).toBe("conflict");
        expect(w.state.writes).toBe(0);
        expect(w.cache.get().version).toBe(5);
    });

    test("an invalid snapshot is refused with every problem listed", async () => {
        const w = world();
        const e = await w.ingest({ schema: 2, version: 0 }).catch((x) => x);
        expect(e).toBeInstanceOf(IngestError);
        expect(e.code).toBe("invalid");
        expect(e.details.length).toBeGreaterThan(1);
        expect(await code(w.ingest("nope"))).toBe("invalid");
        expect(await code(w.ingest(snap(2, undefined, { updatedAt: "2026-02-31T00:00:00Z" })))).toBe("invalid");
    });

    test("a sender's own source field is overwritten by how it arrived", async () => {
        const w = world();
        await w.ingest({ ...snap(2, { "a.one": 105, "b.two": 200, "c.three": 300, "d.four": 400 }), source: "seed" }, { source: "operator" });
        expect(w.cache.get().source).toBe("operator");
    });
});

describe("persist before cache", () => {
    test("when the write fails the cache keeps the old snapshot and the error is persist_failed", async () => {
        const w = world();
        w.state.failWrites = true;
        expect(await code(w.ingest(snap(2, { "a.one": 105, "b.two": 200, "c.three": 300, "d.four": 400 })))).toBe("persist_failed");
        expect(w.cache.get().version).toBe(1);
        w.state.failWrites = false;
        expect(await code(w.ingest(snap(2, { "a.one": 105, "b.two": 200, "c.three": 300, "d.four": 400 })))).toBe("ok");
    });

    test("subscribers see the snapshot only after it is persisted", async () => {
        const w = world();
        let persistedAtNotify = 0;
        w.cache.subscribe(() => { persistedAtNotify = w.state.persisted.version; });
        await w.ingest(snap(2, { "a.one": 105, "b.two": 200, "c.three": 300, "d.four": 400 }));
        expect(persistedAtNotify).toBe(2);
    });
});

describe("sanity guards", () => {
    test("a price moving more than 50 percent is refused as change_too_large, logged, nothing changes", async () => {
        const w = world(snap(1, ten));
        expect(await code(w.ingest(snap(2, { ...ten, "k.p0": 1600 })))).toBe("change_too_large");
        expect(w.cache.get().version).toBe(1);
        expect(w.state.writes).toBe(0);
        expect(w.lines.some((l) => l.includes("refused version 2") && l.includes("k.p0"))).toBe(true);
    });

    test("a non-zero price going to 0, and more than 25 percent of keys changing, are refused", async () => {
        const w = world(snap(1, ten));
        expect(await code(w.ingest(snap(2, { ...ten, "k.p0": 0 })))).toBe("change_too_large");
        expect(await code(w.ingest(snap(2, { ...ten, "k.p0": 1100, "k.p1": 1100, "k.p2": 1100 })))).toBe("change_too_large");
        expect(await code(w.ingest(snap(2, { ...ten, "k.p0": 1100, "k.p1": 1100 })))).toBe("ok");
    });

    test("removing more than 30 percent at once is refused", async () => {
        const w = world(snap(1, ten));
        expect(await code(w.ingest(snap(2, Object.fromEntries(Object.entries(ten).slice(4)))))).toBe("change_too_large");
    });

    test("cumulative removals are counted against the baseline: slow bleeding is caught", async () => {
        const w = world(snap(1, ten));
        const left = Object.entries(ten);
        const results: string[] = [];
        for (let i = 1; i <= 4; i++) results.push(await code(w.ingest(snap(i + 1, Object.fromEntries(left.slice(i))))));
        expect(results).toEqual(["ok", "ok", "ok", "change_too_large"]);
        expect(Object.keys(w.cache.get().prices)).toHaveLength(7);
        expect(w.state.baseline?.keys).toHaveLength(10); // the baseline did not move
    });

    test("allowLargeChange applies it, logs it, and becomes the new baseline", async () => {
        const w = world(snap(1, ten));
        const big = snap(2, Object.fromEntries(Object.entries(ten).slice(5)));
        expect(await code(w.ingest(big))).toBe("change_too_large");
        expect(await code(w.ingest(big, { allowLargeChange: true, reason: "retired five plans" }))).toBe("ok");
        expect(Object.keys(w.cache.get().prices)).toHaveLength(5);
        expect(w.state.baseline).toMatchObject({ version: 2, reason: "retired five plans" });
        expect(w.state.baseline?.keys).toHaveLength(5);
        expect(w.lines.some((l) => l.includes("large change accepted") && l.includes("retired five plans"))).toBe(true);
        // and with the new baseline, a small removal is fine again
        expect(await code(w.ingest(snap(3, Object.fromEntries(Object.entries(ten).slice(6)))))).toBe("ok");
    });

    test("the first ingest records the keys in force as the baseline", async () => {
        const w = world(snap(1, ten));
        expect(w.state.baseline).toBeNull();
        await w.ingest(snap(2, { ...ten, "k.p0": 1050 }));
        expect(w.state.baseline).toMatchObject({ version: 1, reason: "initial" });
        expect(w.state.baseline?.keys).toHaveLength(10);
    });

    test("a refusal does not change the baseline", async () => {
        const w = world(snap(1, ten));
        await code(w.ingest(snap(2, { ...ten, "k.p0": 0 })));
        expect(w.state.baseline?.keys).toHaveLength(10);
    });
});

describe("rebaseVersion", () => {
    test("without it a lower version is stale; with it and a reason the version goes down", async () => {
        const w = world(snap(12));
        const lower = snap(5, { "a.one": 105, "b.two": 200, "c.three": 300, "d.four": 400 });
        expect(await code(w.ingest(lower))).toBe("stale");
        expect(await code(w.ingest(lower, { rebaseVersion: true }))).toBe("reason_required");
        expect(await code(w.ingest(lower, { rebaseVersion: true, reason: "API counter was reset" }))).toBe("ok");
        expect(w.cache.get().version).toBe(5);
        expect(w.cache.version()).toBe(13);
        expect(w.lines.some((l) => l.includes("rebased from 12") && l.includes("API counter was reset"))).toBe(true);
        // after the rebase the normal rule applies again, from the new number
        expect(await code(w.ingest(snap(5, { "a.one": 106, "b.two": 200, "c.three": 300, "d.four": 400 })))).toBe("conflict");
        expect(await code(w.ingest(snap(6, { "a.one": 106, "b.two": 200, "c.three": 300, "d.four": 400 })))).toBe("ok");
    });

    test("rebase still runs the sanity guards unless allowLargeChange is also set", async () => {
        const w = world(snap(12, ten));
        const lower = snap(5, { ...ten, "k.p0": 0 });
        expect(await code(w.ingest(lower, { rebaseVersion: true, reason: "x" }))).toBe("change_too_large");
        expect(await code(w.ingest(lower, { rebaseVersion: true, reason: "x", allowLargeChange: true }))).toBe("ok");
    });

    test("a rebase to the same content is unchanged", async () => {
        const w = world(snap(12));
        expect((await w.ingest(snap(12), { rebaseVersion: true, reason: "x" })).status).toBe("unchanged");
    });
});

describe("one at a time", () => {
    test("two ingests started together run in order, and a failed one does not block the next", async () => {
        const w = world();
        const results = await Promise.allSettled([
            w.ingest({ nope: 1 }),
            w.ingest(snap(2, { "a.one": 105, "b.two": 200, "c.three": 300, "d.four": 400 })),
            w.ingest(snap(3, { "a.one": 106, "b.two": 200, "c.three": 300, "d.four": 400 })),
            w.ingest(snap(2, { "a.one": 105, "b.two": 200, "c.three": 300, "d.four": 400 })),
        ]);
        expect(results.map((r) => r.status)).toEqual(["rejected", "fulfilled", "fulfilled", "rejected"]); // the last is stale by then
        expect(w.cache.get().version).toBe(3);
        expect(w.state.writes).toBe(2);
    });
});

describe("lastRefusal in the cache status", () => {
    test("stale, conflict, invalid, change_too_large and reason_required are recorded with the refused version; a success and a persist failure are not", async () => {
        const w = world(snap(5, ten));
        expect(w.cache.status().lastRefusal).toBeNull();
        expect(await code(w.ingest(snap(4, ten)))).toBe("stale");
        expect(w.cache.status().lastRefusal).toMatchObject({ version: 4, code: "stale" });
        expect(await code(w.ingest(snap(5, { ...ten, "k.p0": 999 })))).toBe("conflict");
        expect(w.cache.status().lastRefusal).toMatchObject({ version: 5, code: "conflict" });
        expect(await code(w.ingest({ schema: 1, version: 6 }))).toBe("invalid");
        expect(w.cache.status().lastRefusal).toMatchObject({ version: 6, code: "invalid" });
        expect(await code(w.ingest("junk"))).toBe("invalid");
        expect(w.cache.status().lastRefusal).toMatchObject({ version: null, code: "invalid" });
        expect(await code(w.ingest(snap(7, { ...ten, "k.p0": 0 }), { source: "operator" }))).toBe("change_too_large");
        expect(w.cache.status().lastRefusal).toMatchObject({ version: 7, code: "change_too_large" });
        expect(await code(w.ingest(snap(3, ten), { rebaseVersion: true }))).toBe("reason_required");
        expect(w.cache.status().lastRefusal).toMatchObject({ version: 3, code: "reason_required" });
        const at = w.cache.status().lastRefusal!.at;
        expect(Number.isNaN(Date.parse(at))).toBe(false);
        // a success leaves the last refusal in place; a disk failure is not a refusal of the snapshot
        w.state.failWrites = true;
        expect(await code(w.ingest(snap(8, { ...ten, "k.p1": 1100 })))).toBe("persist_failed");
        expect(w.cache.status().lastRefusal).toMatchObject({ version: 3, code: "reason_required" });
    });
});
