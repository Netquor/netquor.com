// worker.ts: the price poll worker, the BACKUP update path (the webhook is the primary). A separate process from the same image ("bun server/src/worker.ts"). When a heartbeat shows the web process is behind the API (for example it restarted from the seed), the worker drops its ETag and polls again at once instead of waiting a whole interval. Every PRICING_POLL_SECONDS it asks the Netquor API for the snapshot (If-None-Match, optional bearer token) and DELIVERS what it got to the web process with a signed POST to WEB_INTERNAL_URL/hooks/pricing: the snapshot on a 200, a { event: "poll.ok" } heartbeat on a 304. The web process is the single writer; this process writes nothing. It never exits on a failure (it backs off, at most an hour, with jitter); it stops retrying a version the web refused (409, or 422 change_too_large) until a newer version appears; SIGTERM ends it cleanly.
import { readFileSync } from "node:fs";
import { buildCandidate, createCatalogPuller, DEFAULT_CATALOG_INTERVAL_SECONDS, fetchPlan, parseCatalogMap, sourcesFingerprint, type CatalogMap, type CatalogPuller, type CatalogSource } from "./prices/catalog";
import { apiToken, apiUrl, catalogMapFile, catalogProducts, catalogUrl, env, webInternalUrl, webhookSecrets } from "./prices/env";
import { validateSnapshot } from "./prices/snapshot";
import { createFetcher, readBodyCapped, type Fetch } from "./prices/pull";
import { backoffMs, parseIntervalSeconds, realClock, type Clock } from "./prices/schedule";
import { signBody } from "./prices/signature";
import { validateServiceUrl } from "./prices/url";

export interface WorkerDeps {
    /** Fetches the API (createFetcher). */
    api: Fetch;
    /** The web process, e.g. http://netquor-web:3000 */
    webUrl: string;
    /** Signs deliveries (the current PRICING_WEBHOOK_SECRET). */
    secret: string;
    /** Sends the signed POST. */
    post: Poster;
    intervalSeconds: number;
    clock: Clock;
    random: () => number;
    /** Milliseconds since the epoch. */
    now: () => number;
    log: (line: string) => void;
    timeoutMs?: number;
}

export type Poster = (url: string, init: { method: "POST"; body: string; headers: Record<string, string>; signal: AbortSignal; redirect: "error" }) => Promise<Response>;

type Held = { kind: "version"; version: number } | { kind: "content"; fingerprint: string };
type Delivery = { ok: true; status: string; version?: number } | { ok: false; httpStatus: number; error: string };

