import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clamp, initialState, makeCatalog, money, view, LEGACY_PRICES, type AddonId, type BuilderState, type Catalog, type PlanId } from "./builder";

const REPO = join(import.meta.dir, "../../../../..");
const SEED = JSON.parse(readFileSync(join(REPO, "server/data/prices.seed.json"), "utf8")) as { prices: Record<string, { amountCents: number }> };
const catalog = (): Catalog => makeCatalog((k) => (SEED.prices[k] ? SEED.prices[k].amountCents / 100 : NaN));

describe("catalog", () => {
    test("the seed prices equal the literals the legacy script held, Business keeps its literal", () => {
        const c = catalog();
        expect(c.plans.homelab.price).toBe(LEGACY_PRICES.homelab);
        expect(c.plans.startup.price).toBe(LEGACY_PRICES.startup);
        expect(c.plans.business.price).toBe(129.49);
        expect(c.addons.map((a) => a.price)).toEqual([3.5, 9, 4, 2, 12, 3, 10, 15]);
    });
    test("a price from the cache replaces the literal; a missing one falls back to the literal", () => {
        const c = makeCatalog((k) => (k === "network.homelab.month" ? 7.25 : NaN));
        expect(c.plans.homelab.price).toBe(7.25);
        expect(c.plans.startup.price).toBe(37.49);
        expect(c.addons[0].price).toBe(3.5);
    });
    test("money formats like the legacy page", () => {
        expect(money(0)).toBe("$0");
        expect(money(6.49)).toBe("$6.49");
        expect(money(9)).toBe("$9");
        expect(money(1234.5)).toBe("$1,234.50");
    });
});

describe("view", () => {
    test("the default state", () => {
        const v = view(catalog(), initialState(), false, null);
        expect(v.total).toBe("$37.49");
        expect(v.per).toBe("/ month");
        expect(v.note).toBe("Month to month, no setup fee.");
        expect(v.summary).toBe("4 IPv4, IPv6 /56, 2 locations, 3 tunnels, up to 1 Gbps, 5 TB volume, 1 anycast.");
        expect(v.hint).toBe("");
        expect(v.tiles).toHaveLength(8);
        expect(v.blocks.map((b) => b.label)).toEqual(["Startup plan"]);
    });
    test("yearly billing is ten months and shows what is saved", () => {
        const s: BuilderState = { plan: "homelab", bill: "year", qty: {} };
        const v = view(catalog(), s, false, null);
        expect(v.total).toBe("$64.90");
        expect(v.per).toBe("/ year");
        expect(v.note).toBe("Two months free: that is $12.98 off a year.");
    });
    test("anycast without a second location gives the hint; Business blocks extra volume", () => {
        const c = catalog();
        const hint = view(c, { plan: "homelab", bill: "month", qty: { any: 1 } }, false, null);
        expect(hint.hint).toContain("add a location");
        const biz: BuilderState = { plan: "business", bill: "month", qty: { tb: 3 } };
        const q = clamp(c, biz);
        expect(q.tb).toBe(0);
        const v = view(c, { ...biz, qty: q }, false, null);
        expect(v.tiles.find((t) => t.id === "tb")?.off).toBe(true);
        expect(v.summary).toContain("billed on measured use");
    });
    test("the add-on just added drops unless motion is reduced; the mailto carries the setup", () => {
        const c = catalog();
        const s: BuilderState = { plan: "startup", bill: "month", qty: { ipv4: 2 } };
        expect(view(c, s, false, "ipv4").blocks[1]).toMatchObject({ label: "Extra IPv4 address × 2", amt: "$7", drop: true });
        expect(view(c, s, true, "ipv4").blocks[1].drop).toBe(false);
        const q = decodeURIComponent(view(c, s, false, null).quote);
        expect(q).toContain("subject=Network Solutions: Startup setup");
        expect(q).toContain("+ Extra IPv4 address x 2");
        expect(q).toContain("Estimated total: $44.49 / month");
    });
    test("clamp keeps location and gateway inside what the plan allows", () => {
        const c = catalog();
        expect(clamp(c, { plan: "startup", bill: "month", qty: { loc: 99, gw: 99, byo: 5 } })).toMatchObject({ loc: 5, gw: 7, byo: 1 });
    });
});

// The strongest check: run the legacy page's own inline script against a small fake DOM and drive it with the same actions as the port; every number and sentence it shows must equal what view() gives.
interface FakeEl { id?: string; className: string; _html: string; textContent: string; hidden: boolean; href: string; children: FakeEl[]; attrs: Record<string, string>; onclick: (() => void) | null; _buttons?: FakeEl[]; innerHTML: string; appendChild(c: FakeEl): void; getAttribute(n: string): string | null; setAttribute(n: string, v: string): void; querySelectorAll(sel: string): FakeEl[]; focus(): void; disabled: boolean }

const legacyScript = (): string => {
    const html = readFileSync(join(REPO, "network.html"), "utf8");
    const m = /<script>\s*(\(function \(\) \{[\s\S]*?\}\)\(\));\s*<\/script>/.exec(html);
    if (!m) throw new Error("the inline script of network.html was not found");
    return m[1];
};

