import { describe, expect, test } from "bun:test";
import { applyIntentionalChanges, contactNumbers, INTENTIONAL_CHANGES, localPageLinks } from "./intentional";

describe("intentional changes since the baseline", () => {
    test("every change has an id, a date and a real reason", () => {
        const ids = new Set<string>();
        for (const c of INTENTIONAL_CHANGES) { expect(ids.has(c.id)).toBe(false); ids.add(c.id); expect(c.since).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(c.reason.length).toBeGreaterThan(15); }
    });
    test("every patch is idempotent", () => {
        const html = '<p class="nq-footer-contact"><a href="mailto:hello@netquor.com">hello@netquor.com</a><br><a href="tel:+18887171701">+1 (888) 717-1701</a></p><script type="application/ld+json">{"telephone": "+1-888-717-1701"}</script>';
        for (const c of INTENTIONAL_CHANGES) expect(c.apply(c.apply(html))).toBe(c.apply(html));
    });
    test("contact numbers: footer, contact link, buttons, Central, FAQ, structured data and plain links", () => {
        const foot = contactNumbers.apply('<br><a href="tel:+18887171701">+1 (888) 717-1701</a></p>');
        expect(foot).toBe('<br><a href="tel:+18887171701">Toll-free +1 (888) 717-1701</a><br><a href="tel:+17019601701">Local +1 (701) 960-1701</a></p>');
        const btn = contactNumbers.apply('<a class="btn btn-outline-info btn-lg rounded-pill px-4" href="tel:+18887171701">+1 (888) 717-1701</a>');
        expect(btn).toContain(">Toll-free +1 (888) 717-1701</a>");
        expect(btn).toContain('href="tel:+17019601701">Local +1 (701) 960-1701</a>');
        expect(contactNumbers.apply('<a href="tel:+18887171701" class="btn btn-outline-info btn-lg">Call +1 (888) 717-1701</a>')).toContain("Call local +1 (701) 960-1701");
        expect(contactNumbers.apply('or call <a href="tel:+18887171701">+1 (888) 717-1701</a>.')).toContain("locally at +1 (701) 960-1701");
        expect(contactNumbers.apply('<a href="tel:+18887171701" class="x">+1 (888) 717-1701</a>')).toBe('<a href="tel:+18887171701" class="x">Toll-free +1 (888) 717-1701</a>');
        expect(contactNumbers.apply('{"telephone": "+1-888-717-1701"}')).toBe('{"telephone": ["+1-888-717-1701", "+1-701-960-1701"]}');
    });
    test("local page links: footer and home section, once", () => {
        const html = '<a href="startups.html">For startups</a> and remotely anywhere in the Midwest.</p>';
        const out = localPageLinks.apply(html);
        expect(out.match(/fargo-moorhead\.html/g)).toHaveLength(2);
        expect(localPageLinks.apply(out)).toBe(out);
    });
    test("pages with no contact numbers are untouched", () => {
        const html = "<h1>Hi</h1><p>+1 (800) 000-0000</p>";
        expect(applyIntentionalChanges(html)).toBe(html);
    });
});
