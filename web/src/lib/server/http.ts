// http.ts: caching headers and conditional requests shared by the legacy server and the pages.

// HTML is revalidated on every request, so a price change shows on the very next one; the ETag makes that a cheap 304.
export const HTML_CACHE_CONTROL = "no-cache";
export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";
export const ASSET_CACHE_CONTROL = "public, max-age=3600";

/** Headers the old static Caddy added to every response; they now come from here. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "SAMEORIGIN",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

/** Does If-None-Match match this ETag? Weak comparison, a list, or "*". */
export const etagMatches = (header: string | null, etag: string): boolean => {
    if (!header) return false;
    const strip = (t: string) => t.trim().replace(/^W\//, "");
    const mine = strip(etag);
    return header.split(",").some((t) => { const v = strip(t); return v === "*" || v === mine; });
};

/** A weak ETag for a page file: its mtime and the price cache's version() it was stamped with (the monotonic counter, never the snapshot's own number, which an operator rebase can reuse). */
export const pageEtag = (mtimeMs: number, priceVersion: number): string => `W/"${Math.floor(mtimeMs).toString(36)}-v${priceVersion}"`;
/** A weak ETag for an asset: its mtime and size. */
export const assetEtag = (mtimeMs: number, size: number): string => `W/"${Math.floor(mtimeMs).toString(36)}-${size.toString(36)}"`;

export const CONTENT_TYPES: Readonly<Record<string, string>> = {
    html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8",
    json: "application/json; charset=utf-8", webmanifest: "application/manifest+json",
    svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif",
    ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2",
};

export const contentTypeFor = (name: string): string => {
    const i = name.lastIndexOf(".");
    return CONTENT_TYPES[(i < 0 ? "" : name.slice(i + 1)).toLowerCase()] ?? "application/octet-stream";
};

/** A 304 or a 200 (or a body-less 200 for HEAD) for a body with this ETag. */
export const conditional = (request: Request, body: BodyInit | null, headers: Record<string, string>, etag: string): Response => {
    const h: Record<string, string> = { ...headers, etag };
    if (etagMatches(request.headers.get("if-none-match"), etag)) {
        const { "content-type": _ct, "content-length": _cl, ...rest } = h;
        return new Response(null, { status: 304, headers: rest });
    }
    return new Response(request.method === "HEAD" ? null : body, { status: 200, headers: h });
};
