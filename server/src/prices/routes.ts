// routes.ts: the pricing webhook and the public snapshot, as an Elysia plugin. POST /hooks/pricing takes a signed body, one of:
//   { snapshot, via?: "poll" | "operator", allowLargeChange?, rebaseVersion?, reason? }  a full snapshot (the primary path, and the worker's delivery of a poll)
//   { event: "prices.changed" } or the Netquor API's { id, type: "price.changed", at, data }  a nudge: pull once from the API (coalesced, see nudge.ts)
//   { event: "poll.ok" }                                                               the worker's heartbeat: the API was reached and had nothing newer. Answered { ok: true, version } with the snapshot version in force here, so the worker can tell when this process is behind the API. A heartbeat signed more than 60 s ago is refused (401).
// A body that carries rebaseVersion or allowLargeChange is honoured only within 60 s of its signature timestamp (every other body: 300 s) and each (timestamp, signature) pair is accepted once for 5 minutes (401 otherwise, like any bad signature).
// Answers: 200 done (or coalesced), 401 bare (bad or missing signature), 400 not a known body, 409 version older or same version with other content, 413 too large, 422 invalid snapshot / change_too_large / reason_required, 429 more than 30 signed requests a minute, 500 could not save, 503 the nudge pull failed.
// GET /api/prices is public: the snapshot in force, short cache, strong ETag.
import { Elysia } from "elysia";
import type { PriceCache } from "./cache";
import { sanitizeSources } from "./catalog";
import { IngestError, type Ingest } from "./ingest";
import { createSeenIds, type Nudger } from "./nudge";
import { serializeSnapshot, snapshotEtag } from "./snapshot";
import { createSeenSignatures, DANGEROUS_TOLERANCE_SECONDS, parseSignatureHeader, verifySignature } from "./signature";

export const MAX_BODY_BYTES = 256 * 1024;
export const HOOK_LIMIT_PER_MINUTE = 30;

/** The signature in either accepted form, as the "t=<unix>,v1=<hex>" text the verifier reads: X-Netquor-Signature as is, else X-Netquor-Signature-256 (bare hex) with X-Netquor-Timestamp (unix seconds). The HMAC is over "<timestamp>.<body>" in both. */
export const signatureHeader = (h: Headers): string | null => {
    const std = h.get("x-netquor-signature");
    if (std) return std;
    const hex = h.get("x-netquor-signature-256")?.trim().replace(/^sha256=/i, ""), ts = h.get("x-netquor-timestamp")?.trim();
    return hex && ts && /^\d{1,12}$/.test(ts) ? `t=${ts},v1=${hex}` : null;
};

export interface PriceRouteDeps {
    /** The secrets in force: current and, while rotating, next. Empty means every request is refused. */
    secrets: () => string[];
    /** Unix milliseconds. */
    now: () => number;
    ingest: Ingest;
    cache: PriceCache;
    nudge: Nudger;
    log?: (line: string) => void;
    /** Signed requests allowed per minute, all senders together. */
    limitPerMinute?: number;
    /** Gap between two refusal log lines (default 10 s); the lines in between are counted, not written. */
    refusalLogGapMs?: number;
}

/** The raw body, or null when it is over the cap. Stops reading as soon as the cap is passed. */
const readCapped = async (request: Request, cap: number): Promise<Uint8Array | null> => {
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > cap) return null;
    if (!request.body) return new Uint8Array();
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = request.body.getReader();
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > cap) { await reader.cancel().catch(() => {}); return null; }
        chunks.push(value);
    }
    return Buffer.concat(chunks);
};

