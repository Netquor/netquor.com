// lib/cors.ts: only the site's own origins may call the API from a browser. No credentials are ever allowed: the service sets no cookies and reads none.
export const originAllowed = (origin: string | null, allowed: readonly string[]): boolean => origin !== null && allowed.includes(origin);

/** Headers for a response to a request from `origin` ({} when that origin is not allowed or there is none). */
export function corsHeaders(origin: string | null, allowed: readonly string[]): Record<string, string> {
    if (!originAllowed(origin, allowed)) return {};
    return { "access-control-allow-origin": origin as string, vary: "Origin" };
}

export function preflightHeaders(origin: string | null, allowed: readonly string[], methods: string): Record<string, string> {
    if (!originAllowed(origin, allowed)) return {};
    return { ...corsHeaders(origin, allowed), "access-control-allow-methods": methods, "access-control-allow-headers": "content-type", "access-control-max-age": "600" };
}
