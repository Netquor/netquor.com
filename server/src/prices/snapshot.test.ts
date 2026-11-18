// snapshot.test.ts: every rule of the snapshot validator, and the fixed way a snapshot is written.
import { describe, expect, test } from "bun:test";
import { removedKeys, sameContent, serializeSnapshot, snapshotEtag, validateSnapshot } from "./snapshot";
import { snap } from "./testkit";

const good = () => JSON.parse(JSON.stringify(snap(3)));
const errorsOf = (x: unknown) => { const v = validateSnapshot(x); return v.ok ? [] : v.errors; };
const mutate = (fn: (s: any) => void) => { const s = good(); fn(s); return errorsOf(s); };

describe("validateSnapshot", () => {
    test("a good snapshot passes and unit is optional", () => {
        expect(validateSnapshot(good()).ok).toBe(true);
        const s = good(); s.prices["a.one"].unit = "per month";
        expect(validateSnapshot(s)).toMatchObject({ ok: true });
    });

    test("it must be an object", () => {
        for (const x of [null, [], "x", 3, undefined]) expect(errorsOf(x)).toEqual(["snapshot must be an object"]);
    });

    test("no extra keys, at the top or on a price", () => {
        expect(mutate((s) => { s.extra = 1; })[0]).toContain('unknown key "extra"');
        expect(mutate((s) => { s.prices["a.one"].note = "x"; })[0]).toContain('unknown key "note"');
        expect(mutate((s) => { s.allowRemovals = true; })[0]).toContain("unknown key");
    });

    test("schema must be 1", () => {
        expect(mutate((s) => { s.schema = 2; })).toContain("schema must be 1");
        expect(mutate((s) => { delete s.schema; })).toContain("schema must be 1");
    });

    test("version is an integer of 1 or more", () => {
        for (const v of [0, -1, 1.5, "3", null, NaN, 2 ** 60]) expect(mutate((s) => { s.version = v; })[0]).toContain("version");
    });

    test("updatedAt is ISO 8601 with a zone", () => {
        for (const v of ["yesterday", "2026-11-10", "2026-11-10T00:00:00", "2026-13-45T00:00:00Z", 5, ""]) expect(mutate((s) => { s.updatedAt = v; })[0]).toContain("updatedAt");
        for (const v of ["2026-11-10T00:00:00Z", "2026-11-10T00:00:00.123Z", "2026-11-10T00:00:00+02:00"]) expect(mutate((s) => { s.updatedAt = v; })).toEqual([]);
    });

    test("updatedAt must be a real calendar date and clock time", () => {
        for (const v of ["2026-02-31T00:00:00Z", "2026-02-29T00:00:00Z", "2026-04-31T10:00:00Z", "2026-11-10T24:00:00Z", "2026-11-10T23:60:00Z", "2026-11-10T23:59:60Z", "2026-00-10T00:00:00Z", "2026-11-00T00:00:00Z"]) {
            expect(mutate((s) => { s.updatedAt = v; })[0]).toContain("updatedAt");
        }
        for (const v of ["2028-02-29T00:00:00Z", "2000-02-29T12:00:00Z", "2026-12-31T23:59:59Z"]) expect(mutate((s) => { s.updatedAt = v; })).toEqual([]);
        expect(mutate((s) => { s.updatedAt = "2100-02-29T00:00:00Z"; })[0]).toContain("updatedAt"); // 2100 is not a leap year
    });

    test("source is seed, webhook, poll or operator", () => {
        for (const v of ["seed", "webhook", "poll", "operator"]) expect(mutate((s) => { s.source = v; })).toEqual([]);
        expect(mutate((s) => { s.source = "email"; })[0]).toContain("source");
    });

    test("cents are integers from 0 to 10,000,000", () => {
        for (const c of [0, 1, 10_000_000]) expect(mutate((s) => { s.prices["a.one"].amountCents = c; })).toEqual([]);
        for (const c of [-1, 10_000_001, 5.95, "595", null, NaN, Infinity]) expect(mutate((s) => { s.prices["a.one"].amountCents = c; })[0]).toContain("amountCents");
    });

    test("currency must be USD", () => {
        expect(mutate((s) => { s.prices["a.one"].currency = "EUR"; })[0]).toContain("currency");
        expect(mutate((s) => { delete s.prices["a.one"].currency; })[0]).toContain("currency");
    });

    test("unit is text of 1 to 120 characters", () => {
        for (const u of ["", 5, "x".repeat(121), null]) expect(mutate((s) => { s.prices["a.one"].unit = u; })[0]).toContain("unit");
    });

    test("keys follow the dotted pattern", () => {
        for (const k of ["a", "fleet.mac.month", "fleet.mobile_x.m2", "a1.b_2"]) expect(mutate((s) => { s.prices[k] = { amountCents: 1, currency: "USD" }; })).toEqual([]);
        for (const k of ["Fleet.mac", "fleet..mac", ".fleet", "fleet.", "fleet mac", "_a", "fleet-mac", "__proto__", "a/b", ""]) {
            const s = good();
            Object.defineProperty(s.prices, k, { value: { amountCents: 1, currency: "USD" }, enumerable: true });
            expect(errorsOf(s)[0]).toContain("not a valid dotted key");
        }
    });

    test("at most 500 prices", () => {
        const make = (n: number) => { const s = good(); s.prices = {}; for (let i = 0; i < n; i++) s.prices[`k${i}.m`] = { amountCents: i, currency: "USD" }; return s; };
        expect(errorsOf(make(500))).toEqual([]);
        expect(errorsOf(make(501))[0]).toContain("500");
    });

    test("prices must be an object, and may be empty", () => {
        expect(mutate((s) => { s.prices = []; })[0]).toContain("prices must be an object");
        expect(mutate((s) => { s.prices = {}; })).toEqual([]);
    });

    test("the result is a clean copy with the keys in a fixed set", () => {
        const v = validateSnapshot(good());
        expect(v.ok && Object.keys(v.snapshot).sort()).toEqual(["prices", "schema", "source", "updatedAt", "version"]);
    });
});

describe("writing and comparing", () => {
    test("serialize is stable: sorted keys, fixed field order, trailing newline", () => {
        const a = serializeSnapshot(snap(1, { "z.z": 1, "a.a": 2 }));
        const b = serializeSnapshot(snap(1, { "a.a": 2, "z.z": 1 }));
        expect(a).toBe(b);
        expect(a.endsWith("}\n")).toBe(true);
        expect(a.indexOf('"a.a"')).toBeLessThan(a.indexOf('"z.z"'));
    });

    test("sameContent ignores source but not version, time or prices", () => {
        expect(sameContent(snap(2), { ...snap(2), source: "poll" })).toBe(true);
        expect(sameContent(snap(2), snap(2, { "a.one": 101 }))).toBe(false);
        expect(sameContent(snap(2), { ...snap(2), updatedAt: "2026-11-11T00:00:00.000Z" })).toBe(false);
    });

    test("removedKeys and the ETag", () => {
        expect(removedKeys(snap(1), snap(2, { "a.one": 100, "b.two": 200 })).sort()).toEqual(["c.three", "d.four"]);
        expect(snapshotEtag(snap(4))).toMatch(/^"v4-[0-9a-f]{16}"$/);
        expect(snapshotEtag(snap(4))).not.toBe(snapshotEtag(snap(4, { "a.one": 1 })));
    });
});
