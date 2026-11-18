// The copy of /startups.html, moved from the original generated page (tools/make-program-pages.py in tag legacy-baseline-2026-11). The two per-device figures in the first table row are half of the published Fleet monthly prices, computed from the price snapshot, so they follow a price change.
import { cents, usd, type Prices } from "../programs/money";
import type { ProgramPageData } from "../programs/types";

export const startupsMeta = {
    slug: "startups",
    title: "Netquor for startups: half price Fleet for 12 months | Netquor",
    description: "Half price Netquor Fleet for 12 months for new businesses under two years old with fewer than ten people. Up to 25 devices, no funding requirement.",
} as const;


/** "$2.98" from 595 cents: half, rounded to the cent, half up. */
export const halfPrice = (priceCents: number): string => usd(priceCents / 2);

export const startupsPage = (prices: Prices): ProgramPageData => ({
    meta: startupsMeta,
    hero: {
        eyebrow: "Netquor for startups",
        title: "Half price Fleet for 12 months",
        lead: "New businesses under two years old with fewer than ten people pay half price for Netquor Fleet for their first 12 paid months, for up to 25 devices. There is no funding requirement, and service businesses are welcome.",
        primary: { href: "mailto:hello@netquor.com?subject=Netquor%20for%20Startups&body=Company%3A%0D%0AWebsite%20or%20work%20email%20domain%3A%0D%0AYear%20founded%20and%20number%20of%20people%3A%0D%0ADevices%20(Macs%20and%20iPhones%2FiPads)%3A%0D%0AOther%20products%20you%20are%20interested%20in%3A", label: "Apply by email" },
        secondary: { href: "#rules", label: "Read the rules" },
        width: 900,
    },
    items: [
        {
            kind: "section", style: "padding-top: 24px;", width: 900,
            head: { eyebrow: "What you get", title: "By product" },
            blocks: [
                {
                    kind: "table",
                    head: ["Product", "Startup terms", "Status"],
                    rows: [
                        ['<a href="/fleet.html">Netquor Fleet</a>', `50% off list for 12 months starting at your first paid month, after the free 30-day trial, for up to 25 devices. About ${halfPrice(cents(prices, "fleet.mac.month"))} a Mac and ${halfPrice(cents(prices, "fleet.mobile.month"))} an iPhone or iPad a month.`, "Available"],
                        ['<a href="https://phone.netquor.com/">Netquor Phone</a>', "Its own startup program applies when billing starts: 50% off the plan fee for the first 6 months. Plan fees only, never usage.", "Early access, not billed yet"],
                        ["Netquor VPN, Network Solutions, Hosted Home Assistant, Digital Access", "No startup discount today. Network Solutions Homelab is already half price for students, and Digital Access is free to start. Ask us if you are building something specific.", "Standard pricing"],
                        ["Netquor SDN", "Quoted per site. Mention that you are a startup and we will take it into account in the quote.", "Quoted"],
                    ],
                },
                { kind: "p", cls: "text-muted small mt-3", html: `List prices are on the <a href="/#pricing">pricing table</a>. Startup pricing applies to Fleet's monthly plans.` },
            ],
        },
        { kind: "rule" },
        {
            kind: "section", id: "rules", width: 900,
            head: { eyebrow: "The rules in plain words", title: "Who qualifies and how it works" },
            blocks: [{
                kind: "safe",
                items: [
                    { b: "Who qualifies", p: "A new Netquor customer that is under two years old and has fewer than ten people, with a work email on its own domain. Any kind of business, funded or not." },
                    { b: "Your own devices", p: "The discount covers your own team's devices, up to 25. It does not cover devices you manage for clients." },
                    { b: "The better price, not both", p: "Startup pricing replaces the bundle, annual and volume discounts while it runs. If one of those would be cheaper for you, you get that one instead." },
                    { b: "No surprises at the end", p: "The discount ends on its own after 12 months. We email you 30 days before, and the confirmation states the price you pay afterwards." },
                    { b: "Free devices", p: "Fleet's earned free devices do not combine with the startup price. You keep whichever is lower." },
                    { b: "Terms can change", p: "We may change or end the program with notice. Enrollments already approved are honored for their term, and we may decline or end one for a false application." },
                ],
            }],
        },
        { kind: "rule" },
        {
            kind: "section", width: 900,
            head: { eyebrow: "How to apply", title: "Three steps" },
            blocks: [{
                kind: "steps",
                items: [
                    "<b>Email us.</b> Company, website or work email domain, year founded and headcount, device counts and any other products you are curious about.",
                    "<b>We reply in writing.</b> We confirm eligibility and the exact price. There is no application portal, so we answer by email.",
                    "<b>Start the free trial.</b> Fleet is free for 30 days. The startup price begins with your first paid month.",
                ],
            }],
        },
        {
            kind: "section", id: "faq", width: 900,
            head: { eyebrow: "Questions", title: "Common questions" },
            blocks: [{
                kind: "faq",
                items: [
                    { q: "Do we need funding or an accelerator?", a: "No. Funding stage and type of business do not matter. Agencies and consultancies can join for their own devices." },
                    { q: "Can an existing customer join?", a: "Not today. The program is for new customers. If you are already a customer and think you should qualify, write to us." },
                    { q: "What happens to Netquor Phone?", a: "Netquor Phone is in early access and not billed yet. When billing starts, Phone has its own startup program: 50% off the plan fee for 6 months, with usage never discounted. Its price here is a planned launch price." },
                    { q: "Can I combine this with a referral credit?", a: `A referral credit applies to plan fees after other discounts, and it cannot take a line below half of its list price. While startup pricing is already at half, a referral credit waits until it ends. See the <a href="/referrals.html">referral terms</a>.` },
                    { q: "How long does a reply take?", a: "We reply by email, usually within a few business days. We do not promise a faster time." },
                ],
            }],
        },
        {
            kind: "section", style: "padding-top: 0;", width: 900,
            blocks: [{
                kind: "cta",
                cta: { title: "Starting something?", text: "Tell us what you are building and what you need to run it. We will reply with a plan and a price in writing.", action: { href: "mailto:hello@netquor.com?subject=Netquor%20for%20Startups", label: "Apply by email" } },
            }],
        },
    ],
});
