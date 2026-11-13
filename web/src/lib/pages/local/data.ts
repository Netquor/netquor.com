// /fargo-moorhead.html: the local page. It says what Netquor does for businesses in Fargo-Moorhead and the surrounding Midwest, and gives an honest, dated, sourced list of the local business internet providers (Netquor is not an internet provider, so these are the companies a customer buys the circuit from). Every provider fact below was read on the provider's own page on CHECKED; nothing is inferred and nothing is a ranking. Re-check before changing the date.
import { EMAIL } from "../../contact";
import type { FaqItem, ProgramPageData } from "../programs/types";

/** The date the provider facts were read from each company's own page. */
export const CHECKED = "November 11, 2026";

export const localMeta = {
    slug: "fargo-moorhead",
    title: "Business networking and IT in Fargo-Moorhead | Netquor",
    description: "Netquor is a Fargo, North Dakota company that designs business networks, manages Apple devices and runs VPNs for offices in Fargo, West Fargo, Moorhead and across the Midwest. Includes a dated list of local business internet providers.",
    keywords: "Fargo business network, Fargo managed network, Moorhead IT, West Fargo IT, Fargo Mac management, Fargo Ubiquiti UniFi installer, Fargo Moorhead business internet providers, North Dakota small business IT, Midwest managed networking",
} as const;

const link = (href: string, text: string) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;

export const localFaq: readonly FaqItem[] = [
    { q: "What does Netquor do for businesses in Fargo-Moorhead?", a: `Netquor is based in Fargo, North Dakota. We design and run business networks on Ubiquiti UniFi and VyOS, manage Mac, iPhone and iPad fleets with <a href="/fleet.html">Netquor Fleet</a>, and connect offices and remote staff with <a href="/vpn.html">WireGuard VPN</a>. On-site installation and repair covers Fargo, West Fargo, Moorhead and the surrounding area.` },
    { q: "Is Netquor an internet service provider?", a: "No. Netquor does not sell a last-mile internet connection. You buy the circuit from a provider that serves your address, and we design and manage the network behind it: the router, switching, Wi-Fi, VPN and the devices on it. The table above lists the business internet providers that publish Fargo-Moorhead service." },
    { q: "Which business internet providers serve Fargo and Moorhead?", a: `Based on their own pages as of ${CHECKED}: Midco lists business internet, phone, TV, advertising and data center services for the Fargo-Moorhead area, Sparklight Business lists plans from 300 Mbps to 1 Gig and Business Fiber up to 5 Gig where available, Gateway Fiber is building an all-fiber network on both sides of the metro, and 702 Communications sells fiber and DSL. Availability depends on the exact address, so ask each provider to check yours.` },
    { q: "Do you serve West Fargo, Moorhead and the rest of North Dakota and Minnesota?", a: "Yes. We install and support on site in Fargo, West Fargo and Moorhead, and across North Dakota, Minnesota and South Dakota. Hosted services such as Netquor Fleet and Network Solutions are delivered over the internet to anywhere in the Midwest." },
    { q: "Can you manage the Macs and iPhones at a Fargo office?", a: `Yes. <a href="/fleet.html">Netquor Fleet</a> manages Macs, iPhones and iPads from one place, month to month with no minimum, and it starts with a free 30-day trial. New businesses can also use the <a href="/startups.html">startup program</a>.` },
    { q: "How do I get a quote?", a: `Email <a href="mailto:${EMAIL}?subject=Netquor%20quote%20from%20Fargo-Moorhead">${EMAIL}</a> or call one of the numbers on this page. Tell us the address, how many people and devices, and what internet connection you have today. We reply in writing.` },
];

