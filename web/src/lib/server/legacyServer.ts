// legacyServer.ts: serves the hand-written pages (and their assets) from the legacy folder. Pages that carry data-price markers are stamped with the current snapshot per request, memoized per (file, mtime, cache version), so a price change shows on the very next request and nothing is written to disk. The "version" in every memo key and ETag is prices.version(), the cache's monotonic counter, never the snapshot's own number (an operator rebase can reuse or lower that). Conditional requests answer 304 from the file's mtime and that version alone, without reading or stamping.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { stampHtml, hasPriceMarkers } from "#server/prices/stamp";
import { legacyPageFiles } from "../pages";
import { assetEtag, ASSET_CACHE_CONTROL, conditional, contentTypeFor, HTML_CACHE_CONTROL, IMMUTABLE_CACHE_CONTROL, pageEtag } from "./http";
import { classifyLegacyPath, statLegacy } from "./legacy";
import type { PriceSource } from "./types";

export interface LegacyServerOptions {
    legacyDir: string;
    prices: PriceSource;
    /** Page files the server may serve; default from the registry. */
    pages?: ReadonlySet<string>;
    log?: (line: string) => void;
}

/** The ?v= value tools/build-nav.py writes into the pages: the first 8 hex characters of the file's md5. */
export const assetFingerprint = (bytes: Uint8Array): string => createHash("md5").update(bytes).digest("hex").slice(0, 8);

interface Memo { mtimeMs: number; version: number; body: string }

const redirectTo = (status: number, location: string): Response => new Response(null, { status, headers: { location } });

/** One URL per page: /index.html is a 301 to /, and a trailing slash on a legacy page (/fleet.html/) is a 308 to the .html URL. The query string is kept. Only for pages that exist. */
const canonicalRedirect = (url: URL, pages: ReadonlySet<string>, legacyDir: string): Response | null => {
    const trimmed = url.pathname.replace(/\/+$/, "");
    const slashed = trimmed !== url.pathname && trimmed !== "";
    if (trimmed !== "/index.html" && !slashed) return null;
    const match = classifyLegacyPath(trimmed, pages);
    if (!match || match.kind !== "page" || !statLegacy(legacyDir, match)) return null;
    if (trimmed === "/index.html") return redirectTo(301, `/${url.search}`);
    return redirectTo(308, `${trimmed}${url.search}`);
};

export const createLegacyServer = (o: LegacyServerOptions) => {
    const pages = o.pages ?? legacyPageFiles();
    const log = o.log ?? ((l: string) => console.error(l));
    const memo = new Map<string, Memo>();
    const warned = new Set<string>();
    const stats = { stamps: 0 };
    const fingerprints = new Map<string, { mtimeMs: number; size: number; v: string }>();
    const fingerprintOf = (rel: string, path: string, mtimeMs: number, size: number): string => {
        const hit = fingerprints.get(rel);
        if (hit && hit.mtimeMs === mtimeMs && hit.size === size) return hit.v;
        const v = assetFingerprint(readFileSync(path));
        fingerprints.set(rel, { mtimeMs, size, v });
        return v;
    };

    const renderPage = (rel: string, path: string, mtimeMs: number): string => {
        // Both reads are synchronous, so the pair is consistent.
        const version = o.prices.version();
        const snapshot = o.prices.get();
        const hit = memo.get(rel);
        if (hit && hit.mtimeMs === mtimeMs && hit.version === version) return hit.body;
        const raw = readFileSync(path, "utf8");
        let body = raw;
        if (hasPriceMarkers(raw)) {
            try { body = stampHtml(raw, snapshot, rel); stats.stamps++; } catch (e) {
                // A key the snapshot lacks: serve the page as written (its own text is a valid price) and say so once per version.
                const k = `${rel}@${version}`;
                if (!warned.has(k)) { warned.add(k); log(`legacy: ${rel} not stamped at price version ${version}: ${e instanceof Error ? e.message.split("\n")[0] : "error"}`); }
            }
        }
        memo.set(rel, { mtimeMs, version, body });
        return body;
    };

    return {
        stats,
        /** The response for a GET or HEAD of this path, or null when the path is not a legacy file. */
        serve(request: Request, url: URL): Response | null {
            if (request.method !== "GET" && request.method !== "HEAD") return null;
            const redirect = canonicalRedirect(url, pages, o.legacyDir);
            if (redirect) return redirect;
            const match = classifyLegacyPath(url.pathname, pages);
            if (!match) return null;
            const file = statLegacy(o.legacyDir, match);
            if (!file) return null;
            const type = contentTypeFor(match.rel);
            if (match.kind === "page") {
                const version = o.prices.version();
                const etag = pageEtag(file.mtimeMs, version);
                const headers = { "content-type": type, "cache-control": HTML_CACHE_CONTROL };
                // Answer a revalidation before doing any work.
                const quick = conditional(request, null, headers, etag);
                if (quick.status === 304) return quick;
                // The snapshot may have moved between reading the version and rendering; the ETag must name what was rendered.
                const body = renderPage(match.rel, file.path, file.mtimeMs);
                const rendered = memo.get(match.rel);
                return conditional(request, body, headers, pageEtag(file.mtimeMs, rendered ? rendered.version : version));
            }
            // Immutable only when ?v= is this file's own fingerprint; any other value (stale, made up) gets the short cache.
            const v = url.searchParams.get("v");
            const immutable = v !== null && v === fingerprintOf(match.rel, file.path, file.mtimeMs, file.size);
            const headers = { "content-type": type, "cache-control": immutable ? IMMUTABLE_CACHE_CONTROL : ASSET_CACHE_CONTROL };
            const etag = assetEtag(file.mtimeMs, file.size);
            const quick = conditional(request, null, headers, etag);
            if (quick.status === 304) return quick;
            return conditional(request, readFileSync(file.path), headers, etag);
        },
    };
};

export type LegacyServer = ReturnType<typeof createLegacyServer>;
