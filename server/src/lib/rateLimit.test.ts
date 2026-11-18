// lib/rateLimit.test.ts: the sliding window.
import { describe, expect, test } from "bun:test";
import { slidingWindowLimiter } from "./rateLimit";

const make = (max = 3, windowMs = 1000) => { const t = { now: 10_000 }; return { t, l: slidingWindowLimiter({ max, windowMs, now: () => t.now }) }; };

describe("sliding window", () => {
    test("allows max, refuses the next, and says how long to wait", () => {
        const { t, l } = make();
        for (let i = 0; i < 3; i++) { expect(l.hit("a").allowed).toBe(true); t.now += 100; }
        const r = l.hit("a");
        expect(r.allowed).toBe(false);
        expect(r.retryAfterSeconds).toBe(1);
    });
    test("an old hit slides out of the window one at a time", () => {
        const { t, l } = make();
        l.hit("a"); t.now += 400; l.hit("a"); t.now += 400; l.hit("a"); // at 0, 400, 800
        expect(l.hit("a").allowed).toBe(false);
        t.now += 201; // 1001: the first hit (0) has left, the others have not
        expect(l.hit("a").allowed).toBe(true);
        expect(l.hit("a").allowed).toBe(false);
    });
    test("exactly one window later everything is free again", () => {
        const { t, l } = make(1);
        l.hit("a");
        t.now += 999; expect(l.hit("a").allowed).toBe(false);
        t.now += 1; expect(l.hit("a").allowed).toBe(true);
    });
    test("a refused request is not counted, so it cannot extend the wait", () => {
        const { t, l } = make(1);
        l.hit("a");
        for (let i = 0; i < 50; i++) { t.now += 10; l.hit("a"); }
        t.now = 10_000 + 1000;
        expect(l.hit("a").allowed).toBe(true);
    });
    test("each key has its own window", () => {
        const { l } = make(1);
        expect(l.hit("1.1.1.1").allowed).toBe(true);
        expect(l.hit("1.1.1.1").allowed).toBe(false);
        expect(l.hit("2.2.2.2").allowed).toBe(true);
    });
    test("memory is bounded: past maxKeys the least recent key is forgotten", () => {
        const t = { now: 0 };
        const l = slidingWindowLimiter({ max: 1, windowMs: 1_000_000, now: () => t.now, maxKeys: 3 });
        for (const k of ["a", "b", "c", "d"]) { t.now++; l.hit(k); }
        expect(l.hit("a").allowed).toBe(true); // forgotten, so allowed again
        expect(l.hit("d").allowed).toBe(false);
    });
    test("a flood of new keys keeps the map at maxKeys and evicts without scanning (a recent key survives)", () => {
        const t = { now: 0 };
        const l = slidingWindowLimiter({ max: 1, windowMs: 1_000_000, now: () => t.now, maxKeys: 100 });
        l.hit("victim");
        const started = performance.now();
        for (let i = 0; i < 20_000; i++) { t.now++; l.hit(`k${i}`); if (i % 50 === 0) l.hit("victim"); } // victim stays recent (its refused hits refresh it)
        expect(performance.now() - started).toBeLessThan(2000);
        expect(l.hit("victim").allowed).toBe(false);
    });
});
