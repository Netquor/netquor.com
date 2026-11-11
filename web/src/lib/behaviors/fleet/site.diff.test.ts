// Differential test of the page behavior: the legacy fleet/site.js (with the legacy fleet/pricing.js) runs in a sandbox against a hand-written fake DOM, and the port's model is driven with the same events. After every step the cards, tags, verdict, breakdown, error, inputs and form fields must match, and the form submit must produce the same status lines, button states and mailto: URL.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { get } from "svelte/store";
import { createFleetModel, type Timers } from "./model";
import { fleetPricesFrom } from "./prices";
import { statusClass } from "./form";

const ROOT = join(import.meta.dir, "../../../../../fleet");

class El {
    private v = "";
    get value(): string { return this.v; }
    set value(x: unknown) { this.v = String(x); }
    textContent = "";
    hidden = false;
    checked = false;
    max = "";
    className = "";
    disabled = false;
    dataset: Record<string, string> = {};
    attrs: Record<string, string> = {};
    children: El[] = [];
    elements: Record<string, El> = {};
    name = "";
    private on: Record<string, ((e: unknown) => unknown)[]> = {};
    private cls = new Set<string>();
    classList = { toggle: (c: string, force: boolean) => { if (force) this.cls.add(c); else this.cls.delete(c); }, contains: (c: string) => this.cls.has(c) };
    constructor(public id = "") {}
    setAttribute(k: string, v: string) { this.attrs[k] = v; }
    getAttribute(k: string) { return this.attrs[k] ?? null; }
    addEventListener(t: string, fn: (e: unknown) => unknown) { (this.on[t] ??= []).push(fn); }
    replaceChildren() { this.children = []; }
    append(c: El) { this.children.push(c); }
    querySelector() { return this.button; }
    button: El = undefined as unknown as El;
    fire(t: string, e: Record<string, unknown> = {}) { for (const fn of this.on[t] ?? []) fn({ target: this, preventDefault() {}, ...e }); }
}

const loadSource = (): string => {
    const pricing = readFileSync(join(ROOT, "pricing.js"), "utf8").replace(/export\s*\{[\s\S]*?\}\s*;?\s*$/, "");
    const site = readFileSync(join(ROOT, "site.js"), "utf8").replace(/^import .*$/m, "");
    return `${pricing}\n${site}`;
};
const SOURCE = loadSource();

interface Legacy { els: Record<string, El>; form: El; hrefs: string[]; flush(): void }

const legacyPage = (): Legacy => {
    const els: Record<string, El> = {};
    for (const id of ["calc", "calc-mac", "calc-mac-r", "calc-ios", "calc-ios-r", "calc-dedicated", "term-annual", "term-monthly", "term-lifetime", "verdict", "breakdown", "calc-error", "lead-status"]) els[id] = new El(id);
    for (const t of ["annual", "monthly", "lifetime"]) for (const p of ["main", "sub", "tag"]) els[`${t}-${p}`] = new El(`${t}-${p}`);
    els["calc-mac"].value = "25"; els["calc-mac-r"].value = "25"; els["calc-mac-r"].max = "500";
    els["calc-ios"].value = "10"; els["calc-ios-r"].value = "10"; els["calc-ios-r"].max = "500";
    els["term-annual"].classList.toggle("on", true);
    for (const t of ["annual", "monthly", "lifetime"]) els[`term-${t}`].setAttribute("aria-pressed", String(t === "annual"));
    const form = new El("lead-form");
    for (const n of ["name", "email", "company", "macs", "ios", "term", "dedicated", "message"]) { form.elements[n] = new El(); form.elements[n].name = n; }
    form.elements.macs.value = "0"; form.elements.ios.value = "0"; form.elements.term.value = "annual"; form.elements.dedicated.value = "0";
    form.button = new El();
    els["lead-form"] = form;
    let pending: (() => void) | null = null;
    const hrefs: string[] = [];
    const document = {
        getElementById: (id: string) => els[id] ?? null,
        createElement: () => new El(),
        querySelectorAll: () => [] as El[],
    };
    const window = { location: { set href(v: string) { hrefs.push(v); } } };
    const ctx = { document, window, setTimeout: (fn: () => void) => { pending = fn; return 1; }, clearTimeout: () => { pending = null; }, Number, Math, String, Set, BigInt, Intl, Array, Object, RegExp, encodeURIComponent };
    vm.runInNewContext(SOURCE, ctx);
    return { els, form, hrefs, flush: () => { const f = pending; pending = null; f?.(); } };
};

