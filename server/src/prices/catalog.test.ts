// catalog.test.ts: the catalog map against the real captured price books and the real seed, the derivations, the candidate, and the fetch plan with a fake fetch.
import { describe, expect, test } from "bun:test";
import { buildCandidate, createCatalogPuller, derive, fetchPlan, parseCatalogMap, parseProducts, parseRetryAfter, sanitizeSources, sourcesFingerprint, type Fetcher, type PriceBook } from "./catalog";
import { fleetWith, phoneWith, realFleet, realMap, realPhone, seedSnapshot } from "./catalog.testkit";
import { validateSnapshot } from "./snapshot";
import type { Snapshot } from "./types";

const asBook = (raw: unknown): PriceBook => raw as PriceBook;
describe("the catalog map against the real books and the real seed", () => {
    test("every catalog-managed key derives EXACTLY the price the seed has today (no silent price change)", () => {
        const map = realMap(), seed = seedSnapshot();
        const books = { "netquor-fleet": asBook(realFleet()), "netquor-phone": asBook(realPhone()) };
        for (const [key, e] of Object.entries(map.keys)) {
            const d = derive(e, books[e.product as keyof typeof books]);
            expect(d.ok).toBe(true);
            expect(d.ok && d.cents).toBe(seed.prices[key].amountCents);
        }
        expect(Object.keys(map.keys).sort()).toEqual(["fleet.dedicated.month", "fleet.dedicated.setup", "fleet.dedicated.year", "fleet.mac.lifetime", "fleet.mac.month", "fleet.mac.year", "fleet.mobile.lifetime", "fleet.mobile.month", "fleet.mobile.year", "phone.planned_launch.month"]);
    });

    test("with the real books the candidate is null: nothing changed, no version bump", () => {
        const r = buildCandidate(seedSnapshot(), { "netquor-fleet": asBook(realFleet()), "netquor-phone": asBook(realPhone()) }, realMap());
        expect(r.candidate).toBeNull();
        expect(r.changes).toEqual([]);
        expect(r.warnings).toEqual([]);
        expect(r.sources["netquor-fleet"]).toEqual({ version: 1, checksum: realFleet().checksum });
    });

    test("manual keys are not in the map and the map says so", () => {
        const map = realMap();
        for (const k of Object.keys(map.keys)) expect(/^(vpn|network|homeassistant|digitalaccess)\./.test(k)).toBe(false);
        expect(map.manual).toEqual(["vpn.*", "network.*", "homeassistant.*", "digitalaccess.*"]);
    });
});

