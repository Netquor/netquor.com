import { afterEach, describe, expect, test } from "bun:test";
import { Cdp } from "./cdp";

type Handler = (msg: { id: number; method: string; params: any; sessionId?: string }, ws: { send(s: string): void }) => void;

let server: ReturnType<typeof Bun.serve> | undefined;
let client: Cdp | undefined;
afterEach(() => {
    client?.close();
    server?.stop(true);
    client = undefined;
    server = undefined;
});

const open = async (handler: Handler): Promise<Cdp> => {
    server = Bun.serve({
        port: 0,
        hostname: "127.0.0.1",
        fetch(req, s) { return s.upgrade(req, { data: null }) ? undefined : new Response("no"); },
        websocket: { message(ws, m) { handler(JSON.parse(String(m)), ws); } },
    });
    client = await Cdp.connect(`ws://127.0.0.1:${server.port}`);
    return client;
};

describe("Cdp", () => {
    test("a request gets its result by id", async () => {
        const c = await open((m, ws) => ws.send(JSON.stringify({ id: m.id, result: { echoed: m.method, params: m.params } })));
        expect(await c.send("Page.navigate", { url: "x" })).toEqual({ echoed: "Page.navigate", params: { url: "x" } });
    });
    test("concurrent requests are matched to their own answers", async () => {
        const c = await open((m, ws) => { setTimeout(() => ws.send(JSON.stringify({ id: m.id, result: { n: m.params.n } })), m.params.n === 1 ? 40 : 0); });
        const [a, b] = await Promise.all([c.send("A", { n: 1 }), c.send("B", { n: 2 })]);
        expect([a.n, b.n]).toEqual([1, 2]);
    });
    test("a protocol error rejects with the method name", async () => {
        const c = await open((m, ws) => ws.send(JSON.stringify({ id: m.id, error: { message: "Not allowed" } })));
        await expect(c.send("Page.close")).rejects.toThrow("Page.close: Not allowed");
    });
    test("the session id is sent only when given", async () => {
        const seen: unknown[] = [];
        const c = await open((m, ws) => { seen.push(m.sessionId); ws.send(JSON.stringify({ id: m.id, result: {} })); });
        await c.send("A");
        await c.send("B", {}, "S1");
        expect(seen).toEqual([undefined, "S1"]);
    });
    test("events reach every listener, with the session id, until unsubscribed", async () => {
        const c = await open((m, ws) => { ws.send(JSON.stringify({ method: "Network.requestWillBeSent", params: { n: 1 }, sessionId: "S" })); ws.send(JSON.stringify({ id: m.id, result: {} })); });
        const a: unknown[] = [], b: unknown[] = [];
        const offA = c.on((e) => a.push([e.method, e.sessionId, e.params]));
        c.on((e) => b.push(e.method));
        await c.send("X");
        offA();
        await c.send("Y");
        expect(a).toEqual([["Network.requestWillBeSent", "S", { n: 1 }]]);
        expect(b).toEqual(["Network.requestWillBeSent", "Network.requestWillBeSent"]);
    });
    test("an unanswered request times out", async () => {
        const c = await open(() => {});
        await expect(c.send("Slow", {}, undefined, 50)).rejects.toThrow(/no answer within 50 ms/);
    });
    test("pending requests reject when the socket closes, and later sends fail fast", async () => {
        const c = await open((_m, ws) => { setTimeout(() => (ws as unknown as { close(): void }).close(), 10); });
        await expect(c.send("Hang")).rejects.toThrow(/socket closed/);
        await expect(c.send("After")).rejects.toThrow(/closed/);
        expect(c.closed).toBe(true);
    });
    test("connecting to nothing rejects", async () => {
        await expect(Cdp.connect("ws://127.0.0.1:1")).rejects.toThrow(/could not open/);
    });
});
