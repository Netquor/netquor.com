import { describe, expect, test } from "bun:test";
import { chapters, closing, credits, hero, jsonLd, meta } from "./data.ts";

const all = JSON.stringify({ chapters, closing, credits, hero, meta });

describe("story page copy", () => {
    test("has no em dashes and no private repository or internal names", () => {
        expect(all).not.toContain("—");
        for (const banned of ["EntrEE", "netquor-apps", "netquor-ops", "BlueJay-IT-Portal", "MSWA", "iBudgeteR", "QUOR", "nq-vm", "pve-hardening", "autom8n", "mongo-credentials"]) expect(all).not.toContain(banned);
    });
    test("credits the open-source work Fleet builds on", () => {
        expect(credits.body).toContain("NanoMDM");
        expect(credits.body).toContain("Jesse Peterson");
    });
    test("chapters are in time order and each has a title and body", () => {
        const year = (w: string) => (w === "Today" ? 9999 : Number(/\d{4}/.exec(w)?.[0] ?? NaN));
        const years = chapters.map((c) => year(c.when));
        expect(years.every((y) => Number.isFinite(y))).toBe(true);
        expect([...years].sort((a, b) => a - b)).toEqual(years);
        for (const c of chapters) { expect(c.title.length).toBeGreaterThan(3); expect(c.body.length).toBeGreaterThan(40); }
    });
    test("Phone is never described as billed or launched", () => {
        expect(all).not.toMatch(/billed|launched|customers?\b.*phone/i);
    });
    test("JSON-LD points at the organization on the canonical host", () => {
        const ld = jsonLd("https://www.netquor.com") as { "@graph": Array<Record<string, unknown>> };
        expect(JSON.stringify(ld)).toContain("https://www.netquor.com/#org");
        expect(ld["@graph"].map((n) => n["@type"])).toEqual(["AboutPage", "Person"]);
    });
});

describe("story photos", () => {
    const figs = chapters.flatMap((c) => c.figures ?? []);
    test("every figure has alt text, a caption, dimensions and a file under brand/story", async () => {
        expect(figs.length).toBeGreaterThanOrEqual(9);
        for (const f of figs) {
            expect(f.alt.length).toBeGreaterThan(30);
            expect(f.caption.length).toBeGreaterThan(10);
            expect(f.width).toBeGreaterThan(0);
            expect(f.src.startsWith("/brand/story/")).toBe(true);
            expect(await Bun.file(new URL(`../../../../..${f.src}`, import.meta.url)).exists()).toBe(true);
        }
    });
    test("no photo that shows credentials or a home address is used", () => {
        for (const f of figs) expect(f.src).not.toMatch(/basement|credentials|reflection|receipt|ifixit-order/);
    });
});

describe("story photo files", () => {
    // WebP (lossy "VP8 " chunk): 14-bit width and height at bytes 26..29.
    const dims = async (src: string) => {
        const b = new Uint8Array(await Bun.file(new URL(`../../../../..${src}`, import.meta.url)).arrayBuffer());
        expect(String.fromCharCode(...b.slice(0, 4)) + String.fromCharCode(...b.slice(8, 12)) + String.fromCharCode(...b.slice(12, 16))).toBe("RIFFWEBPVP8 ");
        return { w: (b[26]! | (b[27]! << 8)) & 0x3fff, h: (b[28]! | (b[29]! << 8)) & 0x3fff };
    };
    const figs = chapters.flatMap((c) => c.figures ?? []);
    test("declared width and height match the real files", async () => {
        for (const f of figs) { const d = await dims(f.src); expect([f.src, d.w, d.h]).toEqual([f.src, f.width, f.height]); }
    });
    test("the iFixit photo is the cropped phones-and-battery view, never the full receipt page", async () => {
        const d = await dims("/brand/story/iphone-repair-2019.webp");
        expect(d).toEqual({ w: 1200, h: 712 });
    });
});

describe("story links", () => {
    test("a linked figure points at the real YouTube video over https", () => {
        const linked = chapters.flatMap((c) => c.figures ?? []).filter((f) => f.href);
        expect(linked.map((f) => f.href)).toEqual(["https://www.youtube.com/watch?v=tnytpjmSwXA"]);
    });
});