describe("buildCandidate", () => {
    const seed = seedSnapshot(), map = realMap();
    test("fleet-mac 595 to 645: month 645, year 6450, lifetime 19350, one candidate at version + 1; units kept; other keys untouched", () => {
        const r = buildCandidate(seed, { "netquor-fleet": asBook(fleetWith(645, 395)), "netquor-phone": asBook(realPhone()) }, map, { now: new Date("2026-11-11T00:00:00Z") });
        expect(r.changes.map((c) => [c.key, c.from, c.to])).toEqual([["fleet.mac.lifetime", 17850, 19350], ["fleet.mac.month", 595, 645], ["fleet.mac.year", 5950, 6450]]);
        const c = r.candidate!;
        expect(c.version).toBe(seed.version + 1);
        expect(c.updatedAt).toBe("2026-11-11T00:00:00.000Z");
        expect(c.source).toBe("poll");
        expect(c.prices["fleet.mac.month"]).toEqual({ ...seed.prices["fleet.mac.month"], amountCents: 645 });
        expect(Object.keys(c.prices).sort()).toEqual(Object.keys(seed.prices).sort());
        for (const k of Object.keys(seed.prices)) if (!k.startsWith("fleet.mac.")) expect(c.prices[k]).toEqual(seed.prices[k]);
        expect(validateSnapshot(c).ok).toBe(true);
        expect(seed.prices["fleet.mac.month"].amountCents).toBe(595); // the input is not mutated
    });

    test("phone 25 to 29", () => {
        const r = buildCandidate(seed, { "netquor-phone": asBook(phoneWith(29_000_000)) }, map);
        expect(r.changes).toEqual([{ key: "phone.planned_launch.month", product: "netquor-phone", from: 2500, to: 2900 }]);
        expect(r.candidate!.prices["phone.planned_launch.month"].amountCents).toBe(2900);
    });

    test("non-divisible micros refuse that key only, with a warning", () => {
        const r = buildCandidate(seed, { "netquor-fleet": asBook(fleetWith(645, 395)), "netquor-phone": asBook(phoneWith(25_005_000)) }, map);
        expect(r.warnings.some((w) => w.startsWith("phone.planned_launch.month") && w.includes("whole number of cents"))).toBe(true);
        expect(r.candidate!.prices["phone.planned_launch.month"].amountCents).toBe(2500);
        expect(r.candidate!.prices["fleet.mac.month"].amountCents).toBe(645);
    });

    test("a missing sku warns and keeps the old value (candidate null when nothing else moved)", () => {
        const r = buildCandidate(seed, { "netquor-phone": asBook(phoneWith(null)) }, map);
        expect(r.candidate).toBeNull();
        expect(r.warnings).toHaveLength(1);
        expect(r.warnings[0]).toContain("phone.starter.monthly");
    });

    test("a product with no book (it failed) leaves its keys alone, silently", () => {
        const r = buildCandidate(seed, { "netquor-fleet": undefined, "netquor-phone": asBook(phoneWith(29_000_000)) }, map);
        expect(r.changes.map((c) => c.key)).toEqual(["phone.planned_launch.month"]);
        expect(r.warnings).toEqual([]);
        expect(Object.keys(r.sources)).toEqual(["netquor-phone"]);
    });

    test("never adds a key that is not in the current snapshot, never deletes one", () => {
        const slim: Snapshot = { ...seed, prices: { "fleet.mac.month": seed.prices["fleet.mac.month"], "vpn.from.month": seed.prices["vpn.from.month"] } };
        const r = buildCandidate(slim, { "netquor-fleet": asBook(fleetWith(645, 395)) }, map);
        expect(Object.keys(r.candidate!.prices).sort()).toEqual(["fleet.mac.month", "vpn.from.month"]);
        expect(r.warnings.some((w) => w.includes("not in the current snapshot"))).toBe(true);
    });

    test("amounts outside 0..10,000,000 cents or not whole are refused", () => {
        const huge = fleetWith(595, 395); huge.entries[0].structure.config.kinds[0].monthlyCents = 9_999_999;
        const r = buildCandidate(seed, { "netquor-fleet": asBook(huge) }, map);
        expect(r.warnings.some((w) => w.startsWith("fleet.mac.year") && w.includes("outside"))).toBe(true);
        expect(r.candidate!.prices["fleet.mac.month"].amountCents).toBe(9_999_999);
        expect(r.candidate!.prices["fleet.mac.year"].amountCents).toBe(5950);
        const frac = fleetWith(595.5, 395);
        expect(buildCandidate(seed, { "netquor-fleet": asBook(frac) }, map).candidate).toBeNull();
    });

    test("dedicated block changes flow through", () => {
        const b = fleetWith(595, 395); b.entries[0].structure.config.dedicated.monthlyCents = 3500; b.entries[0].structure.config.dedicated.setupCents = 40000;
        const r = buildCandidate(seed, { "netquor-fleet": asBook(b) }, map);
        expect(r.changes.map((c) => c.key).sort()).toEqual(["fleet.dedicated.month", "fleet.dedicated.setup"]);
    });
});

