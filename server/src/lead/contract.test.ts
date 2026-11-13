// lead/contract.test.ts: the contract with the Netquor API (POST /v1/leads/site, schema 1). The receiver below is an independent re-implementation, written from the API's README ("Leads from netquor.com") and its src/leads/validate.ts and signature rules, NOT from this repository's sink or validator. What this service sends must pass it; if the API changes a rule, change CONTRACT.md and this test together.
import { describe, expect, test } from "bun:test";
import { createHmac, timingSafeEqual } from "node:crypto";
import { good, ORIGIN, world } from "./testkit";
import { WebhookSink } from "./sinks";
import type { Lead } from "./types";

// ---- the receiver ----------------------------------------------------------------------------
const SECRET = "contract-secret-0123456789abcdef0123456789";
const MAX_BODY = 32 * 1024;
const TOLERANCE = 300;
const L = { name: 100, email: 254, emailLocal: 64, company: 120, message: 2000, term: 40, page: 200, utm: 100, ipHash: 64, source: 60, count: 100_000 };
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const CONTROLS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]+/g;
const clean = (s: string, multiline = false) => {
    let t = (s as unknown as { toWellFormed(): string }).toWellFormed().normalize("NFC").replace(INVISIBLE, "");
    t = multiline
        ? t.replace(/\r\n?|[\u2028\u2029]/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]+/g, " ").replace(/[ ]*\n[ ]*/g, "\n").replace(/ {2,}/g, " ").replace(/\n{3,}/g, "\n\n")
        : t.replace(CONTROLS, " ").replace(/ {2,}/g, " ");
    return t.trim();
};
const EMAIL = /^[^\s@<>(),;:"\\[\]]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const KNOWN = new Set(["schema", "id", "receivedAt", "source", "name", "email", "company", "message", "macs", "ios", "term", "page", "utm", "ipHash"]);

type Verdict = { status: 200 | 401 | 422; code?: string; stored?: Record<string, unknown> };

/** Signature first, on the raw bytes, then the fields. Mirrors the API: a bare 401 for any signature problem, 422 + code for a bad field. */
function receive(rawBody: string, header: string | null, nowSeconds: number, secrets = [SECRET]): Verdict {
    if (Buffer.byteLength(rawBody) > MAX_BODY) return { status: 401 };
    const m = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/.exec(header ?? "");
    if (!m) return { status: 401 };
    if (Math.abs(nowSeconds - Number(m[1])) > TOLERANCE) return { status: 401 };
    const given = Buffer.from(m[2], "hex");
    const ok = secrets.some((s) => timingSafeEqual(createHmac("sha256", s).update(`${m[1]}.`).update(rawBody).digest(), given));
    if (!ok) return { status: 401 };

    let b: unknown;
    try { b = JSON.parse(rawBody); } catch { return { status: 422, code: "invalid_body" }; }
    if (typeof b !== "object" || b === null || Array.isArray(b)) return { status: 422, code: "invalid_body" };
    const o = b as Record<string, unknown>;
    const bad = (f: string): Verdict => ({ status: 422, code: `invalid_${f}` });
    // optional text: undefined is absent; non-string or too long (after cleaning) is bad
    const opt = (v: unknown, max: number, ml = false): string | undefined | null => {
        if (v === undefined) return undefined;
        if (typeof v !== "string") return null;
        const s = clean(v, ml);
        if (s.length > max) return null;
        return s === "" ? undefined : s;
    };
    const cnt = (v: unknown): number | undefined | null => (v === undefined ? undefined : typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= L.count ? v : null);

    if (o.schema !== 1) return bad("schema");
    if (typeof o.id !== "string" || !/^[A-Za-z0-9_-]{8,64}$/.test(o.id)) return bad("id");
    if (typeof o.receivedAt !== "string" || o.receivedAt.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(o.receivedAt) || Number.isNaN(Date.parse(o.receivedAt))) return bad("received_at");
    if (typeof o.source !== "string" || !/^[A-Za-z0-9_./:-]{1,60}$/.test(o.source)) return bad("source");
    const name = opt(o.name, L.name); if (name === null || name === undefined) return bad("name");
    if (typeof o.email !== "string") return bad("email");
    const e = clean(o.email); const at = e.lastIndexOf("@");
    if (e.length > L.email || at < 1 || at > L.emailLocal) return bad("email");
    const email = `${e.slice(0, at)}@${e.slice(at + 1).toLowerCase()}`;
    if (!EMAIL.test(email)) return bad("email");
    const company = opt(o.company, L.company); if (company === null) return bad("company");
    const message = opt(o.message, L.message, true); if (message === null) return bad("message");
    const macs = cnt(o.macs); if (macs === null) return bad("macs");
    const ios = cnt(o.ios); if (ios === null) return bad("ios");
    const term = opt(o.term, L.term); if (term === null) return bad("term");
    const page = opt(o.page, L.page); if (page === null) return bad("page");
    const ipHash = opt(o.ipHash, L.ipHash); if (ipHash === null) return bad("ip_hash");
    let utm: Record<string, string> | undefined;
    if (o.utm !== undefined) {
        if (typeof o.utm !== "object" || o.utm === null || Array.isArray(o.utm)) return bad("utm");
        const u = o.utm as Record<string, unknown>;
        utm = {};
        for (const k of ["source", "medium", "campaign"]) { const v = opt(u[k], L.utm); if (v === null) return bad("utm"); if (v !== undefined) utm[k] = v; }
        if (!Object.keys(utm).length) utm = undefined;
    }
    const stored: Record<string, unknown> = { id: o.id, receivedAt: o.receivedAt, source: o.source, name, email };
    for (const [k, v] of Object.entries({ company, message, macs, ios, term, page, utm, ipHash })) if (v !== undefined) stored[k] = v;
    // fields outside the schema are dropped by the API; this test also records them so it can insist the sender sends none
    for (const k of Object.keys(o)) if (!KNOWN.has(k)) stored.__unknown = [...((stored.__unknown as string[]) ?? []), k];
    return { status: 200, stored };
}

// ---- capture what the real sink puts on the wire ----------------------------------------------
async function sent(lead: Lead, clientIp?: string, now = Date.parse("2026-11-10T12:00:00Z")) {
    let seen: { body: string; sig: string } | null = null;
    const fetcher = (async (_u: string, init: RequestInit) => { seen = { body: init.body as string, sig: (init.headers as Record<string, string>)["x-netquor-signature"] }; return new Response("{}"); }) as unknown as typeof fetch;
    await new WebhookSink({ url: "https://api.example.com/v1/leads/site", secret: SECRET, fetch: fetcher, now: () => now }).deliver(lead, clientIp ? { clientIp } : undefined);
    return { ...seen!, nowSeconds: Math.floor(now / 1000) };
}
const full: Lead = {
    id: "ld_6f1c2a52-0d3e-4c9b-8a55-0b1f3f6a9d11", receivedAt: "2026-11-10T12:00:00.000Z", source: "fleet", name: "Ada Lovelace", email: "ada@example.com",
    company: "Analytical Engines", message: "Hello\nWorld", macs: 12, ios: 3, term: "annual", page: "/fleet.html", utm: { source: "news", medium: "email", campaign: "fall" },
};

describe("the API accepts what this service sends", () => {
    test("a full lead: signature verifies, every field is stored as sent, nothing outside the schema", async () => {
        const w = await sent(full, "203.0.113.9");
        const v = receive(w.body, w.sig, w.nowSeconds);
        expect(v.status).toBe(200);
        expect(v.stored).toMatchObject({ id: full.id, source: "fleet", name: "Ada Lovelace", email: "ada@example.com", company: "Analytical Engines", message: "Hello\nWorld", macs: 12, ios: 3, term: "annual", page: "/fleet.html", utm: full.utm });
        expect(v.stored!.ipHash).toMatch(/^[0-9a-f]{32}$/);
        expect(v.stored!.__unknown).toBeUndefined();
        expect(w.body).not.toContain("203.0.113.9");
    });
    test("a minimal lead (no optionals, no address)", async () => {
        const w = await sent({ id: "ld_minimal01", receivedAt: "2026-11-10T12:00:00.000Z", source: "", name: "Ada", email: "ada@example.com", company: "", message: "", macs: 0, ios: 0, term: "" });
        const v = receive(w.body, w.sig, w.nowSeconds);
        expect(v.status).toBe(200);
        expect(Object.keys(v.stored!).sort()).toEqual(["email", "id", "name", "receivedAt", "source"]);
    });
    test("every field at its maximum passes the API's limits and its 32 KB body cap", async () => {
        const lead: Lead = {
            ...full, name: "n".repeat(L.name), company: "c".repeat(L.company), message: "m".repeat(L.message),
            email: `${"a".repeat(60)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.${"e".repeat(1)}`.slice(0, 254), term: "t".repeat(20), page: "/" + "p".repeat(L.page - 1),
            macs: L.count, ios: L.count, utm: { source: "s".repeat(L.utm), medium: "m".repeat(L.utm), campaign: "c".repeat(L.utm) },
        };
        const w = await sent(lead, "2001:db8::1");
        expect(Buffer.byteLength(w.body)).toBeLessThan(MAX_BODY);
        expect(receive(w.body, w.sig, w.nowSeconds)).toMatchObject({ status: 200 });
    });
    test("a worst-case body (a message of 1000 emoji, 2000 UTF-16 units, 4000 bytes) is still under the cap", async () => {
        const w = await sent({ ...full, message: "\u{1F600}".repeat(1000) });
        expect(Buffer.byteLength(w.body)).toBeLessThan(MAX_BODY);
        expect(receive(w.body, w.sig, w.nowSeconds).status).toBe(200);
    });
    test("a lead that went through POST /api/lead validation is accepted by the API, whatever the form sent", async () => {
        const seen: Lead[] = [];
        const w = world({ sink: { deliver: async (l) => void seen.push(l) } });
        const cases: Record<string, unknown>[] = [
            good, { ...good, source: "home-hero", page: "https://www.netquor.com/fleet.html?x=1", utm_source: "n", utm_medium: "m", utm_campaign: "c" },
            { name: "  Zoë  Ünï  ", email: "ZOE@Example.COM" }, { name: "=SUM(A1)", email: "a+b@example.co.uk", company: "@home", message: "-1\r\nline" },
            { name: "x", email: "x@example.com", macs: "0", ios: "", term: "monthly", utm: { source: "a" } },
        ];
        for (const c of cases) expect((await w.postJson(c)).status).toBe(202);
        expect(seen).toHaveLength(cases.length);
        for (const lead of seen) {
            const wire = await sent(lead, "198.51.100.4");
            const v = receive(wire.body, wire.sig, wire.nowSeconds);
            expect(v.status).toBe(200);
            expect(v.stored!.__unknown).toBeUndefined();
        }
    });
    test("the form's own origin is irrelevant to the API (server to server), but the id shape is the API's", async () => {
        expect(ORIGIN).toContain("netquor.com");
        const w = world();
        const res = await w.postJson(good);
        expect((await res.json()).id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    });
});

describe("the receiver itself (so the tests above mean something)", () => {
    test("rejects a wrong secret, an altered body, a stale or future timestamp, and a malformed header, all as bare 401", async () => {
        const w = await sent(full);
        expect(receive(w.body, w.sig, w.nowSeconds, ["another-secret-0123456789abcdef012345"]).status).toBe(401);
        expect(receive(w.body.replace("Ada", "Eve"), w.sig, w.nowSeconds).status).toBe(401);
        expect(receive(w.body, w.sig, w.nowSeconds + 301).status).toBe(401);
        expect(receive(w.body, w.sig, w.nowSeconds - 301).status).toBe(401);
        expect(receive(w.body, w.sig, w.nowSeconds + 300).status).toBe(200);
        expect(receive(w.body, w.sig.toUpperCase(), w.nowSeconds).status).toBe(401);
        expect(receive(w.body, ` ${w.sig}`, w.nowSeconds).status).toBe(401);
        expect(receive(w.body, null, w.nowSeconds).status).toBe(401);
    });
    test("accepts the next secret during a rotation", async () => {
        const w = await sent(full);
        expect(receive(w.body, w.sig, w.nowSeconds, ["old-secret-0123456789abcdef0123456789", SECRET]).status).toBe(200);
    });
    test("422s a bad field with a stable code", () => {
        const sign = (obj: unknown, t = 1_700_000_000) => { const body = JSON.stringify(obj); return { body, sig: `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex")}`, t }; };
        const base = { schema: 1, id: "ld_abcdefgh", receivedAt: "2026-11-10T12:00:00.000Z", source: "fleet", name: "Ada", email: "ada@example.com" };
        for (const [patch, code] of [[{ schema: 2 }, "invalid_schema"], [{ id: "short" }, "invalid_id"], [{ source: "" }, "invalid_source"], [{ email: "nope" }, "invalid_email"], [{ macs: 1.5 }, "invalid_macs"], [{ name: "n".repeat(101) }, "invalid_name"], [{ utm: [] }, "invalid_utm"], [{ ipHash: "h".repeat(65) }, "invalid_ip_hash"]] as const) {
            const s = sign({ ...base, ...patch });
            expect(receive(s.body, s.sig, s.t)).toEqual({ status: 422, code });
        }
    });
});
