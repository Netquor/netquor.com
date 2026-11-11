// scan-prices.ts: finds every dollar amount in the legacy pages (visible text, attributes, JSON-LD and the Network page's JS price table) and classifies it against the price seed. `bun web/migration/scan-prices.ts` rewrites price-inventory.json; the inventory test re-runs the scan and fails when a page gains a price this file does not classify.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type Kind = "price" | "derived" | "range-part" | "jsonld";
export interface Entry { text: string; key: string | null; kind: Kind; note: string; line: number; amount: string }
export interface Hit { line: number; amount: string; value: number; text: string; ctx: string; jsonld: boolean; nqRow: boolean; before: string; after: string }

export const repoRoot = resolve(import.meta.dir, "../..");

const unescape = (s: string): string => s.replace(/&middot;/g, "·").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&mdash;/g, "-").replace(/&ndash;/g, "-").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
const strip = (s: string): string => unescape(s.replace(/<[^>]*>/g, ""));

/** Every dollar amount on every line, with the visible text around it. */
export const scanHtml = (html: string, file: string): Hit[] => {
    const hits: Hit[] = [];
    const lines = html.split("\n");
    lines.forEach((raw, i) => {
        const ld = raw.includes("application/ld+json");
        const isJs = file === "network.html" && /^\s*(homelab|startup|business):|^\s*\{ id: '/.test(raw);
        const re = ld ? /"price"\s*:\s*"(\d[\d.]*)"/g : isJs ? /price:\s*(\d[\d.]*)/g : /\$\s?(\d(?:[\d,]*\d)?(?:\.\d+)?)/g;
        for (const m of raw.matchAll(re)) {
            const at = m.index!;
            const amount = (ld || isJs ? m[1] : m[0].replace(/\s/g, ""));
            const value = Number((ld || isJs ? m[1] : m[1]).replace(/,/g, ""));
            let text: string; let ctx: string;
            if (ld) {
                const before = raw.slice(Math.max(0, at - 140), at); const nm = [...before.matchAll(/"name"\s*:\s*"([^"]*)"/g)].pop();
                text = `"price": "${m[1]}"` + (nm ? ` (${nm[1]})` : ""); ctx = (nm ? nm[1] : "") + "|" + before.slice(-100);
            } else if (isJs) {
                const nm = /name:\s*'([^']*)'/.exec(raw); text = `${nm ? nm[1] : "?"}: price ${m[1]}`; ctx = nm ? nm[1] : "";
            } else {
                const attr = /(?:content|title)="([^"]*)"/.exec(raw.slice(0, at + 200));
                const inAttr = /<meta [^>]*content="[^"]*$/.test(raw.slice(0, at));
                if (inAttr && attr === null) { text = ""; }
                let hay: string; let rel: number;
                if (inAttr || /<title>[^<]*$/.test(raw.slice(0, at))) {
                    const open = Math.max(raw.lastIndexOf('content="', at), raw.lastIndexOf("<title>", at));
                    const start = raw.lastIndexOf('"', at) >= open && raw.slice(open, at).includes('"') && !raw.slice(open, at).startsWith("<title>") ? open + 9 : open + (raw.startsWith("<title>", open) ? 7 : 9);
                    const endQ = raw.indexOf('"', at); const endT = raw.indexOf("</title>", at);
                    const end = raw.startsWith("<title>", open) ? endT : endQ;
                    hay = unescape(raw.slice(start, end)); rel = unescape(raw.slice(start, at)).length;
                } else {
                    // tag-stripped line, keeping the match position
                    const pre = strip(raw.slice(0, at)); hay = pre + strip(raw.slice(at)); rel = pre.length;
                }
                const s = Math.max(0, rel - 45); const e = Math.min(hay.length, rel + m[0].length + 45);
                text = hay.slice(s, e).replace(/\s+/g, " ").trim(); ctx = hay.slice(Math.max(0, rel - 90), Math.min(hay.length, rel + m[0].length + 70)).replace(/\s+/g, " ");
            }
            const trStart = raw.lastIndexOf("<tr", at);
            const nqRow = trStart >= 0 && raw.slice(trStart, trStart + 40).includes("nq-me") && raw.lastIndexOf("</tr>", at) < trStart;
            hits.push({ line: i + 1, amount, value, text, ctx, jsonld: ld, nqRow, before: strip(raw.slice(Math.max(0, at - 80), at)), after: strip(raw.slice(at + m[0].length, at + m[0].length + 60)) });
        }
    });
    return hits;
};

