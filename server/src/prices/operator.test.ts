// operator.test.ts: the send-prices tool: argument rules, the signed request, and talking to a real local web (Elysia routes) end to end.
import { describe, expect, test } from "bun:test";
import { buildOperatorRequest, parseOperatorArgs, runOperator } from "./operator";
import { createNudger } from "./nudge";
import { priceRoutes } from "./routes";
import { signBody } from "./signature";
import { NOW_MS, snap, world } from "./testkit";

const SECRET = "operator-secret-0123456789";
const ten = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`k.p${i}`, 1000]));

describe("parseOperatorArgs", () => {
    test("a file and a reason are required", () => {
        expect(parseOperatorArgs(["s.json", "--reason", "why"])).toEqual({ file: "s.json", reason: "why", allowLarge: false, rebaseVersion: false });
        expect(parseOperatorArgs(["--reason=why", "s.json", "--allow-large", "--rebase-version"])).toEqual({ file: "s.json", reason: "why", allowLarge: true, rebaseVersion: true });
        expect(parseOperatorArgs(["s.json"])).toEqual({ error: "--reason is required (it is logged)" });
        expect(parseOperatorArgs(["s.json", "--reason", "  "])).toMatchObject({ error: expect.stringContaining("--reason") });
        expect(parseOperatorArgs(["--reason", "x"])).toMatchObject({ error: expect.stringContaining("file") });
        expect(parseOperatorArgs(["a", "b", "--reason", "x"])).toMatchObject({ error: expect.stringContaining("one snapshot") });
        expect(parseOperatorArgs(["a", "--force", "--reason", "x"])).toMatchObject({ error: "unknown option --force" });
        expect(parseOperatorArgs(["a", "--reason", "x".repeat(201)])).toMatchObject({ error: expect.stringContaining("200") });
    });
});

describe("buildOperatorRequest", () => {
    const args = { file: "s.json", reason: "why", allowLarge: true, rebaseVersion: true };
    test("signs the exact body with t=<unix>,v1=<hmac> and sets the flags", () => {
        const r = buildOperatorRequest({ args, snapshotJson: JSON.stringify(snap(2)), secret: SECRET, baseUrl: "http://netquor-web:3000/ignored/path", nowMs: NOW_MS });
        if ("error" in r) throw new Error(r.error);
        expect(r.url).toBe("http://netquor-web:3000/hooks/pricing");
        const t = Math.floor(NOW_MS / 1000);
        expect(r.headers["x-netquor-signature"]).toBe(`t=${t},v1=${signBody(SECRET, t, r.body)}`);
        expect(JSON.parse(r.body)).toMatchObject({ via: "operator", reason: "why", allowLargeChange: true, rebaseVersion: true, snapshot: { version: 2 } });
    });
    test("flags are absent unless asked for", () => {
        const r = buildOperatorRequest({ args: { ...args, allowLarge: false, rebaseVersion: false }, snapshotJson: "{}", secret: SECRET, baseUrl: "http://127.0.0.1:3000", nowMs: NOW_MS });
        if ("error" in r) throw new Error(r.error);
        expect(Object.keys(JSON.parse(r.body)).sort()).toEqual(["reason", "snapshot", "via"]);
    });
    test("not JSON and a bad address are errors", () => {
        expect(buildOperatorRequest({ args, snapshotJson: "{nope", secret: SECRET, baseUrl: "http://x:1", nowMs: 0 })).toEqual({ error: "s.json is not JSON" });
        expect(buildOperatorRequest({ args, snapshotJson: "{}", secret: SECRET, baseUrl: "ftp://x", nowMs: 0 })).toMatchObject({ error: expect.stringContaining("web address") });
    });
});

