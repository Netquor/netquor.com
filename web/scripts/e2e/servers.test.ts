import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveLegacyFile, startLegacyStatic, type Static } from "./servers";

let root = "";
let outer = "";
let srv: Static;

beforeAll(() => {
    outer = mkdtempSync(join(tmpdir(), "nq-e2e-srvtest-"));
    root = join(outer, "site");
    for (const d of ["fleet", "brand", "server", "web", "tools", ".git"]) mkdirSync(join(root, d), { recursive: true });
    writeFileSync(join(root, "index.html"), "<h1>home</h1>");
    writeFileSync(join(root, "vpn.html"), "<h1>vpn</h1>");
    writeFileSync(join(root, "nav.js"), "//nav");
    writeFileSync(join(root, "fleet", "site.js"), "//fleet");
    writeFileSync(join(root, "brand", "logo.svg"), "<svg/>");
    writeFileSync(join(root, "server", "secret.ts"), "SECRET");
    writeFileSync(join(root, "web", "x.ts"), "SECRET");
    writeFileSync(join(root, "tools", "x.py"), "SECRET");
    writeFileSync(join(root, ".env"), "SECRET");
    writeFileSync(join(root, ".git", "config"), "SECRET");
    writeFileSync(join(outer, "outside.txt"), "SECRET");
    srv = startLegacyStatic(root);
});
afterAll(() => {
    srv.stop();
    rmSync(outer, { recursive: true, force: true });
});

describe("resolveLegacyFile", () => {
    test("serves the root pages and scripts", () => {
        expect(resolveLegacyFile(root, "/")).toBe(join(root, "index.html"));
        expect(resolveLegacyFile(root, "/index.html")).toBe(join(root, "index.html"));
        expect(resolveLegacyFile(root, "/vpn.html?x=1#y")).toBe(join(root, "vpn.html"));
        expect(resolveLegacyFile(root, "/nav.js")).toBe(join(root, "nav.js"));
    });
    test("serves fleet/ and brand/", () => {
        expect(resolveLegacyFile(root, "/fleet/site.js")).toBe(join(root, "fleet", "site.js"));
        expect(resolveLegacyFile(root, "/brand/logo.svg")).toBe(join(root, "brand", "logo.svg"));
    });
    test("never serves server/, web/, tools/ or dotfiles", () => {
        for (const p of ["/server/secret.ts", "/web/x.ts", "/tools/x.py", "/.env", "/.git/config", "/fleet/.hidden", "/brand/../.env"]) expect(resolveLegacyFile(root, p)).toBeNull();
    });
    test("blocks traversal in every spelling", () => {
        for (const p of ["/../outside.txt", "/%2e%2e/outside.txt", "/fleet/../../outside.txt", "/..%2foutside.txt", "/fleet/..\\..\\outside.txt", "/%00", "/%zz"]) expect(resolveLegacyFile(root, p)).toBeNull();
    });
    test("a missing file or a directory is null", () => {
        expect(resolveLegacyFile(root, "/nope.html")).toBeNull();
        expect(resolveLegacyFile(root, "/fleet")).toBeNull();
        expect(resolveLegacyFile(root, "/fleet/")).toBeNull();
    });
});

describe("startLegacyStatic", () => {
    test("serves files with a content type and 404s the rest", async () => {
        const home = await fetch(`${srv.base}/`);
        expect(home.status).toBe(200);
        expect(await home.text()).toBe("<h1>home</h1>");
        expect(home.headers.get("content-type")).toContain("text/html");
        const js = await fetch(`${srv.base}/nav.js?v=abc`);
        expect(js.status).toBe(200);
        expect(js.headers.get("content-type")).toMatch(/javascript/);
        expect((await fetch(`${srv.base}/server/secret.ts`)).status).toBe(404);
        expect((await fetch(`${srv.base}/.env`)).status).toBe(404);
        expect((await fetch(`${srv.base}/missing`)).status).toBe(404);
    });
    test("binds to loopback on its own port", () => expect(srv.base).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/));
});
