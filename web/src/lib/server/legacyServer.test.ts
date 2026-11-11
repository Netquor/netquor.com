import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { assetFingerprint, createLegacyServer } from "./legacyServer";
import { mutablePrices, PAGE, snap, tempLegacy } from "./testkit";

let t: ReturnType<typeof tempLegacy> | undefined;
afterEach(() => t?.cleanup());

const setup = (files: Record<string, string> = {}, version = 1, cents = 595) => {
    t = tempLegacy({ "fleet.html": PAGE(), "index.html": "<p>home</p>", ...files });
    const prices = mutablePrices(snap(version, { "fleet.mac.month": cents }));
    const logs: string[] = [];
    const server = createLegacyServer({ legacyDir: t.dir, prices, log: (l) => logs.push(l) });
    const get = (path: string, headers: Record<string, string> = {}, method = "GET") => server.serve(new Request(`http://x${path}`, { method, headers }), new URL(`http://x${path}`));
    return { server, prices, logs, get };
};

describe("pages are stamped per request from the cache", () => {
    test("prices come from the snapshot, not from the file", async () => {
        const { get } = setup({}, 1, 650);
        expect(await get("/fleet.html")!.text()).toContain('<b data-price="fleet.mac.month">$6.50</b>');
    });
    test("a new price version shows on the very next request, and nothing is written to disk", async () => {
        const { get, prices } = setup();
        const before = await Bun.file(`${t!.dir}/fleet.html`).text();
        expect(await get("/fleet.html")!.text()).toContain("$5.95");
        prices.set(snap(2, { "fleet.mac.month": 700 }));
        expect(await get("/fleet.html")!.text()).toContain(">$7<");
        expect(await Bun.file(`${t!.dir}/fleet.html`).text()).toBe(before);
    });
    test("a page with no markers is served as written", async () => {
        const { get } = setup();
        expect(await get("/")!.text()).toBe("<p>home</p>");
    });
    test("headers: html type, no-cache (revalidate every time), weak etag", () => {
        const r = setup().get("/fleet.html")!;
        expect(r.headers.get("content-type")).toBe("text/html; charset=utf-8");
        expect(r.headers.get("cache-control")).toBe("no-cache");
        expect(r.headers.get("etag")).toMatch(/^W\/"/);
    });
});

describe("memoization", () => {
    test("stamped once per (file, mtime, price version)", () => {
        const { get, server, prices } = setup();
        get("/fleet.html"); get("/fleet.html"); get("/fleet.html");
        expect(server.stats.stamps).toBe(1);
        prices.set(snap(2, { "fleet.mac.month": 600 }));
        get("/fleet.html"); get("/fleet.html");
        expect(server.stats.stamps).toBe(2);
        t!.write("fleet.html", PAGE("$1.00"), 2_000_000_000);
        get("/fleet.html");
        expect(server.stats.stamps).toBe(3);
    });
    test("a changed file is picked up", async () => {
        const { get } = setup();
        await get("/fleet.html")!.text();
        t!.write("fleet.html", `${PAGE()}<!-- edited -->`, 2_000_000_100);
        expect(await get("/fleet.html")!.text()).toContain("<!-- edited -->");
    });
});

describe("conditional requests", () => {
    test("304 only while the price version and the file are unchanged", async () => {
        const { get, prices, server } = setup();
        const first = get("/fleet.html")!;
        const etag = first.headers.get("etag")!;
        const stamps = server.stats.stamps;
        const again = get("/fleet.html", { "if-none-match": etag })!;
        expect(again.status).toBe(304);
        expect(await again.text()).toBe("");
        expect(server.stats.stamps).toBe(stamps);
        prices.set(snap(2, { "fleet.mac.month": 600 }));
        const changed = get("/fleet.html", { "if-none-match": etag })!;
        expect(changed.status).toBe(200);
        expect(changed.headers.get("etag")).not.toBe(etag);
        expect(await changed.text()).toContain(">$6<");
    });
    test("an edited file invalidates the etag", () => {
        const { get } = setup();
        const etag = get("/fleet.html")!.headers.get("etag")!;
        t!.write("fleet.html", PAGE("$9.99"), 2_000_000_200);
        expect(get("/fleet.html", { "if-none-match": etag })!.status).toBe(200);
    });
    test("HEAD answers headers only", async () => {
        const r = setup().get("/fleet.html", {}, "HEAD")!;
        expect(r.status).toBe(200);
        expect(await r.text()).toBe("");
    });
});

describe("assets", () => {
    const files = { "nq.css": "a{b:c}", "brand/og.png": "PNG", "readiness-data.json": "{}" };
    test("?v= is immutable only when it is the file's own fingerprint (md5, 8 hex, as tools/build-nav.py writes it); everything else is one hour", () => {
        const { get } = setup(files);
        const v = createHash("md5").update("a{b:c}").digest("hex").slice(0, 8);
        expect(assetFingerprint(new TextEncoder().encode("a{b:c}"))).toBe(v);
        expect(get(`/nq.css?v=${v}`)!.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
        expect(get("/nq.css?v=abc")!.headers.get("cache-control")).toBe("public, max-age=3600");
        expect(get("/nq.css?v=")!.headers.get("cache-control")).toBe("public, max-age=3600");
        expect(get("/nq.css")!.headers.get("cache-control")).toBe("public, max-age=3600");
        expect(get("/brand/og.png")!.headers.get("content-type")).toBe("image/png");
        expect(get("/readiness-data.json")!.headers.get("content-type")).toContain("application/json");
    });
    test("an edited asset is no longer immutable under its old ?v=", () => {
        const { get } = setup(files);
        const v = createHash("md5").update("a{b:c}").digest("hex").slice(0, 8);
        t!.write("nq.css", "a{b:d}", 2_000_000_300);
        expect(get(`/nq.css?v=${v}`)!.headers.get("cache-control")).toBe("public, max-age=3600");
    });
    test("304 on a matching etag", () => {
        const { get } = setup(files);
        const etag = get("/nq.css")!.headers.get("etag")!;
        expect(get("/nq.css", { "if-none-match": etag })!.status).toBe(304);
    });
    test("assets are not stamped", async () => {
        const { get } = setup({ "x.js": 'var a = "<b data-price=\\"nope\\">1</b>";' });
        expect(await get("/x.js")!.text()).toContain("data-price");
    });
});

describe("not served", () => {
    test("null for unknown, denied, missing and non-GET", () => {
        const { server, get } = setup({ "llms.template.txt": "x", "sdn.html": "" });
        expect(get("/nope.html")).toBeNull();
        expect(get("/llms.template.txt")).toBeNull();
        expect(get("/central.html")).toBeNull(); // registered but not on disk
        expect(server.serve(new Request("http://x/fleet.html", { method: "POST" }), new URL("http://x/fleet.html"))).toBeNull();
    });
});

describe("a snapshot without a key the page names", () => {
    test("serves the page as written and logs once per version", async () => {
        const { get, prices, logs } = setup();
        prices.set(snap(2, { "vpn.from.month": 500 }));
        expect(await get("/fleet.html")!.text()).toContain("$5.95");
        get("/fleet.html"); get("/fleet.html");
        expect(logs.length).toBe(1);
        expect(logs[0]).toContain("fleet.html");
    });
});

describe("an operator rebase (the cache's version() keeps counting up)", () => {
    test("a rebase to the SAME snapshot version number with different prices changes the page and its ETag", async () => {
        const { get, prices } = setup({}, 5, 595);
        const first = get("/fleet.html")!;
        const etag = first.headers.get("etag")!;
        expect(await first.text()).toContain(">$5.95<");
        prices.set(snap(5, { "fleet.mac.month": 800 }));
        const after = get("/fleet.html", { "if-none-match": etag })!;
        expect(after.status).toBe(200);
        expect(after.headers.get("etag")).not.toBe(etag);
        expect(await after.text()).toContain(">$8<");
    });
    test("a rebase to a LOWER snapshot version number with different prices changes the page and its ETag", async () => {
        const { get, prices } = setup({}, 9, 595);
        const first = get("/fleet.html")!;
        const etag = first.headers.get("etag")!;
        await first.text();
        prices.set(snap(3, { "fleet.mac.month": 450 }));
        const after = get("/fleet.html", { "if-none-match": etag })!;
        expect(after.status).toBe(200);
        expect(after.headers.get("etag")).not.toBe(etag);
        expect(await after.text()).toContain("$4.50");
        // And it is stable again until the next change.
        expect(get("/fleet.html", { "if-none-match": after.headers.get("etag")! })!.status).toBe(304);
    });
});

describe("a missing key on legacy pages", () => {
    test("an unknown key degrades one page only; other pages are still stamped", async () => {
        const { get, logs } = setup({ "sdn.html": '<p><b data-price="no.such.key">$1</b></p>', "vpn.html": '<p><b data-price="fleet.mac.month">$9</b></p>' });
        expect(await get("/sdn.html")!.text()).toContain(">$1<");
        expect(await get("/vpn.html")!.text()).toContain(">$5.95<");
        expect(await get("/fleet.html")!.text()).toContain(">$5.95<");
        get("/sdn.html"); get("/sdn.html");
        expect(logs.filter((l) => l.includes("sdn.html")).length).toBe(1);
    });
});

describe("one URL per page", () => {
    test("/index.html is a 301 to / and keeps the query string", () => {
        const { get } = setup();
        const r = get("/index.html?utm_source=x&a=1")!;
        expect(r.status).toBe(301);
        expect(r.headers.get("location")).toBe("/?utm_source=x&a=1");
        expect(get("/index.html")!.headers.get("location")).toBe("/");
        expect(get("/index.html/")!.status).toBe(301);
        expect(get("/")!.status).toBe(200);
    });
    test("a trailing slash on a legacy page is a 308 to the .html URL, query kept", () => {
        const { get } = setup();
        const r = get("/fleet.html/?ref=a")!;
        expect(r.status).toBe(308);
        expect(r.headers.get("location")).toBe("/fleet.html?ref=a");
        expect(get("/fleet.html//")!.headers.get("location")).toBe("/fleet.html");
        expect(get("/fleet.html")!.status).toBe(200);
    });
    test("no redirect for things that are not served pages", () => {
        const { get } = setup();
        expect(get("/nope.html/")).toBeNull();
        expect(get("/central.html/")).toBeNull(); // registered but not on disk
        expect(get("/nq.css/")).toBeNull();
        expect(get("/brand/")).toBeNull();
        expect(get("/llms.template.txt/")).toBeNull();
    });
});