describe("runOperator against the real routes", () => {
    const harness = (initial = snap(1, ten)) => {
        const w = world(initial);
        const logs: string[] = [];
        const app = priceRoutes({ secrets: () => [SECRET], now: () => NOW_MS, ingest: w.ingest, cache: w.cache, nudge: createNudger({ pull: async () => ({ kind: "unchanged" }), now: () => NOW_MS }), log: (l) => logs.push(l) });
        const out: string[] = [], err: string[] = [];
        const run = (argv: string[], file: unknown, env: Record<string, string | undefined> = { PRICING_WEBHOOK_SECRET: SECRET }) => runOperator({
            argv, env, now: () => NOW_MS, out: (l) => out.push(l), err: (l) => err.push(l),
            readFile: () => JSON.stringify(file),
            fetch: (url, init) => { expect(url).toBe("http://127.0.0.1:3000/hooks/pricing"); return app.handle(new Request(url, init)); },
        });
        return { ...w, run, out, err, logs };
    };

    test("a normal change is accepted; the reason reaches the web log", async () => {
        const h = harness();
        expect(await h.run(["s.json", "--reason", "price rise"], snap(2, { ...ten, "k.p0": 1100 }))).toBe(0);
        expect(h.out[0]).toContain("accepted");
        expect(h.cache.get()).toMatchObject({ version: 2, source: "operator" });
        expect(h.lines.some((l) => l.includes("price rise"))).toBe(true);
    });

    test("a large change is refused without --allow-large and accepted with it", async () => {
        const h = harness();
        const big = snap(2, Object.fromEntries(Object.entries(ten).slice(5)));
        expect(await h.run(["s.json", "--reason", "retire five"], big)).toBe(1);
        expect(h.err[0]).toContain("change_too_large");
        expect(h.cache.get().version).toBe(1);
        expect(await h.run(["s.json", "--reason", "retire five", "--allow-large"], big)).toBe(0);
        expect(h.cache.get().version).toBe(2);
        expect(h.state.baseline).toMatchObject({ reason: "retire five" });
    });

    test("--rebase-version lowers the version; without it the same file is refused as stale", async () => {
        const h = harness(snap(12, ten));
        const lower = snap(5, ten, { updatedAt: "2026-11-10T11:00:00.000Z" });
        expect(await h.run(["s.json", "--reason", "api reset"], lower)).toBe(1);
        expect(h.err[0]).toContain("stale");
        expect(await h.run(["s.json", "--reason", "api reset", "--rebase-version"], lower)).toBe(0);
        expect(h.cache.get().version).toBe(5);
    });

    test("usage errors exit 2 and never reach the network; the secret must be set and long enough", async () => {
        const h = harness();
        expect(await h.run(["s.json"], snap(2))).toBe(2);
        expect(await h.run(["s.json", "--reason", "x"], snap(2), {})).toBe(2);
        expect(await h.run(["s.json", "--reason", "x"], snap(2), { PRICING_WEBHOOK_SECRET: "short" })).toBe(2);
        expect(h.err.join("\n")).not.toContain("short\n");
        expect(h.cache.get().version).toBe(1);
    });

    test("an unreachable web process is exit 1", async () => {
        const err: string[] = [];
        const code = await runOperator({ argv: ["s.json", "--reason", "x"], env: { PRICING_WEBHOOK_SECRET: SECRET }, now: () => NOW_MS, out: () => {}, err: (l) => err.push(l), readFile: () => "{}", fetch: async () => { throw new Error("ECONNREFUSED"); } });
        expect(code).toBe(1);
        expect(err[0]).toContain("could not reach");
    });

    test("WEB_INTERNAL_URL is honoured", async () => {
        const urls: string[] = [];
        await runOperator({ argv: ["s.json", "--reason", "x"], env: { PRICING_WEBHOOK_SECRET: SECRET, WEB_INTERNAL_URL: "http://netquor-web:3000" }, now: () => NOW_MS, out: () => {}, err: () => {}, readFile: () => "{}", fetch: async (u) => { urls.push(u); return new Response("{}"); } });
        expect(urls).toEqual(["http://netquor-web:3000/hooks/pricing"]);
    });
});