describe("parseCatalogMap, fetchPlan, helpers", () => {
    test("rejects bad maps with every problem named", () => {
        expect(() => parseCatalogMap(null)).toThrow();
        expect(() => parseCatalogMap({ schema: 1, keys: { "Bad Key": {} } })).toThrow(/not a valid price key/);
        expect(() => parseCatalogMap({ schema: 1, keys: { "a.b": { product: "p", sku: "s", rule: "magic" } } })).toThrow(/rule must be one of/);
        expect(() => parseCatalogMap({ schema: 1, keys: { "a.b": { product: "p", sku: "s", rule: "fleet_month" } } })).toThrow(/needs a kind/);
        expect(() => parseCatalogMap({ schema: 1, keys: {} })).toThrow(/no keys/);
    });
    test("the fetch plan is the configured products that the map uses", () => {
        expect(fetchPlan(realMap(), ["netquor-fleet", "netquor-phone", "netquor-sdn"])).toEqual(["netquor-fleet", "netquor-phone"]);
        expect(fetchPlan(realMap(), ["netquor-phone"])).toEqual(["netquor-phone"]);
    });
    test("parseProducts: default, dedupe, invalid dropped", () => {
        expect(parseProducts("").products).toEqual(["netquor-fleet", "netquor-phone"]);
        expect(parseProducts(" a-b , a-b,C D").products).toEqual(["a-b"]);
        expect(parseProducts("a-b,C D").invalid).toEqual(["C D"]);
    });
    test("parseRetryAfter: seconds, date, junk, bounds", () => {
        expect(parseRetryAfter("30", 0)).toBe(30_000);
        expect(parseRetryAfter(null, 0)).toBe(60_000);
        expect(parseRetryAfter("soon", 0)).toBe(60_000);
        expect(parseRetryAfter("999999", 0)).toBe(3_600_000);
        expect(parseRetryAfter(new Date(45_000).toUTCString(), 0)).toBe(45_000);
    });
    test("sanitizeSources keeps only well-formed entries; fingerprint is stable", () => {
        expect(sanitizeSources({ "netquor-fleet": { version: 3, checksum: "abc", fetchedAt: "2026-11-10T00:00:00Z" }, bad: { version: 0 }, "X Y": {} })).toEqual({ "netquor-fleet": { version: 3, checksum: "abc", fetchedAt: "2026-11-10T00:00:00Z" } });
        expect(sourcesFingerprint({ b: { version: 2, checksum: "y" }, a: { version: 1, checksum: "x" } })).toBe("a@1:x,b@2:y");
    });
});

