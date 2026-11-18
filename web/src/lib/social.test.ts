import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSON_LD } from "./pages/index/data";
import { sameAs, socialLinks, xHandle } from "./social";

describe("social", () => {
    test("the real data: order, labels, icons, sameAs and handle", () => {
        expect(socialLinks().map((l) => [l.network, l.icon, l.ariaLabel])).toEqual([
            ["facebook", "bi-facebook", "Netquor on Facebook"], ["x", "bi-twitter-x", "Netquor on X"], ["linkedin", "bi-linkedin", "Netquor on LinkedIn"], ["github", "bi-github", "Netquor on GitHub"],
        ]);
        expect(sameAs()).toEqual(["https://www.facebook.com/people/Netquor-Technologies/61596308317634/", "https://x.com/netquor", "https://www.linkedin.com/company/netquor", "https://github.com/Netquor"]);
        expect(xHandle()).toBe("@netquor");
    });
    test("empty entries add nothing; instagram lands between x and linkedin", () => {
        expect(socialLinks({ x: "", github: "" })).toEqual([]);
        expect(xHandle({ github: "https://github.com/a" })).toBeUndefined();
        expect(sameAs({ linkedin: "https://l/1", instagram: "https://i/1", x: "https://x.com/me/" })).toEqual(["https://x.com/me/", "https://i/1", "https://l/1"]);
        expect(xHandle({ x: "https://x.com/me/" })).toBe("@me");
    });
    test("a non https URL is refused", () => {
        expect(() => socialLinks({ x: "x.com/netquor" })).toThrow(/https/);
    });
    test("the home page JSON-LD sameAs and twitter:site come from it", () => {
        const org = (JSON_LD["@graph"] as { "@id": string; sameAs?: string[] }[]).find((g) => g["@id"] === "https://www.netquor.com/#org")!;
        expect(org.sameAs).toEqual(sameAs());
        const page = readFileSync(join(import.meta.dir, "../routes/(site)/+page.svelte"), "utf8");
        expect(page).toContain("xHandle()");
        expect(page).not.toContain('"@netquor"');
    });
});
