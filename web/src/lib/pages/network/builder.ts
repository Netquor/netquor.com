// The stack builder of /network.html ("Build it your way"), ported from the page's inline script as pure functions so it can be tested. The Svelte island (Builder.svelte) owns the state and the DOM; everything that decides a number or a sentence is here.

export type PlanId = "homelab" | "startup" | "business";
export type Bill = "month" | "year";
export type AddonId = "ipv4" | "loc" | "tun" | "tb" | "any" | "v6" | "gw" | "byo";

export interface Included { ipv4: number; loc: number; tun: number; tb: number | null; any: number; v6: string; speed: string }
export interface Plan { name: string; price: number; inc: Included }
export interface Addon { id: AddonId; name: string; price: number; unit: string; max: number }
export interface Catalog { plans: Record<PlanId, Plan>; addons: Addon[] }
export interface BuilderState { plan: PlanId; bill: Bill; qty: Partial<Record<AddonId, number>> }

/** Price keys of the plans and add-ons that are published prices. Business has no key: the page contradicts itself ($129.49 in the card and this table, "starts at $99" in the FAQ) and the owner has not decided yet, so its price stays the literal below. */
export const PLAN_KEYS: Partial<Record<PlanId, string>> = { homelab: "network.homelab.month", startup: "network.startup.month" };
export const ADDON_KEYS: Record<AddonId, string> = {
    ipv4: "network.addon_ipv4.month", loc: "network.addon_location.month", tun: "network.addon_tunnel.month", tb: "network.addon_volume_tb.month",
    any: "network.addon_anycast.month", v6: "network.addon_ipv6_48.month", gw: "network.addon_gateway.month", byo: "network.addon_byo_prefix.month",
};

/** The legacy page's literal prices: used for Business and whenever a price lookup gives no number. */
export const LEGACY_PRICES = { homelab: 6.49, startup: 37.49, business: 129.49, ipv4: 3.5, loc: 9, tun: 4, tb: 2, any: 12, v6: 3, gw: 10, byo: 15 } as const;

/** `dollars(key)` returns the price in dollars for a key, or NaN when there is none. */
export const makeCatalog = (dollars: (key: string) => number): Catalog => {
    const pick = (key: string | undefined, legacy: number): number => { const v = key ? dollars(key) : NaN; return Number.isFinite(v) ? v : legacy; };
    return {
        plans: {
            homelab: { name: "Homelab", price: pick(PLAN_KEYS.homelab, LEGACY_PRICES.homelab), inc: { ipv4: 1, loc: 1, tun: 1, tb: 2, any: 0, v6: "/56", speed: "1 Gbps" } },
            startup: { name: "Startup", price: pick(PLAN_KEYS.startup, LEGACY_PRICES.startup), inc: { ipv4: 4, loc: 2, tun: 3, tb: 5, any: 1, v6: "/56", speed: "1 Gbps" } },
            business: { name: "Business", price: LEGACY_PRICES.business, inc: { ipv4: 8, loc: 4, tun: 8, tb: null, any: 2, v6: "/48", speed: "2.5 Gbps" } },
        },
        addons: [
            { id: "ipv4", name: "Extra IPv4 address", price: pick(ADDON_KEYS.ipv4, LEGACY_PRICES.ipv4), unit: "address", max: 64 },
            { id: "loc", name: "Extra location", price: pick(ADDON_KEYS.loc, LEGACY_PRICES.loc), unit: "location", max: 7 },
            { id: "tun", name: "Extra tunnel", price: pick(ADDON_KEYS.tun, LEGACY_PRICES.tun), unit: "tunnel", max: 32 },
            { id: "tb", name: "Extra volume", price: pick(ADDON_KEYS.tb, LEGACY_PRICES.tb), unit: "TB", max: 100 },
            { id: "any", name: "Anycast address", price: pick(ADDON_KEYS.any, LEGACY_PRICES.any), unit: "address", max: 16 },
            { id: "v6", name: "Extra IPv6 /48", price: pick(ADDON_KEYS.v6, LEGACY_PRICES.v6), unit: "/48", max: 16 },
            { id: "gw", name: "Dedicated transit gateway", price: pick(ADDON_KEYS.gw, LEGACY_PRICES.gw), unit: "per location", max: 4 },
            { id: "byo", name: "Bring your own prefix", price: pick(ADDON_KEYS.byo, LEGACY_PRICES.byo), unit: "", max: 1 },
        ],
    };
};

export const money = (n: number): string => "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export const initialState = (): BuilderState => ({ plan: "startup", bill: "month", qty: {} });

export const maxFor = (c: Catalog, s: BuilderState, a: Addon): number => {
    const inc = c.plans[s.plan].inc;
    if (a.id === "loc") return 7 - inc.loc; // seven locations in all
    if (a.id === "gw") return inc.loc + (s.qty.loc || 0); // one gateway per location you use
    return a.max;
};

