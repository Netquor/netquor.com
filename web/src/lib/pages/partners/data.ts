// The copy of /partners.html, moved from tools/make-program-pages.py. The commission examples are arithmetic on the published Fleet monthly prices (fleet.mac.month, fleet.mobile.month), computed in whole cents from the price snapshot; the 20% rate, the 12 months and the 10 months of annual billing are the program's terms. The $25 referral credit and the $25 payout threshold are program amounts, not prices, and stay plain text (migration/price-inventory.md: derived).
import { cents, usd, type Prices } from "../programs/money";
import type { ProgramPageData, Role } from "../programs/types";

export const partnersMeta = {
    slug: "partners",
    title: "Work with Netquor: channel partners and open roles | Netquor",
    description: "Refer or resell Netquor services as a channel partner, or tell us about your networking, coding or attention-to-detail skills. Fargo, North Dakota.",
} as const;

export const COMMISSION_RATE_PERCENT = 20;

/** The rows of the "arithmetic at list price" table, from the Fleet Mac and iPhone/iPad monthly prices in cents. */
export const commissionRows = (macCents: number, mobileCents: number): string[][] => {
    const rate = (c: number) => (c * COMMISSION_RATE_PERCENT) / 100;
    const device = 8 * macCents + 8 * mobileCents; // one customer: 8 Macs and 8 iPhones, per month
    const ten = 10 * device;
    const annual = 10 * ten; // annual Fleet pays for 10 months of the monthly price
    const half = device / 2; // startup pricing halves the base
    return [
        ["One referred customer, 8 Macs and 8 iPhones", `8 x ${usd(macCents)} + 8 x ${usd(mobileCents)} = ${usd(device)} a month. 20% = ${usd(rate(device))}`, `${usd(rate(device))} a month, ${usd(rate(device) * 12)} over 12 months`],
        ["Ten referred customers like that", `10 x ${usd(device)} = ${usd(ten)} a month. 20% = ${usd(rate(ten))}`, `${usd(rate(ten))} a month, ${usd(rate(ten) * 12)} over 12 months`],
        ["If those ten customers pay annually", `Annual Fleet pays for 10 months of the monthly price: ${usd(annual)} a year. 20% = ${usd(rate(annual))}`, `${usd(rate(annual))} for the year`],
        ["If a customer qualifies for startup pricing", `Half price for 12 months, so the base halves: ${usd(half)} a month. 20% = ${usd(rate(half))}`, `${usd(rate(half))} a month for that customer`],
    ];
};

export const roles: readonly Role[] = [
    { title: "Networking", have: ["Hands-on experience with routing, switching, VLANs, VPNs and Wi-Fi, from work, a home lab or school", "Comfort reading packet captures and logs, and explaining a fault to someone who is not a specialist", "Patience for careful, repeatable configuration"], do: ["Help design, test and document network and SDN builds for small sites", "Help troubleshoot VPN and Network Solutions issues", "Write the setup notes customers and partners follow"] },
    { title: "Coding", have: ["Working skill in a scripting or web language such as Python or JavaScript", "Experience with APIs, automation or Apple device management is helpful, not required", "A habit of testing your own changes"], do: ["Build and maintain site tools, calculators and automation", "Help with integrations and small internal tools", "Fix bugs, with notes on what changed"] },
    { title: "Attention to detail: QA and documentation", have: ["A keen eye for the small mistake: a wrong number, a broken link, a step out of order", "Clear, plain writing", "Interest in checking work against real devices and real prices"], do: ["Test pages, tools and setup guides before release and report what breaks", "Check pricing and wording across the site against the current price list", "Write and maintain setup guides and help articles"] },
    { title: "Sales and local partnerships", have: ["Comfort talking with owners of small businesses and with local IT shops", "Good connections in Fargo-Moorhead, or a client base of your own", "Honesty about what a product does and does not do"], do: ["Introduce Netquor to local businesses, advisors and IT shops", "Run partner onboarding calls and follow-up", "Report what customers ask for and what stops them"] },
];

