// url.test.ts: the shared address validator.
import { describe, expect, test } from "bun:test";
import { validateServiceUrl } from "./url";

const ok = (u: string, o?: Parameters<typeof validateServiceUrl>[1]) => validateServiceUrl(u, o).ok;

describe("validateServiceUrl", () => {
    test("https is fine anywhere", () => {
        expect(ok("https://account.netquor.com/api/prices")).toBe(true);
        expect(ok("https://localhost:8443/x")).toBe(true);
    });
    test("plain http only to loopback by default", () => {
        for (const u of ["http://localhost:3000/x", "http://127.0.0.1:9000/x", "http://[::1]:9000/"]) expect(ok(u)).toBe(true);
        for (const u of ["http://example.com/x", "http://localhost.evil.com/", "http://127.0.0.1.evil.com/", "http://10.0.0.5/", "http://0.0.0.0/"]) expect(ok(u)).toBe(false);
    });
    test("plainHttp any allows the private container name", () => {
        expect(ok("http://netquor-web:3000", { plainHttp: "any" })).toBe(true);
        expect(ok("http://netquor-web:3000")).toBe(false);
    });
    test("no user name or password, even over https", () => {
        expect(validateServiceUrl("https://user:pw@example.com/")).toEqual({ ok: false, reason: "must not contain a user name or password" });
        expect(ok("https://user@example.com/")).toBe(false);
        expect(ok("http://user:pw@localhost/")).toBe(false);
    });
    test("other schemes, junk, empty and very long are refused", () => {
        for (const u of ["ftp://example.com/", "file:///etc/passwd", "javascript:alert(1)", "not a url", "", "   ", "//example.com", "https://" + "a".repeat(3000) + ".com"]) expect(ok(u)).toBe(false);
    });
    test("the reason never contains the address", () => {
        const r = validateServiceUrl("http://secret-host.example/x?token=abc");
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.reason).not.toContain("secret-host");
    });
});
