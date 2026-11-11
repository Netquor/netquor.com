// Copy of /network.html moved out of the markup. Text is trusted static copy; the FAQ answer that quotes a price is a list of parts so the price is a <Price>.
export interface Feature { icon: string; title: string; text: string }
export interface Pop { city: string; code: string }
export interface Step { n: number; title: string; text: string }
export interface Fit { title: string; text: string }
export type AnswerPart = string | { priceKey: string }
export interface FaqEntry { q: string; a: AnswerPart[] }
export const features: readonly Feature[] = [
    { icon: "globe2", title: "IP as a Service", text: "Routable public IP addresses delivered to your servers, sites and clouds over a WireGuard tunnel. No new circuit, no waiting on your hosting provider to hand you address space." },
    { icon: "broadcast-pin", title: "Anycast for distributed apps", text: "One address announced from several locations, so clients reach a nearby instance. A fit for APIs, DNS, edge services and fleets of workers spread across clouds and regions." },
    { icon: "diagram-3", title: "Our own AS: AS403008", text: "Your addresses are announced by Netquor's own autonomous system over BGP, so they stay yours as workloads move between providers." },
    { icon: "shield-lock", title: "Routed over WireGuard", text: "Traffic reaches you through encrypted WireGuard tunnels, from a laptop-sized VM to a Proxmox cluster or a router. Modern, simple and fast to deploy." },
    { icon: "geo-alt", title: "Seven locations", text: "Presence in Chicago, Dallas, New York, Kansas City, Los Angeles, London and Tokyo, with Fargo, North Dakota as home base, so you can land traffic near your users." },
    { icon: "braces", title: "Managed with Netquor SDN", text: "Tunnels, routes and addresses sit in the same dashboard and API as the rest of your Netquor SDN network, with one place to see and change what is announced." },
];
export const locations: readonly Pop[] = [
    { city: "Chicago", code: "ORD" },
    { city: "Dallas", code: "DFW" },
    { city: "New York", code: "NYC" },
    { city: "Kansas City", code: "MCI" },
    { city: "Los Angeles", code: "LAX" },
    { city: "London", code: "LON" },
    { city: "Tokyo", code: "TYO" },
];
export const steps: readonly Step[] = [
    { n: 1, title: "Choose locations", text: "Pick where your addresses should be announced: one location, or several for anycast." },
    { n: 2, title: "Connect a tunnel", text: "Bring up a WireGuard tunnel from your server, router or cloud instance to our network. We give you the configuration." },
    { n: 3, title: "We announce your IPs", text: "Your addresses are routed to you from AS403008 over BGP. Traffic arrives through the tunnel." },
    { n: 4, title: "Run anywhere", text: "Move or add workloads and keep the same addresses. Add locations when you want more reach." },
];
export const fits: readonly Fit[] = [
    { title: "Workers and agents across clouds", text: "Give distributed workers stable, allow-listable addresses, whichever provider they land on." },
    { title: "Anycast services", text: "DNS, APIs, game servers and edge endpoints that should answer from the closest location." },
    { title: "Static IPs for hosting providers that do not offer them", text: "Get routable addresses on a VPS, a home lab or a small office link." },
    { title: "Migrations", text: "Move between providers without renumbering: the addresses stay, and the tunnel follows the workload." },
];
export const faq: readonly FaqEntry[] = [
    { q: "What is IP as a Service?", a: ["It means we provide routable public IP addresses as a service. The addresses are announced from our network and delivered to you over a WireGuard tunnel, so you do not need to own address space or run BGP yourself."] },
    { q: "What is anycast and when do I want it?", a: ["Anycast announces the same IP address from more than one location. Clients are sent to a nearby one, and if a location goes away, traffic goes to another. It suits stateless or replicated services such as DNS, APIs and edge workers."] },
    { q: "Why WireGuard?", a: ["WireGuard is encrypted, simple to configure and runs well on small servers, routers and cloud instances. A tunnel works from almost anywhere you can run Linux, VyOS or a WireGuard client."] },
    { q: "What speeds can I expect?", a: ["Homelab and Startup plans run up to 1 Gbps per tunnel, and Business includes up to 2.5 Gbps, with 5 and 10 Gbps available by quote using parallel tunnels. Speed is burst capacity, not a promise for every moment: it also depends on the hardware and the internet connection at your end, and a single flow is limited by one CPU core at each end. Tell us your target and we will size it with you."] },
    { q: "Can I bring my own IP addresses?", a: ["Ask us. We can talk through announcing address space you own alongside, or instead of, addresses we provide."] },
    { q: "How is this priced?", a: ["Plans start at ", { priceKey: "network.from.month" }, " a month. Homelab and Startup are fixed prices, Business starts at $99 and larger speeds are quoted from the addresses and locations you need. See the pricing above, or send us what you are building and we will reply within a business day."] },
];
/** The page's inline <style> without its `body { background-color; color; font-family }` rule. On the legacy page that sheet comes before nq.css, whose own `body` rule overrides all three properties; here the page style is emitted after the layout's stylesheets, so keeping the rule would win over nq.css and change the page's colors and font. Every other rule has a selector nq.css out-ranks with its `body` prefix or does not set, so order does not matter for them. */
export const PAGE_CSS = `
        :root { --cyber-blue: #5eaaf0; --obsidian: #12161c; }
        .navbar { backdrop-filter: blur(15px); background: rgba(2, 6, 23, 0.8); border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        .hero-section { padding: 90px 0 70px; background: none; }
        .fw-black { font-weight: 900; }
        .feature-card { background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 2rem; height: 100%; transition: border-color .3s, background .3s; }
        .feature-card:hover { border-color: var(--cyber-blue); background: rgba(30, 41, 59, 0.5); }
        .icon-accent { font-size: 1.8rem; color: var(--cyber-blue); margin-bottom: 1rem; display: inline-block; }
        .btn-primary-cyber { background: var(--cyber-blue); color: var(--obsidian); border: none; border-radius: 50px; padding: 12px 32px; font-weight: 700; transition: .3s; }
        .btn-primary-cyber:hover { background: #8cc4f7; color: var(--obsidian); box-shadow: none; }
        .brand-logo-img { height: 44px; width: auto; background: #f1f5f9; border-radius: 10px; padding: 3px 8px; }
        .pop { background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(47, 143, 224, 0.18); border-radius: 16px; padding: 1.1rem 1.25rem; text-align: center; }
        .pop strong { display: block; font-size: 1.1rem; }
        .step-num { width: 38px; height: 38px; border-radius: 50%; background: rgba(47, 143, 224, 0.12); color: var(--cyber-blue); font-weight: 800; display: inline-flex; align-items: center; justify-content: center; margin-bottom: .75rem; }
        .builder { background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255,255,255,.08); border-radius: 28px; padding: 2rem; }
        .seg { display: inline-flex; background: rgba(2,6,23,.6); border: 1px solid rgba(255,255,255,.1); border-radius: 50px; padding: 4px; gap: 4px; flex-wrap: wrap; }
        .seg button { background: transparent; border: 0; color: #cbd5e1; padding: 8px 20px; border-radius: 50px; font-weight: 600; }
        .seg button[aria-pressed="true"] { background: var(--cyber-blue); color: var(--obsidian); }
        .tile { background: rgba(2,6,23,.55); border: 1px solid rgba(255,255,255,.09); border-radius: 16px; padding: .9rem 1rem; display: flex; align-items: center; gap: .75rem; justify-content: space-between; transition: border-color .2s; }
        .tile.on { border-color: rgba(47, 143, 224,.55); }
        .tile.off { opacity: .45; }
        .step { display: inline-flex; align-items: center; gap: .4rem; }
        .step button { width: 30px; height: 30px; border-radius: 8px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.05); color: #f8fafc; font-weight: 700; line-height: 1; }
        .step button:hover:not(:disabled) { border-color: var(--cyber-blue); color: var(--cyber-blue); }
        .step button:disabled { opacity: .35; cursor: not-allowed; }
        .step .n { min-width: 1.6rem; text-align: center; font-variant-numeric: tabular-nums; }
        .stack { display: flex; flex-direction: column-reverse; gap: 6px; min-height: 140px; justify-content: flex-start; }
        .blk { border-radius: 12px; padding: .65rem 1rem; display: flex; justify-content: space-between; align-items: center; font-size: .9rem; background: rgba(47, 143, 224,.10); border: 1px solid rgba(47, 143, 224,.35); }
        .blk.base { background: rgba(47, 143, 224,.22); border-color: var(--cyber-blue); font-weight: 700; }
        .blk .amt { color: #94a3b8; font-variant-numeric: tabular-nums; }
        .blk.drop { animation: drop .55s cubic-bezier(.2,.7,.2,1); }
        @keyframes drop { 0% { transform: translateY(-70px); opacity: 0; } 55% { transform: translateY(5px); opacity: 1; } 78% { transform: translateY(-3px); } 100% { transform: translateY(0); } }
        .total { font-variant-numeric: tabular-nums; }
        @media (max-width: 575.98px) {
            .builder { padding: 1.1rem; border-radius: 20px; }
            .seg { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; width: 100%; border-radius: 14px; }
            .seg button { padding: 8px 6px; border-radius: 10px; font-size: .9rem; white-space: nowrap; }
            #seg-bill button:last-child { font-size: .8rem; white-space: normal; line-height: 1.15; }
        }
        @media (prefers-reduced-motion: reduce) { .blk.drop { animation: none; } }
        footer { border-top: 1px solid rgba(255, 255, 255, 0.05); padding: 50px 0; }
        .accordion { --bs-accordion-bg: transparent; --bs-accordion-border-color: rgba(255, 255, 255, 0.08); }
        .accordion-button:not(.collapsed) { background: rgba(47, 143, 224, 0.07); color: #f8fafc; box-shadow: none; }
    `;

