import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { baselineText } from "../baselineFiles";
import { join } from "node:path";
import { cssBlocks, cssImports } from "./cssBlocks";

const STYLES = import.meta.dir;
const WEB = join(STYLES, "../../..");
const read = (p: string) => readFileSync(p, "utf8");
const style = (name: string) => read(join(STYLES, name));
const SITE_ORDER = ["tokens", "base", "utilities", "hero", "sections", "cards", "components", "buttons", "footer", "bundles", "calculators", "motion", "home"];
const FLEET_ORDER = ["tokens", "base", "nav", "buttons", "hero", "sections", "pricing", "closing", "responsive", "offers", "phones", "policies", "system"];
// The legacy stylesheets come from the legacy-baseline-2026-11 tag (baselineFiles.ts), not from the working tree; a missing tag fails the test with the fix.
const legacy = baselineText;

describe("the site system is nq.css, split without a change", () => {
    const parts = SITE_ORDER.map((n) => ({ n, blocks: cssBlocks(style(`${n}.css`)) }));
    const all = parts.flatMap((p) => p.blocks);
    test("site.css imports exactly the parts, in the cascade order", () => {
        expect(cssImports(style("site.css"))).toEqual(SITE_ORDER.map((n) => `./${n}.css`));
    });
    test("every block of nq.css is in exactly one part and the parts hold nothing else", () => {
        const want = cssBlocks(legacy("nq.css"));
        expect([...all].sort()).toEqual([...want].sort());
        expect(all.length).toBe(want.length);
    });
    test("inside each part the blocks keep the order they had in nq.css", () => {
        const want = cssBlocks(legacy("nq.css"));
        for (const p of parts) {
            const idx = p.blocks.map((b) => want.indexOf(b));
            for (const i of idx) expect(i).toBeGreaterThanOrEqual(0);
            const ordered = [...idx].sort((a, b) => a - b);
            // duplicated blocks (the same rule twice in nq.css) can share an index, so compare positions, not identity
            expect(idx.length).toBe(ordered.length);
            expect(idx.every((v, i) => i === 0 || v >= idx[i - 1] || want.filter((w) => w === p.blocks[i]).length > 1)).toBe(true);
        }
    });
    test("the cascade-sensitive pairs keep their relative order across parts", () => {
        const pos = (needle: string) => all.findIndex((b) => b.startsWith(needle));
        // the Bootstrap helper overrides (shadow, radius) must come after the card surface they override
        expect(pos("body .shadow,")).toBeGreaterThan(pos("body .service-card,"));
        expect(pos("body .rounded-4,")).toBeGreaterThan(pos("body .service-card,"));
        // the smaller button sizes win over the first button block
        expect(all.findIndex((b) => b === "body .btn,body .btn-lg{padding:10px 18px;font-size:.9375rem;line-height:1.2}")).toBeGreaterThan(pos("body .btn{font-family"));
        // the contact band overrides the start band, which comes after the hero paths it adjusts
        expect(all.lastIndexOf(".nq-start{display:block;padding:40px}")).toBeGreaterThan(pos(".nq-start{display:grid"));
        expect(pos(".nq-paths{margin-top:20px}")).toBeGreaterThan(pos(".nq-paths{display:flex"));
        // the homepage readiness card hover wins over the reveal transform, as in nq.css
        expect(pos(".nq-ready:hover")).toBeGreaterThan(pos(".nq-reveal-on .nq-r{"));
    });
    test("tokens.css has the design tokens and nothing else", () => {
        const t = cssBlocks(style("tokens.css"));
        expect(t.length).toBe(1);
        expect(t[0].startsWith(":root{--nq-bg:")).toBe(true);
        for (const v of ["--nq-bg", "--nq-s1", "--nq-s2", "--nq-s3", "--nq-line", "--nq-line-2", "--nq-ink", "--nq-ink-2", "--nq-ink-3", "--nq-accent", "--nq-accent-t", "--nq-accent-s", "--nq-ok", "--nq-display", "--nq-body", "--nq-mono", "--nq-ease"]) {
            expect(t[0]).toContain(`${v}:`);
            expect(style("tokens.css")).toContain(`${v}`);
        }
        // documented: the header names every group
        for (const g of ["surface", "line", "ink", "accent", "status", "type", "motion"]) expect(style("tokens.css")).toContain(g);
    });
    test("no other part defines a token: the :root block is only in tokens.css", () => {
        for (const n of SITE_ORDER.filter((x) => x !== "tokens")) expect(cssBlocks(style(`${n}.css`)).some((b) => b.startsWith(":root"))).toBe(false);
    });
});

