// lead/sinks.test.ts: the file sink writes private JSON lines; the webhook sink signs so that an independent verifier accepts it.
import { afterAll, describe, expect, test } from "bun:test";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CompositeSink, FileSink, hashIp, leadPayload, WebhookSink } from "./sinks";
import type { Lead, LeadSink } from "./types";

const lead = (n = 1): Lead => ({ id: `ld_${n}`, receivedAt: "2026-11-10T12:00:00.000Z", name: "Ada", email: "ada@example.com", company: "AE", macs: 1, ios: 2, message: "line one\nline two", term: "annual", source: "fleet" });
const dirs: string[] = [];
const tmp = async () => { const d = await mkdtemp(join(tmpdir(), "nq-leads-")); dirs.push(d); return d; };
afterAll(async () => { for (const d of dirs) await rm(d, { recursive: true, force: true }); });

describe("FileSink", () => {
    test("creates the folder, appends one JSON line per lead, and the file is 0600", async () => {
        const path = join(await tmp(), "deep/er/leads.jsonl");
        const s = new FileSink(path);
        await s.deliver(lead(1));
        await s.deliver(lead(2));
        const lines = (await readFile(path, "utf8")).split("\n");
        expect(lines.pop()).toBe("");
        expect(lines.map((l) => JSON.parse(l).id)).toEqual(["ld_1", "ld_2"]);
        expect(JSON.parse(lines[0]).message).toBe("line one\nline two"); // a line break inside a value cannot split the line
        expect((await stat(path)).mode & 0o777).toBe(0o600);
        expect((await stat(join(path, ".."))).mode & 0o777).toBe(0o700);
    });
    test("an existing file with wider rights is tightened", async () => {
        const path = join(await tmp(), "leads.jsonl");
        await writeFile(path, "");
        await chmod(path, 0o644);
        await new FileSink(path).deliver(lead());
        expect((await stat(path)).mode & 0o777).toBe(0o600);
    });
    test("many leads at once all land, each on its own line", async () => {
        const path = join(await tmp(), "leads.jsonl");
        const s = new FileSink(path);
        await Promise.all(Array.from({ length: 40 }, (_, i) => s.deliver(lead(i))));
        const lines = (await readFile(path, "utf8")).trim().split("\n");
        expect(lines).toHaveLength(40);
        lines.forEach((l) => JSON.parse(l));
    });
    test("a path that cannot be written rejects", async () => {
        const dir = await tmp();
        await writeFile(join(dir, "file"), "x");
        await expect(new FileSink(join(dir, "file", "leads.jsonl")).deliver(lead())).rejects.toBeDefined();
    });
});

// An independent verifier, written the way the receiver would: parse the header, recompute, compare in constant time, check the age.
function verify(header: string | null, rawBody: string, secret: string, nowSeconds: number, toleranceSeconds = 300): boolean {
    if (!header) return false;
    const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
    if (!/^\d+$/.test(parts.t ?? "") || !/^[0-9a-f]{64}$/.test(parts.v1 ?? "")) return false;
    if (Math.abs(nowSeconds - Number(parts.t)) > toleranceSeconds) return false;
    const expected = createHmac("sha256", secret).update(parts.t + "." + rawBody).digest();
    return timingSafeEqual(expected, Buffer.from(parts.v1, "hex"));
}

