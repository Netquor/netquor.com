// cache.test.ts: the in-memory price cache: loading, replace, version, status fields, subscribers, freezing.
import { describe, expect, test } from "bun:test";
import { createPriceCache } from "./cache";
import { memoryStore, snap } from "./testkit";

const clockAt = (iso: string) => { const c = { ms: Date.parse(iso) }; return { c, clock: () => c.ms }; };

describe("createPriceCache", () => {
    test("loads from the store at construction and serves it", () => {
        const { store } = memoryStore(snap(7));
        const cache = createPriceCache({ store, clock: () => 0 });
        expect(cache.get().version).toBe(7);
        expect(cache.version()).toBe(7);
        expect(cache.get().prices["a.one"].amountCents).toBe(100);
    });

    test("a store with nothing valid makes construction throw", () => {
        expect(() => createPriceCache({ store: { load: () => { throw new Error("no valid price snapshot"); } }, clock: () => 0 })).toThrow("no valid price snapshot");
    });

    test("replace swaps the snapshot, records source and time, and bumps the version", () => {
        const { c, clock } = clockAt("2026-11-10T12:00:00Z");
        const cache = createPriceCache({ store: memoryStore(snap(1)).store, clock });
        c.ms += 5000;
        cache.replace(snap(2, { "a.one": 150 }), "poll");
        expect(cache.get()).toMatchObject({ version: 2, source: "poll" });
        expect(cache.get().prices["a.one"].amountCents).toBe(150);
        expect(cache.version()).toBe(2);
        expect(cache.status()).toMatchObject({ version: 2, lastIngestSource: "poll", lastIngestAt: "2026-11-10T12:00:05.000Z" });
    });

    test("status before any ingest has null ingest fields; age follows the clock", () => {
        const { c, clock } = clockAt("2026-11-10T00:01:40.000Z");
        const cache = createPriceCache({ store: memoryStore(snap(1, undefined, { updatedAt: "2026-11-10T00:00:00.000Z" })).store, clock });
        expect(cache.status()).toEqual({ version: 1, updatedAt: "2026-11-10T00:00:00.000Z", ageSeconds: 100, lastIngestAt: null, lastIngestSource: null, lastPollOkAt: null, lastRefusal: null, stale: false, catalogSources: {} });
        c.ms += 60_000;
        expect(cache.status().ageSeconds).toBe(160);
    });

    test("age is never negative when updatedAt is in the future", () => {
        const { clock } = clockAt("2026-11-10T00:00:00.000Z");
        const cache = createPriceCache({ store: memoryStore(snap(1, undefined, { updatedAt: "2026-11-11T00:00:00.000Z" })).store, clock });
        expect(cache.status().ageSeconds).toBe(0);
    });

    test("markPollOk sets lastPollOkAt only", () => {
        const { c, clock } = clockAt("2026-11-10T12:00:00Z");
        const cache = createPriceCache({ store: memoryStore().store, clock });
        c.ms += 1000;
        cache.markPollOk();
        expect(cache.status()).toMatchObject({ lastPollOkAt: "2026-11-10T12:00:01.000Z", lastIngestAt: null });
    });

    test("markRefusal records version, code and time; status returns a copy", () => {
        const { c, clock } = clockAt("2026-11-10T12:00:00Z");
        const cache = createPriceCache({ store: memoryStore().store, clock });
        c.ms += 2000;
        cache.markRefusal({ version: 9, code: "stale" });
        const r = cache.status().lastRefusal!;
        expect(r).toEqual({ version: 9, code: "stale", at: "2026-11-10T12:00:02.000Z" });
        r.code = "tampered";
        expect(cache.status().lastRefusal!.code).toBe("stale");
        c.ms += 1000;
        cache.markRefusal({ version: null, code: "invalid" });
        expect(cache.status().lastRefusal).toEqual({ version: null, code: "invalid", at: "2026-11-10T12:00:03.000Z" });
    });

    test("stale: never without an API; with one, true after 3 x the poll period without an ingest or heartbeat", () => {
        const { c, clock } = clockAt("2026-11-10T12:00:00Z");
        const off = createPriceCache({ store: memoryStore().store, clock });
        const on = createPriceCache({ store: memoryStore().store, clock, pollSeconds: 100 });
        c.ms += 10 * 24 * 3600 * 1000;
        expect(off.status().stale).toBe(false);
        expect(on.status().stale).toBe(true);
        on.markPollOk();
        expect(on.status().stale).toBe(false);
        c.ms += 300_000;
        expect(on.status().stale).toBe(false); // exactly 3 x
        c.ms += 1;
        expect(on.status().stale).toBe(true);
        on.replace(snap(2, { "a.one": 150 }), "webhook"); // an ingest also counts as life
        expect(on.status().stale).toBe(false);
    });

    test("stale counts from process start before anything has arrived", () => {
        const { c, clock } = clockAt("2026-11-10T12:00:00Z");
        const on = createPriceCache({ store: memoryStore().store, clock, pollSeconds: 60 });
        c.ms += 179_000;
        expect(on.status().stale).toBe(false);
        c.ms += 2000;
        expect(on.status().stale).toBe(true);
    });

    test("subscribers hear every replace, can unsubscribe, and a throwing one does not break the rest", () => {
        const cache = createPriceCache({ store: memoryStore().store, clock: () => 0 });
        const seen: number[] = [];
        cache.subscribe(() => { throw new Error("bad subscriber"); });
        const off = cache.subscribe((s) => seen.push(s.version));
        cache.replace(snap(2), "webhook");
        cache.replace(snap(3), "webhook");
        off();
        cache.replace(snap(4), "webhook");
        expect(seen).toEqual([2, 3]);
        expect(cache.get().version).toBe(4);
    });

    test("what get() returns is frozen, and the caller's own object is not shared", () => {
        const cache = createPriceCache({ store: memoryStore().store, clock: () => 0 });
        const mine = snap(2);
        cache.replace(mine, "webhook");
        expect(Object.isFrozen(cache.get())).toBe(true);
        expect(Object.isFrozen(cache.get().prices)).toBe(true);
        expect(Object.isFrozen(cache.get().prices["a.one"])).toBe(true);
        expect(Object.isFrozen(mine.prices["a.one"])).toBe(false);
        mine.prices["a.one"].amountCents = 1;
        expect(cache.get().prices["a.one"].amountCents).toBe(100);
    });

    test("version() changes on every replace, even when the snapshot version goes down (an operator rebase)", () => {
        const cache = createPriceCache({ store: memoryStore(snap(12)).store, clock: () => 0 });
        cache.replace(snap(5), "operator");
        expect(cache.get().version).toBe(5);
        expect(cache.version()).toBe(13);
        cache.replace(snap(6), "poll");
        expect(cache.version()).toBe(14);
        cache.replace(snap(20), "poll");
        expect(cache.version()).toBe(20);
    });

    test("a Date clock is accepted", () => {
        const cache = createPriceCache({ store: memoryStore().store, clock: () => new Date("2026-11-10T12:00:00Z") });
        cache.replace(snap(2), "poll");
        expect(cache.status().lastIngestAt).toBe("2026-11-10T12:00:00.000Z");
    });
});
