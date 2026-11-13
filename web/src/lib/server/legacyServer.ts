// legacyServer.ts: serves the runtime's static files from the static folder (the repository root in development, /app/legacy in the image): images, the web manifest and the three calculator scripts, per the allowlist in legacy.ts. No HTML is served from disk and nothing is stamped; the pages are Svelte routes. Conditional requests answer 304 from the file's mtime and size alone. The old URL shapes of the pages keep their canonical redirects (/index.html to /, a trailing slash to the .html URL), decided by the page registry alone.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { legacyPageFiles } from "../pages";
import { assetEtag, ASSET_CACHE_CONTROL, conditional, contentTypeFor, IMMUTABLE_CACHE_CONTROL } from "./http";
import { classifyLegacyPath, statLegacy } from "./legacy";

export interface LegacyServerOptions {
    /** The static folder. */
    legacyDir: string;
    /** Page files whose old URL shapes redirect; default from the registry. */
    pages?: ReadonlySet<string>;
}

/** The ?v= value for a static file: the first 8 hex characters of the file's md5. */
export const assetFingerprint = (bytes: Uint8Array): string => createHash("md5").update(bytes).digest("hex").slice(0, 8);

const redirectTo = (status: number, location: string): Response => new Response(null, { status, headers: { location } });

/** One URL per page: /index.html is a 301 to /, and a trailing slash on a page (/fleet.html/) is a 308 to the .html URL. The query string is kept. Only for registered pages; the registry alone decides, since no HTML is read from disk. */
const canonicalRedirect = (url: URL, pages: ReadonlySet<string>): Response | null => {
    const trimmed = url.pathname.replace(/\/+$/, "");
    const slashed = trimmed !== url.pathname && trimmed !== "";
    if (trimmed !== "/index.html" && !slashed) return null;
    if (!/^\/[A-Za-z0-9_][A-Za-z0-9_.-]*\.html$/.test(trimmed) || !pages.has(trimmed.slice(1))) return null;
    if (trimmed === "/index.html") return redirectTo(301, `/${url.search}`);
    return redirectTo(308, `${trimmed}${url.search}`);
};

export const createLegacyServer = (o: LegacyServerOptions) => {
    const pages = o.pages ?? legacyPageFiles();
    const fingerprints = new Map<string, { mtimeMs: number; size: number; v: string }>();
    const fingerprintOf = (rel: string, path: string, mtimeMs: number, size: number): string => {
        const hit = fingerprints.get(rel);
        if (hit && hit.mtimeMs === mtimeMs && hit.size === size) return hit.v;
        const v = assetFingerprint(readFileSync(path));
        fingerprints.set(rel, { mtimeMs, size, v });
        return v;
    };

    return {
        /** The response for a GET or HEAD of this path, or null when the path is not a served static file. */
        serve(request: Request, url: URL): Response | null {
            if (request.method !== "GET" && request.method !== "HEAD") return null;
            const redirect = canonicalRedirect(url, pages);
            if (redirect) return redirect;
            const match = classifyLegacyPath(url.pathname);
            if (!match) return null;
            const file = statLegacy(o.legacyDir, match);
            if (!file) return null;
            // Immutable only when ?v= is this file's own fingerprint; any other value (stale, made up) gets the short cache.
            const v = url.searchParams.get("v");
            const immutable = v !== null && v === fingerprintOf(match.rel, file.path, file.mtimeMs, file.size);
            const headers = { "content-type": contentTypeFor(match.rel), "cache-control": immutable ? IMMUTABLE_CACHE_CONTROL : ASSET_CACHE_CONTROL };
            const etag = assetEtag(file.mtimeMs, file.size);
            const quick = conditional(request, null, headers, etag);
            if (quick.status === 304) return quick;
            return conditional(request, readFileSync(file.path), headers, etag);
        },
    };
};

export type LegacyServer = ReturnType<typeof createLegacyServer>;