export const partnersPage = (prices: Prices): ProgramPageData => ({
    meta: partnersMeta,
    hero: {
        eyebrow: "Work with Netquor",
        title: "Refer or resell our services, or join the team that builds them",
        lead: "Netquor is a small company in Fargo, North Dakota. We are looking for local advisors, IT shops and freelancers who know businesses that need our services, and for people with networking, coding or sharp-eyed detail skills who want to help build and support them.",
        leadStyle: "max-width: 44rem;",
        primary: { href: "#partners", label: "Become a channel partner" },
        secondary: { href: "#roles", label: "See where we need help" },
        width: 1000,
    },
    items: [
        {
            kind: "section", id: "partners", style: "padding-top: 24px;", width: 1000,
            head: { eyebrow: "Channel partner program", title: "Three ways to partner", lead: "There is no fee to apply, no required purchase and no inventory. Channel partners are paid for their own sales work and have no ownership interest in Netquor." },
            blocks: [{
                kind: "table",
                head: ["Tier", "Who it suits", "Terms"],
                rows: [
                    ["<b>Referral partner</b><br><small>Open now, by email</small>", "Advisors, accountants, bookkeepers, agencies and freelancers who know a business that needs device management or networking.", `Netquor Fleet: 20% of net fees collected for each referred account for its first 12 months. Other products: the standard <a href="/referrals.html">$25 referral credit</a>. Netquor Phone: terms are set after it starts billing.`],
                    ["<b>Reseller</b><br><small>By application</small>", "IT shops and small MSPs that want to own the customer relationship, bill the customer and give first-line support.", "Terms are agreed in writing after we talk about your book of business. We do not publish a reseller rate yet."],
                    ["<b>Managed partner</b><br><small>By application</small>", "MSPs and IT firms that deploy, manage and support devices and networks for clients as a core service.", "Terms are agreed in writing, including who supports what. We onboard a few partners at a time because support is small, and we say so plainly."],
                ],
            }],
        },
        { kind: "rule" },
        {
            kind: "section", width: 1000,
            head: { eyebrow: "How commission is calculated", title: "The arithmetic, at list price", lead: "These figures are arithmetic, not results. Netquor has no partner payout history yet, no partner has earned these amounts, and most will earn less. Discounts, free trials, annual billing and unpaid invoices lower the real number." },
            blocks: [
                { kind: "table", head: ["Example", "Calculation", "Result"], rows: commissionRows(cents(prices, "fleet.mac.month"), cents(prices, "fleet.mobile.month")) },
                { kind: "p", cls: "text-muted small mt-3", html: "Commission is calculated on net cash collected, after any discount the customer receives, so partner terms do not add a discount of their own. Net excludes tax, refunds, chargebacks, credits and processing fees." },
            ],
        },
        { kind: "rule" },
        {
            kind: "section", width: 1000,
            head: { eyebrow: "The rules", title: "What partners agree to" },
            blocks: [{
                kind: "safe",
                items: [
                    { b: "Register each lead", p: "Email us the business and contact. We confirm in writing that it is new to Netquor. Attribution lasts 90 days from that confirmation." },
                    { b: "New customers only", p: "Existing customers, accounts in a trial, and businesses you own or are affiliated with do not qualify." },
                    { b: "Cash only", p: "Commission is paid on cash collected, never on invoices paid with credit." },
                    { b: "Paid after the dispute window", p: "Monthly in arrears, 60 days after the customer's payment, once refund and dispute windows have closed. Balances under $25 roll forward. We need a W-9 before the first payout." },
                    { b: "Say that you get paid", p: "If you recommend Netquor and earn commission, disclose it clearly in the same message. The FTC requires this for any material connection." },
                    { b: "No exclusivity", p: "You can work with other vendors, and customers can buy from Netquor directly. Programs and rates may change with notice, and earned commission is honored." },
                ],
            }],
        },
        { kind: "rule" },
        {
            kind: "section", id: "roles",
            head: { eyebrow: "Where we need help", title: "Skills we are looking for", lead: "Four areas. Tell us which fits and what you have worked on, even if it was a home lab or a school project. A resume is welcome, not required." },
            blocks: [
                { kind: "roles", roles },
                { kind: "p", cls: "text-muted small mt-4", html: "Each opportunity may be employee, contractor or project work, and we will tell you which before work starts. Pay is discussed in the first conversation and confirmed in writing before you begin. Netquor is an equal opportunity employer and welcomes applicants regardless of race, color, religion, sex, national origin, age, disability or any other protected status." },
            ],
        },
        {
            kind: "section", id: "faq", width: 900,
            head: { eyebrow: "Questions", title: "Common questions" },
            blocks: [{
                kind: "faq",
                items: [
                    { q: "Is there a fee to join?", a: "No. There is no fee to apply or to join as a Referral partner. Resellers and Managed partners go through a short onboarding with us." },
                    { q: "How much could I earn?", a: "It depends on how many devices and services your referred customers use, and for how long. The arithmetic above shows how commission is calculated at list price. It is not a promise, and we have no partner earnings history yet." },
                    { q: "Do I support the customers?", a: "Referral partners do not. Resellers and Managed partners handle first-line support for their own customers. Netquor supports partners by email and does not publish a service-level agreement." },
                    { q: "Does this cover Netquor Phone?", a: "Netquor Phone is in early access and not billed yet. Partner terms for it will be set after billing starts." },
                    { q: "How do I apply?", a: `Email <a href="mailto:hello@netquor.com?subject=Channel%20partner">hello@netquor.com</a> with your business, the kind of customers you work with, and which tier you are interested in. We reply in writing.` },
                ],
            }],
        },
        {
            kind: "section", style: "padding-top: 0;", width: 900,
            blocks: [
                { kind: "cta", cta: { title: "Tell us about you", text: "Write with what you do, who you work with and what you have in mind. We reply in writing.", action: { href: "mailto:hello@netquor.com?subject=Work%20with%20Netquor", label: "Email us" }, phone: { href: "tel:+18887171701", label: "+1 (888) 717-1701" } } },
                { kind: "p", cls: "text-muted small mt-4", html: "Channel partner commissions are payments for sales work and are not an investment. Nothing on this page is an offer to sell, or a solicitation of an offer to buy, any security. Examples are arithmetic at list price, not promises. Netquor Phone is in early access and is not billed yet. Terms may change." },
            ],
        },
    ],
});