const el = (): FakeEl => {
    const e: FakeEl = {
        className: "", _html: "", textContent: "", hidden: false, href: "", children: [], attrs: {}, onclick: null, disabled: false,
        get innerHTML() { return e._html; },
        set innerHTML(v: string) {
            e._html = v;
            if (v === "") e.children = [];
        },
        appendChild(c) { e.children.push(c); },
        getAttribute: (n) => e.attrs[n] ?? null,
        setAttribute: (n, v) => { e.attrs[n] = v; },
        querySelectorAll: (sel) => {
            if (sel !== "button") return [];
            // buttons inside innerHTML, in order; `disabled` read from the tag text
            const tags = [...e._html.matchAll(/<button[^>]*>/g)].map((t) => t[0]);
            e._buttons ??= tags.map((t) => ({ ...el(), disabled: / disabled/.test(t) }));
            return e._buttons;
        },
        focus() {},
    } as FakeEl;
    return e;
};

const runLegacy = () => {
    const ids: Record<string, FakeEl> = {};
    for (const id of ["tiles", "stack", "total", "per", "summary", "hint", "quote", "note"]) ids[id] = el();
    const planBtns = ["homelab", "startup", "business"].map((p) => { const b = el(); b.attrs["data-plan"] = p; return b; });
    const billBtns = ["month", "year"].map((p) => { const b = el(); b.attrs["data-bill"] = p; return b; });
    const doc = {
        getElementById: (id: string) => ids[id],
        querySelectorAll: (sel: string) => (sel === "#seg-plan button" ? planBtns : billBtns),
        createElement: () => el(),
    };
    const win = { matchMedia: () => ({ matches: false }) };
    new Function("document", "window", legacyScript())(doc, win);
    return { ids, planBtns, billBtns };
};

describe("the port equals the legacy inline script", () => {
    test("a long sequence of plan, billing and add-on changes shows the same everywhere", () => {
        const c = catalog();
        const L = runLegacy();
        let s: BuilderState = initialState();
        let drop: AddonId | null = null;
        const same = (label: string) => {
            const v = view(c, s, false, drop);
            const tilesLegacy = L.ids.tiles.children.map((t) => ({ cls: t.className, html: t.innerHTML }));
            expect(L.ids.total.textContent).toBe(v.total);
            expect(L.ids.per.textContent).toBe(v.per);
            expect(L.ids.note.textContent).toBe(v.note);
            expect(L.ids.summary.textContent).toBe(v.summary);
            expect(L.ids.hint.hidden ? "" : L.ids.hint.textContent).toBe(v.hint);
            expect(L.ids.quote.href).toBe(v.quote);
            expect(tilesLegacy.map((t) => t.cls)).toEqual(v.tiles.map((t) => ["tile", t.on && "on", t.off && "off"].filter(Boolean).join(" ")));
            v.tiles.forEach((t, i) => {
                const h = tilesLegacy[i].html;
                expect(h).toContain(`<div class="fw-semibold">${t.name}</div><div class="small text-muted">${t.sub}</div>`);
                expect(h).toContain(`<span class="n">${t.q}</span>`);
                const [rm, add] = [...h.matchAll(/<button[^>]*>/g)].map((x) => x[0]);
                expect(/ disabled/.test(rm)).toBe(t.removeDisabled);
                expect(/ disabled/.test(add)).toBe(t.addDisabled);
            });
            const blocks = L.ids.stack.children.map((b) => ({ cls: b.className, html: b.innerHTML.replace(/&times;/g, "×") }));
            expect(blocks.map((b) => b.cls)).toEqual(v.blocks.map((b) => ["blk", b.base && "base", b.drop && "drop"].filter(Boolean).join(" ")));
            expect(blocks.map((b) => b.html)).toEqual(v.blocks.map((b) => `<span>${b.label}</span><span class="amt">${b.amt}</span>`));
            void label;
        };
        const plan = (p: PlanId) => { L.planBtns.find((b) => b.attrs["data-plan"] === p)?.onclick?.(); s = { ...s, plan: p }; s.qty = clamp(c, s); drop = null; same(`plan ${p}`); };
        const bill = (b: "month" | "year") => { L.billBtns.find((x) => x.attrs["data-bill"] === b)?.onclick?.(); s = { ...s, bill: b }; s.qty = clamp(c, s); drop = null; same(`bill ${b}`); };
        const tile = (i: number, k: 0 | 1) => {
            const t = L.ids.tiles.children[i];
            t.querySelectorAll("button")[k].onclick?.();
            const id = c.addons[i].id;
            s = { ...s, qty: { ...s.qty, [id]: (s.qty[id] || 0) + (k ? 1 : -1) } };
            s.qty = clamp(c, s);
            drop = k ? id : null;
            same(`tile ${i} ${k}`);
        };
        same("init");
        for (const i of [0, 0, 0, 1, 4, 5, 5, 6, 6, 6, 7, 7, 2, 3, 3]) tile(i, 1);
        tile(0, 0);
        plan("business"); bill("year"); plan("homelab"); tile(3, 1); tile(3, 1); plan("business"); bill("month"); plan("startup");
        for (let n = 0; n < 6; n++) tile(1, 1);
        for (let i = 0; i < 8; i++) for (let n = 0; n < 70; n++) if (!(L.ids.tiles.children[i].querySelectorAll("button")[0].disabled)) tile(i, 0);
        plan("homelab"); tile(4, 1);
        // gateways depend on the clamped location count: raise both, then shrink the plan
        plan("startup"); for (let n = 0; n < 5; n++) tile(1, 1);
        for (let n = 0; n < 8; n++) tile(6, 1);
        plan("business"); plan("homelab"); plan("startup");
    });
});