const seed = fleetPricesFrom(undefined);
const modelPage = () => {
    let pending: (() => void) | null = null;
    const hrefs: string[] = [];
    const timers: Timers = { setTimeout: (fn) => { pending = fn; return 1; }, clearTimeout: () => { pending = null; } };
    const model = createFleetModel({ prices: seed, timers, navigate: (u) => hrefs.push(u) });
    model.mount();
    return { model, hrefs, flush: () => { const f = pending; pending = null; f?.(); } };
};

const legacySnapshot = (l: Legacy) => {
    const g = (id: string) => l.els[id];
    const f = l.form.elements;
    return {
        cards: ["annual", "monthly", "lifetime"].map((t) => [g(`${t}-main`).textContent, g(`${t}-sub`).textContent, g(`${t}-tag`).textContent, g(`${t}-tag`).hidden]),
        verdict: g("verdict").textContent,
        breakdown: g("breakdown").children.map((c) => c.textContent),
        error: g("calc-error").textContent,
        inputs: [g("calc-mac").value, g("calc-mac-r").value, g("calc-ios").value, g("calc-ios-r").value],
        dedicated: g("calc-dedicated").checked,
        pressed: ["annual", "monthly", "lifetime"].map((t) => `${g(`term-${t}`).getAttribute("aria-pressed")}/${g(`term-${t}`).classList.contains("on")}`),
        form: { macs: f.macs.value, ios: f.ios.value, term: f.term.value, dedicated: f.dedicated.value, touched: l.form.dataset.touched ?? null },
    };
};

const modelSnapshot = (m: ReturnType<typeof modelPage>) => {
    const s = get(m.model.calc);
    const f = get(m.model.form);
    const cards = [s.view.annual, s.view.monthly, s.view.lifetime];
    return {
        cards: cards.map((c) => [c.main, c.sub, c.tag, s.live && !c.tag]),
        verdict: s.view.verdict,
        breakdown: s.view.breakdown,
        error: s.view.error,
        inputs: [s.macN, s.macR, s.iosN, s.iosR],
        dedicated: s.dedicated,
        pressed: ["annual", "monthly", "lifetime"].map((t) => `${s.term === t}/${s.term === t}`),
        form: { macs: f.macs, ios: f.ios, term: f.term, dedicated: f.dedicated, touched: f.touched ? "1" : null },
    };
};

type Step = ["mac" | "ios", string] | ["range-mac" | "range-ios", string] | ["dedicated", boolean] | ["term", "annual" | "monthly" | "lifetime"] | ["form-macs", string];

const apply = (l: Legacy, m: ReturnType<typeof modelPage>, step: Step) => {
    const [kind, v] = step;
    if (kind === "mac" || kind === "ios") {
        l.els[`calc-${kind}`].value = v as string;
        l.els[`calc-${kind}`].fire("input");
        l.flush();
        m.model.numberInput(kind, v as string);
        m.flush();
    } else if (kind === "range-mac" || kind === "range-ios") {
        const k = kind === "range-mac" ? "mac" : "ios";
        l.els[`calc-${k}-r`].value = v as string;
        l.els[`calc-${k}-r`].fire("input");
        l.flush();
        m.model.rangeInput(k, v as string);
        m.flush();
    } else if (kind === "dedicated") {
        l.els["calc-dedicated"].checked = v as boolean;
        l.els["calc-dedicated"].fire("change");
        m.model.setDedicated(v as boolean);
    } else if (kind === "term") {
        l.els[`term-${v}`].fire("click");
        m.model.selectTerm(v as "annual");
    } else {
        l.form.elements.macs.value = v as string;
        l.form.fire("input", { target: l.form.elements.macs });
        m.model.formInput("macs", v as string);
    }
};

