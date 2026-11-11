import type { Handle } from "@sveltejs/kit/hooks";
import { handleRequest, type HandleEvent } from "#lib/server/handle.ts";
import { fleetShell, isFleetRoute } from "#lib/server/fleetShell.ts";
import { getRuntime } from "#lib/server/runtime.ts";

// Everything goes through handleRequest (src/lib/server/handle.ts): the Elysia API, the legacy pages, then SvelteKit. Pages of the (fleet) group get their own <html> and viewport (src/lib/server/fleetShell.ts).
export const handle: Handle = async ({ event, resolve }) => {
    const rt = await getRuntime();
    return handleRequest(rt, event as unknown as HandleEvent, () => resolve(event, isFleetRoute(event.route.id) ? { transformPageChunk: ({ html }) => fleetShell(html) } : undefined));
};