const etagMatches = (header: string | null, etag: string): boolean =>
    !!header && header.split(",").some((t) => { const v = t.trim().replace(/^W\//, ""); return v === "*" || v === etag; });

const STATUS: Record<IngestError["code"], number> = { invalid: 422, change_too_large: 422, reason_required: 422, stale: 409, conflict: 409, persist_failed: 500 };

export const priceRoutes = (d: PriceRouteDeps) => {
    const out = d.log ?? (() => {});
    const log = out;
    // Refusals before or at authentication come from anyone on the internet, so they are logged at most once per gap with a count of the lines held back. Everything after authentication is logged as it happens.
    const gap = d.refusalLogGapMs ?? 10_000;
    let lastRefusalLog = -Infinity, suppressed = 0;
    const logRefusal = (line: string) => {
        const t = d.now();
        if (t - lastRefusalLog < gap) { suppressed++; return; }
        lastRefusalLog = t;
        out(suppressed ? `${line} (${suppressed} similar refusal${suppressed === 1 ? "" : "s"} not logged in the last ${Math.round(gap / 1000)} s)` : line);
        suppressed = 0;
    };
    const seenSignatures = createSeenSignatures({ now: d.now });
    const seenEvents = createSeenIds({ now: d.now });
    const limit = d.limitPerMinute ?? HOOK_LIMIT_PER_MINUTE;
    let hits: number[] = [];
    /** A sliding minute over every authenticated request, all senders together. Unsigned requests are not counted, so nobody without the secret can use up the allowance. */
    const allowed = (): boolean => {
        const now = d.now();
        hits = hits.filter((t) => t > now - 60_000);
        if (hits.length >= limit) return false;
        hits.push(now);
        return true;
    };

    return new Elysia()
        .post("/hooks/pricing", async ({ request, set }) => {
            const raw = await readCapped(request, MAX_BODY_BYTES);
            if (raw === null) { logRefusal("prices-hook: refused, body too large"); set.status = 413; return { ok: false, error: "payload_too_large" }; }
            if (!verifySignature({ header: signatureHeader(request.headers), body: raw, secrets: d.secrets(), nowSeconds: Math.floor(d.now() / 1000) })) {
                logRefusal("prices-hook: refused, bad or missing signature");
                set.status = 401;
                return "";
            }
            if (!allowed()) { logRefusal("prices-hook: refused, rate limit"); set.status = 429; set.headers["retry-after"] = "60"; return { ok: false, error: "rate_limited" }; }

            let body: Record<string, unknown> | null = null;
            try { const j = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)); if (typeof j === "object" && j !== null && !Array.isArray(j)) body = j as Record<string, unknown>; } catch { /* not JSON */ }
            const bad = (message: string) => { log(`prices-hook: ignored, ${message}`); set.status = 400; return { ok: false, error: "bad_request", message }; };
            if (!body) return bad("not a JSON object");

            // Replay limits. The signature is already verified, so the header parses.
            const sig = parseSignatureHeader(signatureHeader(request.headers))!;
            const nowSeconds = Math.floor(d.now() / 1000);
            const isHeartbeat = body.event === "poll.ok" && !("snapshot" in body);
            const dangerous = !isHeartbeat && (body.rebaseVersion === true || body.allowLargeChange === true || (body.rebaseVersion !== undefined && body.rebaseVersion !== false) || (body.allowLargeChange !== undefined && body.allowLargeChange !== false));
            if (isHeartbeat && nowSeconds - sig.t > DANGEROUS_TOLERANCE_SECONDS) { logRefusal("prices-hook: refused, heartbeat signed more than 60 s ago"); set.status = 401; return ""; }
            if (dangerous) {
                if (Math.abs(nowSeconds - sig.t) > DANGEROUS_TOLERANCE_SECONDS) { logRefusal("prices-hook: refused, rebaseVersion/allowLargeChange body signed more than 60 s away"); set.status = 401; return ""; }
                if (!seenSignatures.accept(sig.t, sig.v1)) { logRefusal("prices-hook: refused, rebaseVersion/allowLargeChange body already used"); set.status = 401; return ""; }
            }

            const reportSources = () => { const src = sanitizeSources(body.sources); if (Object.keys(src).length) d.cache.markCatalogSources(src); };
            if (isHeartbeat) { d.cache.markPollOk(); reportSources(); return { ok: true, version: d.cache.get().version }; }
            const isEvent = body.type === "price.changed" && !("snapshot" in body);
            if ((body.event === "prices.changed" || isEvent) && !("snapshot" in body)) {
                // The Netquor API's own event: { id, type: "price.changed", at, data }. A redelivery of the same id (24 h) is answered but not acted on.
                const id = isEvent && typeof body.id === "string" && body.id.length > 0 && body.id.length <= 128 ? body.id : null;
                if (id && !seenEvents.accept(id)) { log("prices-hook: price.changed already handled"); return { ok: true, duplicate: true }; }
                const r = await d.nudge();
                if (r.kind === "coalesced") return { ok: true, coalesced: true };
                if (r.outcome.kind === "failed") { if (id) seenEvents.forget(id); log(`prices-hook: nudge pull failed: ${r.outcome.reason}`); set.status = 503; return { ok: false, error: "pull_failed", message: r.outcome.reason }; }
                log(`prices-hook: nudge pull ${r.outcome.kind}`);
                return { ok: true, status: r.outcome.kind === "updated" ? "applied" : "unchanged", ...(r.outcome.kind === "updated" ? { version: r.outcome.version } : {}) };
            }
            if (!("snapshot" in body)) return bad("send { snapshot } or { event: \"prices.changed\" | \"poll.ok\" }");

            if (body.via !== undefined && body.via !== "poll" && body.via !== "operator") return bad("via must be \"poll\" or \"operator\"");
            for (const k of ["allowLargeChange", "rebaseVersion"]) if (body[k] !== undefined && typeof body[k] !== "boolean") return bad(`${k} must be true or false`);
            if (body.reason !== undefined && (typeof body.reason !== "string" || body.reason.length > 200)) return bad("reason must be text of at most 200 characters");

            try {
                const source = body.via === "poll" ? "poll" : body.via === "operator" ? "operator" : "webhook";
                const r = await d.ingest(body.snapshot, { source, allowLargeChange: body.allowLargeChange === true, rebaseVersion: body.rebaseVersion === true, reason: body.reason as string | undefined });
                if (source === "poll") { d.cache.markPollOk(); reportSources(); } // a poll that delivered is a poll that worked
                return { ok: true, status: r.status, version: r.version };
            } catch (e) {
                if (!(e instanceof IngestError)) throw e;
                log(`prices-hook: ${e.code}: ${e.message.slice(0, 200)}`);
                set.status = STATUS[e.code];
                return { ok: false, error: e.code, message: e.message, ...(e.code === "invalid" || e.code === "change_too_large" ? { details: e.details } : {}) };
            }
        }, { parse: "none" })
        .get("/api/prices", ({ request }) => {
            const s = d.cache.get();
            const etag = snapshotEtag(s);
            const headers = { etag, "cache-control": "public, max-age=60", "content-type": "application/json; charset=utf-8" };
            if (etagMatches(request.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });
            return new Response(serializeSnapshot(s), { status: 200, headers });
        });
};