export const localPage = (): ProgramPageData => ({
    meta: localMeta,
    hero: {
        eyebrow: "Fargo-Moorhead and the Midwest",
        title: "Business networking and IT, from Fargo",
        lead: "Netquor Technologies is a Fargo, North Dakota company. We design the network behind your internet connection, manage your Apple devices and connect your offices and remote staff, in Fargo, West Fargo, Moorhead and across the Midwest.",
        leadStyle: "max-width: 720px;",
        primary: { href: `mailto:${EMAIL}?subject=Netquor%20quote%20from%20Fargo-Moorhead`, label: "Ask for a quote" },
        secondary: { href: "#providers", label: "Local internet providers" },
        width: 900,
    },
    items: [
        {
            kind: "section", style: "padding-top: 24px;", width: 900,
            head: { eyebrow: "What we do", title: "The network and devices behind your internet" },
            blocks: [{
                kind: "safe",
                items: [
                    { b: "Business networks", p: "Design, install and management of Ubiquiti UniFi and VyOS networks: routers, switching, Wi-Fi and cabling, with remote management from our dashboard. See <a href=\"/sdn.html\">Netquor SDN</a>." },
                    { b: "Mac, iPhone and iPad management", p: "Enrollment, policies, apps and security for the devices your team uses, month to month with no minimum. See <a href=\"/fleet.html\">Netquor Fleet</a>." },
                    { b: "VPN and remote access", p: "A flat per-account WireGuard VPN that runs on our own network, for staff who work away from the office. See <a href=\"/vpn.html\">Netquor VPN</a>." },
                    { b: "Routable IP addresses", p: "A routable IPv4 and an IPv6 /56 delivered to your own hardware over WireGuard, for an office, a lab or a server. See <a href=\"/network.html\">Network Solutions</a>." },
                    { b: "Business phone", p: "Netquor Phone, a phone system and an AI receptionist, is in early access and is not billed yet. We will say so plainly until that changes." },
                    { b: "On site and remote", p: "On-site installation and repair in Fargo, West Fargo and Moorhead, and across North Dakota, Minnesota and South Dakota. Hosted services work anywhere in the Midwest." },
                ],
            }],
        },
        { kind: "rule" },
        {
            kind: "section", id: "providers", width: 900,
            head: { eyebrow: `Local internet providers, as of ${CHECKED}`, title: "Who sells business internet in Fargo-Moorhead", lead: "Netquor does not sell an internet connection, so here are the providers that publish business service for the area. Each row is what the provider's own page says on the date above, in the order we looked, not a ranking. The list is not complete, and availability and prices depend on the address." },
            blocks: [
                {
                    kind: "table",
                    head: ["Provider", "What its own page says", "Source"],
                    rows: [
                        ["Midco", "Lists business internet, phone, TV, advertising and data center services for the Fargo, ND and Moorhead, MN area. Says services may not be available everywhere and some may require a contract. No business prices on that page.", link("https://midco.com/about/service-areas/north-dakota/fargo/", "Midco, Fargo")],
                        ["Sparklight Business", "Lists Business Internet 300, 500 and 1 Gig plans, and Business Fiber up to 5 Gig with equal upload and download where available. Names Fargo, West Fargo, Horace, Moorhead, Dilworth and Glyndon. No prices on that page, it says to call.", link("https://business.sparklight.com/locations/nd/fargo", "Sparklight Business, Fargo")],
                        ["Gateway Fiber", "In its announcement of September 24, 2025, it said it was expanding into Moorhead, with construction under way, to serve both sides of the Fargo metro with fiber. Availability follows construction neighborhood by neighborhood.", link("https://www.gatewayfiber.com/news/gateway-fiber-expands-into-moorhead-strengthening-fargo-moorhead-fiber-network", "Gateway Fiber announcement")],
                        ["702 Communications", "Lists fiber and DSL business internet in the Fargo-Moorhead area, with packages starting at $99.99 a month for 100MB, and says it is continuing to expand its fiber network.", link("https://702com.net/business-internet/", "702 Communications, business internet")],
                    ],
                },
                { kind: "p", cls: "text-muted small mt-3", html: `Facts on this table come from each provider's own page, read on ${CHECKED}. Providers change plans, prices and coverage, so confirm with them. If one of them is not shown accurately, <a href="mailto:${EMAIL}?subject=Provider%20correction">write to us</a> and we will fix it.` },
            ],
        },
        { kind: "rule" },
        {
            kind: "section", width: 900,
            head: { eyebrow: "Before you sign", title: "Questions to ask any internet provider" },
            blocks: [{
                kind: "safe",
                items: [
                    { b: "Is the speed symmetrical?", p: "Upload speed decides how well video calls, cloud backups and remote access work. Some plans match upload to download, and many do not." },
                    { b: "Do you get a static IP address?", p: "A fixed address matters for a VPN, a server or a camera system. Ask whether it is included, what it costs and whether it is routable." },
                    { b: "What are the term and the fees?", p: "Ask for the contract length, the install fee, the price after any promotion and the early termination fee, in writing." },
                    { b: "What is the repair commitment?", p: "Ask for the time to respond and the time to restore, and whether there is a written service level for business customers." },
                    { b: "Do you have a second connection?", p: "A second line from another provider, or a cellular backup, keeps the office running when one circuit fails. We can configure the failover." },
                    { b: "Can we see the address on a map?", p: "Coverage maps are approximate. Have the provider confirm service at the exact address before you order." },
                ],
            }],
        },
        { kind: "rule" },
        {
            kind: "section", width: 900,
            head: { eyebrow: "Beyond Fargo", title: "North Dakota, Minnesota, South Dakota and the Midwest" },
            blocks: [
                { kind: "p", cls: "text-muted", html: "Fargo is home base. On-site work covers Fargo, West Fargo and Moorhead and reaches across North Dakota, Minnesota and South Dakota. Everything that can be delivered over the internet, including Netquor Fleet, the VPN and Network Solutions, works for a business anywhere in the Midwest. Network Solutions has points of presence in Chicago, Dallas, New York, Kansas City, Los Angeles, London and Tokyo, so traffic can land near your users." },
            ],
        },
        {
            kind: "section", id: "faq", width: 900,
            head: { eyebrow: "Questions", title: "Common questions" },
            blocks: [{ kind: "faq", items: [...localFaq] }],
        },
        {
            kind: "section", style: "padding-top: 0;", width: 900,
            blocks: [{
                kind: "cta",
                cta: { title: "Tell us about your office", text: "The address, how many people and devices, and what internet connection you have today. We reply in writing with a plan and a price.", action: { href: `mailto:${EMAIL}?subject=Netquor%20quote%20from%20Fargo-Moorhead`, label: "Ask for a quote" } },
            }],
        },
    ],
});

/** The structured data for the page: the page itself, tied to the LocalBusiness entity on the home page, and its questions. */
export const localJsonLd = (origin: string) => ({
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "WebPage",
            "@id": `${origin}/fargo-moorhead.html#page`,
            url: `${origin}/fargo-moorhead.html`,
            name: localMeta.title,
            description: localMeta.description,
            about: { "@id": "https://www.netquor.com/#local" },
            isPartOf: { "@id": "https://www.netquor.com/#site" },
            inLanguage: "en-US",
        },
        {
            "@type": "FAQPage",
            "@id": `${origin}/fargo-moorhead.html#faq`,
            mainEntity: localFaq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a.replace(/<[^>]+>/g, "") } })),
        },
    ],
});
