// Copy of /vpn.html moved out of the markup. Plan prices are price keys (rendered with <Price>); everything else is trusted static copy.

export interface Feature { icon: string; title: string; text: string }
export interface Tier { name: string; priceKey: string; speed: string; bar: string; sub: string; pop?: boolean; items: readonly string[]; cta: { href: string; label: string; cls: string } }
export interface FaqEntry { q: string; a: string }

export const tiers: readonly Tier[] = [
    { name: "Lite", priceKey: "vpn.lite.month", speed: "25 / 25 Mbps", bar: "3%", sub: "Download / upload", items: ["Up to 3 devices", "Great for browsing, banking and travel", "Month to month"], cta: { href: "mailto:hello@netquor.com?subject=Netquor%20VPN%20-%20Lite", label: "Choose Lite", cls: "btn btn-outline-info rounded-pill" } },
    { name: "Plus", priceKey: "vpn.plus.month", speed: "100 Mbps", bar: "10%", sub: "Download and upload", items: ["Up to 3 devices", "HD streaming and video calls", "Month to month"], cta: { href: "mailto:hello@netquor.com?subject=Netquor%20VPN%20-%20Plus", label: "Choose Plus", cls: "btn btn-outline-info rounded-pill" } },
    { name: "Fast", priceKey: "vpn.fast.month", speed: "500 Mbps", bar: "50%", sub: "Download and upload", pop: true, items: ["Up to 5 devices", "4K streaming, big downloads, the whole household", "Month to month"], cta: { href: "mailto:hello@netquor.com?subject=Netquor%20VPN%20-%20Fast", label: "Choose Fast", cls: "btn btn-primary-cyber" } },
    { name: "Gigabit", priceKey: "vpn.gigabit.month", speed: "Up to 1 Gbps", bar: "100%", sub: "Download and upload", items: ["Up to 10 devices", "Home labs, remote work, and heavy users", "Month to month"], cta: { href: "mailto:hello@netquor.com?subject=Netquor%20VPN%20-%20Gigabit", label: "Choose Gigabit", cls: "btn btn-outline-info rounded-pill" } },
];

export const features: readonly Feature[] = [
    { icon: "chat-heart", title: "Fast, friendly local support", text: "Netquor is a Fargo, North Dakota company. When something is wrong, you email a person who runs the network, not a ticket queue in another time zone." },
    { icon: "speedometer2", title: "Capacity checked every day", text: "We check capacity daily to make sure you are getting the speed you pay for, instead of finding out from a complaint." },
    { icon: "graph-up-arrow", title: "We scale with our customers", text: "As more people join, we add capacity to match, so the service does not slow down as it grows." },
    { icon: "diagram-3", title: "Routed on our own network", text: "Your traffic is routed through our own network, AS403008, with presence in Chicago, Dallas, New York, Kansas City, Los Angeles, London and Tokyo. We run the routing and the service ourselves." },
    { icon: "lightning-charge", title: "WireGuard, nothing exotic", text: "Fast, modern and open. Use the official WireGuard app on iPhone, Android, Mac, Windows and Linux, or drop a config into your router." },
    { icon: "calendar-check", title: "Simple and month to month", text: "Pay for the speed and devices you use. No yearly lock-in, and you can cancel any month by email." },
];

export const faq: readonly FaqEntry[] = [
    { q: "How is this different from the big commercial VPNs?", a: "Large VPN brands serve millions of subscribers. Netquor VPN is a smaller service run by a local team and routed through our own network, AS403008. You know who runs it, where they are, and how to reach them." },
    { q: "How many devices can I use?", a: "Lite and Plus include up to 3 devices, Fast includes up to 5, and Gigabit includes up to 10." },
    { q: "What apps do I use?", a: "The official WireGuard app, free on iPhone, iPad, Android, Mac, Windows and Linux. We send you a configuration for each device, and you scan a QR code or import a file." },
    { q: "What speeds will I actually get?", a: "Each plan is the top speed of your connection to us. We check capacity every day to make sure you are getting the speed you pay for, and we add capacity as our customer base grows. Your own internet service, Wi-Fi and device set the rest, so you will not exceed what your home or office connection allows." },
    { q: "Can I put it on my router?", a: "Yes. It is standard WireGuard, so it works on routers that support it, including VyOS and many consumer and prosumer models. A router counts as one device." },
    { q: "How do I sign up or cancel?", a: "Email hello@netquor.com with the plan you want. To cancel, email us any time. Plans are month to month." },
];