type Res = { key: string | null; kind: Kind; note: string };
const P = (key: string, note = ""): Res => ({ key, kind: "price", note });
const D = (note: string): Res => ({ key: null, kind: "derived", note });
const R = (key: string, note = ""): Res => ({ key, kind: "range-part", note });
const THIRD = D("third-party competitor price quoted on the comparison page; editorial fact, not a Netquor price");

/** The decision for one hit, or null when this file does not know it (the caller reports it). */
export const classify = (file: string, h: Hit): Res | null => {
    const v = h.value; const c = h.ctx; const a = h.amount;
    if (h.jsonld) {
        const J = (key: string | null, note = ""): Res => ({ key, kind: "jsonld", note });
        if (v === 0) return J(null, "free tier or free trial; not a billed price");
        const m: Record<string, Record<number, string>> = {
            "index.html": { 25: "phone.planned_launch.month", 5.95: "fleet.mac.month", 6.49: "network.from.month", 5: "vpn.from.month", 12: "homeassistant.from.month", 9.99: "digitalaccess.plus.month" },
            "digitalaccess.html": { 9.99: "digitalaccess.plus.month", 59.99: "digitalaccess.pro.month", 199: "digitalaccess.scale.month" },
            "homeassistant.html": { 14: "homeassistant.home.month", 24: "homeassistant.plus.month", 39: "homeassistant.pro.month", 12: "homeassistant.resilient.month" },
            "fleet.html": { 5.95: "fleet.mac.month", 3.95: "fleet.mobile.month" },
            "vpn.html": { 5: "vpn.lite.month", 10: "vpn.plus.month", 20: "vpn.fast.month", 30: "vpn.gigabit.month" },
        };
        const k = m[file]?.[v]; return k ? J(k, k === "phone.planned_launch.month" ? "planned launch price, early access, not billed" : "") : null;
    }
    // site-wide
    if (/VPN from \$5 a month|from \$5\/mo|VPN &middot; from|VPN · from|From \$5 a month|Local WireGuard VPN from \$5/.test(c) && v === 5) return P("vpn.from.month", "the smallest VPN plan, used in the nav, title and meta text");
    if (file === "network.html" && /^(Homelab|Startup|Business)/.test(c) && /price \d/.test(h.text)) {
        const k = { Homelab: "network.homelab.month", Startup: "network.startup.month", Business: "network.business.month" }[c.split(/[:|]/)[0] as "Homelab"]; return k === "network.business.month" ? D("CONFLICT, no key: JS table says 129.49 but the FAQ says Business starts at $99; unresolved, see openQuestions") : P(k, "JS plan table used by the stack builder");
    }
    if (file === "network.html" && /^(Extra IPv4|Extra location|Extra tunnel|Extra volume|Anycast|Extra IPv6|Dedicated transit|Bring your own)/.test(c) && /price \d/.test(h.text)) {
        const k: [RegExp, string][] = [[/IPv4/, "network.addon_ipv4.month"], [/location/, "network.addon_location.month"], [/tunnel/, "network.addon_tunnel.month"], [/volume/, "network.addon_volume_tb.month"], [/Anycast/, "network.addon_anycast.month"], [/IPv6/, "network.addon_ipv6_48.month"], [/transit/, "network.addon_gateway.month"], [/prefix/, "network.addon_byo_prefix.month"]];
        return P(k.find(([r]) => r.test(c))![1], "JS add-on table used by the stack builder");
    }
    if (file === "network.html") {
        if (/(IPv4|location|tunnel|volume|anycast address|IPv6 \/48|prefix|gateway) $/.test(h.before)) {
            const t: [RegExp, string][] = [[/IPv4 $/, "network.addon_ipv4.month"], [/location $/, "network.addon_location.month"], [/tunnel $/, "network.addon_tunnel.month"], [/volume $/, "network.addon_volume_tb.month"], [/anycast address $/, "network.addon_anycast.month"], [/IPv6 \/48 $/, "network.addon_ipv6_48.month"], [/prefix $/, "network.addon_byo_prefix.month"], [/gateway $/, "network.addon_gateway.month"]];
            const hit = t.find(([r]) => r.test(h.before));
            return hit ? P(hit[1], "add-ons sentence shown without JavaScript") : null;
        }
        if (v === 0 && /id="total"|\$0/.test(c) && a === "$0") return D("stack builder total before anything is chosen");
        if (v === 6.49 && /Plans start at/.test(c)) return P("network.from.month", "FAQ: plans start at the Homelab price");
        if (v === 99 && /Business starts at/.test(c)) return D("CONFLICT, no key: the FAQ says Business starts at $99 but the plan card and the JS table say $129.49; unresolved, see openQuestions");
        if (v === 6.49) return P("network.homelab.month");
        if (v === 37.49) return P("network.startup.month");
        if (v === 129.49) return D("CONFLICT, no key: the card says from $129.49 but the FAQ says Business starts at $99; unresolved, see openQuestions");
    }
    if (file === "compare.html") {
        if (/European Central Bank|1 pound is|1 euro is/.test(c) && /pound is|euro is/.test(c)) return D("exchange rate used to convert third-party prices, not a price");
        if (!h.nqRow) return THIRD;
        if (v === 5.95) return P("fleet.mac.month"); if (v === 3.95) return P("fleet.mobile.month");
        if (v === 25) return P("phone.planned_launch.month", "planned launch price, early access, not billed");
        if (v === 5 && /to \$30/.test(c)) return R("vpn.from.month"); if (v === 30) return R("vpn.to.month");
        if (v === 6.49) return P("network.from.month"); if (v === 12) return P("homeassistant.from.month"); if (v === 9.99) return P("digitalaccess.plus.month");
        return null;
    }
    // per page
    switch (file) {
        case "digitalaccess.html":
            if (v === 9.99) return P("digitalaccess.plus.month"); if (v === 59.99) return P("digitalaccess.pro.month"); if (v === 199) return P("digitalaccess.scale.month");
            if (v === 2) return P("digitalaccess.tenant_addon.month", "Connected Tenant Experience add-on, per tenant per month");
            return null;
        case "homeassistant.html":
            if (/from \$12|From \$12/.test(c)) return P("homeassistant.from.month");
            if (v === 14) return P("homeassistant.home.month"); if (v === 24) return P("homeassistant.plus.month"); if (v === 39) return P("homeassistant.pro.month");
            if (v === 12) return P("homeassistant.resilient.month", "equal to the starting price; the Resilient plan is the cheapest");
            if (v === 6) return P("homeassistant.extra_bridge.month", "about $6 a month, shown with 'about'");
            if (v === 49) return P("homeassistant.zigbee_radio.once", "one-time hardware price");
            if (v === 4) return D("'about $4 / month off' when you bring your own Raspberry Pi; a discount, not a price");
            if (v === 79) return P("homeassistant.setup_session.once", "one-time, free on yearly plans");
            return null;
        case "index.html": {
            if (/·|middot/.test(c) && /\$5 .*\$10 .*\$20 .*\$30/.test(c)) { const k: Record<number, string> = { 5: "vpn.lite.month", 10: "vpn.plus.month", 20: "vpn.fast.month", 30: "vpn.gigabit.month" }; return R(k[v]); }
            if (/Community free.*Plus.*Pro.*Scale/.test(c)) { const k: Record<number, string> = { 9.99: "digitalaccess.plus.month", 59.99: "digitalaccess.pro.month", 199: "digitalaccess.scale.month" }; return k[v] ? R(k[v], "plan list on the product card") : null; }
            if (/\$0\.00/.test(c) && v === 0) return D("bundle calculator output when nothing is chosen");
            if (/about \$3\.25/.test(c)) return D("half of the Homelab price, rounded: 6.49 / 2 for students");
            if (/from \$12\/mo/.test(c)) return P("homeassistant.from.month");
            if (/from \$5\/mo/.test(c)) return P("vpn.from.month");
            if (/\$5 to \$30/.test(c)) return v === 5 ? R("vpn.from.month", "low end of the $5 to $30 range") : R("vpn.to.month", "high end of the $5 to $30 range");
            if (v === 25 && /Early access|early access|Planned launch|launch price/i.test(c)) return P("phone.planned_launch.month", "planned launch price, early access, not billed");
            if (v === 5.95) return P("fleet.mac.month"); if (v === 3.95) return P("fleet.mobile.month");
            if (v === 6.49) return P("network.from.month"); if (v === 12) return P("homeassistant.from.month"); if (v === 9.99) return P("digitalaccess.plus.month");
            if (v === 5) return P("vpn.from.month"); if (v === 30) return R("vpn.to.month");
            return null;
        }
        case "vpn.html":
            if (v === 6.49) return P("network.from.month", "cross-link to Network Solutions");
            if (/from \$5|From \$5/.test(c)) return P("vpn.from.month");
            if (v === 5) return P("vpn.lite.month"); if (v === 10) return P("vpn.plus.month"); if (v === 20) return P("vpn.fast.month"); if (v === 30) return P("vpn.gigabit.month");
            return null;
        case "fleet.html": {
            if (v === 5.95) return P("fleet.mac.month"); if (v === 3.95) return P("fleet.mobile.month");
            if (v === 59.5) return P("fleet.mac.year"); if (v === 39.5) return P("fleet.mobile.year");
            if (v === 178.5) return P("fleet.mac.lifetime"); if (v === 118.5) return P("fleet.mobile.lifetime");
            if (v === 300 && /^\s*one-time/.test(h.after)) return P("fleet.dedicated.setup");
            if (v === 300 && /^\s*(a year|per year)/.test(h.after)) return P("fleet.dedicated.year");
            if (v === 30 && /^\s*(a month|per month)/.test(h.after)) return P("fleet.dedicated.month");
            if (v === 360) return D("12 x $30, the dedicated instance billed monthly for a year (fleet.dedicated.month x 12)");
            if (v === 60) return D("yearly saving on the dedicated instance: 360 - 300 (fleet.dedicated.month x 12 - fleet.dedicated.year)");
            if (/pack|Per license|\d+ to \d+ licenses|licenses<|num/.test(c) || [56.53, 37.53, 53.55, 35.55, 50.58, 33.58, 47.6, 31.6, 44.63, 29.63].includes(v)) return D("volume pack discount price: the annual price (fleet.mac.year or fleet.mobile.year) less 5/10/15/20/25 percent, rounded to cents");
            return null;
        }
        case "partners.html":
            if (v === 25 && /referral credit/.test(c)) return D("referral credit amount, not a product price");
            if (v === 25 && /Balances under/.test(c)) return D("payout threshold, not a price");
            if (v === 5.95 || v === 3.95) return D("worked commission example: 8 x fleet.mac.month + 8 x fleet.mobile.month; the figures are marketing arithmetic");
            return D("worked commission example arithmetic from fleet.mac.month and fleet.mobile.month (20% commission, 12 months, annual and startup variants)");
        case "startups.html":
            if (v === 2.98 || v === 1.98) return D("half price startup offer: fleet.mac.month / 2 = 2.975 and fleet.mobile.month / 2 = 1.975, rounded");
            return null;
        case "referrals.html":
            return v === 25 ? D("referral credit amount, not a product price") : null;
        case "subnet-calculator.html":
            return v === 6.49 ? P("network.from.month") : null;
        case "terms.html":
            return v === 100 ? D("liability cap in the terms, not a price") : null;
    }
    return null;
};

