// servers.ts: the two servers a scenario compares. The legacy site is the untouched repository root behind a tiny static server (no price stamping: legacy pages show the prices written in them). The Svelte site is the built server started exactly as scripts/parity/run.ts does (seed prices, temp data folder, throwaway secret).
import { existsSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { REPO, startServer, type Served } from "../parity/run";

/** The top-level folders and files the legacy site publishes. Everything else (server/, web/, tools/, .git, .env, deploy/, mockups/) is never served. */
const PUBLIC_DIRS = new Set(["fleet", "brand"]);

/** URL path to a file path under root, or null when it must not be served (pure apart from the stat; tested with a temp tree). */
export const resolveLegacyFile = (root: string, urlPath: string): string | null => {
    let p: string;
    try { p = decodeURIComponent(urlPath.split("?")[0].split("#")[0]); } catch { return null; }
    if (p.includes("\0") || p.includes("..") || p.includes("\\")) return null;
    if (p.endsWith("/")) p += "index.html";
    const parts = p.split("/").filter(Boolean);
    if (parts.length === 0) parts.push("index.html");
    if (parts.some((s) => s.startsWith("."))) return null;
    if (parts.length > 1 && !PUBLIC_DIRS.has(parts[0])) return null;
    const file = resolve(root, ...parts);
    if (!file.startsWith(resolve(root) + sep)) return null;
    return existsSync(file) && statSync(file).isFile() ? file : null;
};

export interface Static { base: string; stop(): void }

export const startLegacyStatic = (root: string = REPO): Static => {
    const server = Bun.serve({
        port: 0,
        hostname: "127.0.0.1",
        fetch: (req) => {
            const file = resolveLegacyFile(root, new URL(req.url).pathname);
            if (!file) return new Response("not found", { status: 404 });
            return new Response(Bun.file(file));
        },
    });
    return { base: `http://127.0.0.1:${server.port}`, stop: () => server.stop(true) };
};

export interface Servers { legacy: string; svelte: string; stop(): void }

/** Starts both servers. The Svelte one builds first unless build is false. */
export const startServers = async (o: { build: boolean; log?: (s: string) => void }): Promise<Servers> => {
    const legacy = startLegacyStatic();
    let svelte: Served;
    try { svelte = await startServer(o); } catch (e) { legacy.stop(); throw e; }
    return { legacy: legacy.base, svelte: svelte.base, stop: () => { legacy.stop(); svelte.stop(); } };
};

