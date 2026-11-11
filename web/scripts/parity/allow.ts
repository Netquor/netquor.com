// allow.ts: web/migration/parity-allow.json. Per page, per category, the differences an agent decided to keep, each with a reason:
//   { "pages": { "fleet.html": { "meta": [ { "match": "name:viewport = width=device-width, initial-scale=1.0", "reason": "app.html is global" } ] } } }
import { existsSync, readFileSync } from "node:fs";
import { CATEGORIES, type PageAllow } from "./compare";

export type AllowFile = { pages: Record<string, PageAllow> };

/** Throws with every problem found, so one run reports them all. */
export const parseAllow = (text: string, file = "parity-allow.json"): AllowFile => {
    let data: unknown;
    try { data = JSON.parse(text); } catch (e) { throw new Error(`${file}: not valid JSON (${e instanceof Error ? e.message : e})`); }
    const problems: string[] = [];
    const pages = (data as { pages?: unknown })?.pages;
    if (!pages || typeof pages !== "object" || Array.isArray(pages)) throw new Error(`${file}: expected { "pages": { "<page>.html": { ... } } }`);
    for (const [page, cats] of Object.entries(pages as Record<string, unknown>)) {
        if (!cats || typeof cats !== "object" || Array.isArray(cats)) { problems.push(`${page}: expected an object of categories`); continue; }
        for (const [cat, entries] of Object.entries(cats as Record<string, unknown>)) {
            if (!(CATEGORIES as readonly string[]).includes(cat)) { problems.push(`${page}: unknown category "${cat}" (use ${CATEGORIES.join(", ")})`); continue; }
            if (!Array.isArray(entries)) { problems.push(`${page}.${cat}: expected a list`); continue; }
            entries.forEach((e: unknown, i) => {
                const m = (e as { match?: unknown })?.match, r = (e as { reason?: unknown })?.reason;
                if (typeof m !== "string" || m === "") problems.push(`${page}.${cat}[${i}]: "match" must be a non-empty string`);
                if (typeof r !== "string" || r.trim().length < 5) problems.push(`${page}.${cat}[${i}]: "reason" is required (say why the difference is intended)`);
            });
        }
    }
    if (problems.length) throw new Error(`${file}:\n  ${problems.join("\n  ")}`);
    return data as AllowFile;
};

export const loadAllow = (path: string): AllowFile => (existsSync(path) ? parseAllow(readFileSync(path, "utf8"), path) : { pages: {} });