/** Business is billed on measured use, so extra volume cannot be added to it. */
export const blocked = (s: BuilderState, a: Addon): boolean => a.id === "tb" && s.plan === "business";

/** The quantities pulled back into what the plan allows. Run after every change, as the legacy page did before every render. */
export const clamp = (c: Catalog, s: BuilderState): BuilderState["qty"] => {
    // Add-ons are clamped in order and each limit sees the ones already clamped (the gateway limit depends on the clamped location count), as the legacy loop mutated its state as it went.
    const run: BuilderState = { ...s, qty: { ...s.qty } };
    for (const a of c.addons) {
        const m = blocked(run, a) ? 0 : maxFor(c, run, a);
        run.qty[a.id] = Math.max(0, Math.min(run.qty[a.id] || 0, m));
    }
    return run.qty;
};

export interface Totals { ipv4: number; loc: number; tun: number; tb: number | null; any: number; v6: string; gw: number; byo: boolean }

export const totals = (c: Catalog, s: BuilderState): Totals => {
    const inc = c.plans[s.plan].inc, q = s.qty;
    return {
        ipv4: inc.ipv4 + (q.ipv4 || 0), loc: inc.loc + (q.loc || 0), tun: inc.tun + (q.tun || 0),
        tb: inc.tb === null ? null : inc.tb + (q.tb || 0), any: inc.any + (q.any || 0),
        v6: inc.v6 + (q.v6 ? " + " + q.v6 + " extra /48" + (q.v6 > 1 ? "s" : "") : ""), gw: q.gw || 0, byo: !!q.byo,
    };
};

export interface Tile { id: AddonId; name: string; q: number; off: boolean; on: boolean; sub: string; removeDisabled: boolean; addDisabled: boolean }
export interface Block { id: string; label: string; amt: string; base: boolean; drop: boolean }
export interface View {
    tiles: Tile[]; blocks: Block[]; total: string; per: string; note: string; summary: string; hint: string; quote: string;
}

/** Everything the page shows for a state (which must already be clamped). `reduce` is prefers-reduced-motion, `dropId` the add-on just added. */
export const view = (c: Catalog, s: BuilderState, reduce: boolean, dropId: AddonId | null): View => {
    const plan = c.plans[s.plan];
    let sum = plan.price;
    const blocks: Block[] = [{ id: "base", label: plan.name + " plan", amt: money(plan.price), base: true, drop: false }];
    for (const a of c.addons) {
        const q = s.qty[a.id] || 0;
        if (!q) continue;
        const cost = q * a.price;
        sum += cost;
        blocks.push({ id: a.id, label: a.name + (q > 1 ? " × " + q : ""), amt: money(cost), base: false, drop: dropId === a.id && !reduce });
    }
    const yearly = s.bill === "year", shown = yearly ? sum * 10 : sum;
    const t = totals(c, s);
    const loc = t.loc + " location" + (t.loc > 1 ? "s" : "") + ", " + t.tun + " tunnel" + (t.tun > 1 ? "s" : "");
    const summary = t.ipv4 + " IPv4, IPv6 " + t.v6 + ", " + loc + ", up to " + plan.inc.speed + (t.tb === null ? ", billed on measured use" : ", " + t.tb + " TB volume") + (t.any ? ", " + t.any + " anycast" : "") + (t.gw ? ", " + t.gw + " dedicated gateway" + (t.gw > 1 ? "s" : "") : "") + (t.byo ? ", your own prefix" : "") + ".";
    const hint = t.any && t.loc < 2 ? "Anycast announces from more than one location: add a location to use it." : "";
    const lines = ["Plan: " + plan.name + " (" + (yearly ? "yearly" : "monthly") + ")"];
    for (const a of c.addons) { const q = s.qty[a.id] || 0; if (q) lines.push("+ " + a.name + (q > 1 ? " x " + q : "")); }
    lines.push("", t.ipv4 + " IPv4, IPv6 " + t.v6 + ", " + loc, "Estimated total: " + money(shown) + (yearly ? " / year" : " / month"), "", "What I am building:");
    const tiles: Tile[] = c.addons.map((a) => {
        const q = s.qty[a.id] || 0, off = blocked(s, a), m = off ? 0 : maxFor(c, s, a);
        return {
            id: a.id, name: a.name, q, off, on: q > 0,
            sub: money(a.price) + " / month" + (a.unit ? " per " + a.unit.replace(/^per /, "") : "") + (off ? " (Business is billed on measured use)" : ""),
            removeDisabled: !q, addDisabled: q >= m,
        };
    });
    return {
        tiles, blocks, total: money(shown), per: yearly ? "/ year" : "/ month",
        note: yearly ? "Two months free: that is " + money(sum * 2) + " off a year." : "Month to month, no setup fee.",
        summary, hint,
        quote: "mailto:hello@netquor.com?subject=" + encodeURIComponent("Network Solutions: " + plan.name + " setup") + "&body=" + encodeURIComponent(lines.join("\n")),
    };
};