export const createWorker = (d: WorkerDeps) => {
    const intervalMs = d.intervalSeconds * 1000;
    const timeoutMs = d.timeoutMs ?? 10_000;
    const endpoint = new URL("/hooks/pricing", d.webUrl).href;
    let etag: string | undefined;
    let failures = 0;
    let held: Held | null = null;
    /** The version of the last snapshot the API sent in a 200 (null until one). */
    let apiVersion: number | null = null;
    /** The (API, web) version pair a heal was last tried for, so a web that stays behind cannot make the worker spin. */
    let healedPair = "";

    /** One signed POST to the web process. Resolves to the web's answer; throws on a network failure or timeout. */
    const send = async (body: unknown, signal: AbortSignal): Promise<Delivery> => {
        const raw = JSON.stringify(body);
        const t = Math.floor(d.now() / 1000);
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), timeoutMs);
        const onAbort = () => ctl.abort();
        signal.addEventListener("abort", onAbort);
        try {
            const res = await d.post(endpoint, { method: "POST", body: raw, headers: { "content-type": "application/json", "x-netquor-signature": `t=${t},v1=${signBody(d.secret, t, raw)}` }, signal: ctl.signal, redirect: "error" });
            const bytes = await readBodyCapped(res, 16 * 1024, ctl.signal);
            let json: { status?: string; version?: unknown; error?: string } = {};
            try { json = JSON.parse(Buffer.from(bytes ?? new Uint8Array()).toString("utf8")); } catch { /* empty or not JSON */ }
            if (res.status === 200) return { ok: true, status: json.status ?? "ok", version: typeof json.version === "number" ? json.version : undefined };
            return { ok: false, httpStatus: res.status, error: json.error ?? "" };
        } finally { clearTimeout(timer); signal.removeEventListener("abort", onAbort); }
    };

    const fail = (line: string): number => {
        failures++;
        const delay = backoffMs(intervalMs, failures, d.random);
        d.log(`prices-worker: ${line}; retry in ${Math.round(delay / 1000)} s`);
        return delay;
    };

    /** The heartbeat: a problem sentence, or null with the web's current snapshot version when it said so. */
    const heartbeat = async (signal: AbortSignal): Promise<{ problem: string | null; webVersion?: number }> => {
        try {
            const r = await send({ event: "poll.ok" }, signal);
            return r.ok ? { problem: null, webVersion: r.version } : { problem: `the web process refused the heartbeat (${r.httpStatus})` };
        } catch { return { problem: signal.aborted ? "stopped" : "could not reach the web process" }; }
    };

    /** One poll. Logs one line and returns how long to wait. */
    const step = async (signal: AbortSignal): Promise<{ delayMs: number }> => {
        const r = await d.api({ etag, signal });
        if (signal.aborted) return { delayMs: intervalMs };
        if (r.kind === "failed") return { delayMs: fail(`poll failed: ${r.reason}`) };

        if (r.kind === "not_modified") {
            const { problem, webVersion } = await heartbeat(signal);
            if (problem) return { delayMs: fail(problem) };
            failures = 0;
            // The API has nothing newer than what we last saw, but the web process reports an older version (restarted from the seed, a lost volume): forget the ETag and fetch and deliver again now. Once per (API, web) pair; if the web still lags afterwards it is refusing, and the normal interval applies.
            if (apiVersion !== null && webVersion !== undefined && webVersion < apiVersion && !held && healedPair !== `${apiVersion}:${webVersion}`) {
                healedPair = `${apiVersion}:${webVersion}`;
                etag = undefined;
                d.log(`prices-worker: the web process is at version ${webVersion} but the API is at ${apiVersion}; delivering again now`);
                return { delayMs: 0 };
            }
            d.log("prices-worker: unchanged");
            return { delayMs: intervalMs };
        }

        const cand = r.candidate as { version?: unknown } | null;
        const version = typeof cand === "object" && cand !== null && typeof cand.version === "number" ? cand.version : null;
        if (version !== null) apiVersion = version;
        const fingerprint = JSON.stringify(r.candidate);
        if (held && ((held.kind === "version" && version !== null && version <= held.version) || (held.kind === "content" && held.fingerprint === fingerprint))) {
            const { problem } = await heartbeat(signal);
            if (problem) return { delayMs: fail(problem) };
            failures = 0;
            etag = r.etag ?? undefined;
            d.log(`prices-worker: still holding version ${version ?? "?"}: the web process refused it, waiting for a newer version`);
            return { delayMs: intervalMs };
        }

        let out: Delivery;
        try { out = await send({ snapshot: r.candidate, via: "poll" }, signal); }
        catch { return signal.aborted ? { delayMs: intervalMs } : { delayMs: fail("could not reach the web process") }; }

        if (out.ok) {
            failures = 0; held = null; etag = r.etag ?? undefined;
            d.log(`prices-worker: delivered version ${out.version ?? version ?? "?"} (${out.status})`);
            return { delayMs: intervalMs };
        }
        if (out.httpStatus === 409 || (out.httpStatus === 422 && out.error === "change_too_large")) {
            held = { kind: "version", version: version ?? 0 };
            failures = 0; etag = r.etag ?? undefined;
            d.log(`prices-worker: the web process refused version ${version ?? "?"} (${out.httpStatus} ${out.error || "conflict"}); not retrying it until a newer version appears (an operator can accept it with scripts/send-prices.ts)`);
            return { delayMs: intervalMs };
        }
        if (out.httpStatus === 422) {
            held = { kind: "content", fingerprint };
            failures = 0; etag = r.etag ?? undefined;
            d.log(`prices-worker: the web process says the API snapshot is invalid (422 ${out.error}); not retrying the same content`);
            return { delayMs: intervalMs };
        }
        return { delayMs: fail(`the web process answered ${out.httpStatus}${out.error ? ` ${out.error}` : ""}`) };
    };

    /** Polls now, then after each delay, until the signal aborts. */
    const run = async (signal: AbortSignal): Promise<void> => {
        while (!signal.aborted) {
            let delayMs: number;
            try { ({ delayMs } = await step(signal)); }
            catch { delayMs = fail("unexpected error"); }
            if (signal.aborted) break;
            await d.clock.sleep(delayMs, signal);
        }
        d.log("prices-worker: stopped");
    };

    return { step, run, state: () => ({ failures, held, etag }) };
};

