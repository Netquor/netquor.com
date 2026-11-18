import { describe, expect, test } from "bun:test";
import { MIN_SECRET_LENGTH, pricingProblems, webhookSecrets } from "./env";

describe("pricingProblems", () => {
    test("nothing set is fine", () => expect(pricingProblems({})).toEqual([]));
    test("a complete setup is fine", () => {
        expect(pricingProblems({ PRICING_WEBHOOK_SECRET: "x".repeat(32), PRICING_WEBHOOK_SECRET_NEXT: "y".repeat(32), PRICING_API_URL: "https://account.netquor.com/api/prices", PRICING_API_TOKEN: "t", PRICING_POLL_SECONDS: "900", WEB_INTERNAL_URL: "http://netquor-web:3000" })).toEqual([]);
    });
    test("short secret is named but not echoed", () => {
        const p = pricingProblems({ PRICING_WEBHOOK_SECRET: "short" });
        expect(p).toHaveLength(1);
        expect(p[0]).toContain("PRICING_WEBHOOK_SECRET");
        expect(p[0]).not.toContain("short,");
    });
    test("next without current", () => expect(pricingProblems({ PRICING_WEBHOOK_SECRET_NEXT: "y".repeat(32) })).toHaveLength(1));
    test("urls use the shared validator", () => {
        expect(pricingProblems({ PRICING_API_URL: "http://example.com/x" })[0]).toContain("PRICING_API_URL");
        expect(pricingProblems({ PRICING_API_URL: "http://127.0.0.1:9000/x" })).toEqual([]);
        expect(pricingProblems({ PRICING_API_URL: "https://u:p@example.com/" })).toHaveLength(1);
        expect(pricingProblems({ WEB_INTERNAL_URL: "ftp://x" })[0]).toContain("WEB_INTERNAL_URL");
    });
    test("token needs a url", () => expect(pricingProblems({ PRICING_API_TOKEN: "t" })).toHaveLength(1));
    test("poll interval", () => {
        expect(pricingProblems({ PRICING_POLL_SECONDS: "10" })).toHaveLength(1);
        expect(pricingProblems({ PRICING_POLL_SECONDS: "abc" })).toHaveLength(1);
    });
});

describe("webhookSecrets (runtime)", () => {
    const warnings = () => { const w: string[] = []; return { w, warn: (l: string) => void w.push(l) }; };
    const good = "g".repeat(MIN_SECRET_LENGTH), next = "n".repeat(MIN_SECRET_LENGTH);

    test("a 16 character secret is accepted, 15 is ignored with one warning and the list is empty", () => {
        const a = warnings();
        expect(webhookSecrets({ PRICING_WEBHOOK_SECRET: good }, a.warn)).toEqual([good]);
        expect(a.w).toEqual([]);
        const b = warnings();
        expect(webhookSecrets({ PRICING_WEBHOOK_SECRET: "x".repeat(15) }, b.warn)).toEqual([]);
        expect(b.w).toHaveLength(1);
        expect(b.w[0]).not.toContain("xxxx");
    });
    test("no secret at all is silent and empty", () => {
        const a = warnings();
        expect(webhookSecrets({}, a.warn)).toEqual([]);
        expect(a.w).toEqual([]);
    });
    test("a weak NEXT secret is ignored with a warning while the current one stays", () => {
        const a = warnings();
        expect(webhookSecrets({ PRICING_WEBHOOK_SECRET: good, PRICING_WEBHOOK_SECRET_NEXT: "weak" }, a.warn)).toEqual([good]);
        expect(a.w).toHaveLength(1);
    });
    test("both are in force during a rotation", () => expect(webhookSecrets({ PRICING_WEBHOOK_SECRET: good, PRICING_WEBHOOK_SECRET_NEXT: next })).toEqual([good, next]));
    test("NEXT alone does not switch the route on", () => {
        const a = warnings();
        expect(webhookSecrets({ PRICING_WEBHOOK_SECRET_NEXT: next }, a.warn)).toEqual([]);
        expect(a.w).toHaveLength(1);
    });
    test("a weak current secret with a good NEXT keeps the route off", () => {
        expect(webhookSecrets({ PRICING_WEBHOOK_SECRET: "weak", PRICING_WEBHOOK_SECRET_NEXT: next })).toEqual([]);
    });
    test("surrounding whitespace is trimmed before the length is judged", () => {
        expect(webhookSecrets({ PRICING_WEBHOOK_SECRET: `  ${"x".repeat(15)}  ` })).toEqual([]);
    });
});

describe("empty settings count as unset", () => {
    test("an empty WEB_INTERNAL_URL, PRICES_DIR and PRICES_SEED_FILE give the defaults", async () => {
        const { webInternalUrl, pricesDir, seedFile } = await import("./env");
        expect(webInternalUrl({ WEB_INTERNAL_URL: "" })).toBe("http://netquor-web:3000");
        expect(webInternalUrl({ WEB_INTERNAL_URL: "  " }, "http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
        expect(pricesDir({ PRICES_DIR: "" })).toBe(pricesDir({}));
        expect(seedFile({ PRICES_SEED_FILE: "" })).toBe(seedFile({}));
        expect(pricesDir({ PRICES_DIR: "/data" })).toBe("/data");
    });
});

describe("DATA_DIR", () => {
    test("is the default folder for the prices when PRICES_DIR is unset or empty; PRICES_DIR wins", async () => {
        const { pricesDir } = await import("./env");
        expect(pricesDir({ DATA_DIR: "/vol" })).toBe("/vol");
        expect(pricesDir({ DATA_DIR: "/vol", PRICES_DIR: "" })).toBe("/vol");
        expect(pricesDir({ DATA_DIR: "/vol", PRICES_DIR: "/p" })).toBe("/p");
        expect(pricesDir({ DATA_DIR: "" })).toBe(pricesDir({}));
    });
});

describe("catalog settings", () => {
    test("NETQUOR_CATALOG_URL must be https (or loopback http); invalid product ids are reported; defaults", async () => {
        const { catalogProducts, catalogUrl } = await import("./env");
        expect(pricingProblems({ NETQUOR_CATALOG_URL: "https://api.netquor.com" })).toEqual([]);
        expect(pricingProblems({ NETQUOR_CATALOG_URL: "http://api.netquor.com" })).toEqual(["NETQUOR_CATALOG_URL must be https:// (http is allowed only for localhost)"]);
        expect(pricingProblems({ NETQUOR_CATALOG_PRODUCTS: "netquor-fleet,Bad One" })).toEqual(['NETQUOR_CATALOG_PRODUCTS has an invalid product id "Bad One"']);
        expect(catalogProducts({}).products).toEqual(["netquor-fleet", "netquor-phone"]);
        expect(catalogProducts({ NETQUOR_CATALOG_PRODUCTS: "netquor-fleet" }).products).toEqual(["netquor-fleet"]);
        expect(catalogUrl({ NETQUOR_CATALOG_URL: "  " })).toBe("");
    });
});
