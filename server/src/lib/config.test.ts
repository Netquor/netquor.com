// lib/config.test.ts: settings: defaults, clear errors, and that a secret is never in a message.
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { checkConfig, ConfigError, loadConfig, serverRoot } from "./config";

describe("defaults", () => {
    test("an empty environment is a working setup: file sink, production origins, nothing trusted", () => {
        const c = loadConfig({});
        expect(c).toMatchObject({ port: 4200, host: "127.0.0.1", rateLimitMax: 5, rateLimitWindowMs: 600_000, leadForwardUrl: "", maxBodyBytes: 16384, deliveryDeadlineMs: 8000 });
        expect(c.allowedOrigins).toEqual(["https://www.netquor.com", "https://netquor.com"]);
        expect(c.leadFile).toBe(resolve(serverRoot, "data/leads.jsonl"));
        expect(c.siteOrigin).toBe("https://www.netquor.com");
        expect(c.webInternalUrl).toBe("http://netquor-web:3000");
    });
});

describe("sink selection", () => {
    test("the default lead file sits in the data folder (PRICES_DIR)", () => {
        expect(loadConfig({ PRICES_DIR: "/data" }).leadFile).toBe("/data/leads.jsonl");
    });
    test("DATA_DIR is the default data folder when PRICES_DIR is unset; PRICES_DIR wins; LEAD_FILE wins over both", () => {
        expect(loadConfig({ DATA_DIR: "/vol" }).leadFile).toBe("/vol/leads.jsonl");
        expect(loadConfig({ DATA_DIR: "/vol", PRICES_DIR: "/p" }).leadFile).toBe("/p/leads.jsonl");
        expect(loadConfig({ DATA_DIR: "/vol", PRICES_DIR: "" }).leadFile).toBe("/vol/leads.jsonl");
        expect(loadConfig({ DATA_DIR: "/vol", LEAD_FILE: "/x/l.jsonl" }).leadFile).toBe("/x/l.jsonl");
        expect(loadConfig({ DATA_DIR: "  " }).leadFile).toBe(resolve(serverRoot, "data/leads.jsonl"));
    });
    const hook = { LEAD_FORWARD_URL: "https://hooks.example.com/lead", LEAD_FORWARD_SECRET: "s".repeat(32) };
    test("a webhook alone turns the file off", () => { expect(loadConfig(hook)).toMatchObject({ leadFile: "", leadForwardUrl: hook.LEAD_FORWARD_URL }); });
    test("a webhook and a file asked for are both on", () => { expect(loadConfig({ ...hook, LEAD_FILE: "data/x.jsonl" }).leadFile).toBe(resolve(serverRoot, "data/x.jsonl")); });
    test("a webhook needs a secret, and a secret needs a webhook", () => {
        expect(checkConfig({ LEAD_FORWARD_URL: hook.LEAD_FORWARD_URL }).problems.join()).toContain("LEAD_FORWARD_SECRET");
        expect(checkConfig({ LEAD_FORWARD_SECRET: hook.LEAD_FORWARD_SECRET }).problems.join()).toContain("LEAD_FORWARD_URL");
    });
    test("the webhook must be https (http only for localhost)", () => {
        expect(checkConfig({ ...hook, LEAD_FORWARD_URL: "http://hooks.example.com/x" }).problems.join()).toContain("LEAD_FORWARD_URL");
        expect(checkConfig({ ...hook, LEAD_FORWARD_URL: "http://localhost:9/x" }).problems).toEqual([]);
    });
});

describe("problems", () => {
    test("each bad value is named, all at once", () => {
        const { config, problems } = checkConfig({ PORT: "abc", SITE_ORIGIN: "http://www.netquor.com", WEB_INTERNAL_URL: "http://u:p@web:3000/x", RATE_LIMIT_MAX: "0", ALLOWED_ORIGINS: "https://www.netquor.com/path, http://evil.com", });
        expect(config).toBeNull();
        const all = problems.join("\n");
        for (const name of ["PORT", "RATE_LIMIT_MAX", "ALLOWED_ORIGINS entry 1", "ALLOWED_ORIGINS entry 2", "SITE_ORIGIN", "WEB_INTERNAL_URL"]) expect(all).toContain(name);
    });
    test("a secret value never appears in a message", () => {
        const secret = "super-secret-value-123456";
        const { problems } = checkConfig({ LEAD_FORWARD_URL: "not a url", LEAD_FORWARD_SECRET: secret, PORT: secret });
        expect(problems.length).toBeGreaterThan(0);
        expect(problems.join("\n")).not.toContain(secret);
    });
    test("loadConfig throws a ConfigError listing them", () => {
        expect(() => loadConfig({ PORT: "0" })).toThrow(ConfigError);
    });
    test("origins are compared exactly: a trailing slash is tolerated, a path or another scheme is not", () => {
        expect(loadConfig({ ALLOWED_ORIGINS: "https://www.netquor.com/" }).allowedOrigins).toEqual(["https://www.netquor.com"]);
        expect(loadConfig({ ALLOWED_ORIGINS: "http://localhost:8080" }).allowedOrigins).toEqual(["http://localhost:8080"]);
        expect(checkConfig({ ALLOWED_ORIGINS: "http://www.netquor.com" }).config).toBeNull();
    });
    test("SITE_ORIGIN and WEB_INTERNAL_URL: trailing slash tolerated, defaults, bad shapes refused", () => {
        expect(loadConfig({ SITE_ORIGIN: "https://staging.netquor.com/", WEB_INTERNAL_URL: "http://web:3000/" })).toMatchObject({ siteOrigin: "https://staging.netquor.com", webInternalUrl: "http://web:3000" });
        for (const v of ["https://www.netquor.com/path", "ftp://x", "www.netquor.com"]) expect(checkConfig({ SITE_ORIGIN: v }).config).toBeNull();
        for (const v of ["http://web:3000/api", "http://user@web:3000", "web:3000", "http://web:3000?x=1"]) expect(checkConfig({ WEB_INTERNAL_URL: v }).config).toBeNull();
    });
    test("the removed settings do nothing", () => {
        const c = checkConfig({ TRUST_CLOUDFLARE: "true", TRUSTED_PROXY_HEADER: "X-Real-IP", SERVE_STATIC: "true" }).config as unknown as Record<string, unknown>;
        expect(c).not.toBeNull();
        for (const k of ["trustedProxyHeader", "serveStatic", "siteDir", "trustCloudflare"]) expect(k in c).toBe(false);
    });
});
