// audit.ts: `bun run e2e:audit [--no-build]`. Loads every migrated page in headless Chrome on the legacy and the Svelte server and lists what each requested. A Svelte page must not request the Bootstrap JavaScript bundle or one of the replaced scripts (nav.js, fx.js, bg.js, nudge.js, analytics.js, readiness.js, fleet/site.js, fleet/pricing.js) from any origin, and its Google Analytics requests must equal the legacy page's. Exit code 1 on any violation.
import { launchBrowser } from "./browser";
import { startServers } from "./servers";

export const REPLACED = ["nav.js", "fx.js", "bg.js", "nudge.js", "analytics.js", "readiness.js", "fleet/site.js", "fleet/pricing.js"] as const;
export const PAGES = ["/", "/central.html", "/compare.html", "/digitalaccess.html", "/fleet.html", "/homeassistant.html", "/network.html", "/partners.html", "/privacy.html", "/readiness.html", "/referrals.html", "/sdn.html", "/startups.html", "/subnet-calculator.html", "/terms.html", "/vpn.html", "/story.html"] as const;

const GOOGLE = /googletagmanager|google-analytics|doubleclick|googleadservices/;

/** The requests that must not happen on a Svelte page: Bootstrap's JS (any origin) and the replaced scripts from the page's own origin. */
export const forbidden = (urls: string[], own: string): string[] =>
    urls.filter((u) => {
        const path = u.startsWith(own) ? u.slice(own.length).split("?")[0].replace(/^\//, "") : null;
        if (/bootstrap(?:\.bundle)?(?:\.min)?\.js/.test(u) || /\/bootstrap@[^/]*\/dist\/js\//.test(u)) return true;
        return path !== null && (REPLACED as readonly string[]).includes(path);
    });

/** Google requests, without query strings and in a stable order, to compare two pages. */
export const googleRequests = (urls: string[]): string[] => [...new Set(urls.filter((u) => GOOGLE.test(u)).map((u) => u.split("?")[0]))].sort();

export interface AuditRow { page: string; legacyRequests: number; svelteRequests: number; forbidden: string[]; legacyGoogle: string[]; svelteGoogle: string[]; legacyOnly: string[]; ok: boolean }

/** `legacy` is null for a page with no legacy file (story.html): its Google requests must then be the one gtag.js load every page makes. */
export const auditRow = (page: string, legacy: string[] | null, svelte: string[], legacyOwn: string, svelteOwn: string): AuditRow => {
    const bad = forbidden(svelte, svelteOwn);
    const lg = legacy ? googleRequests(legacy) : ["https://www.googletagmanager.com/gtag/js"], sg = googleRequests(svelte);
    const strip = (u: string, own: string) => (u.startsWith(own) ? u.slice(own.length) : u).split("?")[0];
    const sv = new Set(svelte.map((u) => strip(u, svelteOwn)));
    const legacyOnly = [...new Set((legacy ?? []).map((u) => strip(u, legacyOwn)))].filter((u) => !sv.has(u) && !GOOGLE.test(u)).sort();
    return { page, legacyRequests: legacy?.length ?? 0, svelteRequests: svelte.length, forbidden: bad, legacyGoogle: lg, svelteGoogle: sg, legacyOnly, ok: bad.length === 0 && JSON.stringify(lg) === JSON.stringify(sg) };
};

export const formatAudit = (rows: AuditRow[]): string => {
    const lines = ["page".padEnd(26) + "legacy".padStart(7) + "svelte".padStart(8) + "  google(legacy = svelte)".padEnd(26) + "  result"];
    for (const r of rows) lines.push(r.page.padEnd(26) + String(r.legacyRequests).padStart(7) + String(r.svelteRequests).padStart(8) + `  ${r.legacyGoogle.length}=${r.svelteGoogle.length}`.padEnd(26) + `  ${r.ok ? "ok" : "FAIL"}`);
    for (const r of rows) {
        if (r.forbidden.length) lines.push(`  ${r.page}: forbidden request(s) from the Svelte page: ${r.forbidden.join(", ")}`);
        if (JSON.stringify(r.legacyGoogle) !== JSON.stringify(r.svelteGoogle)) lines.push(`  ${r.page}: google requests differ: legacy ${JSON.stringify(r.legacyGoogle)}, svelte ${JSON.stringify(r.svelteGoogle)}`);
    }
    for (const r of rows) if (r.legacyOnly.length) lines.push(`  ${r.page}: requested by legacy only: ${r.legacyOnly.join(", ")}`);
    return lines.join("\n");
};

if (import.meta.main) {
    const servers = await startServers({ build: !process.argv.includes("--no-build"), log: (s) => console.log(s) });
    const browser = await launchBrowser();
    const rows: AuditRow[] = [];
    try {
        for (const path of PAGES) {
            const run = async (base: string): Promise<string[]> => {
                const page = await browser.newPage();
                try {
                    await page.goto(base + path, { waitUntil: "networkidle", timeoutMs: 45000 });
                    await page.wait(1500);
                    return page.requests().map((r) => r.url).filter((u) => !u.startsWith("data:"));
                } finally { await page.close(); }
            };
            const legacy = path === "/story.html" ? null : await run(servers.legacy);
            const svelte = await run(servers.svelte);
            rows.push(auditRow(path, legacy, svelte, servers.legacy, servers.svelte));
        }
    } finally {
        await browser.close();
        servers.stop();
    }
    console.log(formatAudit(rows));
    process.exit(rows.every((r) => r.ok) ? 0 : 1);
}