describe("site.js against the port", () => {
    test("the state before and right after load agree", () => {
        const l = legacyPage();
        const m = modelPage();
        expect(modelSnapshot(m)).toEqual(legacySnapshot(l));
    });

    test("a grid of device counts, plans and the dedicated box", () => {
        const counts = ["0", "1", "7", "10", "25", "33", "99", "100", "250", "500", "800", "12.9", "-3", "", "abc", "100001"];
        let n = 0;
        for (const macs of counts) {
            for (const ios of ["0", "10", "41", "250", ""]) {
                for (const term of ["annual", "monthly", "lifetime"] as const) {
                    for (const ded of [false, true]) {
                        const l = legacyPage();
                        const m = modelPage();
                        const steps: Step[] = [["mac", macs], ["ios", ios], ["term", term], ["dedicated", ded]];
                        for (const s of steps) {
                            apply(l, m, s);
                            expect(modelSnapshot(m)).toEqual(legacySnapshot(l));
                        }
                        n++;
                    }
                }
            }
        }
        expect(n).toBeGreaterThanOrEqual(200);
    });

    test("sliders, touching the form, switching plans back and forth", () => {
        const l = legacyPage();
        const m = modelPage();
        const steps: Step[] = [["range-mac", "60"], ["range-ios", "400"], ["term", "lifetime"], ["dedicated", true], ["term", "monthly"], ["form-macs", "7"], ["mac", "33"], ["term", "annual"], ["mac", "800"], ["range-mac", "0"], ["mac", "0"], ["ios", "0"], ["term", "lifetime"], ["dedicated", false]];
        for (const s of steps) {
            apply(l, m, s);
            expect(modelSnapshot(m)).toEqual(legacySnapshot(l));
        }
    });

    test("the form submit: messages, button states, the mailto: URL", () => {
        const l = legacyPage();
        const m = modelPage();
        const f = l.form.elements;
        const say = (): [string, string] => [l.els["lead-status"].textContent, l.els["lead-status"].className];
        const values = () => ({ name: f.name.value, email: f.email.value, company: f.company.value, macs: f.macs.value, ios: f.ios.value, term: f.term.value, dedicated: f.dedicated.value, message: f.message.value });
        const mySay = (): [string, string] => { const s = get(m.model.status); return [s.text, s.text || s.kind ? statusClass(s.kind) : "status"]; };
        const submitBoth = () => {
            // the legacy handler is async: its body up to the first await runs now
            l.form.fire("submit");
            const buttons: boolean[] = [];
            m.model.submit(values(), (d) => buttons.push(d));
            return buttons;
        };
        let buttons = submitBoth();
        expect(mySay()).toEqual(say());
        expect(buttons).toEqual([]);
        f.name.value = "  Ada Lovelace ";
        buttons = submitBoth();
        expect(mySay()).toEqual(say());
        f.email.value = "ada@example";
        submitBoth();
        expect(mySay()).toEqual(say());
        f.email.value = " ada@example.com ";
        f.company.value = "Analytical Engines";
        f.message.value = " Hello ";
        l.hrefs.length = 0;
        buttons = submitBoth();
        expect(mySay()).toEqual(say());
        expect(say()).toEqual(["Opening your email app. If nothing opens, write to hello@netquor.com.", "status ok"]);
        expect(buttons).toEqual([true, false]);
        expect(l.form.button.disabled).toBe(false);
        expect(m.hrefs).toEqual(l.hrefs);
        expect(m.hrefs.length).toBe(1);
    });
});
