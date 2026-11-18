import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ASSET_FILES, assetUrl, assetVersions } from "./assets";

describe("assets", () => {
    test("no stylesheet is loaded from the legacy folder: the styles are bundled by Vite (src/lib/styles)", () => {
        for (const file of Object.values(ASSET_FILES)) expect(file.endsWith(".css")).toBe(false);
    });
    test("every listed file exists in the legacy folder (the repository root) and is an allowed asset type", () => {
        const root = join(import.meta.dir, "../../..");
        for (const file of Object.values(ASSET_FILES)) {
            expect(existsSync(join(root, file))).toBe(true);
            expect(/\.js$/.test(file)).toBe(true);
        }
    });
    test("assetVersions fingerprints every key through the given function", () => {
        const v = assetVersions((f) => `v:${f}`);
        expect(Object.keys(v).sort()).toEqual(Object.keys(ASSET_FILES).sort());
        expect(v.subnet).toBe("v:subnet-calc.js");
        expect(v.costCalc).toBe("v:cost-calc.js");
    });
    test("assetUrl is absolute and carries ?v=; a missing version becomes 0", () => {
        expect(assetUrl({ costCalc: "25e7ba41" }, "costCalc")).toBe("/cost-calc.js?v=25e7ba41");
        expect(assetUrl({}, "subnet")).toBe("/subnet-calc.js?v=0");
    });
});
