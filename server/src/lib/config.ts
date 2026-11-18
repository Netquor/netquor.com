// lib/config.ts: settings come from the environment (see .env.example); Bun loads .env by itself. loadConfig reads them when asked, so a test can pass its own, and a bad setting is a clear message that names the variable and never prints its value.
import { resolve } from "node:path";

export const env = (name: string, fallback = ""): string => (process.env[name] ?? fallback).trim();

/** The folder this service lives in (server/), whatever the working directory is. */
export const serverRoot = resolve(import.meta.dir, "../..");

export interface Config {
    port: number;
    host: string;
    /** Browser origins allowed to post the form, exactly as a browser sends them (https://www.netquor.com). */
    allowedOrigins: string[];
    rateLimitMax: number;
    rateLimitWindowMs: number;
    /** Where leads are appended; "" when the file sink is off. */
    leadFile: string;
    /** Where leads are posted; "" when the webhook sink is off. */
    leadForwardUrl: string;
    leadForwardSecret: string;
    /** The public origin of the site (canonical host), used in the sitemap and absolute links. */
    siteOrigin: string;
    /** Where the worker reaches the web process on the private network. */
    webInternalUrl: string;
    /** Largest request body POST /api/lead reads (bytes). */
    maxBodyBytes: number;
    /** A slow sink never holds a request longer than this (ms). */
    deliveryDeadlineMs: number;
}

export class ConfigError extends Error {
    constructor(public readonly problems: string[]) {
        super(`configuration is not usable:\n  ${problems.join("\n  ")}`);
        this.name = "ConfigError";
    }
}

type Source = Record<string, string | undefined>;
const DEFAULT_ORIGINS = "https://www.netquor.com,https://netquor.com";

const isLocal = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "[::1]";

/** Reads and checks everything. Problems name the variable only, never its value (some are secrets). */
export function checkConfig(source: Source = process.env): { config: Config | null; problems: string[] } {
    const problems: string[] = [];
    const get = (name: string, fallback = ""): string => (source[name] ?? fallback).trim();
    const bool = (name: string, fallback: boolean): boolean => {
        const v = get(name).toLowerCase();
        if (v === "") return fallback;
        if (v === "true") return true;
        if (v === "false") return false;
        problems.push(`${name} must be true or false`);
        return fallback;
    };
    const int = (name: string, fallback: number, min: number, max: number): number => {
        const v = get(name);
        if (v === "") return fallback;
        const n = Number(v);
        if (!/^\d+$/.test(v) || n < min || n > max) { problems.push(`${name} must be a whole number from ${min} to ${max}`); return fallback; }
        return n;
    };

    const port = int("PORT", 4200, 1, 65535);
    const host = get("HOST", "127.0.0.1");
    if (!host || /\s/.test(host)) problems.push("HOST must be an address to listen on");

    const allowedOrigins: string[] = [];
    get("ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",").map((s) => s.trim()).filter(Boolean).forEach((entry, i) => {
        try {
            const u = new URL(entry);
            const okScheme = u.protocol === "https:" || (u.protocol === "http:" && isLocal(u.hostname));
            if (!okScheme || u.origin !== entry.replace(/\/$/, "")) throw new Error("not an origin");
            allowedOrigins.push(u.origin);
        } catch { problems.push(`ALLOWED_ORIGINS entry ${i + 1} must be an origin such as https://www.netquor.com (https, no path)`); }
    });
    if (!allowedOrigins.length && !problems.some((p) => p.startsWith("ALLOWED_ORIGINS"))) problems.push("ALLOWED_ORIGINS must list at least one origin");

    const rateLimitMax = int("RATE_LIMIT_MAX", 5, 1, 100000);
    const rateLimitWindowSeconds = int("RATE_LIMIT_WINDOW_SECONDS", 600, 1, 86400);

    const forwardUrl = get("LEAD_FORWARD_URL");
    const forwardSecret = get("LEAD_FORWARD_SECRET");
    if (forwardUrl) {
        try {
            const u = new URL(forwardUrl);
            if (!(u.protocol === "https:" || (u.protocol === "http:" && isLocal(u.hostname)))) throw new Error("scheme");
        } catch { problems.push("LEAD_FORWARD_URL must be an https:// address"); }
        if (forwardSecret.length < 16) problems.push("LEAD_FORWARD_SECRET must be set (16 characters or more) when LEAD_FORWARD_URL is");
    } else if (forwardSecret) {
        problems.push("LEAD_FORWARD_SECRET is set but LEAD_FORWARD_URL is not");
    }
    // The file sink is the default, in the same data folder as the prices (PRICES_DIR, else DATA_DIR; the 'data' volume); it is off only when a webhook is configured and no file was asked for.
    const fileWanted = get("LEAD_FILE");
    const leadFile = fileWanted ? resolve(serverRoot, fileWanted) : forwardUrl ? "" : resolve(serverRoot, get("PRICES_DIR") || get("DATA_DIR") || "data", "leads.jsonl");

    const siteOrigin = get("SITE_ORIGIN", "https://www.netquor.com").replace(/\/$/, "");
    try {
        const u = new URL(siteOrigin);
        if (!(u.protocol === "https:" || (u.protocol === "http:" && isLocal(u.hostname))) || u.origin !== siteOrigin) throw new Error("origin");
    } catch { problems.push("SITE_ORIGIN must be an origin such as https://www.netquor.com (https, no path)"); }
    const webInternalUrl = get("WEB_INTERNAL_URL", "http://netquor-web:3000").replace(/\/$/, "");
    try {
        const u = new URL(webInternalUrl);
        if ((u.protocol !== "http:" && u.protocol !== "https:") || u.username || u.password || u.search || u.hash || (u.pathname !== "/" && u.pathname !== "")) throw new Error("url");
    } catch { problems.push("WEB_INTERNAL_URL must be an http:// or https:// address with no path, credentials or query"); }

    if (problems.length) return { config: null, problems };
    return {
        problems,
        config: {
            port, host, allowedOrigins,
            rateLimitMax, rateLimitWindowMs: rateLimitWindowSeconds * 1000,
            leadFile, leadForwardUrl: forwardUrl, leadForwardSecret: forwardSecret,
            siteOrigin, webInternalUrl,
            maxBodyBytes: 16 * 1024,
            deliveryDeadlineMs: 8000,
        },
    };
}

export function loadConfig(source: Source = process.env): Config {
    const { config, problems } = checkConfig(source);
    if (!config) throw new ConfigError(problems);
    return config;
}
