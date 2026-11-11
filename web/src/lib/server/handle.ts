// handle.ts: the request pipeline behind hooks.server.ts, written against plain objects so it can be tested without SvelteKit.
//   1. /api/*, /hooks/*, /health*  -> the Elysia app (client address passed in x-nq-client-ip, overwriting anything the visitor sent)
//   2. a path no SvelteKit route matches but the legacy allowlist serves -> the legacy page or asset (stamped per request)
//   3. everything else -> SvelteKit (migrated pages, sitemap.xml, robots.txt, llms.txt, 404)
import { createHash } from "node:crypto";
import { CLIENT_IP_HEADER } from "#server/lib/clientIp";
import type { Snapshot } from "#server/prices/types";
import { conditional, HTML_CACHE_CONTROL, SECURITY_HEADERS } from "./http";
import type { LegacyServer } from "./legacyServer";

export interface HandleEvent {
    request: Request;
    url: URL;
    /** SvelteKit's matched route id, or null when no route matches. */
    route: { id: string | null };
    getClientAddress(): string;
    locals: { prices?: Snapshot };
}

export interface HandleRuntime {
    prices: { get(): Snapshot };
    legacy: Pick<LegacyServer, "serve">;
    /** The Elysia app's handle. */
    api: (request: Request) => Promise<Response>;
    /** Production caching for pages (off under `vite dev`, where an hour-old page would be a nuisance). */
    cachePages: boolean;
}

export const isApiPath = (pathname: string): boolean =>
    pathname === "/api" || pathname.startsWith("/api/") || pathname === "/hooks" || pathname.startsWith("/hooks/") || pathname === "/health" || pathname.startsWith("/health/");

/** A copy of the request whose x-nq-client-ip is the address the web server resolved (the edge's trusted client address when ADDRESS_HEADER is set). Whatever the visitor sent under that name is dropped. */
export const withClientIp = (request: Request, address: string | null): Request => {
    const headers = new Headers(request.headers);
    headers.delete(CLIENT_IP_HEADER);
    if (address) headers.set(CLIENT_IP_HEADER, address);
    const hasBody = request.method !== "GET" && request.method !== "HEAD" && request.body !== null;
    return new Request(request.url, { method: request.method, headers, body: hasBody ? request.body : null, ...(hasBody ? { duplex: "half" } : {}) } as RequestInit);
};

const safeAddress = (event: HandleEvent): string | null => { try { return event.getClientAddress(); } catch { return null; } };

/** Adds the security headers the old static server added, where the response has not set its own. */
export const withSecurityHeaders = (res: Response): Response => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!res.headers.has(k)) res.headers.set(k, v);
    return res;
};

const isHtml = (res: Response) => (res.headers.get("content-type") ?? "").toLowerCase().startsWith("text/html");

/** A server-rendered page: weak ETag from the rendered bytes, 304 when the visitor has them, the page cache header. */
const cachePage = async (request: Request, res: Response): Promise<Response> => {
    const body = await res.text();
    const etag = `W/"${createHash("sha1").update(body).digest("base64url").slice(0, 22)}"`;
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });
    delete headers["content-length"];
    headers["cache-control"] = HTML_CACHE_CONTROL;
    return conditional(request, body, headers, etag);
};

export const handleRequest = async (rt: HandleRuntime, event: HandleEvent, resolve: (event: HandleEvent) => Promise<Response>): Promise<Response> => {
    const { pathname } = event.url;
    // Operational detail is for the host only (bun run deploy --status). Anything that came through the edge carries X-Real-IP, so refuse every spelling of the path for it.
    if (event.request.headers.has("x-real-ip") && /^\/health\/+(?:\.\/)*detail/i.test(decodeURIComponent(pathname).replace(/\/\.\//g, "/"))) return withSecurityHeaders(new Response("Not found", { status: 404 }));
    if (isApiPath(pathname)) return withSecurityHeaders(await rt.api(withClientIp(event.request, safeAddress(event))));

    event.locals.prices = rt.prices.get();
    if (event.route.id === null) {
        const legacy = rt.legacy.serve(event.request, event.url);
        if (legacy) return withSecurityHeaders(legacy);
    }
    const res = await resolve(event);
    const get = event.request.method === "GET" || event.request.method === "HEAD";
    if (rt.cachePages && get && event.route.id !== null && res.status === 200 && isHtml(res)) return withSecurityHeaders(await cachePage(event.request, res));
    return withSecurityHeaders(res);
};
