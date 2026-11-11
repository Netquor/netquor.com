// smoke.ts: builds the app, starts the BUILT server under Bun on a free loopback port with a temp data folder, a temp seed and a temp copy of the legacy site, and checks the behaviour that matters end to end. Run with `bun run smoke`. Touches nothing outside temp folders; secrets here are throwaway test values.
import { createHmac } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const web = resolve(import.meta.dir, "..");
const repo = resolve(web, "..");
const SECRET = "smoke-test-secret-0123456789abcdef";
const CANARY = "CANARY-PRIVATE-DO-NOT-SERVE";

let failures = 0;
const check = async (name: string, fn: () => void | Promise<void>) => {
    try { await fn(); console.log(`  ok    ${name}`); } catch (e) { failures++; console.log(`  FAIL  ${name}\n        ${e instanceof Error ? e.message : e}`); }
};
const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };
const eq = <T>(a: T, b: T, msg: string) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)?.slice(0, 300)}, wanted ${JSON.stringify(b)?.slice(0, 300)}`);

// 1. build
console.log("build");
const built = Bun.spawnSync(["bun", "run", "build"], { cwd: web, stdout: "ignore", stderr: "inherit" });
if (built.exitCode !== 0) { console.error("build failed"); process.exit(1); }

// 2. temp world: data folder, seed, a copy of the legacy site (what the image holds at /app/legacy) with private canaries planted around it
const root = mkdtempSync(join(tmpdir(), "nq-smoke-"));
const dataDir = join(root, "data"), legacy = join(root, "legacy");
mkdirSync(dataDir); mkdirSync(legacy);
for (const e of readdirSync(repo, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    if (e.isFile()) cpSync(join(repo, e.name), join(legacy, e.name));
    else if (e.name === "brand" || e.name === "fleet") cpSync(join(repo, e.name), join(legacy, e.name), { recursive: true });
}
for (const p of ["server/.env", "server/src/secret.ts", ".git/config", ".env", "tools/secret.txt", "mockups/x.html", ".agents/note.md", "deploy/x.yml", "web/.env", "brand/.hidden.png", "private.html", "notes.template.txt"]) {
    mkdirSync(join(legacy, p, ".."), { recursive: true });
    writeFileSync(join(legacy, p), CANARY);
}
// The repository's own fleet.html may not carry price markers yet; the copy gets one so the price flow is exercised on it too.
let fleetPatched = false;
{
    const f = join(legacy, "fleet.html");
    const html = readFileSync(f, "utf8");
    if (!/data-price="fleet\.mac\.month"/.test(html)) {
        const patched = html.replace(/<strong>\$5\.95<\/strong> per Mac \/ month/, '<strong data-price="fleet.mac.month" data-fmt="usd">$5.95</strong> per Mac / month');
        assert(patched !== html, "smoke: could not place a price marker in the copy of fleet.html");
        writeFileSync(f, patched);
        fleetPatched = true;
    }
}
const seed = JSON.parse(readFileSync(join(repo, "server/data/prices.seed.json"), "utf8"));
seed.prices["fleet.mac.month"].amountCents = 612; // differs from every baked-in page text, so a stamped value can only have come from the seed
const seedFile = join(root, "seed.json");
writeFileSync(seedFile, JSON.stringify(seed, null, 2) + "\n");

const probe = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response("") });
const port = probe.port as number; probe.stop(true);
const base = `http://127.0.0.1:${port}`;
const server = Bun.spawn(["bun", "build/index.js"], {
    cwd: web,
    env: {
        PATH: process.env.PATH ?? "", HOME: root,
        PORT: String(port), HOST: "127.0.0.1", ORIGIN: base, ADDRESS_HEADER: "X-Real-IP",
        LEGACY_DIR: legacy, PRICES_DIR: dataDir, PRICES_SEED_FILE: seedFile, LEAD_FILE: join(dataDir, "leads.jsonl"),
        PRICING_WEBHOOK_SECRET: SECRET, SITE_ORIGIN: "https://www.netquor.com", ALLOWED_ORIGINS: `https://www.netquor.com,${base}`,
    },
    stdout: "pipe", stderr: "pipe",
});
const logs: string[] = [];
(async () => { for await (const c of server.stdout) logs.push(new TextDecoder().decode(c)); })();
(async () => { for await (const c of server.stderr) logs.push(new TextDecoder().decode(c)); })();
const stop = () => { server.kill(); rmSync(root, { recursive: true, force: true }); };
process.on("SIGINT", () => { stop(); process.exit(130); });

