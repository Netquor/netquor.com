import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveLegacyFile, serveBaseline, type BaselineServer } from "./server";

let outer = "";
let root = "";
let srv: BaselineServer;
let stamped: BaselineServer;

beforeAll(() => {
    outer = mkdtempSync(join(tmpdir(), "nq-baseline-srv-"));
    root = join(outer, "site");
    for (const d of ["fleet", "brand", "server", "web", "tools", ".git"]) mkdirSync(join(root, d), { recursive: true });
    writeFileSync(join(root, "index.html"), "<h1>home</h1>");
    writeFileSync(join(root, "vpn.html"), "<h1>vpn</h1>");
    writeFileSync(join(root, "nav.js"), "//nav");
    writeFileSync(join(root, "nq.css"), "a{}");
    writeFileSync(join(root, "fleet", "site.js"), "//fleet");
    writeFileSync(join(root, "brand", "logo.svg"), "<svg/>");
    writeFileSync(join(root, "server", "secret.ts"), "SECRET");
    writeFileSync(join(root, "web", "x.ts"), "SECRET");
    writeFileSync(join(root, "tools", "x.py"), "SECRET");
    writeFileSync(join(root, ".env"), "SECRET");
    writeFileSync(join(root, ".git", "config"), "SECRET");
    writeFileSync(join(outer, "outside.txt"), "SECRET");
    srv = serveBaseline({ dir: root });
    stamped = serveBaseline({ dir: root, transformHtml: (html, rel) => html.replace("home", `home:${rel}`) });
});
afterAll(() => {
    srv.stop(); stamped.stop();
    rmSync(outer, { recursive: true, force: true });
});

describe("resolveLegacyFile", () => {
    test("serves the root pages and scripts, fleet/ and brand/", () => {
        expect(resolveLegacyFile(root, "/")).toBe(join(root, "index.html"));
        expect(resolveLegacyFile(root, "/vpn.html?x=1#y")).toBe(join(root, "vpn.html"));
        expect(resolveLegacyFile(root, "/fleet/site.js")).toBe(join(root, "fleet", "site.js"));
        expect(resolveLegacyFile(root, "/brand/logo.svg")).toBe(join(root, "brand", "logo.svg"));
    });
    test("never serves server/, web/, tools/ or dotfiles, and blocks traversal", () => {
        for (const p of ["/server/secret.ts", "/web/x.ts", "/tools/x.py", "/.env", "/.git/config", "/../outside.txt", "/%2e%2e/outside.txt", "/..%2foutside.txt", "/%00", "/%zz"]) expect(resolveLegacyFile(root, p)).toBeNull();
    });
    test("a missing file or a directory is null", () => {
        expect(resolveLegacyFile(root, "/nope.html")).toBeNull();
        expect(resolveLegacyFile(root, "/fleet")).toBeNull();
    });
});

describe("serveBaseline", () => {
    test("serves with content types on loopback and 404s the rest", async () => {
        expect(srv.base).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
        expect(srv.dir).toBe(root);
        const home = await fetch(`${srv.base}/`);
        expect(home.status).toBe(200);
        expect(await home.text()).toBe("<h1>home</h1>");
        expect(home.headers.get("content-type")).toContain("text/html");
        expect((await fetch(`${srv.base}/nav.js?v=abc`)).headers.get("content-type")).toMatch(/javascript/);
        expect((await fetch(`${srv.base}/nq.css`)).headers.get("content-type")).toContain("text/css");
        expect((await fetch(`${srv.base}/brand/logo.svg`)).headers.get("content-type")).toContain("image/svg+xml");
        for (const p of ["/server/secret.ts", "/.env", "/missing"]) expect((await fetch(srv.base + p)).status).toBe(404);
    });
    test("transformHtml rewrites pages only", async () => {
        expect(await (await fetch(`${stamped.base}/`)).text()).toBe("<h1>home:index.html</h1>");
        expect(await (await fetch(`${stamped.base}/nav.js`)).text()).toBe("//nav");
    });
});
