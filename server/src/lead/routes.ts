// lead/routes.ts: POST /api/lead: the form on the site's pages. JSON or a form post in; 202 when a sink has the lead.
// Order matters: origin, rate limit, type, size, parse, honeypot, validate, deliver. Nothing a visitor sent is ever echoed back.
import { Elysia } from "elysia";
import { readBodyCapped } from "../lib/body";
import { clientIp, rateKey, UNKNOWN_IP } from "../lib/clientIp";
import type { Config } from "../lib/config";
import { corsHeaders, originAllowed, preflightHeaders } from "../lib/cors";
import { DeadlineError, withDeadline } from "../lib/deadline";
import type { RateLimiter } from "../lib/rateLimit";
import type { LeadSink } from "./types";
import { honeypotFilled, parseForm, validateLead } from "./validate";

export interface LeadRouteDeps {
    config: Pick<Config, "allowedOrigins" | "maxBodyBytes" | "deliveryDeadlineMs">;
    sink: LeadSink;
    rateLimiter: RateLimiter;
    /** Milliseconds since the epoch. */
    clock: () => number;
    log?: (message: string) => void;
    /** Believe x-nq-client-ip (see lib/clientIp.ts). Default false. */
    trustPeerIpHeader?: boolean;
}

export const leadRoutes = (d: LeadRouteDeps) => {
    const log = d.log ?? console.error;
    const reply = (origin: string | null, status: number, body: unknown, extra: Record<string, string> = {}) =>
        new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...corsHeaders(origin, d.config.allowedOrigins), ...extra } });
    const fail = (origin: string | null, status: number, error: string, extra?: Record<string, string>) => reply(origin, status, { ok: false, error }, extra);

    return new Elysia()
        .options("/api/lead", ({ request }) => {
            const origin = request.headers.get("origin");
            if (!originAllowed(origin, d.config.allowedOrigins)) return new Response(null, { status: 403, headers: { "cache-control": "no-store" } });
            return new Response(null, { status: 204, headers: { "cache-control": "no-store", ...preflightHeaders(origin, d.config.allowedOrigins, "POST, OPTIONS") } });
        })
        .post("/api/lead", async ({ request, server }) => {
            const origin = request.headers.get("origin");
            // A browser always names the page's origin on a cross-site post, so a named origin that is not ours is refused. A request with no Origin header is NOT trusted as a browser: it is let through to the rate limit and validation like any other caller (curl, a server), so this check stops cross-site browser posts only and is not authentication.
            if (origin !== null && !originAllowed(origin, d.config.allowedOrigins)) return fail(null, 403, "origin_not_allowed");

            const ip = clientIp(request, server, d.trustPeerIpHeader === true);
            const limit = d.rateLimiter.hit(rateKey(ip));
            if (!limit.allowed) return fail(origin, 429, "rate_limited", { "retry-after": String(limit.retryAfterSeconds) });

            const type = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
            if (type !== "application/json" && type !== "application/x-www-form-urlencoded") return fail(origin, 415, "unsupported_media_type");

            const body = await readBodyCapped(request, d.config.maxBodyBytes);
            if (!body.ok) return fail(origin, 413, "payload_too_large");

            let text: string;
            try { text = new TextDecoder("utf-8", { fatal: true }).decode(body.bytes); } catch { return fail(origin, 400, "invalid_body"); }
            let fields: Record<string, unknown>;
            if (type === "application/json") {
                let parsed: unknown;
                try { parsed = JSON.parse(text); } catch { return fail(origin, 400, "invalid_json"); }
                if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return fail(origin, 400, "invalid_body");
                fields = parsed as Record<string, unknown>;
            } else {
                fields = parseForm(text);
            }

            // A bot filled the hidden field: look like a success and keep nothing.
            if (honeypotFilled(fields.website)) return reply(origin, 200, { ok: true });

            const checked = validateLead(fields);
            if (!checked.ok) return fail(origin, 422, checked.error);

            const lead = { id: `ld_${crypto.randomUUID()}`, receivedAt: new Date(d.clock()).toISOString(), ...checked.value };
            try {
                await withDeadline(d.sink.deliver(lead, { clientIp: ip === UNKNOWN_IP ? undefined : ip }), d.config.deliveryDeadlineMs);
            } catch (e) {
                log(`lead ${lead.id} was not delivered: ${e instanceof DeadlineError ? "sink too slow" : "sink failed"}`);
                return fail(origin, 503, e instanceof DeadlineError ? "delivery_timeout" : "delivery_failed", { "retry-after": "30" });
            }
            return reply(origin, 202, { ok: true, id: lead.id });
        }, { parse: "none" });
};
