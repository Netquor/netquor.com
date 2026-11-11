import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { legacyPage, migratedPaths, pageKey, pagePathFor } from "./run";

describe("page names", () => {
    test("pagePathFor accepts the page file name, the URL path and index.html for /", () => {
        expect(pagePathFor("subnet-calculator.html")).toBe("/subnet-calculator.html");
        expect(pagePathFor("/fleet.html")).toBe("/fleet.html");
        expect(pagePathFor("index.html")).toBe("/");
        expect(pagePathFor("/")).toBe("/");
        expect(pagePathFor("nope.html")).toBeNull();
    });
    test("pageKey is the allowlist key", () => {
        expect(pageKey("/")).toBe("index.html");
        expect(pageKey("/fleet.html")).toBe("fleet.html");
    });
    test("migratedPaths finds route files under groups; the pilot is migrated, the empty fleet group adds nothing yet", () => {
        const m = migratedPaths();
        expect(m.has("/subnet-calculator.html")).toBe(true);
        expect(m.has("/nope.html")).toBe(false);
    });
});

describe("legacyPage", () => {
    test("serves the legacy file stamped with the seed prices and returns the text of its local scripts", async () => {
        const dir = mkdtempSync(join(tmpdir(), "nq-parity-legacy-"));
        try {
            mkdirSync(dir, { recursive: true });
            writeFileSync(join(dir, "fleet.html"), `<html><head><script src="calc.js?v=1"></script></head><body><p data-price="fleet.mac.month">$1</p></body></html>`);
            writeFileSync(join(dir, "calc.js"), `document.getElementById("a")`);
            const { html, scripts } = await legacyPage("/fleet.html", dir);
            expect(html).toMatch(/data-price="fleet\.mac\.month"[^>]*>\$\d/);
            expect(html).not.toContain(">$1<");
            expect(scripts).toEqual([`document.getElementById("a")`]);
            await expect(legacyPage("/terms.html", dir)).rejects.toThrow(/does not serve/);
        } finally { rmSync(dir, { recursive: true, force: true }); }
    });
});
