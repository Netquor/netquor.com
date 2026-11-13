// url.ts: the one validator for every address the pricing code is told to call (PRICING_API_URL, WEB_INTERNAL_URL). https is always fine; plain http only to loopback (or, for the private container network, anywhere when the caller says so). No user name or password in the address (a token goes in PRICING_API_TOKEN, never in the URL). Used by the env check, the fetcher and the worker, so they cannot disagree.
export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

export interface UrlOptions {
    /** "loopback" (default): http only to localhost, 127.0.0.1 or [::1]. "any": http to any host (for the private docker network). */
    plainHttp?: "loopback" | "any";
}

export const validateServiceUrl = (raw: string, o: UrlOptions = {}): UrlCheck => {
    const text = raw.trim();
    if (!text) return { ok: false, reason: "is empty" };
    if (text.length > 2048) return { ok: false, reason: "is too long" };
    let url: URL;
    try { url = new URL(text); } catch { return { ok: false, reason: "is not a valid address" }; }
    if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "must start with https://" };
    if (!url.hostname) return { ok: false, reason: "has no host" };
    if (url.username || url.password) return { ok: false, reason: "must not contain a user name or password" };
    if (url.protocol === "http:" && (o.plainHttp ?? "loopback") === "loopback" && !LOOPBACK.has(url.hostname)) return { ok: false, reason: "must be https:// (http is allowed only for localhost)" };
    return { ok: true, url };
};