export const TITLE = "Netquor Network Solutions: AS403008, Anycast & IP as a Service";
export const DESCRIPTION = "Routable IP space and anycast for distributed applications and workers, delivered over WireGuard tunnels from our own network, AS403008, with presence in Chicago, Dallas, New York, Kansas City, Los Angeles, London and Tokyo.";
export const OG_DESCRIPTION = "Routable IP space and anycast for distributed applications and workers, delivered over WireGuard tunnels, from Chicago, Dallas, New York, Kansas City, Los Angeles, London and Tokyo.";
export const TWITTER_DESCRIPTION = "Routable IP space and anycast for distributed applications and workers, delivered over WireGuard tunnels.";
export const KEYWORDS = "AS403008, anycast, IP as a service, IPaaS, BGP, WireGuard tunnel, routable IP addresses, distributed applications, Chicago, Dallas, New York, Kansas City, Los Angeles, London, Tokyo, Netquor";

export interface PlanCard {
    name: string;
    /** Price key of the published price; a plan without one shows `literal`. */
    priceKey?: string;
    /** Shown as written when there is no price key. Business: the page says $129.49 here and "starts at $99" in the FAQ; undecided, so it stays literal and is not fetched. */
    literal?: string;
    from?: boolean;
    cardStyle?: string;
    items: readonly string[];
    cta: { href: string; label: string; cls: string };
}

