import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { createRuntime } from "./runtime";
import { mutablePrices, snap, tempLegacy } from "./testkit";

let t: ReturnType<typeof tempLegacy> | undefined;
afterEach(() => t?.cleanup());

const make = (files: Record<string, string>) => {
    t = tempLegacy(files);
    return createRuntime({ prices: mutablePrices(snap(1)), api: async () => new Response("x"), env: { siteOrigin: "https://www.netquor.com", legacyDir: t.dir }, cachePages: true });
};

describe("runtime", () => {
    test("assetVersion is a short content hash that follows the file", () => {
        const rt = make({ "nq.css": "a" });
        const v1 = rt.assetVersion("nq.css");
        expect(v1).toMatch(/^[0-9a-f]{8}$/);
        expect(rt.assetVersion("nq.css")).toBe(v1);
        t!.write("nq.css", "b", 2_000_000_000);
        expect(rt.assetVersion("nq.css")).not.toBe(v1);
        expect(rt.assetVersion("missing.css")).toBe("0");
    });
    test("assetVersion is the scheme tools/build-nav.py uses for the legacy pages: first 8 hex of the md5", () => {
        const rt = make({ "nq.css": "body{margin:0}" });
        expect(rt.assetVersion("nq.css")).toBe(createHash("md5").update("body{margin:0}").digest("hex").slice(0, 8));
    });
    test("llmsTemplate re-reads when the file changes", () => {
        const rt = make({ "llms.template.txt": "one" });
        expect(rt.llmsTemplate()).toBe("one");
        t!.write("llms.template.txt", "two", 2_000_000_300);
        expect(rt.llmsTemplate()).toBe("two");
    });
});
