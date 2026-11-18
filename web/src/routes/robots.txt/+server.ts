import type { RequestHandler } from "./$types";
import { buildRobots } from "#lib/server/files.ts";
import { conditional } from "#lib/server/http.ts";
import { getRuntime } from "#lib/server/runtime.ts";

export const GET: RequestHandler = async ({ request }) => {
    const rt = await getRuntime();
    const text = buildRobots(rt.env.siteOrigin);
    return conditional(request, text, { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" }, `W/"robots-${rt.env.siteOrigin.length}"`);
};