export const legacyPages = (root = repoRoot): string[] => readdirSync(root).filter((f) => f.endsWith(".html")).sort();

/** Scan every legacy page. `unclassified` lists what classify() did not know. */
export const buildInventory = (root = repoRoot) => {
    const pages: Record<string, Entry[]> = {}; const unclassified: string[] = [];
    for (const f of legacyPages(root)) {
        const hits = scanHtml(readFileSync(join(root, f), "utf8"), f); const out: Entry[] = [];
        for (const h of hits) {
            const r = classify(f, h);
            if (!r) { unclassified.push(`${f}:${h.line} ${h.amount} :: ${h.text}`); continue; }
            out.push({ text: h.text, key: r.key, kind: r.kind, note: r.note, line: h.line, amount: h.amount });
        }
        if (out.length) pages[f] = out;
    }
    return { pages, unclassified };
};

if (import.meta.main) {
    const { pages, unclassified } = buildInventory();
    if (unclassified.length) { console.error("UNCLASSIFIED:\n" + unclassified.join("\n")); process.exit(1); }
    const slim: Record<string, Omit<Entry, never>[]> = pages;
    writeFileSync(join(repoRoot, "web/migration/price-inventory.json"), JSON.stringify({ pages: slim }, null, 2) + "\n");
    console.log(`wrote ${Object.values(pages).reduce((n, p) => n + p.length, 0)} entries across ${Object.keys(pages).length} pages`);
}
