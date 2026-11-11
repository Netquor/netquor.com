import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { legacyPageFiles } from "../pages";
import { classifyLegacyPath, statLegacy } from "./legacy";
import { tempLegacy } from "./testkit";

const pages = legacyPageFiles();
const ok = (p: string) => classifyLegacyPath(p, pages);

describe("classifyLegacyPath: what is served", () => {
    test("registered pages", () => {
        expect(ok("/")).toEqual({ rel: "index.html", kind: "page" });
        expect(ok("/fleet.html")).toEqual({ rel: "fleet.html", kind: "page" });
        expect(ok("/subnet-calculator.html")?.kind).toBe("page");
    });
    test("top-level assets by extension, and the explicit data files", () => {
        for (const p of ["/nq.css", "/nav.js", "/favicon.ico", "/favicon.svg", "/apple-touch-icon.png", "/da-screen.jpeg", "/readiness-data.json", "/site.webmanifest"]) expect(ok(p)?.kind).toBe("asset");
    });
    test("brand/ and fleet/ files, including nested ones", () => {
        expect(ok("/brand/og.png")?.rel).toBe("brand/og.png");
        expect(ok("/brand/social/nq-avatar-400.png")?.rel).toBe("brand/social/nq-avatar-400.png");
        expect(ok("/fleet/img/shot.webp")?.kind).toBe("asset");
        expect(ok("/fleet/site.js")?.kind).toBe("asset");
    });
});

describe("classifyLegacyPath: what is never served", () => {
    const denied = [
        "/server/src/app.ts", "/server/.env", "/server/data/prices.json", "/web/package.json", "/tools/build-nav.py", "/deploy/docker-compose.yml", "/mockups/a.html", "/.agents/ai-agent-plan.md",
        "/.git/config", "/.gitignore", "/.env", "/Dockerfile", "/llms.template.txt", "/llms.template.js", "/brand/x.template.css", "/robots.txt", "/llms.txt", "/sitemap.xml",
        "/unregistered.html", "/brand/", "/brand", "/fleet/index.html", "/brand/notes.md", "/brand/.hidden.png", "/brand/secret.json", "/package.json", "/bun.lock",
        // traversal in every spelling
        "/../server/.env", "/%2e%2e/server/.env", "/%2E%2E/server/.env", "/..%2fserver/.env", "/..%2Fserver/.env", "/brand/../server/.env", "/brand/%2e%2e/server/.env", "/brand/..%2f..%2fserver/.env",
        "/%252e%252e/server/.env", "/brand/%2e%2e%2fserver%2f.env", "/..\\server\\.env", "/brand/..\\x.png", "/fleet.html%00.png", "/nq.css%00", "/%00", "/%", "/%zz", "/fleet.html/", "/brand//og.png", "//etc/passwd",
        "/brand/og.png/../../server/.env", "/./nq.css", "/brand/./og.png",
    ];
    for (const p of denied) test(`denies ${p}`, () => expect(ok(p)).toBeNull());
    test("depth is bounded", () => expect(ok("/brand/a/b/c/d/e/f/g.png")).toBeNull());
});

describe("statLegacy", () => {
    let t: ReturnType<typeof tempLegacy> | undefined;
    afterEach(() => t?.cleanup());
    test("finds a regular file, refuses a missing one", () => {
        t = tempLegacy({ "fleet.html": "x" });
        expect(statLegacy(t.dir, { rel: "fleet.html", kind: "page" })?.size).toBe(1);
        expect(statLegacy(t.dir, { rel: "sdn.html", kind: "page" })).toBeNull();
    });
    test("refuses a directory and a symbolic link that leaves the folder", () => {
        t = tempLegacy({ "ok.css": "a" });
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
