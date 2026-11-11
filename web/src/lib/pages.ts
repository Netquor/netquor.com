// pages.ts: the page registry. One entry per public page: its URL path, sitemap priority and change frequency. The sitemap lists exactly these (merged with which of them are SvelteKit routes), and the legacy server serves exactly the files named here. A page that is not listed is neither in the sitemap nor served as a legacy page.
export type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export interface PageEntry {
    /** URL path as visitors use it: "/" or "/fleet.html". */
    path: string;
    priority: number;
    changefreq: ChangeFreq;
    /** Explicit last modification date, "YYYY-MM-DD". Without it the sitemap omits lastmod for a legacy page (file times in the image are the build time, not an edit time). */
    lastmod?: string;
}

export const PAGES: readonly PageEntry[] = [
    { path: "/", priority: 1.0, changefreq: "weekly" },
    { path: "/fleet.html", priority: 0.9, changefreq: "weekly" },
    { path: "/sdn.html", priority: 0.9, changefreq: "monthly" },
    { path: "/network.html", priority: 0.9, changefreq: "weekly" },
    { path: "/vpn.html", priority: 0.9, changefreq: "weekly" },
    { path: "/homeassistant.html", priority: 0.9, changefreq: "weekly" },
    { path: "/digitalaccess.html", priority: 0.9, changefreq: "weekly" },
    { path: "/central.html", priority: 0.7, changefreq: "monthly" },
    { path: "/subnet-calculator.html", priority: 0.8, changefreq: "monthly" },
    { path: "/readiness.html", priority: 0.7, changefreq: "monthly" },
    { path: "/fargo-moorhead.html", priority: 0.8, changefreq: "monthly" },
    { path: "/startups.html", priority: 0.7, changefreq: "monthly" },
    { path: "/referrals.html", priority: 0.6, changefreq: "monthly" },
    { path: "/story.html", priority: 0.5, changefreq: "monthly" },
    { path: "/compare.html", priority: 0.8, changefreq: "monthly" },
    { path: "/partners.html", priority: 0.6, changefreq: "monthly" },
    { path: "/terms.html", priority: 0.2, changefreq: "yearly" },
    { path: "/privacy.html", priority: 0.2, changefreq: "yearly" },
];

/** The legacy file for a page path: "/" is index.html, "/x.html" is x.html. */
export const fileForPath = (path: string): string => (path === "/" ? "index.html" : path.slice(1));

/** Names (top-level, relative to the legacy folder) of the pages the legacy server may serve. */
export const legacyPageFiles = (pages: readonly PageEntry[] = PAGES): Set<string> => new Set(pages.map((p) => fileForPath(p.path)));
