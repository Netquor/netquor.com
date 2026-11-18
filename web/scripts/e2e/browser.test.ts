import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isOwnProfileDir, parseKey, removeProfile } from "./browser";

describe("parseKey", () => {
    test("named keys", () => {
        expect(parseKey("Escape")).toMatchObject({ key: "Escape", code: "Escape", vk: 27, modifiers: 0 });
        expect(parseKey("Tab")).toMatchObject({ vk: 9 });
        expect(parseKey("Enter")).toMatchObject({ vk: 13, text: "\r" });
        expect(parseKey("Space")).toMatchObject({ key: " ", vk: 32, text: " " });
        expect(parseKey("ArrowDown")).toMatchObject({ vk: 40 });
    });
    test("modifiers", () => {
        expect(parseKey("Shift+Tab")).toMatchObject({ key: "Tab", modifiers: 8 });
        expect(parseKey("Control+Shift+a").modifiers).toBe(2 | 8);
        expect(parseKey("cmd+a").modifiers).toBe(4);
        expect(parseKey("Alt+ArrowLeft").modifiers).toBe(1);
    });
    test("single characters", () => {
        expect(parseKey("a")).toMatchObject({ key: "a", code: "KeyA", vk: 65, text: "a" });
        expect(parseKey("7")).toMatchObject({ code: "Digit7", vk: 55 });
    });
    test("punctuation does not collide with navigation keys (a period is not Delete, code 46)", () => {
        expect(parseKey(".").vk).toBe(190);
        expect(parseKey("/").vk).toBe(191);
        expect(parseKey("-").vk).toBe(189);
        expect(parseKey("!").vk).toBe(0);
    });
    test("unknown names and modifiers throw", () => {
        expect(() => parseKey("Hyper+a")).toThrow(/unknown modifier/);
        expect(() => parseKey("Banana")).toThrow(/unknown key/);
    });
});

describe("profile directory safety", () => {
    const tmp = tmpdir();
    test("only a direct child of the temp dir with our prefix qualifies", () => {
        expect(isOwnProfileDir(join(tmp, "nq-e2e-abc123"), tmp)).toBe(true);
        expect(isOwnProfileDir(join(tmp, "other-abc"), tmp)).toBe(false);
        expect(isOwnProfileDir(join(tmp, "nq-e2e-abc", "nested"), tmp)).toBe(false);
        expect(isOwnProfileDir(join(tmp, "nq-e2e-abc", ".."), tmp)).toBe(false);
    });
    test("empty, root, home, the temp dir itself and relative paths never qualify", () => {
        for (const bad of ["", "/", process.env.HOME ?? "/Users/x", tmp, "nq-e2e-abc", "./nq-e2e-abc", join(tmp, ".."), "/nq-e2e-abc"]) expect(isOwnProfileDir(bad, tmp)).toBe(false);
    });
    test("a non-string never qualifies", () => expect(isOwnProfileDir(undefined as unknown as string, tmp)).toBe(false));
    test("a prefix lookalike outside the temp dir does not qualify", () => expect(isOwnProfileDir(join(tmp, "..", "nq-e2e-abc"), tmp)).toBe(false));
    test("removeProfile removes a profile it could have made, and its contents", () => {
        const dir = mkdtempSync(join(tmp, "nq-e2e-"));
        mkdirSync(join(dir, "Default"));
        writeFileSync(join(dir, "Default", "Preferences"), "{}");
        removeProfile(dir);
        expect(existsSync(dir)).toBe(false);
    });
    test("removeProfile refuses anything else and touches nothing", () => {
        const keep = mkdtempSync(join(tmp, "keep-me-"));
        writeFileSync(join(keep, "f"), "x");
        try {
            expect(() => removeProfile(keep)).toThrow(/refusing to remove/);
            expect(() => removeProfile("")).toThrow(/refusing to remove/);
            expect(() => removeProfile("/")).toThrow(/refusing to remove/);
            expect(() => removeProfile(tmp)).toThrow(/refusing to remove/);
            expect(existsSync(join(keep, "f"))).toBe(true);
        } finally {
            rmSync(keep, { recursive: true, force: true });
        }
    });
});
