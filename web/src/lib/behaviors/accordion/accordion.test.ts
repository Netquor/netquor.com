import { describe, expect, test } from "bun:test";
import { renderSvelte } from "../../server/svelteHarness";
import { collapse } from "./action";
import { FakeDoc, h } from "./fakeDom";
import { openIds, viewItems } from "./model";

const items = [
    { id: "q0", q: "What is it?", a: "A <b>thing</b>." },
    { id: "q1", q: "Cost & terms?", a: "Free.", open: true },
    { id: "q2", q: "Where?", a: "Fargo.", open: true },
];

describe("model", () => {
    test("exclusive: the first open item wins; not exclusive: all marked items", () => {
        expect([...openIds(items, true)]).toEqual(["q1"]);
        expect([...openIds(items, false)]).toEqual(["q1", "q2"]);
    });
    test("view classes and aria match Bootstrap's markup for closed and open", () => {
        const v = viewItems(items);
        expect(v[0]).toMatchObject({ open: false, buttonClass: "accordion-button collapsed", panelClass: "accordion-collapse collapse", ariaExpanded: "false" });
        expect(v[1]).toMatchObject({ open: true, buttonClass: "accordion-button", panelClass: "accordion-collapse collapse show", ariaExpanded: "true" });
        expect(v[2].open).toBe(false);
    });
});

const render = async (props: Record<string, unknown>) => {
    const out = await renderSvelte("lib/behaviors/accordion/Accordion.svelte", props, {});
    return { body: out.body.replace(/<!--.*?-->/g, ""), head: out.head.replace(/<!--.*?-->/g, "") };
};

describe("Accordion.svelte (server render, no JavaScript)", () => {
    test("renders Bootstrap's accordion markup, complete without scripts", async () => {
        const { body } = await render({ id: "faq", items });
        expect(body).toContain('<div class="accordion" id="faq">');
        expect(body.match(/data-bs-toggle="collapse"/g)).toHaveLength(3);
        expect(body).toContain('<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#q0" aria-expanded="false" aria-controls="q0">What is it?</button>');
        expect(body).toContain('<h3 class="accordion-header">');
        expect(body).toContain('<div id="q0" class="accordion-collapse collapse" data-bs-parent="#faq"><div class="accordion-body text-muted small">A <b>thing</b>.</div></div>');
    });
    test("the open item is server-rendered open: no collapsed, aria-expanded true, show", async () => {
        const { body } = await render({ id: "faq", items });
        expect(body).toContain('<button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#q1" aria-expanded="true" aria-controls="q1">Cost &amp; terms?</button>');
        expect(body).toContain('<div id="q1" class="accordion-collapse collapse show" data-bs-parent="#faq">');
        expect(body).toContain('<div id="q2" class="accordion-collapse collapse" ');
    });
    test("exclusive=false drops data-bs-parent and keeps every open item", async () => {
        const { body } = await render({ id: "faq", items, exclusive: false });
        expect(body).not.toContain("data-bs-parent");
        expect(body).toContain('id="q2" class="accordion-collapse collapse show"');
    });
    test("headingLevel and bodyClass", async () => {
        const { body } = await render({ id: "faq", items, headingLevel: 2, bodyClass: "small" });
        expect(body).toContain('<h2 class="accordion-header">');
        expect(body).toContain('<div class="accordion-body small">');
    });
    test("showWithoutJs adds a noscript rule to the head, off by default", async () => {
        expect((await render({ id: "faq", items })).head).not.toContain("noscript");
        expect((await render({ id: "faq", items, showWithoutJs: true })).head).toContain("<noscript><style>#faq .collapse:not(.show){display:block}</style></noscript>");
    });
});

describe("collapse action", () => {
    test("wires on mount and removes its listener on destroy", () => {
        const doc = new FakeDoc();
        const t = h(doc, "button", { "data-bs-toggle": "collapse", "data-bs-target": "#p" });
        const p = h(doc, "div", { id: "p", class: "collapse show" });
        const root = h(doc, "div", {}, [t, p]);
        doc.documentElement.append(root);
        const a = collapse(root as unknown as Element);
        expect(root.listenerCount("click")).toBe(1);
        expect(t.getAttribute("aria-expanded")).toBe("true");
        a.destroy();
        expect(root.listenerCount("click")).toBe(0);
    });
});
