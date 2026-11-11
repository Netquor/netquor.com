// files.ts: the generated text files: /sitemap.xml, /robots.txt, /llms.txt. Pure builders; the +server routes pass in what they know.
import { renderLlms } from "#server/prices/stamp";
import { PAGES, type PageEntry } from "../pages";
import type { Snapshot } from "./types";

const xmlEscape = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** https://www.netquor.com without a trailing slash; anything that is not an http(s) origin falls back to the default. */
export const normalizeOrigin = (value: string | undefined, fallback: string): string => {
    try {
        const u = new URL((value ?? "").trim());
        if (u.protocol !== "https:" && u.protocol !== "http:") return fallback;
        return u.origin;
    } catch { return fallback; }
};

export interface SitemapInput {
    origin: string;
    /** Page paths that are SvelteKit routes (they take precedence over any static file). */
    migratedPaths: ReadonlySet<string>;
    /** Not used for lastmod any more; kept so callers need no change. */
    buildDate: string;
    pages?: readonly PageEntry[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The sitemap lists exactly the registry. lastmod: only the registry's explicit lastmod, otherwise none (a build date or file time is the deploy time, not an edit time, so it would be a lie once every page is a route). Nothing outside the registry appears. */
export const buildSitemap = (i: SitemapInput): string => {
    const rows = (i.pages ?? PAGES).map((p) => {
        const lastmod = p.lastmod && DATE.test(p.lastmod) ? p.lastmod : null;
        const loc = `${i.origin}${p.path}`;
        return `  <url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>${p.changefreq}</changefreq><priority>${p.priority.toFixed(1)}</priority></url>`;
    });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
};

export const buildRobots = (origin: string): string => `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;

/** llms.txt from the template, with prices from the snapshot. */
export const buildLlms = (template: string, snapshot: Snapshot): string => renderLlms(template, snapshot);

/** Route directories such as "subnet-calculator.html" or "(site)/x.html" turned into URL paths. Route groups "(name)" are not part of the URL and are dropped; a route with a parameter or rest segment ("[slug]") does not count. */
export const routePathsFromGlob = (keys: string[]): Set<string> => {
    const out = new Set<string>();
    for (const k of keys) {
        const m = /\/routes\/(.*)\/?\+page\.svelte$/.exec(k);
        if (!m) continue;
        const dir = m[1].replace(/\/$/, "").split("/").filter((seg) => !/^\([^()/]+\)$/.test(seg)).join("/");
        if (/[[\]()]/.test(dir)) continue;
        out.add(dir === "" ? "/" : `/${dir}`);
    }
    return out;
};
