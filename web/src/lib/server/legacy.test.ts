import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ASSET_FILES } from "../assets";
import { classifyLegacyPath, RUNTIME_FILES, statLegacy } from "./legacy";
import { tempLegacy } from "./testkit";

const rt = (p: string) => classifyLegacyPath(p);

describe("classifyLegacyPath (what is never served)", () => {
    const denied = [
        "/server/src/app.ts", "/server/.env", "/server/data/prices.json", "/web/package.json", "/tools/build-nav.py", "/deploy/docker-compose.yml", "/mockups/a.html", "/.agents/ai-agent-plan.md",
        "/.git/config", "/.gitignore", "/.env", "/Dockerfile", "/llms.template.txt", "/llms.template.js", "/brand/x.template.css", "/robots.txt", "/llms.txt", "/sitemap.xml",
        "/unregistered.html", "/brand/", "/brand", "/fleet/index.html", "/brand/notes.md", "/brand/.hidden.png", "/brand/secret.json", "/package.json", "/bun.lock",
        // traversal in every spelling
        "/../server/.env", "/%2e%2e/server/.env", "/%2E%2E/server/.env", "/..%2fserver/.env", "/..%2Fserver/.env", "/brand/../server/.env", "/brand/%2e%2e/server/.env", "/brand/..%2f..%2fserver/.env",
        "/%252e%252e/server/.env", "/brand/%2e%2e%2fserver%2f.env", "/..\\server\\.env", "/brand/..\\x.png", "/fleet.html%00.png", "/nq.css%00", "/%00", "/%", "/%zz", "/fleet.html/", "/brand//og.png", "//etc/passwd",
        "/brand/og.png/../../server/.env", "/./nq.css", "/brand/./og.png",
    ];
    for (const p of denied) test(`denies ${p}`, () => expect(rt(p)).toBeNull());
    test("depth is bounded", () => expect(rt("/brand/a/b/c/d/e/f/g.png")).toBeNull());
});

describe("classifyLegacyPath: what is served", () => {
    test("images, the manifest and the three calculator scripts are served", () => {
        for (const p of ["/favicon.ico", "/favicon.svg", "/apple-touch-icon.png", "/da-screen.jpeg", "/site.webmanifest", "/subnet-calc.js", "/cost-calc.js", "/bundle-calc.js", "/brand/og.png", "/brand/story/home-rack.webp", "/brand/social/nq-avatar-400.png", "/fleet/favicon.svg", "/fleet/img/console.png"]) expect(rt(p)?.kind).toBe("asset");
    });
    test("no HTML page, stylesheet, other script, font or data file is served", () => {
        for (const p of ["/", "/index.html", "/fleet.html", "/subnet-calculator.html", "/nq.css", "/nav.css", "/nav.js", "/fx.js", "/bg.js", "/nudge.js", "/analytics.js", "/readiness.js", "/fleet/site.css", "/fleet/site.js", "/fleet/pricing.js", "/brand/colors.css", "/readiness-data.json", "/x.woff2", "/brand/x.js", "/fleet/img/x.html", "/fleet/img/x.css"]) expect(rt(p)).toBeNull();
    });
    test("the allowed script names are exactly the asset keys of assets.ts", () => {
        expect([...RUNTIME_FILES].filter((n) => n.endsWith(".js")).sort()).toEqual(Object.values(ASSET_FILES).sort());
    });
});

describe("statLegacy", () => {
    let t: ReturnType<typeof tempLegacy> | undefined;
    afterEach(() => t?.cleanup());
    test("finds a regular file, refuses a missing one", () => {
        t = tempLegacy({ "cost-calc.js": "x" });
        expect(statLegacy(t.dir, { rel: "cost-calc.js", kind: "asset" })?.size).toBe(1);
        expect(statLegacy(t.dir, { rel: "missing.js", kind: "asset" })).toBeNull();
    });
    test("refuses a directory and a symbolic link that leaves the folder", () => {
        t = tempLegacy({ "ok.js": "a" });
        mkdirSync(join(t.dir, "brand"));
        const outside = tempLegacy({ "secret.png": "s" });
        symlinkSync(join(outside.dir, "secret.png"), join(t.dir, "brand", "leak.png"));
        symlinkSync(outside.dir, join(t.dir, "fleet"));
        expect(statLegacy(t.dir, { rel: "brand", kind: "asset" })).toBeNull();
        expect(statLegacy(t.dir, { rel: "brand/leak.png", kind: "asset" })).toBeNull();
        expect(statLegacy(t.dir, { rel: "fleet/secret.png", kind: "asset" })).toBeNull();
        writeFileSync(join(t.dir, "brand", "fine.png"), "p");
        expect(statLegacy(t.dir, { rel: "brand/fine.png", kind: "asset" })).not.toBeNull();
        outside.cleanup();
    });
});
