// server.ts: a small self-contained static server for the baseline directory (the legacy site). No dependency on the app code in web/src. "/" is index.html; content types come from the file extension. Only the legacy site's public files are served: top-level files and the fleet/ and brand/ folders; server/, web/, tools/, deploy/, dotfiles and anything outside the directory never are.
import { readFileSync as readText } from "node:fs";
import { join as joinPath } from "node:path";
import { applyIntentionalChanges } from "./intentional";

/** The rules added after the baseline (src/lib/styles/after-baseline.css) are part of the baseline site the tools compare with, appended to nq.css. */
const AFTER_BASELINE = () => readText(joinPath(import.meta.dir, "../../src/lib/styles/after-baseline.css"), "utf8");
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { baselineDirSync } from "./dir";

/** The folders (besides the top level) the legacy site publishes. */
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

export interface ServeBaselineOptions {
    /** The folder to serve. Default: the baseline directory extracted from the tag. */
    dir?: string;
    /** Default 0: a free loopback port. */
    port?: number;
    /** Rewrites each HTML page before it is sent (the comparison tools stamp the seed prices here). Default: pages are sent as written. */
    transformHtml?: (html: string, rel: string) => string;
}

export interface BaselineServer { base: string; dir: string; stop(): void }

export const serveBaseline = (o: ServeBaselineOptions = {}): BaselineServer => {
    const dir = o.dir ?? baselineDirSync();
    const server = Bun.serve({
        port: o.port ?? 0,
        hostname: "127.0.0.1",
        fetch: (req) => {
            if (req.method !== "GET" && req.method !== "HEAD") return new Response("method not allowed", { status: 405 });
            const file = resolveLegacyFile(dir, new URL(req.url).pathname);
            if (!file) return new Response("not found", { status: 404 });
            if (file.endsWith(".html")) {
                const rel = file.slice(resolve(dir).length + 1).split(sep).join("/");
                // the baseline served to the comparison tools always includes the recorded content decisions since the tag (see intentional.ts)
                const base = applyIntentionalChanges(readFileSync(file, "utf8"));
                return new Response(o.transformHtml ? o.transformHtml(base, rel) : base, { headers: { "content-type": "text/html;charset=utf-8" } });
            }
            if (file.endsWith(`${sep}nq.css`) && resolve(file) === resolve(dir, "nq.css")) return new Response(`${readText(file, "utf8")}\n${AFTER_BASELINE()}`, { headers: { "content-type": "text/css;charset=utf-8" } });
            return new Response(Bun.file(file));
        },
    });
    return { base: `http://127.0.0.1:${server.port}`, dir, stop: () => server.stop(true) };
};