export const plans: readonly PlanCard[] = [
    {
        name: "Homelab", priceKey: "network.homelab.month",
        items: ["1 routable IPv4 address", "IPv6 /56 (256 subnets)", "1 location of your choice", "1 WireGuard tunnel, up to 1 Gbps", "2 TB fair-use volume, slowed and never surprise-billed", "Standard WireGuard and VyOS configs", "Community and email support"],
        cta: { href: "mailto:hello@netquor.com?subject=Network%20Solutions%20-%20Homelab", label: "Start with Homelab", cls: "btn btn-outline-info rounded-pill" },
    },
    {
        name: "Startup", priceKey: "network.startup.month", cardStyle: "border-color: rgba(47, 143, 224,.5);",
        items: ["4 routable IPv4 addresses", "IPv6 /56, or a /48 on request", "2 locations", "1 anycast address", "3 WireGuard tunnels, up to 1 Gbps", "5 TB fair-use volume", "Optional BGP session", "Email support, one business day"],
        cta: { href: "mailto:hello@netquor.com?subject=Network%20Solutions%20-%20Startup", label: "Choose Startup", cls: "btn btn-primary-cyber" },
    },
    {
        name: "Business", literal: "$129.49", from: true,
        items: ["8 or more routable IPv4 addresses", "IPv6 /48 included", "4 locations included, up to all seven with extras", "Anycast and BGP included", "2.5 Gbps burst included; 5 or 10 Gbps by quote", "Parallel tunnels as the speed needs", "Usage above the commit billed on measured use", "Priority support, same day"],
        cta: { href: "mailto:hello@netquor.com?subject=Network%20Solutions%20-%20Business", label: "Talk to us", cls: "btn btn-outline-info rounded-pill" },
    },
];

const SITE = "https://www.netquor.com";

export const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
        { "@type": "Organization", "@id": `${SITE}/#org`, name: "Netquor Technologies LLC", url: `${SITE}/` },
        {
            "@type": "Service", name: "Netquor Network Solutions", serviceType: "IP as a Service and anycast, routed over WireGuard", provider: { "@id": `${SITE}/#org` }, url: `${SITE}/network.html`,
            description: "Routable IP space and anycast addresses for distributed applications and workers, delivered over WireGuard tunnels from Netquor's network, AS403008, with presence in Chicago, Dallas, New York, Kansas City, Los Angeles, London and Tokyo.",
        },
    ],
};
