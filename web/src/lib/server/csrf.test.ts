// Pins what SvelteKit 3's CSRF guard does to our POSTs (the guard is on in Kit 3 and cannot be switched off from config). It is the Kit function respond.js calls, imported from the installed package; if a Kit upgrade changes the rule, this fails and web/README.md must be revisited.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
// @ts-expect-error plain JS module inside the package, not part of its public exports
import { is_csrf_forbidden } from "../../../node_modules/@sveltejs/kit/src/runtime/server/csrf.js";

const SELF = "https://www.netquor.com";
const TRUSTED = ["https://netquor.com", "https://www.netquor.com"];
const forbidden = (init: { method?: string; type?: string | null; origin?: string | null }): boolean => {
    const headers = new Headers();
    if (init.type) headers.set("content-type", init.type);
    return is_csrf_forbidden({
        request: new Request(`${SELF}/api/lead`, { method: init.method ?? "POST", headers, body: "x" }),
        request_origin: init.origin ?? null,
        self_origin: SELF,
        trusted_origins: TRUSTED,
    });
};

describe("Kit 3 CSRF guard", () => {
    test("a form-encoded or content-type-less POST without a matching Origin is refused (403)", () => {
        expect(forbidden({ type: "application/x-www-form-urlencoded", origin: null })).toBe(true);
        expect(forbidden({ type: "multipart/form-data; boundary=x", origin: null })).toBe(true);
        expect(forbidden({ type: "text/plain", origin: null })).toBe(true);
        expect(forbidden({ type: null, origin: null })).toBe(true);
        expect(forbidden({ type: "application/x-www-form-urlencoded", origin: "https://evil.example" })).toBe(true);
    });
    test("the same POSTs with our own Origin (or a trusted one) pass", () => {
        expect(forbidden({ type: "application/x-www-form-urlencoded", origin: SELF })).toBe(false);
        expect(forbidden({ type: null, origin: "https://netquor.com" })).toBe(false);
    });
    test("JSON posts are not affected, with or without an Origin", () => {
        expect(forbidden({ type: "application/json", origin: null })).toBe(false);
        expect(forbidden({ type: "application/json", origin: "https://evil.example" })).toBe(false);
    });
    test("GET is never refused", () => {
        expect(forbidden({ method: "GET", type: null, origin: null })).toBe(false);
    });
    test("our config lists the apex and www as trusted origins", () => {
        const cfg = readFileSync(new URL("../../../vite.config.ts", import.meta.url), "utf8");
        expect(cfg).toContain('trustedOrigins: ["https://netquor.com", "https://www.netquor.com"]');
    });
});