export interface CatalogWorkerDeps {
    puller: CatalogPuller;
    products: string[];
    map: CatalogMap;
    webUrl: string;
    secret: string;
    post: Poster;
    /** GETs the web process (its current snapshot at /api/prices). */
    get: (url: string, init: { headers: Record<string, string>; signal: AbortSignal; redirect: "error" }) => Promise<Response>;
    intervalSeconds: number;
    clock: Clock;
    random: () => number;
    now: () => number;
    log: (line: string) => void;
    timeoutMs?: number;
}

/** Catalog mode (NETQUOR_CATALOG_URL): each cycle reads the web process's snapshot, checks every product's price book (conditional GET), builds a candidate and delivers it by the same signed webhook; with nothing to change it sends the poll.ok heartbeat carrying the book versions and checksums. Writes nothing itself. */
export const createCatalogWorker = (d: CatalogWorkerDeps) => {
    const intervalMs = d.intervalSeconds * 1000;
    const timeoutMs = d.timeoutMs ?? 10_000;
    const hook = new URL("/hooks/pricing", d.webUrl).href, snapshotUrl = new URL("/api/prices", d.webUrl).href;
    let failures = 0;
    /** The book fingerprint the web refused (422); not sent again until a book changes. */
    let held: string | null = null;
    const warned = new Set<string>();

    const timed = async <T>(signal: AbortSignal, run: (s: AbortSignal) => Promise<T>): Promise<T> => {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), timeoutMs);
        const onAbort = () => ctl.abort();
        signal.addEventListener("abort", onAbort);
        try { return await run(ctl.signal); } finally { clearTimeout(timer); signal.removeEventListener("abort", onAbort); }
    };
    const send = (body: unknown, signal: AbortSignal) => timed(signal, async (s) => {
        const raw = JSON.stringify(body);
        const t = Math.floor(d.now() / 1000);
        const res = await d.post(hook, { method: "POST", body: raw, headers: { "content-type": "application/json", "x-netquor-signature": `t=${t},v1=${signBody(d.secret, t, raw)}` }, signal: s, redirect: "error" });
        const bytes = await readBodyCapped(res, 16 * 1024, s);
        let json: { status?: string; version?: unknown; error?: string } = {};
        try { json = JSON.parse(Buffer.from(bytes ?? new Uint8Array()).toString("utf8")); } catch { /* empty or not JSON */ }
        return { httpStatus: res.status, status: json.status ?? "ok", version: typeof json.version === "number" ? json.version : undefined, error: json.error ?? "" };
    });
    const webSnapshot = (signal: AbortSignal) => timed(signal, async (s) => {
        const res = await d.get(snapshotUrl, { headers: { accept: "application/json" }, signal: s, redirect: "error" });
        if (res.status !== 200) { await res.body?.cancel().catch(() => {}); return { problem: `the web process answered ${res.status} for its snapshot` }; }
        const bytes = await readBodyCapped(res, 256 * 1024, s);
        if (bytes === null) return { problem: "the web snapshot is too large" };
        try { const v = validateSnapshot(JSON.parse(Buffer.from(bytes).toString("utf8"))); return v.ok ? { snapshot: v.snapshot } : { problem: "the web snapshot is invalid" }; } catch { return { problem: "the web snapshot is not JSON" }; }
    });
    const fail = (line: string, floorMs = 0): number => {
        failures++;
        const delay = Math.max(floorMs, backoffMs(intervalMs, failures, d.random));
        d.log(`prices-worker: ${line}; retry in ${Math.round(delay / 1000)} s`);
        return delay;
    };

    const step = async (signal: AbortSignal): Promise<{ delayMs: number }> => {
        let web: Awaited<ReturnType<typeof webSnapshot>>;
        try { web = await webSnapshot(signal); } catch { return signal.aborted ? { delayMs: intervalMs } : { delayMs: fail("could not reach the web process") }; }
        if (!web.snapshot) return { delayMs: fail(web.problem ?? "the web snapshot could not be read") };
        const current = web.snapshot;

        const report = await d.puller.pull(d.products, { signal });
        if (signal.aborted) return { delayMs: intervalMs };
        const failed = Object.entries(report.results).filter(([, r]) => r.kind === "failed" || r.kind === "rate_limited");
        const retryFloor = Math.max(0, ...failed.map(([, r]) => (r.kind === "rate_limited" ? r.retryAfterMs : 0)));
        for (const [p, r] of failed) if ("reason" in r) d.log(`prices-worker: ${p}: ${r.reason}; its prices are left unchanged`);
        if (Object.keys(report.books).length === 0) return { delayMs: fail("no price book could be read", retryFloor) };

        const built = buildCandidate(current, report.books, d.map, { now: new Date(d.now()) });
        for (const w of built.warnings) if (!warned.has(w)) { warned.add(w); d.log(`prices-worker: ${w}`); }
        const sources: Record<string, CatalogSource> = {};
        for (const p of Object.keys(report.books)) sources[p] = { ...built.sources[p], fetchedAt: report.checkedAt[p] };
        const after = (ms: number) => Math.max(ms, retryFloor);

        const heartbeat = async (note: string): Promise<{ delayMs: number }> => {
            try {
                const r = await send({ event: "poll.ok", sources }, signal);
                if (r.httpStatus !== 200) return { delayMs: fail(`the web process refused the heartbeat (${r.httpStatus})`) };
            } catch { return signal.aborted ? { delayMs: intervalMs } : { delayMs: fail("could not reach the web process") }; }
            failures = 0;
            d.log(`prices-worker: ${note}`);
            return { delayMs: after(intervalMs) };
        };

        if (!built.candidate) return heartbeat("unchanged");
        const fp = sourcesFingerprint(built.sources);
        if (held === fp) return heartbeat("still holding a change the web process refused (change_too_large); waiting for the price book to change, or an operator can accept it with scripts/send-prices.ts --allow-large");

        let out: Awaited<ReturnType<typeof send>>;
        try { out = await send({ snapshot: built.candidate, via: "poll", sources }, signal); }
        catch { return signal.aborted ? { delayMs: intervalMs } : { delayMs: fail("could not reach the web process") }; }
        const keys = built.changes.map((c) => `${c.key} ${c.from}->${c.to}`).join(", ");
        if (out.httpStatus === 200) { failures = 0; held = null; d.log(`prices-worker: delivered version ${out.version ?? built.candidate.version} (${out.status}): ${keys}`); return { delayMs: after(intervalMs) }; }
        if (out.httpStatus === 409) { failures = 0; d.log(`prices-worker: the web process moved on (409 ${out.error || "conflict"}); re-reading its snapshot next cycle`); return { delayMs: after(intervalMs) }; }
        if (out.httpStatus === 422) {
            failures = 0;
            if (held !== fp) { held = fp; d.log(`prices-worker: the web process refused the change (422 ${out.error}) for ${fp}: ${keys}; not retrying until a price book changes. If it is right, an operator can accept it with scripts/send-prices.ts --allow-large`); }
            return { delayMs: after(intervalMs) };
        }
        return { delayMs: fail(`the web process answered ${out.httpStatus}${out.error ? ` ${out.error}` : ""}`) };
    };

    const run = async (signal: AbortSignal): Promise<void> => {
        while (!signal.aborted) {
            let delayMs: number;
            try { ({ delayMs } = await step(signal)); } catch { delayMs = fail("unexpected error"); }
            if (signal.aborted) break;
            await d.clock.sleep(delayMs, signal);
        }
        d.log("prices-worker: stopped");
    };
    return { step, run, state: () => ({ failures, held }) };
};