describe("WebhookSink", () => {
    const secret = "whsec_test_0123456789abcdef";
    const NOW = Date.parse("2026-11-10T12:00:00Z");
    type Call = { url: string; init: RequestInit };
    const fakeFetch = (answers: (Response | Error)[]) => {
        const calls: Call[] = [];
        const f = (async (url: string, init: RequestInit) => { calls.push({ url, init }); const a = answers.shift()!; if (a instanceof Error) throw a; return a; }) as unknown as typeof fetch;
        return { calls, f };
    };
    const sink = (f: typeof fetch) => new WebhookSink({ url: "https://hooks.example.com/lead", secret, fetch: f, now: () => NOW, retryDelayMs: 1 });

    test("posts the lead as JSON with a signature an independent verifier accepts", async () => {
        const { calls, f } = fakeFetch([new Response("ok", { status: 200 })]);
        await sink(f).deliver(lead());
        expect(calls).toHaveLength(1);
        const { url, init } = calls[0];
        expect(url).toBe("https://hooks.example.com/lead");
        expect(init.method).toBe("POST");
        const headers = init.headers as Record<string, string>;
        expect(headers["content-type"]).toBe("application/json");
        expect(headers["x-netquor-signature"]).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
        const body = init.body as string;
        expect(JSON.parse(body)).toEqual({ schema: 1, id: "ld_1", receivedAt: "2026-11-10T12:00:00.000Z", source: "fleet", name: "Ada", email: "ada@example.com", company: "AE", message: "line one\nline two", macs: 1, ios: 2, term: "annual" });
        expect(verify(headers["x-netquor-signature"], body, secret, NOW / 1000)).toBe(true);
    });
    test("empty optionals are omitted, and a missing source becomes 'site'", async () => {
        const { calls, f } = fakeFetch([new Response("ok")]);
        await sink(f).deliver({ id: "ld_2", receivedAt: "2026-11-10T12:00:00.000Z", name: "Ada", email: "ada@example.com", company: "", macs: 0, ios: 0, message: "", term: "", source: "" });
        expect(JSON.parse(calls[0].init.body as string)).toEqual({ schema: 1, id: "ld_2", receivedAt: "2026-11-10T12:00:00.000Z", source: "site", name: "Ada", email: "ada@example.com" });
    });
    test("page and utm are sent when present; an empty utm is not", () => {
        expect(leadPayload({ ...lead(), page: "/fleet.html", utm: { source: "news", campaign: "fall" } })).toMatchObject({ page: "/fleet.html", utm: { source: "news", campaign: "fall" } });
        expect(leadPayload({ ...lead(), utm: {} })).not.toHaveProperty("utm");
    });
    test("ipHash is the first 32 hex of HMAC-SHA256(key = secret, data = address); the raw address is never in the body", async () => {
        const { calls, f } = fakeFetch([new Response("ok")]);
        await sink(f).deliver(lead(), { clientIp: "203.0.113.9" });
        const body = calls[0].init.body as string;
        const expected = createHmac("sha256", secret).update("203.0.113.9").digest("hex").slice(0, 32);
        expect(JSON.parse(body).ipHash).toBe(expected);
        expect(hashIp(secret, "203.0.113.9")).toBe(expected);
        expect(body).not.toContain("203.0.113.9");
        const { calls: c2, f: f2 } = fakeFetch([new Response("ok")]);
        await sink(f2).deliver(lead());
        expect(JSON.parse(c2[0].init.body as string)).not.toHaveProperty("ipHash");
    });
    test("the verifier rejects a wrong secret, an altered body, and an old timestamp", async () => {
        const { calls, f } = fakeFetch([new Response("ok")]);
        await sink(f).deliver(lead());
        const sig = (calls[0].init.headers as Record<string, string>)["x-netquor-signature"];
        const body = calls[0].init.body as string;
        expect(verify(sig, body, "another-secret-0123456789", NOW / 1000)).toBe(false);
        expect(verify(sig, body.replace("Ada", "Eve"), secret, NOW / 1000)).toBe(false);
        expect(verify(sig, body, secret, NOW / 1000 + 3600)).toBe(false);
    });
    test("retries once on a 500 and then succeeds; each attempt carries a valid signature", async () => {
        const { calls, f } = fakeFetch([new Response("no", { status: 500 }), new Response("ok")]);
        await sink(f).deliver(lead());
        expect(calls).toHaveLength(2);
        for (const c of calls) expect(verify((c.init.headers as Record<string, string>)["x-netquor-signature"], c.init.body as string, secret, NOW / 1000)).toBe(true);
    });
    test("retries once on a network error, then gives up after the second failure", async () => {
        const { calls, f } = fakeFetch([new Error("down"), new Error("down")]);
        await expect(sink(f).deliver(lead())).rejects.toThrow("webhook could not be reached");
        expect(calls).toHaveLength(2);
    });
    test("a 4xx answer is final (no retry) and rejects", async () => {
        const { calls, f } = fakeFetch([new Response("bad", { status: 401 })]);
        await expect(sink(f).deliver(lead())).rejects.toThrow("401");
        expect(calls).toHaveLength(1);
    });
    test("a 429 is retried", async () => {
        const { calls, f } = fakeFetch([new Response("slow", { status: 429 }), new Response("ok")]);
        await sink(f).deliver(lead());
        expect(calls).toHaveLength(2);
    });
    test("passes a 5 second timeout signal and refuses redirects", async () => {
        const { calls, f } = fakeFetch([new Response("ok")]);
        await sink(f).deliver(lead());
        expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
        expect(calls[0].init.redirect).toBe("error");
    });
    test("a really slow server is cut off by the timeout", async () => {
        const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Promise<Response>(() => {}) });
        try {
            const s = new WebhookSink({ url: `http://127.0.0.1:${server.port}/`, secret, timeoutMs: 80, retryDelayMs: 1 });
            const started = Date.now();
            await expect(s.deliver(lead())).rejects.toThrow("timed out");
            expect(Date.now() - started).toBeLessThan(2000);
        } finally { server.stop(true); }
    });
    test("a real receiver can verify what actually went over the wire", async () => {
        let seen: { sig: string | null; body: string } | null = null;
        const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: async (req) => { seen = { sig: req.headers.get("x-netquor-signature"), body: await req.text() }; return new Response("ok"); } });
        try {
            await new WebhookSink({ url: `http://127.0.0.1:${server.port}/`, secret }).deliver(lead());
            expect(verify(seen!.sig, seen!.body, secret, Date.now() / 1000)).toBe(true);
        } finally { server.stop(true); }
    });
});

describe("CompositeSink", () => {
    const ok: LeadSink = { deliver: async () => {} };
    const bad: LeadSink = { deliver: async () => { throw new Error("boom"); } };
    test("succeeds when at least one works, and logs the other without the lead", async () => {
        const logs: string[] = [];
        await new CompositeSink([{ name: "file", sink: bad }, { name: "webhook", sink: ok }], (m) => logs.push(m)).deliver(lead());
        expect(logs).toEqual(["lead sink file failed: boom"]);
        expect(logs.join()).not.toContain("ada@example.com");
    });
    test("both are tried even when the first works", async () => {
        let n = 0;
        const count: LeadSink = { deliver: async () => void n++ };
        await new CompositeSink([{ name: "a", sink: count }, { name: "b", sink: count }]).deliver(lead());
        expect(n).toBe(2);
    });
    test("fails only when every sink fails", async () => {
        await expect(new CompositeSink([{ name: "a", sink: bad }, { name: "b", sink: bad }], () => {}).deliver(lead())).rejects.toThrow("no lead sink");
    });
});