/** The page's inline <style> without its `body { background-color; color; font-family }` rule. On the legacy page that sheet comes before nq.css, whose own `body` rule overrides all three properties; here the page style is emitted after the layout's stylesheets, so keeping the rule would win over nq.css and change the page's colors and font. Every other rule has a selector nq.css out-ranks with its `body` prefix or does not set, so order does not matter for them. */
export const PAGE_CSS = `
        :root { --cyber-blue: #5eaaf0; --obsidian: #12161c; }
        .navbar { backdrop-filter: blur(15px); background: rgba(2, 6, 23, 0.8); border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        .hero-section { padding: 90px 0 60px; background: none; }
        .fw-black { font-weight: 900; }
        .feature-card { background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 2rem; height: 100%; transition: border-color .3s, background .3s; }
        .feature-card:hover { border-color: var(--cyber-blue); background: rgba(30, 41, 59, 0.5); }
        .icon-accent { font-size: 1.8rem; color: var(--cyber-blue); margin-bottom: 1rem; display: inline-block; }
        .btn-primary-cyber { background: var(--cyber-blue); color: var(--obsidian); border: none; border-radius: 50px; padding: 12px 32px; font-weight: 700; transition: .3s; }
        .btn-primary-cyber:hover { background: #8cc4f7; color: var(--obsidian); box-shadow: none; }
        .brand-logo-img { height: 44px; width: auto; background: #f1f5f9; border-radius: 10px; padding: 3px 8px; }
        .tier { display: flex; flex-direction: column; }
        .tier.pop { border-color: rgba(47, 143, 224, .5); }
        .speed { font-size: 1.15rem; font-weight: 700; }
        .bar { height: 8px; border-radius: 8px; background: rgba(255, 255, 255, .08); overflow: hidden; }
        .bar > i { display: block; height: 100%; background: var(--cyber-blue); border-radius: 8px; }
        .wallet { text-decoration: line-through; color: #64748b; }
        footer { border-top: 1px solid rgba(255, 255, 255, 0.05); padding: 50px 0; }
        .accordion { --bs-accordion-bg: transparent; --bs-accordion-border-color: rgba(255, 255, 255, 0.08); }
        .accordion-button:not(.collapsed) { background: rgba(47, 143, 224, 0.07); color: #f8fafc; box-shadow: none; }
    `;

/** Head text that quotes the starting price. `from` is the formatted price ("$5"), taken from the price cache by the route. */
export const head = (from: string) => ({
    title: `Netquor VPN: Local WireGuard VPN from ${from}/mo | Fargo, ND`,
    description: `A WireGuard VPN run by a local team and routed through our own network, AS403008. From ${from} a month for 25/25 Mbps, up to 1 Gbps and 10 devices. Stop paying for crowded commercial VPNs.`,
    ogTitle: `Netquor VPN: Local WireGuard VPN from ${from}/mo`,
    ogDescription: `Run by a local team and routed through our own network. From ${from} a month, up to 1 Gbps and 10 devices.`,
});
export const KEYWORDS = "VPN, WireGuard VPN, private VPN, local VPN, Fargo ND, fast VPN, 1 Gbps VPN, Netquor";

const SITE = "https://www.netquor.com";

/** The JSON-LD as the legacy page wrote it. The four offer prices are placeholders: priceMap fills them from the price cache. */
export const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
        { "@type": "Organization", "@id": `${SITE}/#org`, name: "Netquor Technologies LLC", url: `${SITE}/` },
        {
            "@type": "Service", name: "Netquor VPN", serviceType: "WireGuard VPN", provider: { "@id": `${SITE}/#org` }, url: `${SITE}/vpn.html`,
            offers: [
                { "@type": "Offer", name: "Lite: 25/25 Mbps, 3 devices", price: "5", priceCurrency: "USD" },
                { "@type": "Offer", name: "Plus: 100 Mbps, 3 devices", price: "10", priceCurrency: "USD" },
                { "@type": "Offer", name: "Fast: 500 Mbps, 5 devices", price: "20", priceCurrency: "USD" },
                { "@type": "Offer", name: "Gigabit: up to 1 Gbps, 10 devices", price: "30", priceCurrency: "USD" },
            ],
        },
    ],
};

/** JSON pointer to price key: the offers' prices come from the live price cache (as strings, like the legacy JSON-LD). */
export const priceMap = {
    "/@graph/1/offers/0/price": "vpn.lite.month",
    "/@graph/1/offers/1/price": "vpn.plus.month",
    "/@graph/1/offers/2/price": "vpn.fast.month",
    "/@graph/1/offers/3/price": "vpn.gigabit.month",
};
