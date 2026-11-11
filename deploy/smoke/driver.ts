// The request side of deploy/smoke.sh. It runs INSIDE a throwaway container on the throwaway network (so it can reach
// netquor-web by name), one phase per invocation: `bun /smoke/driver.ts <phase>`. The shell drives docker between phases.
import { createHmac } from "node:crypto";

const WEB = "http://netquor-web:3000";
const TRUSTED = "http://edge-trusted"; // a Caddy that trusts CF-Connecting-IP from this network, like the real edge does for Cloudflare
const UNTRUSTED = "http://edge-untrusted"; // the same routing, but the peer is not a trusted proxy
const SECRET = process.env.SMOKE_SECRET ?? "";
const phase = process.argv[2];

let failures = 0;
const check = async (name: string, fn: () => void | Promise<void>) => {
    try { await fn(); console.log(`  ok    ${name}`); } catch (e) { failures++; console.log(`  FAIL  ${name}\n        ${e instanceof Error ? e.message : e}`); }
};
const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const eq = <T>(a: T, b: T, m: string) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)?.slice(0, 300)}, wanted ${JSON.stringify(b)?.slice(0, 300)}`);
const priceOf = (html: string, key: string) => new RegExp(`data-price="${key.replace(/\./g, "\\.")}"[^>]*>([^<]*)<`).exec(html)?.[1];
const page = async (base: string, path = "/", headers: Record<string, string> = {}) => { const r = await fetch(base + path, { headers, redirect: "manual" }); return { r, body: await r.text() }; };
const detail = async () => (await (await fetch(`${WEB}/health/detail`)).json()) as { prices: { version: number; lastIngestSource: string | null; lastPollOkAt: string | null } };
const sign = (body: string) => { const t = Math.floor(Date.now() / 1000); return `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex")}`; };
const until = async (what: string, fn: () => Promise<boolean>, seconds: number) => {
    const end = Date.now() + seconds * 1000;
    while (Date.now() < end) { try { if (await fn()) return; } catch { /* retry */ } await Bun.sleep(1000); }
    throw new Error(`timed out after ${seconds} s waiting for ${what}`);
};
const lead = (base: string, body: object, headers: Record<string, string> = {}) =>
    fetch(`${base}/api/lead`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", origin: "https://www.netquor.com", ...headers } });

const SEED_VERSION = Number(process.env.SEED_VERSION);

if (phase === "boot") {
    await check("web: / is 200 and shows the image's seed price ($5.95)", async () => { const { r, body } = await page(WEB); eq(r.status, 200, "status"); eq(priceOf(body, "fleet.mac.month"), "$5.95", "price"); });
    await check("web: /health is 200", async () => { const r = await fetch(`${WEB}/health`); eq(r.status, 200, "status"); });
    await check("web: /health/detail reports the seed version", async () => eq((await detail()).prices.version, SEED_VERSION, "version"));
    await check("edge mimic: / is 200 through the proxy", async () => eq((await page(TRUSTED)).r.status, 200, "status"));
    await check("a private path is not served (/server/.env, /Dockerfile, /web/package.json)", async () => {
        for (const p of ["/server/.env", "/Dockerfile", "/web/package.json", "/llms.template.txt"]) { const r = await fetch(WEB + p); assert(r.status === 404, `${p} answered ${r.status}`); }
    });
    await check("every asset the pages need is served from the image (images, manifest, calculator scripts) and the legacy CSS and scripts are not", async () => {
        for (const p of ["/favicon.svg", "/brand/og.png", "/fleet/favicon.svg", "/fleet/img/console.png", "/site.webmanifest", "/subnet-calc.js", "/cost-calc.js", "/bundle-calc.js"]) { const r = await fetch(WEB + p); assert(r.status === 200, `${p} answered ${r.status}`); }
        for (const p of ["/nq.css", "/nav.css", "/nav.js", "/fx.js", "/analytics.js", "/fleet/site.css", "/fleet/site.js", "/readiness-data.json"]) { const r = await fetch(WEB + p); assert(r.status === 404, `${p} answered ${r.status}`); }
    });
} else if (phase === "worker") {
    await check("worker delivery: the API's version 3 reaches web without any webhook", async () => until("version 3", async () => (await detail()).prices.version === 3, 40));
    await check("web: the next page request shows the API price ($6.40), source poll", async () => {
        eq(priceOf((await page(WEB)).body, "fleet.mac.month"), "$6.40", "price"); eq((await detail()).prices.lastIngestSource, "poll", "source");
    });
} else if (phase === "webhook") {
    const seed = JSON.parse(await Bun.file("/app/server/data/prices.seed.json").text());
    const next = { ...seed, version: 4, updatedAt: new Date().toISOString(), source: "webhook", prices: { ...seed.prices, "fleet.mac.month": { ...seed.prices["fleet.mac.month"], amountCents: 650 } } };
    const body = JSON.stringify({ snapshot: next });
    await check("an unsigned webhook is refused (401) and the price stays", async () => {
        eq((await fetch(`${WEB}/hooks/pricing`, { method: "POST", body, headers: { "content-type": "application/json" } })).status, 401, "status");
        eq(priceOf((await page(WEB)).body, "fleet.mac.month"), "$6.40", "price");
    });
    await check("a signed webhook (version 4, $6.50) is accepted", async () => {
        const r = await fetch(`${WEB}/hooks/pricing`, { method: "POST", body, headers: { "content-type": "application/json", "x-netquor-signature": sign(body) } });
        eq(r.status, 200, `status ${await r.clone().text()}`);
    });
    await check("the very next page request, through the edge mimic, shows $6.50", async () => eq(priceOf((await page(TRUSTED)).body, "fleet.mac.month"), "$6.50", "price"));
    await check("a stale version is refused (409) and does not roll the price back", async () => {
        const old = JSON.stringify({ snapshot: { ...next, version: 2 } });
        const r = await fetch(`${WEB}/hooks/pricing`, { method: "POST", body: old, headers: { "content-type": "application/json", "x-netquor-signature": sign(old) } });
        eq(r.status, 409, "status"); eq(priceOf((await page(WEB)).body, "fleet.mac.month"), "$6.50", "price");
    });
} else if (phase === "persisted") {
    await check("after a restart of web: version 4 and $6.50 are still in force (read from the volume)", async () => {
        eq((await detail()).prices.version, 4, "version"); eq(priceOf((await page(WEB)).body, "fleet.mac.month"), "$6.50", "price");
    });
    await check("after the restart the worker does not roll web back (API is still version 3)", async () => { await Bun.sleep(3000); eq((await detail()).prices.version, 4, "version"); });
} else if (phase === "lead") {
    await check("/api/lead through the edge mimic answers 202", async () => {
        const r = await lead(TRUSTED, { name: "Smoke Test", email: "smoke@example.com", message: "hello from the container smoke test" }, { "cf-connecting-ip": "198.51.100.10" });
        eq(r.status, 202, `status ${await r.clone().text()}`);
    });
    await check("a honeypot post is answered like success and stores nothing (checked by the shell)", async () => {
        const r = await lead(TRUSTED, { name: "Bot", email: "bot@example.com", website: "http://spam.example" }, { "cf-connecting-ip": "198.51.100.11" });
        eq(r.status, 200, "status"); eq(await r.json(), { ok: true }, "body");
    });
    await check("through the TRUSTED edge, a client-sent X-Real-IP is overwritten: 7 posts as one visitor with 7 spoofed X-Real-IP values are limited (429)", async () => {
        const codes: number[] = [];
        for (let i = 0; i < 7; i++) codes.push((await lead(TRUSTED, { name: "R", email: "r@example.com", website: "x" }, { "cf-connecting-ip": "198.51.100.77", "x-real-ip": `203.0.113.${i + 1}`, "x-forwarded-for": `203.0.113.${i + 20}` })).status);
        assert(codes.slice(0, 5).every((c) => c === 200) && codes[6] === 429, `codes ${codes.join(",")}`);
    });
    await check("through the same edge, a different visitor (another CF-Connecting-IP) is not limited", async () => {
        eq((await lead(TRUSTED, { name: "O", email: "o@example.com", website: "x" }, { "cf-connecting-ip": "198.51.100.78" })).status, 200, "status");
    });
    await check("through an edge that does NOT trust this peer, CF-Connecting-IP and X-Real-IP are both ignored: 7 posts with 7 different values share one bucket (429)", async () => {
        const codes: number[] = [];
        for (let i = 0; i < 7; i++) codes.push((await lead(UNTRUSTED, { name: "U", email: "u@example.com", website: "x" }, { "cf-connecting-ip": `198.51.100.${100 + i}`, "x-real-ip": `203.0.113.${100 + i}` })).status);
        assert(codes.slice(0, 5).every((c) => c === 200) && codes[6] === 429, `codes ${codes.join(",")}`);
    });
    await check("a spoofed x-nq-client-ip header from a client never picks the bucket (the web hook overwrites it): 7 posts, 7 values, still limited", async () => {
        const codes: number[] = [];
        for (let i = 0; i < 7; i++) codes.push((await lead(TRUSTED, { name: "N", email: "n@example.com", website: "x" }, { "cf-connecting-ip": "198.51.100.90", "x-nq-client-ip": `192.0.2.${i + 1}` })).status);
        assert(codes[6] === 429, `codes ${codes.join(",")}`);
    });
} else if (phase === "heartbeat") {
    const first = (await detail()).prices.lastPollOkAt;
    console.log(`  (lastPollOkAt before waiting: ${first}; the worker polls every 60 s)`);
    await check("the worker's second poll gets a 304 from the fake API and sends a poll.ok heartbeat: lastPollOkAt advances, version stays 4", async () => {
        await until("lastPollOkAt to advance", async () => { const d = await detail(); return d.prices.lastPollOkAt !== null && d.prices.lastPollOkAt !== first; }, 100);
        eq((await detail()).prices.version, 4, "version");
    });
    await check("the fake API saw If-None-Match answered 304 and the bearer token", async () => {
        const s = (await (await fetch("http://fakeapi:9100/__stats")).json()) as { total: number; notModified: number; withBearer: number };
        assert(s.notModified >= 1 && s.withBearer === s.total, JSON.stringify(s));
    });
} else { console.error(`unknown phase ${phase}`); process.exit(2); }

if (failures) { console.log(`${failures} check(s) failed in phase ${phase}`); process.exit(1); }
