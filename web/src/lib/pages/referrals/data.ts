// The copy of /referrals.html, moved from the original generated page (tools/make-program-pages.py in tag legacy-baseline-2026-11). The $25 credit is the referral program's amount, not a product price, so it is plain text.
import type { ProgramPageData } from "../programs/types";

export const referralsMeta = {
    slug: "referrals",
    title: "Refer a business: $25 credit each, on any product | Netquor",
    description: "Refer a business to Netquor. When they become a paying customer, you each get a $25 account credit that works on any Netquor product.",
} as const;

export const referralsPage = (): ProgramPageData => ({
    meta: referralsMeta,
    hero: {
        eyebrow: "Referrals",
        title: "Refer a business, you both get a credit",
        lead: "When a business you refer becomes a paying Netquor customer, you each get a $25 account credit. It works on any Netquor product, and it is the same program everywhere.",
        primary: { href: "mailto:hello@netquor.com?subject=Referral&body=Who%20I%20am%20referring%20(name%2C%20business%2C%20email)%3A%0D%0AProducts%20they%20may%20need%3A", label: "Refer a business" },
        secondary: { href: "#terms", label: "Read the terms" },
        width: 900,
    },
    items: [
        {
            kind: "section", style: "padding-top: 24px;", width: 900,
            head: { eyebrow: "How it works", title: "Three steps" },
            blocks: [{
                kind: "steps",
                items: [
                    "<b>You refer.</b> Email us who you are referring, or ask them to mention your name when they write to us.",
                    "<b>They become a customer.</b> They pay for their first month, and 30 days pass without a refund or a chargeback.",
                    "<b>You both get $25.</b> Credit goes on both accounts and applies to plan fees on any Netquor product.",
                ],
            }],
        },
        { kind: "rule" },
        {
            kind: "section", id: "terms", width: 900,
            head: { eyebrow: "The terms", title: "What the credit is, and what it is not" },
            blocks: [
                {
                    kind: "safe",
                    items: [
                        { b: "$25 each", p: "The person who refers and the new customer each get a $25 account credit." },
                        { b: "Paid referrals only", p: "The referred business must be new to Netquor and make a real payment. A free plan, such as Digital Access free, does not count." },
                        { b: "Plan fees only", p: "Credit pays plan fees on any product. It never pays for usage, and it is not cash or transferable." },
                        { b: "Never below half price", p: "Credit applies after other discounts and cannot take a plan-fee line below half of its list price. On a line already at half price, it waits until that discount ends." },
                        { b: "Up to ten a year", p: "Each person can earn credit for up to ten referrals a year. Credit expires 12 months after it is issued." },
                        { b: "Different people", p: "You cannot refer yourself, someone at your own business, or an account you control." },
                    ],
                },
                { kind: "p", cls: "text-muted small mt-3", html: "Netquor Phone is in early access and not billed yet, so Phone referrals are credited when Phone starts billing. Netquor may withhold or reverse credit for spam, misleading claims or abuse, and may change or pause the program with notice. Credit already earned is honored." },
            ],
        },
        { kind: "rule" },
        {
            kind: "section", width: 900,
            head: { eyebrow: "If you share a link or a recommendation", title: "Say that you get a credit" },
            blocks: [
                { kind: "p", cls: "text-muted", html: "If you recommend Netquor and get a credit when someone signs up, say so clearly in the same message or post, near the recommendation. The FTC expects this for any material connection, even a small one. You can use this wording:" },
                { kind: "quote", text: "I get a $25 Netquor credit if you become a paying customer, and you get $25 too." },
                { kind: "p", cls: "text-muted small", html: "Do not make claims about Netquor that its own pages do not make. Netquor Phone is in early access, so describe it that way." },
            ],
        },
        {
            kind: "section", id: "faq", width: 900,
            head: { eyebrow: "Questions", title: "Common questions" },
            blocks: [{
                kind: "faq",
                items: [
                    { q: "Which products count?", a: "Any paid Netquor plan: Fleet, VPN, Network Solutions, Hosted Home Assistant, paid Digital Access plans and, when it starts billing, Netquor Phone." },
                    { q: "When does my credit arrive?", a: "After the business you referred has paid for its first month and 30 days have passed with no refund or chargeback. We confirm by email." },
                    { q: "Can I get cash instead?", a: "No. Credit is an account credit toward plan fees." },
                    { q: "Is there a link I can share?", a: "Not yet. Referrals are tracked by email while the program is small. Tell us who you referred, or ask them to mention your name." },
                    { q: "How does this fit with the startup program?", a: `The <a href="/startups.html">startup program</a> and a referral credit can both apply, but the credit cannot take a line below half price, so it waits while startup pricing is running.` },
                ],
            }],
        },
    ],
});