describe("nav.css and Fleet's stylesheet are the legacy files, moved", () => {
    test("nav.css has the same blocks in the same order as the legacy nav.css", () => {
        expect(cssBlocks(style("nav.css"))).toEqual(cssBlocks(legacy("nav.css")));
    });
    test("fleet/index.css imports the parts in order, and together they are fleet/site.css, block for block", () => {
        expect(cssImports(style("fleet/index.css"))).toEqual(FLEET_ORDER.map((n) => `./${n}.css`));
        expect(FLEET_ORDER.flatMap((n) => cssBlocks(style(`fleet/${n}.css`)))).toEqual(cssBlocks(legacy("fleet/site.css")));
    });
});

describe("entry stylesheets", () => {
    test("the (site) entry is Bootstrap, Bootstrap Icons, nav.css, then the site system, then the rules added after the baseline, with fonts first", () => {
        expect(cssImports(style("entry-site.css"))).toEqual(["./fonts.css", "bootstrap/dist/css/bootstrap.min.css", "bootstrap-icons/font/bootstrap-icons.min.css", "./nav.css", "./site.css", "./after-baseline.css"]);
    });
    test("the (fleet) entry is the Geist fonts, Fleet's stylesheet, nav.css, Bootstrap Icons, Plex; no Bootstrap and no site system", () => {
        const i = cssImports(style("entry-fleet.css"));
        expect(i).toEqual(["./fonts-fleet.css", "./fleet/index.css", "./nav.css", "bootstrap-icons/font/bootstrap-icons.min.css", "./fonts.css"]);
        expect(i.some((x) => /bootstrap\/dist|site\.css/.test(x))).toBe(false);
    });
    test("every @import resolves to a file (ours or in node_modules) and every stylesheet here is reachable from an entry", () => {
        const seen = new Set<string>();
        const walk = (file: string) => {
            for (const target of cssImports(read(file))) {
                const path = target.startsWith(".") ? join(file, "..", target) : join(WEB, "node_modules", target);
                expect(existsSync(path)).toBe(true);
                if (target.startsWith(".")) { seen.add(path); walk(path); }
            }
        };
        walk(join(STYLES, "entry-site.css"));
        walk(join(STYLES, "entry-fleet.css"));
        const all = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? all(join(dir, e.name)) : e.name.endsWith(".css") ? [join(dir, e.name)] : []));
        for (const f of all(STYLES)) if (!/entry-(site|fleet)\.css$/.test(f)) expect(seen.has(f)).toBe(true);
    });
    test("the dark theme is unchanged: the shell sets data-bs-theme=dark on <html>, and the bundled Bootstrap is the 5.3.3 build that styles it", () => {
        const shell = read(join(WEB, "src/app.html"));
        expect(shell).toContain('<html lang="en-US" data-bs-theme="dark">');
        expect(shell).toContain('classList.add("nq-js")');
        const bs = read(join(WEB, "node_modules/bootstrap/dist/css/bootstrap.min.css"));
        expect(bs).toContain("Bootstrap  v5.3.3");
        expect(bs).toContain('[data-bs-theme=dark]');
    });
    test("the layouts import their entry stylesheet and nothing from a CDN", () => {
        expect(read(join(WEB, "src/routes/(site)/+layout.svelte"))).toContain('import "#lib/styles/entry-site.css"');
        expect(read(join(WEB, "src/routes/(fleet)/+layout.svelte"))).toContain('import "#lib/styles/entry-fleet.css"');
    });
});

