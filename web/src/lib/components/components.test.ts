import { beforeEach, describe, expect, test } from "bun:test";
import { PRICE_FALLBACKS, priceText, resetPriceWarnings, UNKNOWN_PRICE_TEXT } from "../priceFallbacks";
import { renderComponent } from "../server/svelteHarness";
import { snap } from "../server/testkit";

beforeEach(() => resetPriceWarnings());

const dataFor = (prices: Record<string, number>, version = 7) => ({ prices: snap(version, prices).prices, priceVersion: version });
const quiet = async (fn: () => Promise<string>) => {
    const orig = console.error;
    const lines: string[] = [];
    console.error = (...a: unknown[]) => { lines.push(a.join(" ")); };
    try { return { html: await fn(), lines }; } finally { console.error = orig; }
};

describe("Price", () => {
    test("renders the snapshot's price", async () => {
        const html = await renderComponent("Price.svelte", { key: "vpn.from.month" }, dataFor({ "vpn.from.month": 700 }));
        expect(html).toContain('data-price="vpn.from.month"');
        expect(html).toContain(">$7<");
    });
    test("a missing key with an explicit fallback shows the fallback and does not throw", async () => {
        const { html } = await quiet(() => renderComponent("Price.svelte", { key: "vpn.from.month", fallback: "$5" }, dataFor({})));
        expect(html).toContain(">$5<");
    });
    test("a missing key without a fallback shows the last-known seed price", async () => {
        const { html } = await quiet(() => renderComponent("Price.svelte", { key: "vpn.from.month" }, dataFor({})));
        const seeded = PRICE_FALLBACKS["vpn.from.month"].amountCents / 100;
        expect(html).toContain(`>$${seeded}<`);
    });
    test("a key that is nowhere shows neutral text and does not throw", async () => {
        const { html } = await quiet(() => renderComponent("Price.svelte", { key: "no.such.key" }, dataFor({})));
        expect(html).toContain(`>${UNKNOWN_PRICE_TEXT}<`);
    });
    test("page data without prices at all still renders", async () => {
        const { html } = await quiet(() => renderComponent("Price.svelte", { key: "vpn.from.month" }, {}));
        expect(html).toContain("data-price");
    });
});

describe("Nav on a page whose snapshot lacks the VPN key", () => {
    test("renders (the page stays a 200) with the fallback text, and logs once", async () => {
        const data = dataFor({ "fleet.mac.month": 595 });
        const a = await quiet(() => renderComponent("Nav.svelte", { current: "/subnet-calculator.html" }, data));
        expect(a.html).toContain("Local WireGuard VPN from ");
        expect(a.html).toContain('data-price="vpn.from.month"');
        expect(a.html).toContain("Netquor Fleet");
        expect(a.lines.filter((l) => l.includes("vpn.from.month")).length).toBe(1);
        const b = await quiet(() => renderComponent("Nav.svelte", { current: "/" }, data));
        expect(b.lines.length).toBe(0);
    });
});

describe("priceText", () => {
    test("logs once per key per version; a new version logs again", () => {
        const lines: string[] = [];
        const log = (l: string) => lines.push(l);
        priceText({}, "vpn.from.month", "usd0", undefined, 1, log);
        priceText({}, "vpn.from.month", "usd0", undefined, 1, log);
        expect(lines.length).toBe(1);
        priceText({}, "vpn.from.month", "usd0", undefined, 2, log);
        expect(lines.length).toBe(2);
    });
    test("inherited object keys are not prices", () => {
        expect(priceText({}, "constructor", "usd0", undefined, 1, () => {})).toBe(UNKNOWN_PRICE_TEXT);
    });
});

describe("Nav", () => {
    test("static adds nq-static; the default does not", async () => {
        expect(await renderComponent("Nav.svelte", { current: "/" }, dataFor({}))).not.toContain("nq-static");
        expect(await renderComponent("Nav.svelte", { current: "/", static: true }, dataFor({}))).toContain('class="nq-nav nq-static"');
    });
});

const tidy = async (file: string, props: Record<string, unknown>, data: Record<string, unknown>) => (await renderComponent(file, props, data)).replace(/<!--.*?-->/g, "").replace(/>\s+</g, "><");

describe("Faq", () => {
    const items = [{ q: "Who?", a: 'Mail <a href="mailto:hello@netquor.com">us</a> &amp; ask.' }, { q: "Open one", a: "Yes.", id: "apple", open: true }];
    test("renders details in order with trusted HTML answers, ids and open where given", async () => {
        const html = await tidy("Faq.svelte", { items }, {});
        expect(html).toContain('<div class="nq-faq">');
        expect(html).toContain("<summary>Who?</summary><p>Mail <a href=\"mailto:hello@netquor.com\">us</a> &amp; ask.</p>");
        expect(html.indexOf("Who?")).toBeLessThan(html.indexOf("Open one"));
        expect(html).toMatch(/<details id="apple" open(="")?>/);
        expect(html.match(/<details/g)?.length).toBe(2);
    });
    test("a question is escaped as text", async () => {
        expect(await tidy("Faq.svelte", { items: [{ q: "a <b> & c", a: "x" }] }, {})).toContain("<summary>a &lt;b> &amp; c</summary>");
    });
    test("an extra class is added after nq-faq", async () => {
        expect(await tidy("Faq.svelte", { items: [], class: "nq-cmp-list" }, {})).toContain('class="nq-faq nq-cmp-list"');
    });
});

describe("SectionHead", () => {
    test("eyebrow, h2 and lead; the lead may hold a link", async () => {
        const html = await tidy("SectionHead.svelte", { eyebrow: "Questions", title: "Common questions", lead: 'See <a href="/x">x</a>.' }, {});
        expect(html).toContain('<div class="nq-section-head"><p class="nq-eyebrow">Questions</p><h2>Common questions</h2><p class="text-muted">See <a href="/x">x</a>.</p></div>');
    });
    test("eyebrow and lead are optional", async () => {
        const html = await tidy("SectionHead.svelte", { title: "Only" }, {});
        expect(html).toContain("<h2>Only</h2>");
        expect(html).not.toContain("nq-eyebrow");
        expect(html).not.toContain("text-muted");
    });
});

describe("CmpTable", () => {
    test("head, rows, HTML cells, and nq-me on the marked rows", async () => {
        const html = await tidy("CmpTable.svelte", { head: ["Option", "Price"], rows: [['<a href="/f">Fleet</a>', "$5.95"], ["Other", "$9"]], mine: [0] }, {});
        expect(html).toContain('<div class="nq-cmp-wrap"><table class="nq-cmp"><thead><tr><th>Option</th><th>Price</th></tr></thead>');
        expect(html).toContain('<tr class="nq-me"><td><a href="/f">Fleet</a></td><td>$5.95</td></tr>');
        expect(html).toContain("<tr><td>Other</td><td>$9</td></tr>");
    });
});