try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(`${base}/health`)).ok) break; } catch { /* not up yet */ } await Bun.sleep(150); if (i === 99) throw new Error("server did not start\n" + logs.join("")); }
    const get = (path: string, headers: Record<string, string> = {}) => fetch(base + path, { headers, redirect: "manual" });
    const text = async (path: string, headers: Record<string, string> = {}) => { const r = await get(path, headers); return { r, body: await r.text() }; };
    const raw = (target: string): Promise<{ status: number; body: string }> => new Promise((res, rej) => {
        const s = connect(port, "127.0.0.1", () => s.write(`GET ${target} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`));
        let buf = ""; s.on("data", (d) => (buf += d)); s.on("error", rej);
        s.on("close", () => res({ status: Number(/^HTTP\/1\.1 (\d{3})/.exec(buf)?.[1] ?? 0), body: buf.slice(buf.indexOf("\r\n\r\n") + 4) }));
    });
    const sign = (body: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex")}`;
    const hook = (payload: unknown) => { const body = JSON.stringify(payload); return fetch(`${base}/hooks/pricing`, { method: "POST", body, headers: { "content-type": "application/json", "x-netquor-signature": sign(body) } }); };
    const priceOf = (html: string, key: string) => new RegExp(`data-price="${key.replace(/\./g, "\\.")}"[^>]*>([^<]*)<`).exec(html)?.[1];

    console.log("pages and prices from the seed");
    await check("/ is 200 and shows the seed's Fleet Mac price", async () => {
        const { r, body } = await text("/");
        eq(r.status, 200, "status"); eq(priceOf(body, "fleet.mac.month"), "$6.12", "fleet.mac.month in /");
    });
    await check("/fleet.html is 200 and shows the seed's Fleet Mac price" + (fleetPatched ? " (marker placed in the temp copy)" : ""), async () => {
        const { r, body } = await text("/fleet.html");
        eq(r.status, 200, "status"); eq(priceOf(body, "fleet.mac.month"), "$6.12", "fleet.mac.month in /fleet.html");
    });
    await check("HTML carries a weak ETag and no-cache (revalidated every time)", async () => {
        const r = await get("/fleet.html");
        assert(/^W\//.test(r.headers.get("etag") ?? ""), "weak etag"); eq(r.headers.get("cache-control"), "no-cache", "cache-control");
    });
    await check("assets: a matching ?v= (md5, 8 hex) is immutable, a wrong one and a plain URL are one hour, 304 on a matching etag", async () => {
        const v = new Bun.CryptoHasher("md5").update(readFileSync(join(legacy, "nq.css"))).digest("hex").slice(0, 8);
        const a = await get(`/nq.css?v=${v}`); eq(a.headers.get("cache-control"), "public, max-age=31536000, immutable", "versioned");
        eq((await get("/nq.css?v=abc")).headers.get("cache-control"), "public, max-age=3600", "wrong v");
        const b = await get("/nq.css"); eq(b.headers.get("cache-control"), "public, max-age=3600", "plain");
        eq((await get("/nq.css", { "if-none-match": b.headers.get("etag")! })).status, 304, "304");
    });
    await check("the ?v= the pages carry is the one the server treats as immutable", async () => {
        const { body } = await text("/"); const m = /href="\/?nq\.css\?v=([0-9a-f]{8})"/.exec(body); assert(m, "nq.css link with v");
        eq((await get(`/nq.css?v=${m![1]}`)).headers.get("cache-control"), "public, max-age=31536000, immutable", "page's own v");
    });
    await check("one URL per page: /index.html is a 301 to / (query kept), /fleet.html/ a 308 to /fleet.html", async () => {
        const a = await get("/index.html?x=1"); eq(a.status, 301, "index status"); eq(a.headers.get("location"), "/?x=1", "index location");
        const b = await get("/fleet.html/?y=2"); eq(b.status, 308, "slash status"); assert(new URL(b.headers.get("location")!, "http://x/fleet.html/").pathname + new URL(b.headers.get("location")!, "http://x/fleet.html/").search === "/fleet.html?y=2", `slash location ${b.headers.get("location")}`);
        eq((await get("/subnet-calculator.html/")).status, 308, "migrated page");
    });

    console.log("a signed webhook changes the next response");
    const tag = { home: (await get("/")).headers.get("etag")!, fleet: (await get("/fleet.html")).headers.get("etag")! };
    await check("same ETag, nothing changed: 304", async () => {
        eq((await get("/", { "if-none-match": tag.home })).status, 304, "/"); eq((await get("/fleet.html", { "if-none-match": tag.fleet })).status, 304, "/fleet.html");
    });
    const llmsBefore = await (await get("/llms.txt")).text();
    const next = structuredClone(seed); next.version = seed.version + 1; next.updatedAt = new Date().toISOString(); next.source = "webhook"; next.prices["fleet.mac.month"].amountCents = 650;
    await check("an unsigned or badly signed post is refused (401), prices unchanged", async () => {
        eq((await fetch(`${base}/hooks/pricing`, { method: "POST", body: JSON.stringify({ snapshot: next }), headers: { "content-type": "application/json" } })).status, 401, "unsigned");
        const body = JSON.stringify({ snapshot: next });
        eq((await fetch(`${base}/hooks/pricing`, { method: "POST", body, headers: { "content-type": "application/json", "x-netquor-signature": `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}` } })).status, 401, "bad signature");
        eq(priceOf((await text("/")).body, "fleet.mac.month"), "$6.12", "still the seed");
    });
    await check("the signed snapshot is accepted (200)", async () => { const r = await hook({ snapshot: next }); eq(r.status, 200, `status ${await r.text()}`); });
    await check("/ and /fleet.html show the new price on the very next request", async () => {
        eq(priceOf((await text("/")).body, "fleet.mac.month"), "$6.50", "/"); eq(priceOf((await text("/fleet.html")).body, "fleet.mac.month"), "$6.50", "/fleet.html");
    });
    await check("the old ETag no longer gives a 304; the new one does", async () => {
        eq((await get("/", { "if-none-match": tag.home })).status, 200, "old on /"); eq((await get("/fleet.html", { "if-none-match": tag.fleet })).status, 200, "old on fleet");
        const e = (await get("/fleet.html")).headers.get("etag")!; assert(e !== tag.fleet, "etag did not change");
        eq((await get("/fleet.html", { "if-none-match": e })).status, 304, "new etag");
    });
    await check("the same version sent again changes nothing (still 304 on the new ETag)", async () => {
        const e = (await get("/")).headers.get("etag")!;
        eq((await hook({ snapshot: next })).status, 200, "resend");
        eq((await get("/", { "if-none-match": e })).status, 304, "304 after resend");
    });
    await check("an older version is refused (409) and the price stays", async () => {
        const old = structuredClone(next); old.version = next.version - 1; old.prices["fleet.mac.month"].amountCents = 111;
        eq((await hook({ snapshot: old })).status, 409, "stale"); eq(priceOf((await text("/")).body, "fleet.mac.month"), "$6.50", "price");
    });
    await check("a wild change is refused (422 change_too_large) and the price stays", async () => {
        const wild = structuredClone(next); wild.version = next.version + 1; wild.prices["fleet.mac.month"].amountCents = 5950;
        const r = await hook({ snapshot: wild }); eq(r.status, 422, "status"); assert((await r.text()).includes("change_too_large"), "code");
        eq(priceOf((await text("/")).body, "fleet.mac.month"), "$6.50", "price");
    });
    await check("llms.txt follows the price too", async () => {
        const now = await (await get("/llms.txt")).text();
        assert(llmsBefore.includes("$6.12") && !llmsBefore.includes("$6.50"), "before"); assert(now.includes("$6.50") && !now.includes("$6.12"), "after");
    });
    await check("the snapshot is persisted for the next start (prices.json)", () => { assert(existsSync(join(dataDir, "prices.json")), "prices.json"); eq(JSON.parse(readFileSync(join(dataDir, "prices.json"), "utf8")).version, next.version, "version"); });
    await check("/health and /health/detail", async () => {
        eq(await (await get("/health")).json(), { ok: true }, "health");
        const d = await (await get("/health/detail")).json() as { prices: { version: number; lastIngestSource: string } };
        eq(d.prices.version, next.version, "version"); eq(d.prices.lastIngestSource, "webhook", "source");
    });

    console.log("generated files");
    await check("/sitemap.xml lists only the registered pages on https://www.netquor.com", async () => {
        const { r, body } = await text("/sitemap.xml"); eq(r.status, 200, "status"); assert((r.headers.get("content-type") ?? "").includes("xml"), "type");
        const { PAGES } = await import("../src/lib/pages.ts");
        eq([...body.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]), PAGES.map((p) => `https://www.netquor.com${p.path}`), "locs");
        assert(!body.includes("127.0.0.1") && !/<loc>http:/.test(body), "canonical host only");
    });
    await check("route groups are not in any URL: the migrated pages (in (site)) have the same URLs and no invented lastmod", async () => {
        const { body } = await text("/sitemap.xml");
        assert(!/[()]/.test(body), "no group name in the sitemap");
        const withLastmod = [...body.matchAll(/<loc>(.*?)<\/loc><lastmod>/g)].map((m) => m[1]);
        eq(withLastmod, [], "pages with a lastmod");
        eq((await get("/%28site%29/subnet-calculator.html")).status, 404, "the group folder is not a URL");
    });
    await check("/robots.txt allows all and names the sitemap", async () => {
        const { body } = await text("/robots.txt"); assert(/User-agent: \*\nAllow: \//.test(body) && body.includes("Sitemap: https://www.netquor.com/sitemap.xml"), body);
    });

    console.log("pilot page: /subnet-calculator.html (SvelteKit) against its legacy copy");
    const visible = (html: string): string => html
        .replace(/<head[\s\S]*?<\/head>/gi, " ").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, " ")
        .replace(/&(copy|middot|amp|lt|gt|quot|nbsp|#39);/g, (_m, n: string) => ({ copy: "©", middot: "·", amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " ", "#39": "'" })[n]!)
        .replace(/\s+/g, " ").trim();
    const meta = (html: string) => ({
        title: /<title>([\s\S]*?)<\/title>/.exec(html)?.[1].trim(),
        description: /<meta name="description" content="([^"]*)"/.exec(html)?.[1],
        canonical: /<link rel="canonical" href="([^"]*)"/.exec(html)?.[1],
        og: [...html.matchAll(/<meta property="(og:[a-z:]+)" content="([^"]*)"/g)].map((m) => `${m[1]}=${m[2]}`).sort(),
        ld: JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "null"),
    });
    const legacyHtml = readFileSync(join(legacy, "subnet-calculator.html"), "utf8");
    const svelte = await text("/subnet-calculator.html");
    await check("served by SvelteKit (not the legacy file), server-rendered with the page content", () => {
        eq(svelte.r.status, 200, "status"); assert(svelte.body.includes("sveltekit") || svelte.body.includes("__sveltekit"), "SvelteKit markers"); assert(svelte.body.includes("Subnet calculator"), "content in the HTML");
    });
    await check("visible text is identical to the legacy page", () => { eq(visible(svelte.body), visible(legacyHtml), "text"); });
    await check("title, description, canonical, Open Graph and JSON-LD are identical", () => { eq(meta(svelte.body), meta(legacyHtml), "metadata"); });
    await check("it loads subnet-calc.js unchanged and the island's source is the same bytes", async () => {
        const js = await text("/subnet-calc.js"); eq(js.body, readFileSync(join(legacy, "subnet-calc.js"), "utf8"), "subnet-calc.js"); assert(/<script src="\/subnet-calc\.js\?v=[0-9a-f]+"/.test(svelte.body), "script tag");
    });
    await check("the price in the page follows the cache (Price component)", async () => {
        const n2 = structuredClone(next); n2.version = next.version + 1; n2.updatedAt = new Date().toISOString(); n2.prices["network.from.month"].amountCents = 699;
        eq((await hook({ snapshot: n2 })).status, 200, "ingest");
        const { body } = await text("/subnet-calculator.html"); assert(visible(body).includes("starts at $6.99 a month"), "network price"); eq(priceOf(body, "network.from.month"), "$6.99", "marker");
    });

    console.log("lead form (POST /api/lead)");
    const lead = (b: object, ip: string, extra: Record<string, string> = {}) => fetch(`${base}/api/lead`, { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json", "x-real-ip": ip, origin: "https://www.netquor.com", ...extra } });
    const leadLines = () => (existsSync(join(dataDir, "leads.jsonl")) ? readFileSync(join(dataDir, "leads.jsonl"), "utf8").trim().split("\n").filter(Boolean) : []);
    await check("a valid lead is accepted (202) and stored", async () => {
        const r = await lead({ name: "Smoke Test", email: "smoke@example.com", message: "hello" }, "198.51.100.10");
        eq(r.status, 202, `status ${await r.clone().text()}`); eq(leadLines().length, 1, "stored");
    });
    await check("a filled honeypot is a silent 200 and nothing is stored", async () => {
        const r = await lead({ name: "Bot", email: "bot@example.com", website: "http://spam.example" }, "198.51.100.11");
        eq(r.status, 200, "status"); eq(await r.json(), { ok: true }, "body"); eq(leadLines().length, 1, "still one lead");
    });
    await check("a form post from our own origin is accepted; SvelteKit's CSRF guard (always on in Kit 3) refuses a form post with no or a foreign Origin before the API sees it", async () => {
        const form = (origin?: string) => fetch(`${base}/api/lead`, { method: "POST", body: "name=Form+Test&email=form%40example.com", headers: { "content-type": "application/x-www-form-urlencoded", "x-real-ip": "198.51.100.13", ...(origin ? { origin } : {}) } });
        eq((await form(base)).status, 202, "own origin"); eq((await form()).status, 403, "no origin"); eq((await form("https://evil.example")).status, 403, "foreign origin");
        eq(leadLines().length, 2, "only the accepted one was stored");
    });
    await check("a foreign Origin is refused (403)", async () => eq((await lead({ name: "X", email: "x@example.com" }, "198.51.100.12", { origin: "https://evil.example" })).status, 403, "status"));
    await check("the rate limit counts the real address; a spoofed x-nq-client-ip does not help", async () => {
        const codes: number[] = [];
        for (let i = 0; i < 7; i++) codes.push((await lead({ name: "R", email: "r@example.com", website: "x" }, "198.51.100.77", { "x-nq-client-ip": `203.0.113.${i + 1}` })).status);
        eq(codes, [200, 200, 200, 200, 200, 429, 429], "statuses");
        eq((await lead({ name: "Other", email: "o@example.com", website: "x" }, "198.51.100.78")).status, 200, "another address is not limited");
    });

    console.log("private paths are not reachable");
    const denied = [
        "/server/.env", "/server/src/secret.ts", "/server/data/prices.json", "/web/.env", "/.env", "/.git/config", "/tools/secret.txt", "/mockups/x.html", "/.agents/note.md", "/deploy/x.yml", "/private.html", "/notes.template.txt", "/llms.template.txt", "/brand/.hidden.png",
        "/../server/.env", "/%2e%2e/server/.env", "/%2E%2E/%2e%2e/.env", "/..%2fserver/.env", "/..%2Fserver%2F.env", "/brand/../server/.env", "/brand/%2e%2e/server/.env", "/brand/..%2f..%2fserver/.env", "/%252e%252e/server/.env", "/fleet/%2e%2e/%2e%2e/.env", "/nq.css%00.png", "/brand//../.env", "/package.json", "/Dockerfile",
    ];
    for (const p of denied) await check(`denied: ${p}`, async () => { const r = await raw(p); assert(r.status !== 200, `status ${r.status}`); assert(!r.body.includes(CANARY), "canary content was served"); });
    await check("the allowlist still serves what it should", async () => { for (const p of ["/brand/og.png", "/favicon.svg", "/readiness-data.json", "/site.webmanifest", "/fleet/site.css"]) eq((await get(p)).status, 200, p); });
} finally {
    stop();
}
console.log(failures ? `\n${failures} check(s) FAILED` : "\nall smoke checks passed");
if (failures) console.log("--- server log ---\n" + logs.join("").slice(-3000));
process.exit(failures ? 1 : 0);