const log = (line: string) => console.log(`${new Date().toISOString()} ${line}`);

async function main(): Promise<void> {
    const stop = new AbortController();
    for (const sig of ["SIGTERM", "SIGINT"] as const) process.on(sig, () => { log(`prices-worker: ${sig} received`); stop.abort(); });
    const idle = async (why: string) => {
        log(`prices-worker: ${why}; polling is off`);
        // A pending promise alone does not keep the process alive; without this a container would exit and be restarted in a loop.
        const keepAlive = setInterval(() => {}, 1 << 30);
        await new Promise<void>((resolve) => stop.signal.addEventListener("abort", () => resolve()));
        clearInterval(keepAlive);
    };
    if (catalogUrl()) {
        const cat = validateServiceUrl(catalogUrl());
        if (!cat.ok) return idle(`NETQUOR_CATALOG_URL ${cat.reason}`);
        const web = validateServiceUrl(webInternalUrl(), { plainHttp: "any" });
        if (!web.ok) return idle(`WEB_INTERNAL_URL ${web.reason}`);
        const secret = webhookSecrets(process.env, log)[0];
        if (!secret) return idle("PRICING_WEBHOOK_SECRET is not set (or is too short), so deliveries cannot be signed");
        let map: CatalogMap;
        try { map = parseCatalogMap(JSON.parse(readFileSync(catalogMapFile(), "utf8"))); } catch (e) { return idle(e instanceof Error ? e.message : "the catalog map could not be read"); }
        const { products: wanted, invalid } = catalogProducts();
        if (invalid.length) log(`prices-worker: ignoring invalid NETQUOR_CATALOG_PRODUCTS entries (${invalid.length})`);
        const products = fetchPlan(map, wanted);
        if (!products.length) return idle("none of NETQUOR_CATALOG_PRODUCTS is in the catalog map");
        if (apiUrl()) log("prices-worker: NETQUOR_CATALOG_URL and PRICING_API_URL are both set; catalog mode wins and PRICING_API_URL is not used");
        const intervalSeconds = parseIntervalSeconds(env("PRICING_POLL_SECONDS", String(DEFAULT_CATALOG_INTERVAL_SECONDS)));
        log(`prices-worker: catalog mode, ${products.join(", ")}, every ${intervalSeconds} s, delivering to ${web.url.origin}`);
        await createCatalogWorker({
            puller: createCatalogPuller({ baseUrl: cat.url.href, fetch: (u, i) => fetch(u, i), now: Date.now }),
            products, map, webUrl: web.url.origin, secret, post: (u, i) => fetch(u, i), get: (u, i) => fetch(u, i),
            intervalSeconds, clock: realClock, random: Math.random, now: Date.now, log,
        }).run(stop.signal);
        return;
    }
    const api = validateServiceUrl(apiUrl());
    if (!apiUrl()) return idle("PRICING_API_URL is not set");
    if (!api.ok) return idle(`PRICING_API_URL ${api.reason}`);
    const web = validateServiceUrl(webInternalUrl(), { plainHttp: "any" });
    if (!web.ok) return idle(`WEB_INTERNAL_URL ${web.reason}`);
    const secret = webhookSecrets(process.env, log)[0];
    if (!secret) return idle("PRICING_WEBHOOK_SECRET is not set (or is too short), so deliveries cannot be signed");
    const intervalSeconds = parseIntervalSeconds(env("PRICING_POLL_SECONDS"));
    log(`prices-worker: polling every ${intervalSeconds} s, delivering to ${web.url.origin}`);
    await createWorker({
        api: createFetcher({ url: api.url.href, token: apiToken() || undefined, fetch: (url, init) => fetch(url, init) }),
        webUrl: web.url.origin, secret, post: (url, init) => fetch(url, init),
        intervalSeconds, clock: realClock, random: Math.random, now: Date.now, log,
    }).run(stop.signal);
}

if (import.meta.main) main().then(() => process.exit(0), (e) => { console.error("prices-worker could not start:", e instanceof Error ? e.message : e); process.exit(1); });
