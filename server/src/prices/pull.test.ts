// pull.test.ts: fetching the API: headers, ETag, redirects, timeout, the byte cap on a stream, bad content, URL validation.
import { describe, expect, test } from "bun:test";
import { createFetcher, readBodyCapped, unwrapPayload, type Fetcher } from "./pull";
import { snap } from "./testkit";

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, ...init });
const make = (fetch: Fetcher, extra: Partial<Parameters<typeof createFetcher>[0]> = {}) => createFetcher({ url: "https://api.example.com/prices", fetch, ...extra });

describe("createFetcher", () => {
    test("sends accept, the bearer token and If-None-Match; returns the snapshot and its ETag", async () => {
        let seen: { url: string; headers: Record<string, string>; redirect: string } | undefined;
        const f = make(async (url, init) => { seen = { url, headers: init.headers, redirect: init.redirect }; return json(snap(2), { headers: { etag: '"abc"' } }); }, { token: "tok-1" });
        const r = await f({ etag: '"old"' });
        expect(r).toEqual({ kind: "changed", candidate: snap(2), etag: '"abc"' });
        expect(seen as unknown).toEqual({ url: "https://api.example.com/prices", headers: { accept: "application/json", authorization: "Bearer tok-1", "if-none-match": '"old"' }, redirect: "error" });
    });

    test("no token and no etag means neither header", async () => {
        let h: Record<string, string> = {};
        await make(async (_u, init) => { h = init.headers; return json(snap(2)); })();
        expect(Object.keys(h)).toEqual(["accept"]);
    });

    test("304 is not_modified; other statuses are failures that name only the status", async () => {
        expect(await make(async () => new Response(null, { status: 304 }))()).toEqual({ kind: "not_modified" });
        expect(await make(async () => new Response("nope", { status: 503 }))()).toEqual({ kind: "failed", reason: "the API answered 503" });
        expect(await make(async () => new Response("", { status: 302, headers: { location: "https://evil.example" } }))()).toEqual({ kind: "failed", reason: "the API answered 302" });
    });

    test("a fetch that throws (including a refused redirect) is a failure that does not leak the message", async () => {
        const r = await make(async () => { throw new Error("redirect to https://secret.example/?token=zzz"); })();
        expect(r).toEqual({ kind: "failed", reason: "could not reach the API" });
    });

    test("a wrapper { snapshot } is unwrapped; its extra flags are ignored", async () => {
        const r = await make(async () => json({ snapshot: snap(2), allowLargeChange: true }))();
        expect(r).toMatchObject({ kind: "changed", candidate: snap(2) });
        expect(unwrapPayload({ snapshot: 1, prices: {} })).toEqual({ snapshot: 1, prices: {} });
    });

    test("not JSON and not UTF-8 are failures", async () => {
        expect(await make(async () => new Response("<html>"))()).toEqual({ kind: "failed", reason: "the API answer is not JSON" });
        expect(await make(async () => new Response(new Uint8Array([0x7b, 0xff, 0x7d])))()).toEqual({ kind: "failed", reason: "the API answer is not valid UTF-8" });
    });

    test("a timeout aborts the request and reports the budget", async () => {
        let aborted = false;
        const f = make((_u, init) => new Promise<Response>((_res, rej) => { init.signal.addEventListener("abort", () => { aborted = true; rej(new Error("aborted")); }); }), { timeoutMs: 30 });
        expect(await f()).toEqual({ kind: "failed", reason: "no answer within 0 s" });
        expect(aborted).toBe(true);
    });

    test("the timeout also covers a body that never finishes", async () => {
        const stalled = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('{"a":')); } });
        const f = make(async () => new Response(stalled), { timeoutMs: 40 });
        const started = Date.now();
        const r = await f();
        expect(r.kind).toBe("failed");
        expect(Date.now() - started).toBeLessThan(2000);
    });

    test("an outside abort signal stops it", async () => {
        const ctl = new AbortController();
        const f = make((_u, init) => new Promise<Response>((_res, rej) => init.signal.addEventListener("abort", () => rej(new Error("x")))));
        const p = f({ signal: ctl.signal });
        ctl.abort();
        expect(await p).toEqual({ kind: "failed", reason: "stopped" });
    });

    test("an invalid or empty address never reaches fetch", async () => {
        let called = 0;
        const fetch: Fetcher = async () => { called++; return json(snap(1)); };
        for (const url of ["http://example.com/x", "https://u:p@example.com/", "ftp://x", ""]) expect((await createFetcher({ url, fetch })()).kind).toBe("failed");
        expect(called).toBe(0);
        expect(await createFetcher({ url: "", fetch })()).toEqual({ kind: "failed", reason: "PRICING_API_URL is not set" });
    });
});

describe("the byte cap", () => {
    test("a declared Content-Length over the cap is refused without reading", async () => {
        let cancelled = false, read = 0;
        const body = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(10)); }, cancel() { cancelled = true; } });
        const origGetReader = body.getReader.bind(body);
        body.getReader = ((...a: []) => { read++; return origGetReader(...a); }) as typeof body.getReader;
        const f = make(async () => new Response(body, { headers: { "content-length": "999999" } }), { maxBytes: 1000 });
        expect(await f()).toEqual({ kind: "failed", reason: "the API answer is too large" });
        expect(read).toBe(0);
        expect(cancelled).toBe(true);
    });

    test("a stream with no length is cut off as soon as it passes the cap, and cancelled", async () => {
        let produced = 0, cancelled = false;
        const body = new ReadableStream({ pull(c) { produced += 100; c.enqueue(new Uint8Array(100)); }, cancel() { cancelled = true; } });
        const f = make(async () => new Response(body), { maxBytes: 1000 });
        expect(await f()).toEqual({ kind: "failed", reason: "the API answer is too large" });
        expect(cancelled).toBe(true);
        expect(produced).toBeLessThanOrEqual(2000); // never the whole (endless) stream
    });

    test("a body of exactly the cap is read", async () => {
        const bytes = await readBodyCapped(new Response(new Uint8Array(1000)), 1000);
        expect(bytes?.byteLength).toBe(1000);
        expect(await readBodyCapped(new Response(new Uint8Array(1001)), 1000)).toBeNull();
    });
});