describe("fonts", () => {
    const faces = (css: string) => [...css.matchAll(/@import "([^"]+)"/g)].map((m) => m[1]);
    const read5 = (spec: string) => read(join(WEB, "node_modules", spec));
    test("the site fonts are Plex Sans 400, 500, 600 and Plex Mono 400, 500, latin subset, font-display swap, with woff2 files on disk", () => {
        const specs = faces(style("fonts.css"));
        expect(specs).toEqual(["@fontsource/ibm-plex-sans/latin-400.css", "@fontsource/ibm-plex-sans/latin-500.css", "@fontsource/ibm-plex-sans/latin-600.css", "@fontsource/ibm-plex-mono/latin-400.css", "@fontsource/ibm-plex-mono/latin-500.css"]);
        for (const s of specs) {
            const css = read5(s);
            expect(css).toContain("font-display: swap");
            const m = /url\(\.\/files\/([^)]+\.woff2)\)/.exec(css);
            expect(m).not.toBeNull();
            expect(existsSync(join(WEB, "node_modules", s, "..", "files", m![1]))).toBe(true);
        }
    });
    test("Fleet's fonts are Geist 400, 500, 600 and Geist Mono 400, 500, latin, swap", () => {
        const specs = faces(style("fonts-fleet.css"));
        expect(specs).toEqual(["@fontsource/geist/latin-400.css", "@fontsource/geist/latin-500.css", "@fontsource/geist/latin-600.css", "@fontsource/geist-mono/latin-400.css", "@fontsource/geist-mono/latin-500.css"]);
        for (const s of specs) expect(read5(s)).toContain("font-display: swap");
    });
    test("the site is English: every non-ASCII character in the page sources is in the latin subset the fonts cover", () => {
        const srcs: string[] = [];
        const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(svelte|ts)$/.test(e.name) && !e.name.endsWith(".test.ts")) srcs.push(p); } };
        walk(join(WEB, "src"));
        // the latin subset (Google's definition, which Fontsource uses): Basic Latin, Latin-1, general punctuation, a few more
        const covered = (cp: number) => cp <= 0xff || cp === 0x131 || (cp >= 0x152 && cp <= 0x153) || (cp >= 0x2bb && cp <= 0x2bc) || cp === 0x2c6 || cp === 0x2da || cp === 0x2dc || (cp >= 0x2000 && cp <= 0x206f) || cp === 0x20ac || cp === 0x2122 || cp === 0x2191 || cp === 0x2193 || cp === 0x2212 || cp === 0x2215 || cp === 0xfeff || cp === 0xfffd;
        const bad = new Map<string, string>();
        for (const f of srcs) for (const ch of read(f)) { const cp = ch.codePointAt(0)!; if (cp > 0x7f && !covered(cp) && !bad.has(ch)) bad.set(ch, f); }
        // Arrows, check marks and the like in markup are drawn by the icon font or the fallback face, as on the legacy pages; list them so a new one is noticed
        const known = new Set(["→", "✓", "—", "•"]);
        for (const [ch] of bad) if (!known.has(ch)) throw new Error(`U+${ch.codePointAt(0)!.toString(16)} (${ch}) in ${bad.get(ch)} is outside the latin subset`);
    });
});

describe("no runtime dependency on a CDN or a font service", () => {
    const walk = (d: string, out: string[] = []): string[] => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p, out); else if (!e.name.endsWith(".test.ts")) out.push(p); } return out; };
    const files = [...walk(join(WEB, "src")), join(WEB, "vite.config.ts")].filter((f) => /\.(svelte|ts|css|html)$/.test(f));
    test("no source file names a CDN or Google's font hosts", () => {
        for (const f of files) {
            const t = read(f);
            for (const host of ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com", "unpkg.com"]) {
                // comments may mention where something used to come from; code, markup and URLs may not
                const code = f.endsWith(".css") ? t.replace(/\/\*[\s\S]*?\*\//g, "") : t.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
                if (code.includes(host)) throw new Error(`${f} mentions ${host}`);
            }
        }
    });
    test("no source file links a stylesheet by URL or injects a <style> string with {@html}", () => {
        for (const f of files.filter((x) => /\.(svelte|ts)$/.test(x))) {
            // a <noscript> fallback (the accordion shows its panels without JavaScript) is the one allowed inline style
            const t = read(f).split("\n").filter((l) => !l.includes("<noscript>")).join("\n");
            expect(/<link[^>]*rel=["']stylesheet["']/.test(t)).toBe(false);
            expect(/\{@html\s*`<style/.test(t)).toBe(false);
        }
        expect(read(join(WEB, "src/app.html"))).not.toContain("stylesheet");
    });
    test("no PAGE_CSS string is left in the page data", () => {
        for (const f of files.filter((x) => x.endsWith(".ts"))) expect(read(f)).not.toContain("export const PAGE_CSS");
    });
    test("every page.css is imported by exactly its route, and every such route import has a file", () => {
        const pagesDir = join(WEB, "src/lib/pages");
        const withCss = readdirSync(pagesDir, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(join(pagesDir, e.name, "page.css"))).map((e) => e.name);
        expect(withCss.sort()).toEqual(["central", "digitalaccess", "homeassistant", "index", "network", "privacy", "sdn", "sms", "terms", "vpn"]);
        const routes = files.filter((f) => f.includes("/src/routes/") && f.endsWith("+page.svelte"));
        for (const n of withCss) {
            const importers = routes.filter((f) => read(f).includes(`import "#lib/pages/${n}/page.css";`));
            expect(importers.length).toBe(1);
        }
    });
    test("bundled style packages are pinned to an exact version", () => {
        const pkg = JSON.parse(read(join(WEB, "package.json"))) as { devDependencies: Record<string, string> };
        expect(pkg.devDependencies.bootstrap).toBe("5.3.3");
        expect(pkg.devDependencies["bootstrap-icons"]).toBe("1.11.3");
        for (const p of ["@fontsource/ibm-plex-sans", "@fontsource/ibm-plex-mono", "@fontsource/geist", "@fontsource/geist-mono"]) expect(pkg.devDependencies[p]).toMatch(/^\d+\.\d+\.\d+$/);
    });
});
