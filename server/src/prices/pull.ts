// pull.ts: fetching the snapshot from the Netquor API (PRICING_API_URL). Shared by the worker (the backup path, which delivers the result to the web process) and by the web process (when nudged). The address is validated first, redirects are refused, the whole exchange has a 10 s budget, and the body is read as a stream and abandoned the moment it passes the byte cap.
import { validateServiceUrl } from "./url";

export const MAX_API_BYTES = 256 * 1024;

export type FetchOutcome =
    | { kind: "changed"; candidate: unknown; etag: string | null }
    | { kind: "not_modified" }
    | { kind: "failed"; reason: string };

export type Fetcher = (url: string, init: { headers: Record<string, string>; signal: AbortSignal; redirect: "error" }) => Promise<Response>;

export interface FetchDeps {
    url: string;
    token?: string;
    fetch: Fetcher;
    timeoutMs?: number;
    maxBytes?: number;
}

/** The API may send the snapshot bare or as { snapshot }. Anything else a wrapper carries is ignored: only a signed operator body can accept a large change. */
export const unwrapPayload = (payload: unknown): unknown =>
    typeof payload === "object" && payload !== null && !Array.isArray(payload) && "snapshot" in payload && !("prices" in payload) ? (payload as { snapshot: unknown }).snapshot : payload;

/** Reads at most maxBytes; null when the body is longer (the stream is cancelled at once). */
export const readBodyCapped = async (res: Response, maxBytes: number, signal?: AbortSignal): Promise<Uint8Array | null> => {
    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) { await res.body?.cancel().catch(() => {}); return null; }
    if (!res.body) return new Uint8Array();
    const reader = res.body.getReader();
    // An abort (timeout, shutdown) stops a body that has stalled: cancelling the reader ends a pending read.
    const onAbort = () => { void reader.cancel().catch(() => {}); };
    signal?.addEventListener("abort", onAbort);
    if (signal?.aborted) onAbort();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try { for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel().catch(() => {}); return null; }
        chunks.push(value);
    } } finally { signal?.removeEventListener("abort", onAbort); }
    if (signal?.aborted) throw new Error("aborted");
    return Buffer.concat(chunks);
};

export const createFetcher = (d: FetchDeps) => {
    const timeoutMs = d.timeoutMs ?? 10_000, maxBytes = d.maxBytes ?? MAX_API_BYTES;
    return async (o: { etag?: string; signal?: AbortSignal } = {}): Promise<FetchOutcome> => {
        const checked = validateServiceUrl(d.url);
        if (!checked.ok) return { kind: "failed", reason: d.url ? `PRICING_API_URL ${checked.reason}` : "PRICING_API_URL is not set" };
        const headers: Record<string, string> = { accept: "application/json" };
        if (d.token) headers.authorization = `Bearer ${d.token}`;
        if (o.etag) headers["if-none-match"] = o.etag;
        const ctl = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs);
        const onAbort = () => ctl.abort();
        o.signal?.addEventListener("abort", onAbort);
        if (o.signal?.aborted) ctl.abort();
        try {
            const res = await d.fetch(checked.url.href, { headers, signal: ctl.signal, redirect: "error" });
            if (res.status === 304) { await res.body?.cancel().catch(() => {}); return { kind: "not_modified" }; }
            if (res.status !== 200) { await res.body?.cancel().catch(() => {}); return { kind: "failed", reason: `the API answered ${res.status}` }; }
            const bytes = await readBodyCapped(res, maxBytes, ctl.signal);
            if (bytes === null) return { kind: "failed", reason: "the API answer is too large" };
            let text: string;
            try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { return { kind: "failed", reason: "the API answer is not valid UTF-8" }; }
            let payload: unknown;
            try { payload = JSON.parse(text); } catch { return { kind: "failed", reason: "the API answer is not JSON" }; }
            return { kind: "changed", candidate: unwrapPayload(payload), etag: res.headers.get("etag") };
        } catch {
            if (o.signal?.aborted) return { kind: "failed", reason: "stopped" };
            return { kind: "failed", reason: timedOut ? `no answer within ${Math.round(timeoutMs / 1000)} s` : "could not reach the API" };
        } finally {
            clearTimeout(timer);
            o.signal?.removeEventListener("abort", onAbort);
        }
    };
};

export type Fetch = ReturnType<typeof createFetcher>;
