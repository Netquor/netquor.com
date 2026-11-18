// schedule.test.ts: the worker timing pieces: the interval and its minimum, backoff with jitter bounds, the sleeping clock.
import { describe, expect, test } from "bun:test";
import { MAX_BACKOFF_MS, backoffMs, parseIntervalSeconds, realClock } from "./schedule";

describe("parseIntervalSeconds", () => {
    test("default 900, never below 60, junk is the default", () => {
        expect(parseIntervalSeconds("")).toBe(900);
        expect(parseIntervalSeconds("abc")).toBe(900);
        expect(parseIntervalSeconds("1800")).toBe(1800);
        expect(parseIntervalSeconds("60")).toBe(60);
        expect(parseIntervalSeconds("10")).toBe(60);
        expect(parseIntervalSeconds("0")).toBe(60);
        expect(parseIntervalSeconds("-5")).toBe(60);
        expect(parseIntervalSeconds("90.9")).toBe(90);
    });
});

describe("backoffMs", () => {
    const interval = 900_000;
    test("doubles with each failure, between half and the full value, never under the interval, never over an hour", () => {
        for (let failures = 1; failures <= 30; failures++) {
            const raw = Math.min(MAX_BACKOFF_MS, interval * 2 ** Math.min(failures, 20));
            for (const r of [0, 0.25, 0.999999]) {
                const ms = backoffMs(interval, failures, () => r);
                expect(ms).toBeGreaterThanOrEqual(interval);
                expect(ms).toBeLessThanOrEqual(MAX_BACKOFF_MS);
                expect(ms).toBeGreaterThanOrEqual(Math.max(interval, Math.floor(raw / 2)));
                expect(ms).toBeLessThanOrEqual(raw);
            }
        }
        expect(backoffMs(60_000, 1, () => 0.999999)).toBeLessThanOrEqual(120_000);
        expect(backoffMs(60_000, 3, () => 0.999999)).toBeLessThanOrEqual(480_000);
        expect(backoffMs(60_000, 12, () => 0.999999)).toBeGreaterThan(3_500_000);
    });
    test("the jitter really moves it, and a longer-than-an-hour interval is respected", () => {
        expect(backoffMs(60_000, 5, () => 0)).not.toBe(backoffMs(60_000, 5, () => 0.99));
        expect(backoffMs(7_200_000, 3, () => 0)).toBe(7_200_000);
    });
});

describe("realClock", () => {
    test("sleep ends early when the signal aborts, and at once if it already has", async () => {
        const stop = new AbortController();
        const started = Date.now();
        const p = realClock.sleep(60_000, stop.signal);
        stop.abort();
        await p;
        await realClock.sleep(60_000, stop.signal);
        expect(Date.now() - started).toBeLessThan(1000);
    });
});
