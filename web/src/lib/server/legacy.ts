// legacy.ts: which URL paths may be served from the legacy folder (the hand-written pages and their assets). An EXPLICIT allowlist, so nothing else in the folder (server/, web/, tools/, deploy/, mockups/, .agents/, .git, templates, dotfiles) can ever be reached, whatever the path looks like once decoded.
import { realpathSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { ASSET_FILES } from "../assets";
import { legacyPageFiles } from "../pages";

/** "runtime": what the deployed web process serves from the legacy folder (images, the web manifest and the three calculator scripts the Svelte pages load; no HTML page, no stylesheet, no other script). "baseline": the whole hand-written site (pages, CSS, JS), used only by the local comparison tools (parity, visual) to serve the untouched repository root. */
export type LegacyScope = "runtime" | "baseline";

export type LegacyKind = "page" | "asset";
export interface LegacyMatch {
    /** Path relative to the legacy folder, "/" separated: "fleet.html", "brand/og.png". */
    rel: string;
    kind: LegacyKind;
}

/** Image extensions: what the runtime serves, at the top level and inside the allowed folders. */
export const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set(["svg", "png", "jpg", "jpeg", "gif", "webp", "avif", "ico"]);
/** Baseline only: the images plus the stylesheets, scripts and fonts of the hand-written site. */
export const ASSET_EXTENSIONS: ReadonlySet<string> = new Set([...IMAGE_EXTENSIONS, "css", "js", "woff", "woff2"]);
/** Baseline only: top-level data files served by exact name. */
export const EXPLICIT_FILES: ReadonlySet<string> = new Set(["readiness-data.json", "site.webmanifest"]);
/** Runtime: top-level files served by exact name. The web manifest, and the pure calculation scripts the Svelte pages load by URL (src/lib/assets.ts). readiness-data.json is read at build time only and is not served. */
export const RUNTIME_FILES: ReadonlySet<string> = new Set(["site.webmanifest", ...Object.values(ASSET_FILES)]);
/** Folders whose files (by asset extension) are served. */
export const ALLOWED_FOLDERS: ReadonlySet<string> = new Set(["brand", "fleet"]);

// A file name: letters, digits, _ . - with no leading dot. No %, no backslash, no spaces, so a double-encoded trick never matches.
const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

const extOf = (name: string): string => { const i = name.lastIndexOf("."); return i < 0 ? "" : name.slice(i + 1).toLowerCase(); };

/** Decides whether a request path may be served from the legacy folder. Pure: no file system. `pathname` is the URL path as received (percent-encoded); it is decoded exactly once. */
export const classifyLegacyPath = (pathname: string, pages: ReadonlySet<string> = legacyPageFiles(), scope: LegacyScope = "runtime"): LegacyMatch | null => {
    const baseline = scope === "baseline";
    if (pathname === "/") return !baseline ? null : pages.has("index.html") ? { rel: "index.html", kind: "page" } : null;
    let decoded: string;
    try { decoded = decodeURIComponent(pathname); } catch { return null; }
    if (!decoded.startsWith("/") || decoded.includes("..") || decoded.includes("\0") || decoded.includes("\\")) return null;
    const segments = decoded.slice(1).split("/");
    if (segments.length > 6 || !segments.every((s) => SEGMENT.test(s))) return null;
    const name = segments[segments.length - 1];
    if (name.toLowerCase().includes(".template.")) return null;
    const ext = extOf(name);
    if (segments.length === 1) {
        if (ext === "html") return baseline && pages.has(name) ? { rel: name, kind: "page" } : null;
        if (baseline ? EXPLICIT_FILES.has(name) || ASSET_EXTENSIONS.has(ext) : RUNTIME_FILES.has(name) || IMAGE_EXTENSIONS.has(ext)) return { rel: name, kind: "asset" };
        return null;
    }
    if (!ALLOWED_FOLDERS.has(segments[0]) || !(baseline ? ASSET_EXTENSIONS : IMAGE_EXTENSIONS).has(ext)) return null;
    return { rel: segments.join("/"), kind: "asset" };
};

export interface LegacyFile { path: string; mtimeMs: number; size: number }

/** Finds the file on disk for a match: it must exist, be a regular file, and (after resolving symbolic links) still lie inside the legacy folder. null otherwise. */
export const statLegacy = (legacyDir: string, match: LegacyMatch): LegacyFile | null => {
    try {
        const root = realpathSync(legacyDir);
        const real = realpathSync(join(root, ...match.rel.split("/")));
        if (!real.startsWith(root + sep)) return null;
        const st = statSync(real);
        if (!st.isFile()) return null;
        return { path: real, mtimeMs: st.mtimeMs, size: st.size };
    } catch { return null; }
};
