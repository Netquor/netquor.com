import { describe, expect, test } from "bun:test";
import { auditRow, forbidden, formatAudit, googleRequests, PAGES } from "./audit";

const OWN = "http://127.0.0.1:4000";
const BS = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js";

describe("forbidden", () => {
    test("the Bootstrap JS bundle from any origin and the replaced scripts from our own origin", () => {
        expect(forbidden([BS, `${OWN}/nav.js?v=ab`, `${OWN}/fx.js`, `${OWN}/bg.js`, `${OWN}/nudge.js`, `${OWN}/analytics.js`, `${OWN}/readiness.js`, `${OWN}/fleet/site.js`, `${OWN}/fleet/pricing.js`], OWN)).toHaveLength(9);
        expect(forbidden(["https://example.com/bootstrap.bundle.js"], OWN)).toHaveLength(1);
    });
    test("css, the pure calculators and a same-named script on another origin are fine", () => {
        expect(forbidden(["https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css", `${OWN}/nav.css?v=1`, `${OWN}/cost-calc.js`, `${OWN}/subnet-calc.js`, "https://other.test/nav.js", `${OWN}/_app/immutable/nav.abc.js`], OWN)).toEqual([]);
    });
});

describe("auditRow", () => {
    const gtag = "https://www.googletagmanager.com/gtag/js?id=G-X";
    test("passes when the Svelte page lost only the Bootstrap bundle and keeps the same Google requests", () => {
        const r = auditRow("/vpn.html", [BS, gtag, "http://l/nq.css"], [gtag, "http://s/nq.css"], "http://l", "http://s");
        expect(r.ok).toBe(true);
        expect(r.legacyOnly).toEqual([BS]);
        expect(formatAudit([r])).toContain("1=1");
    });
    test("fails on a forbidden request and on a Google difference", () => {
        expect(auditRow("/", [gtag], [gtag, `http://s/fx.js`], "http://l", "http://s").ok).toBe(false);
        const r = auditRow("/", [gtag], [], "http://l", "http://s");
        expect(r.ok).toBe(false);
        expect(formatAudit([r])).toContain("google requests differ");
    });
    test("googleRequests drops query strings and repeats", () => {
        expect(googleRequests([gtag, gtag + "2", "https://www.google-analytics.com/g/collect?v=2", "http://x/y"])).toEqual(["https://www.google-analytics.com/g/collect", "https://www.googletagmanager.com/gtag/js"]);
    });
    test("a page with no legacy file must make the one gtag.js request", () => {
        expect(auditRow("/story.html", null, [gtag], "http://l", "http://s").ok).toBe(true);
        expect(auditRow("/story.html", null, [], "http://l", "http://s").ok).toBe(false);
    });
    test("every migrated page is audited", () => { expect(PAGES).toContain("/fleet.html"); expect(PAGES.length).toBe(19); });
});
