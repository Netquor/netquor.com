import type { RequestHandler } from "./$types";
import { buildSitemap, routePathsFromGlob } from "#lib/server/files.ts";
import { conditional } from "#lib/server/http.ts";
import { getRuntime } from "#lib/server/runtime.ts";
import { createHash } from "node:crypto";

// Which pages are SvelteKit routes: found at build time, so the sitemap needs no list of its own.
const migrated = routePathsFromGlob(Object.keys(import.meta.glob("/src/routes/**/+page.svelte")));
declare const __BUILD_DATE__: string;

export const GET: RequestHandler = async ({ request }) => {
    const rt = await getRuntime();
    const xml = buildSitemap({ origin: rt.env.siteOrigin, migratedPaths: migrated, buildDate: __BUILD_DATE__ });
    const etag = `W/"${createHash("sha1").update(xml).digest("base64url").slice(0, 22)}"`;
    return conditional(request, xml, { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" }, etag);
};
