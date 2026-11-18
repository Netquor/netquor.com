// app.ts: the Elysia app (mounted inside the SvelteKit web process through app.handle(request); it never needs a socket), with its pieces passed in so tests can build it without files, a network or a real clock. Extra route plugins (such as the prices routes) are mounted as given.
import { Elysia } from "elysia";
import { healthRoutes, type HealthDeps } from "./health/routes";
import type { Config } from "./lib/config";
import type { RateLimiter } from "./lib/rateLimit";
import { leadRoutes, type LeadRouteDeps } from "./lead/routes";
import type { LeadSink } from "./lead/types";

// Any Elysia instance, whatever routes it carries.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Plugin = Elysia<any, any, any, any, any, any, any>;

export interface AppDeps {
    config: Pick<Config, "allowedOrigins" | "maxBodyBytes" | "deliveryDeadlineMs">;
    leadSink: LeadSink;
    /** Milliseconds since the epoch. */
    clock: () => number;
    rateLimiter: RateLimiter;
    /** Extra route plugins (the prices routes), mounted after the built-in routes. */
    plugins?: Plugin[];
    log?: (message: string) => void;
    /** Believe the x-nq-client-ip header as the client address. Only the web hooks entry sets this (it overwrites the header first); everything else leaves it off and the socket address, or "unknown" when there is none, is used. */
    trustPeerIpHeader?: boolean;
    /** What GET /health/detail may report. */
    health?: HealthDeps;
}

export const createApp = (d: AppDeps) => {
    const log = d.log ?? console.error;
    let app: Plugin = new Elysia()
        // Everything this service answers is no-store, except routes that set their own header (GET /api/prices is public, max-age=60).
        .onAfterHandle({ as: "global" }, ({ set }) => { set.headers["cache-control"] = "no-store"; set.headers["x-content-type-options"] = "nosniff"; })
        // No stack trace, no message, no input in an error: a stable code and a log line.
        .onError({ as: "global" }, ({ code, set, error }) => {
            set.headers["cache-control"] = "no-store";
            if (code === "NOT_FOUND") { set.status = 404; return { ok: false, error: "not_found" }; }
            if (code === "PARSE" || code === "VALIDATION" || code === "INVALID_COOKIE_SIGNATURE") { set.status = 400; return { ok: false, error: "bad_request" }; }
            log(`unhandled error (${String(code)}): ${error instanceof Error ? error.name : "unknown"}`);
            set.status = 500;
            return { ok: false, error: "internal_error" };
        })
        .use(healthRoutes({ clock: d.clock, ...d.health }))
        .use(leadRoutes({ config: d.config, sink: d.leadSink, rateLimiter: d.rateLimiter, clock: d.clock, log, trustPeerIpHeader: d.trustPeerIpHeader === true }));
    for (const p of d.plugins ?? []) app = app.use(p);
    return app;
};
