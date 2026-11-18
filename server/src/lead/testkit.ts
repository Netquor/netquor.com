// lead/testkit.ts: a world for tests: the app with a memory sink, a controllable clock and a real limiter.
import { createApp, type AppDeps, type Plugin } from "../app";
import { slidingWindowLimiter } from "../lib/rateLimit";
import type { Lead, LeadSink } from "./types";

export const ORIGIN = "https://www.netquor.com";

export const memorySink = () => {
    const leads: Lead[] = [];
    const sink: LeadSink = { deliver: async (l) => void leads.push(l) };
    return { leads, sink };
};

export const world = (o: { sink?: LeadSink; max?: number; windowMs?: number; trustPeerIpHeader?: boolean; config?: Partial<AppDeps["config"]>; plugins?: Plugin[]; health?: AppDeps["health"] } = {}) => {
    const mem = memorySink();
    const time = { now: Date.parse("2026-11-10T12:00:00Z") };
    const logs: string[] = [];
    const clock = () => time.now;
    const config = { allowedOrigins: [ORIGIN, "https://netquor.com"], maxBodyBytes: 16 * 1024, deliveryDeadlineMs: 8000, ...o.config };
    const app = createApp({
        config,
        trustPeerIpHeader: o.trustPeerIpHeader ?? true, // app.handle has no socket, so the header is the only address source in these tests
        leadSink: o.sink ?? mem.sink,
        clock,
        rateLimiter: slidingWindowLimiter({ max: o.max ?? 5, windowMs: o.windowMs ?? 600_000, now: clock, keyMax: { unknown: (o.max ?? 5) * 20 } }),
        plugins: o.plugins,
        health: o.health,
        log: (m) => void logs.push(m),
    });
    const post = (body: string, headers: Record<string, string> = {}) =>
        app.handle(new Request("http://localhost/api/lead", { method: "POST", body, headers: { "content-type": "application/json", ...headers } }));
    const postJson = (obj: unknown, headers: Record<string, string> = {}) => post(JSON.stringify(obj), headers);
    const postForm = (obj: Record<string, string>, headers: Record<string, string> = {}) =>
        post(new URLSearchParams(obj).toString(), { "content-type": "application/x-www-form-urlencoded", ...headers });
    return { app, time, logs, leads: mem.leads, post, postJson, postForm };
};

export const good = { name: "Ada Lovelace", email: "ada@example.com", company: "Analytical Engines", macs: 12, ios: 3, message: "Hello", term: "annual" };
