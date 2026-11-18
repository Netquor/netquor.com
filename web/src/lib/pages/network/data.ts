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
