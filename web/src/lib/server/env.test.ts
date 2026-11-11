import { describe, expect, test } from "bun:test";
import { readWebEnv } from "./env";

describe("readWebEnv", () => {
    test("defaults: the canonical origin and the repository root above web/", () => {
        expect(readWebEnv({}, "/repo/web", () => false)).toEqual({ siteOrigin: "https://www.netquor.com", legacyDir: "/repo" });
    });
    test("the image folder is used when it exists", () => {
        expect(readWebEnv({}, "/app/web", (p) => p === "/app/legacy").legacyDir).toBe("/app/legacy");
    });
    test("LEGACY_DIR wins, relative to the working directory", () => {
        expect(readWebEnv({ LEGACY_DIR: "../site" }, "/repo/web", () => true).legacyDir).toBe("/repo/site");
        expect(readWebEnv({ LEGACY_DIR: "/srv/x" }, "/repo/web", () => true).legacyDir).toBe("/srv/x");
    });
    test("SITE_ORIGIN is normalised and a bad one falls back", () => {
        expect(readWebEnv({ SITE_ORIGIN: "https://staging.netquor.com/" }, "/r", () => false).siteOrigin).toBe("https://staging.netquor.com");
        expect(readWebEnv({ SITE_ORIGIN: "ftp://x" }, "/r", () => false).siteOrigin).toBe("https://www.netquor.com");
    });
});
