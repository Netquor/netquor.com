import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { startServer, WEB } from "../../../../scripts/parity/run";
import { renderSvelte } from "../../server/svelteHarness";
import { snap } from "../../server/testkit";
import { CAPABILITIES, FAQ_ITEMS } from "./data";

const ROUTE = "routes/(site)/central.html/+page.svelte";
const data = { prices: snap(3).prices, priceVersion: 3, origin: "https://www.netquor.com", assets: { nudge: "abc" } };

describe("central", () => {
    test("every capability has one of the two statuses the shared CSS styles", () => {
        expect(CAPABILITIES.length).toBe(10);
        for (const c of CAPABILITIES) expect(["available", "in-development"]).toContain(c.status);
    });
    test("renders the status table, the FAQ and the contact link, and no price", async () => {
        const { body, head } = await renderSvelte(ROUTE, { data }, data, "http://localhost/central.html");
        expect(body).toContain('id="status"');
        expect(body).toContain('id="faq"');
        expect((body.match(/<details/g) ?? []).length).toBe(FAQ_ITEMS.length);
        expect((body.match(/data-status="/g) ?? []).length).toBe(CAPABILITIES.length);
        expect(body).toContain("mailto:hello@netquor.com?subject=Netquor Central%20and%20Google%20Workspace");
        expect(body).not.toContain("data-price");
        expect(head).toContain('rel="canonical" href="https://www.netquor.com/central.html"');
        expect(head).not.toContain("<style>");
        expect(readFileSync(join(import.meta.dir, "Hero.svelte"), "utf8")).toContain(".nq-diff-row b.rm");
        expect(readFileSync(join(import.meta.dir, "page.css"), "utf8")).toContain(".nq-map-labels text");
    });
    test("the built server answers 200 (when a build exists)", async () => {
        if (!existsSync(join(WEB, "build/index.js"))) return;
        const s = await startServer({ build: false });
        try {
            const r = await fetch(`${s.base}/central.html`);
            expect(r.status).toBe(200);
            expect(await r.text()).toContain("What is built, and what is not");
        } finally { s.stop(); }
    }, 30000);
});