describe("createCatalogPuller", () => {
    const BASE = "https://api.example.com";
    type Call = { url: string; headers: Record<string, string> };
    const script = (handler: (call: Call, n: number) => Response | Error) => {
        const calls: Call[] = [];
        const fetch: Fetcher = async (url, init) => { const c = { url, headers: init.headers }; calls.push(c); const r = handler(c, calls.length); if (r instanceof Error) throw r; return r; };
        return { fetch, calls };
    };
    const book = (product: string) => (product === "netquor-fleet" ? realFleet() : realPhone());
    const ok = (c: Call, etag?: string) => new Response(JSON.stringify(book(new URL(c.url).searchParams.get("product")!)), { headers: { etag: etag ?? '"e1"' } });
    const clock = { ms: 1_000_000 };
    const mk = (s: ReturnType<typeof script>, o: { timeoutMs?: number; maxBytes?: number; base?: string } = {}) => createCatalogPuller({ baseUrl: o.base ?? BASE, fetch: s.fetch, now: () => clock.ms, timeoutMs: o.timeoutMs, maxBytes: o.maxBytes });

    test("one request per product with the User-Agent, product in the query; ETag sent per product on the next pull; 304 reuses the kept book", async () => {
        const s = script((c) => (c.headers["if-none-match"] ? new Response(null, { status: 304 }) : ok(c, `"e-${new URL(c.url).searchParams.get("product")}"`)));
        const p = mk(s);
        const first = await p.pull(["netquor-fleet", "netquor-phone"]);
        expect(first.results["netquor-fleet"].kind).toBe("changed");
        expect(s.calls.map((c) => c.url).sort()).toEqual([`${BASE}/v1/catalog/price-books/current?product=netquor-fleet`, `${BASE}/v1/catalog/price-books/current?product=netquor-phone`]);
        expect(s.calls.every((c) => c.headers["user-agent"] === "netquor-web-worker" && !c.headers["if-none-match"])).toBe(true);
        const second = await p.pull(["netquor-fleet", "netquor-phone"]);
        expect(s.calls.slice(2).map((c) => [new URL(c.url).searchParams.get("product"), c.headers["if-none-match"]]).sort()).toEqual([["netquor-fleet", '"e-netquor-fleet"'], ["netquor-phone", '"e-netquor-phone"']]);
        expect(second.results["netquor-phone"].kind).toBe("not_modified");
        expect(second.books["netquor-phone"].version).toBe(1);
        const forced = await p.pull(["netquor-fleet"], { force: true });
        expect(s.calls.at(-1)!.headers["if-none-match"]).toBeUndefined();
        expect(forced.results["netquor-fleet"].kind).toBe("changed");
    });

    test("a failing product never blocks the others, and has no book", async () => {
        const s = script((c) => (c.url.includes("netquor-fleet") ? new Response("boom", { status: 500 }) : ok(c)));
        const r = await mk(s).pull(["netquor-fleet", "netquor-phone"]);
        expect(r.results["netquor-fleet"]).toEqual({ kind: "failed", reason: "the API answered 500" });
        expect(Object.keys(r.books)).toEqual(["netquor-phone"]);
    });

    test("429 honours Retry-After: no request to that product until it passes; the other product is unaffected", async () => {
        const s = script((c) => (c.url.includes("netquor-fleet") ? new Response("", { status: 429, headers: { "retry-after": "120" } }) : ok(c)));
        const p = mk(s);
        const a = await p.pull(["netquor-fleet", "netquor-phone"]);
        expect(a.results["netquor-fleet"]).toMatchObject({ kind: "rate_limited", retryAfterMs: 120_000 });
        const n = s.calls.length;
        clock.ms += 60_000;
        const b = await p.pull(["netquor-fleet", "netquor-phone"]);
        expect(b.results["netquor-fleet"]).toMatchObject({ kind: "rate_limited", retryAfterMs: 60_000 });
        expect(s.calls.length).toBe(n + 1); // only phone was asked
        clock.ms += 60_001;
        expect((await p.pull(["netquor-fleet"])).results["netquor-fleet"].kind).toBe("rate_limited"); // asked again, still 429
        expect(s.calls.length).toBe(n + 2);
    });

    test("http to a non-loopback host is refused without a request; loopback http works", async () => {
        const s = script((c) => ok(c));
        expect((await mk(s, { base: "http://api.example.com" }).pull(["netquor-fleet"])).results["netquor-fleet"].kind).toBe("failed");
        expect(s.calls).toHaveLength(0);
        expect((await mk(s, { base: "http://127.0.0.1:9999" }).pull(["netquor-fleet"])).results["netquor-fleet"].kind).toBe("changed");
    });

    test("an oversized body, a wrong product, an unpublished book and junk are all failures", async () => {
        expect((await mk(script((c) => ok(c)), { maxBytes: 100 }).pull(["netquor-fleet"])).results["netquor-fleet"]).toEqual({ kind: "failed", reason: "the answer is too large" });
        expect((await mk(script(() => new Response(JSON.stringify(realPhone())))).pull(["netquor-fleet"])).results["netquor-fleet"]).toMatchObject({ kind: "failed", reason: "the book is for another product" });
        expect((await mk(script(() => new Response(JSON.stringify({ ...realFleet(), status: "draft" })))).pull(["netquor-fleet"])).results["netquor-fleet"]).toMatchObject({ kind: "failed" });
        expect((await mk(script(() => new Response("<html>"))).pull(["netquor-fleet"])).results["netquor-fleet"]).toMatchObject({ kind: "failed" });
        expect((await mk(script(() => new Error("down"))).pull(["netquor-fleet"])).results["netquor-fleet"]).toEqual({ kind: "failed", reason: "could not reach the API" });
    });

    test("a request that hangs is abandoned after the timeout", async () => {
        const s = script(() => new Error("x"));
        const hang: Fetcher = (_u, init) => new Promise((_r, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted"))));
        const r = await createCatalogPuller({ baseUrl: BASE, fetch: hang, now: () => 0, timeoutMs: 20 }).pull(["netquor-fleet"]);
        expect(r.results["netquor-fleet"]).toEqual({ kind: "failed", reason: "no answer within 0 s" });
        void s;
    });
});
