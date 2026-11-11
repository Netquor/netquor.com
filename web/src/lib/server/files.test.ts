import { describe, expect, test } from "bun:test";
import { buildLlms, buildRobots, buildSitemap, normalizeOrigin, routePathsFromGlob } from "./files";
import { PAGES } from "../pages";
import { snap } from "./testkit";

const base = { origin: "https://www.netquor.com", migratedPaths: new Set<string>(), buildDate: "2026-11-10" };

describe("sitemap", () => {
    test("lists exactly the registry, on the canonical host", () => {
        const xml = buildSitemap(base);
        const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
        expect(locs).toEqual(PAGES.map((p) => `https://www.netquor.com${p.path}`));
        expect(locs.every((l) => l.startsWith("https://www.netquor.com/"))).toBe(true);
        expect(xml).not.toMatch(/<loc>http:/);
        expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    });
    test("no page has a lastmod unless the registry gives one, migrated or not", () => {
        const xml = buildSitemap({ ...base, migratedPaths: new Set(["/subnet-calculator.html"]) });
        expect(xml).toContain("<loc>https://www.netquor.com/fleet.html</loc><changefreq>");
        expect(xml).toContain("<loc>https://www.netquor.com/subnet-calculator.html</loc><changefreq>");
        expect(xml).not.toContain("<lastmod>");
        expect(PAGES.some((p) => p.lastmod)).toBe(false);
    });
    test("a registry entry with an explicit lastmod date carries it; a malformed one is ignored", () => {
        const pages = [
            { path: "/a.html", priority: 0.5, changefreq: "weekly" as const, lastmod: "2026-09-01" },
            { path: "/b.html", priority: 0.5, changefreq: "weekly" as const, lastmod: "yesterday" },
        ];
        const xml = buildSitemap({ ...base, pages });
        expect(xml).toContain("<loc>https://www.netquor.com/a.html</loc><lastmod>2026-09-01</lastmod>");
        expect(xml).toContain("<loc>https://www.netquor.com/b.html</loc><changefreq>");
    });
    test("a migrated route that is not in the registry is left out, and so is any file", () => {
        const xml = buildSitemap({ ...base, migratedPaths: new Set(["/secret.html", "/server/.env"]) });
        expect(xml).not.toContain("secret");
        expect(xml).not.toContain(".env");
    });
    test("the origin comes from the setting, and is escaped", () => {
        expect(buildSitemap({ ...base, origin: "https://staging.example.com", pages: [{ path: "/a&b.html", priority: 0.5, changefreq: "weekly" }] })).toContain("<loc>https://staging.example.com/a&amp;b.html</loc>");
    });
    test("priorities have one decimal; the home page is 1.0", () => {
        expect(buildSitemap(base)).toContain("<loc>https://www.netquor.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority>");
    });
});

describe("normalizeOrigin", () => {
    test("keeps an origin, drops path and trailing slash, falls back otherwise", () => {
        expect(normalizeOrigin("https://x.example/", "F")).toBe("https://x.example");
        expect(normalizeOrigin("https://x.example/a/b", "F")).toBe("https://x.example");
        expect(normalizeOrigin("", "F")).toBe("F");
        expect(normalizeOrigin(undefined, "F")).toBe("F");
        expect(normalizeOrigin("javascript:alert(1)", "F")).toBe("F");
        expect(normalizeOrigin("not a url", "F")).toBe("F");
    });
});

describe("robots", () => {
    test("allows all and references the sitemap on the origin", () => {
        const r = buildRobots("https://www.netquor.com");
        expect(r).toContain("User-agent: *\nAllow: /");
        expect(r).toContain("Sitemap: https://www.netquor.com/sitemap.xml");
        expect(r).not.toContain("Disallow");
    });
});

describe("llms", () => {
    test("renders prices from the snapshot", () => {
        expect(buildLlms("Fleet {{price:fleet.mac.month}} a month", snap(3, { "fleet.mac.month": 625 }))).toBe("Fleet $6.25 a month");
    });
    test("an unknown key throws rather than printing a wrong price", () => {
        expect(() => buildLlms("{{price:nope.key}}", snap(1))).toThrow();
    });
});

describe("routePathsFromGlob", () => {
    test("route directories become paths; params and the root work", () => {
        const s = routePathsFromGlob(["/src/routes/+page.svelte", "/src/routes/subnet-calculator.html/+page.svelte", "/src/routes/[slug]/+page.svelte", "/src/routes/(g)/x.html/+page.svelte", "/src/routes/a/b.html/+page.svelte", "/src/routes/+layout.svelte"]);
        expect([...s].sort()).toEqual(["/", "/a/b.html", "/subnet-calculator.html", "/x.html"]);
    });
    test("route groups are not part of the URL", () => {
        const s = routePathsFromGlob(["/src/routes/(site)/+page.svelte", "/src/routes/(site)/subnet-calculator.html/+page.svelte", "/src/routes/(fleet)/fleet.html/+page.svelte", "/src/routes/(site)/(deep)/a/b.html/+page.svelte", "/src/routes/(site)/[slug]/+page.svelte", "/src/routes/(site)/+layout.svelte"]);
        expect([...s].sort()).toEqual(["/", "/a/b.html", "/fleet.html", "/subnet-calculator.html"]);
    });
});
