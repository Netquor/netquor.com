#!/usr/bin/env bun
// Builds .agents/agent/facts.json so the website AI agent can only state what the site states.
//
// Run after changing a product card, a price row or a seed price:   bun tools/build-agent-facts.ts
// The agent's recommend_product tool reads that file and nothing else. Product cards and the price table come from the home page data
// (web/src/lib/pages/index/data.ts), prices from server/data/prices.seed.json (what the site shows when the live cache has no value),
// accounts from web/src/lib/data/social.json. The legacy HTML is not read: it exists only in the legacy-baseline-2026-11 tag.
// Output goes to .agents/agent/ only (git-ignored private notes).
import { LOCAL, TOLL_FREE } from "../web/src/lib/contact";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { APP_GROUPS, PRICE_ROWS } from "../web/src/lib/pages/index/data.ts";
import { socialLinks } from "../web/src/lib/social.ts";
import { formatPrice } from "../server/src/prices/stamp.ts";

const ROOT = join(import.meta.dir, "..");
const seed = JSON.parse(readFileSync(join(ROOT, "server/data/prices.seed.json"), "utf8")) as { prices: Record<string, { amountCents: number; currency: string; unit: string }> };

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
/** Resolve {{key}} / {{key|fmt}} tokens from the seed, strip tags and entities, collapse whitespace. */
export function plain(s: string): string {
    const priced = s.replace(/\{\{([^}|]+)(?:\|([^}]+))?\}\}/g, (_m, key: string, fmt?: string) => {
        const p = seed.prices[key];
        if (!p) throw new Error(`price key ${key} is not in prices.seed.json`);
        return formatPrice(p as never, (fmt ?? "usd0") as never);
    });
    return priced.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (e) => ENTITIES[e]).replace(/\s+/g, " ").trim();
}

export function buildFacts() {
    const products = APP_GROUPS.flatMap((g) => g.apps).map((a) => {
        const primary = a.links.find((l) => l.cls === "primary") ?? a.links[0];
        const href = primary.href;
        return {
            name: a.name,
            status: a.statusLabel,
            fixes: a.fix,
            description: plain(a.text),
            price_note: plain(a.meta),
            features: a.feats.map(plain),
            url: href.startsWith("http") ? href : "https://www.netquor.com" + (href.startsWith("/") ? href : "/" + href),
        };
    });
    const price_rows = PRICE_ROWS.map((r) => plain([r.name, r.small, r.what, r.price, r.terms].filter(Boolean).join(" ")));
    return {
        generated_from: "web/src/lib/pages/index/data.ts, server/data/prices.seed.json, web/src/lib/data/social.json",
        company: { name: "Netquor Technologies LLC", location: "Fargo, North Dakota", email: "hello@netquor.com", phone: TOLL_FREE.display, phone_toll_free: TOLL_FREE.display, phone_local: LOCAL.display, helpdesk: "https://support.netquor.com", account: "https://account.netquor.com/" },
        social: socialLinks().map((l) => ({ network: l.label, url: l.url })),
        products,
        price_table_text: price_rows,
        rules: ["Netquor Phone is in early access and not billed yet; its prices are planned launch prices.",
            "Netquor Central is in development, has no price and no self-serve sign-up.",
            "Netquor SDN is quoted per site.",
            "Bundle: 10% off monthly plan fees with two products, 15% with three; annual and volume pricing do not combine; usage is never discounted."],
    };
}

if (import.meta.main) {
    const facts = buildFacts();
    const out = join(ROOT, ".agents", "agent", "facts.json");
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(facts, null, 1));
    console.log(`${facts.products.length} products, ${facts.price_table_text.length} price rows -> .agents/agent/facts.json`);
}
