// Copy and structured data of /sdn.html, moved out of the markup. The FAQ list feeds both the visible accordion and the FAQPage JSON-LD, so the two cannot drift.

export interface Feature { icon: string; title: string; text: string }
export interface FaqEntry { q: string; a: string }

export const features: readonly Feature[] = [
    { icon: "router", title: "Ubiquiti UniFi automation", text: "Design, deploy and centrally manage Ubiquiti UniFi networks: Wi-Fi 6/7 mesh, switching, cameras and structured cabling, with monitoring across every site." },
    { icon: "diagram-3", title: "VyOS routing and firewall", text: "Run VyOS edge routers and hubs from one dashboard: BGP with RPKI checks, firewall policy, DNS, static routes and guard rules that block attackers on the router itself." },
    { icon: "shield-lock", title: "WireGuard VPN and mesh", text: "Secure remote access for people and sites. Laptops and servers join as WireGuard peers on Linux, macOS and Windows, with direct mesh tunnels where traffic should not detour through a hub." },
    { icon: "server", title: "Hosting and virtualization services", text: "Proxmox virtual machine clusters with routed static IPv4, private networking and secure access. A self-hosted, privacy-first alternative to public cloud." },
    { icon: "cloud", title: "Cloud and converged infrastructure", text: "Networking, compute and access control in one inventory with one policy model and audit trail, so a small team can run what used to take a data center crew." },
    { icon: "braces", title: "Automation and API", text: "Everything in the dashboard is available over a REST API with scoped keys, so provisioning, DNS, IP space and device onboarding can be scripted." },
    { icon: "geo-alt", title: "Local to Fargo and the Midwest", text: "On-site installs, cabling and support in Fargo, West Fargo, Moorhead and across the region, backed by remote management anywhere." },
    { icon: "currency-dollar", title: "Affordable for small business", text: "Enterprise-style software-defined networking without the enterprise price. No long contracts to start. Ask for a quote." },
    { icon: "apple", title: "Pairs with Netquor Fleet MDM", text: "Add affordable Apple device management with a free 30-day trial and no minimum seats, integrated with the same Netquor platform." },
];

export const faq: readonly FaqEntry[] = [
    { q: "What is Netquor SDN?", a: "Netquor SDN is a software-defined networking and infrastructure platform from Fargo, North Dakota. It automates Ubiquiti UniFi networks and VyOS routers, connects sites and people with WireGuard VPN, and orchestrates hosting and virtualization on Proxmox, all from one dashboard and API." },
    { q: "Do you work with Ubiquiti UniFi?", a: "Yes. We design, install and automate Ubiquiti UniFi networks, including Wi-Fi 6 and 7 mesh optimization, structured cabling and rack cleanup, and manage them centrally alongside VyOS routing." },
    { q: "What is VyOS and why use it?", a: "VyOS is an open-source network operating system for routers and firewalls. Netquor SDN manages VyOS configuration centrally, with BGP, firewall, VPN, DNS and static IPv4 handled from the dashboard instead of the command line." },
    { q: "Do you offer hosting and virtualization services?", a: "Yes. We build and run virtual machine clusters on Proxmox, with routed static IPv4 addresses, private networking and secure remote access, as a self-hosted or managed alternative to public cloud." },
    { q: "What is converged infrastructure here?", a: "Networking, compute, storage and access control managed as one system: routers, hubs, VMs and VPN users share one inventory, one policy model and one set of audit logs." },
    { q: "Do you serve Fargo, ND and the Midwest?", a: "Yes. Netquor is based in Fargo, North Dakota. We provide on-site installation and support in Fargo, West Fargo, Moorhead and across North Dakota, Minnesota and South Dakota, and remote management anywhere in the Midwest." },
    { q: "Does Netquor SDN have an API?", a: "Yes. The dashboard is built on the same API available to you, with scoped API keys for scripts and integrations." },
    { q: "Can I manage Macs, iPhones and iPads too?", a: "Yes. Netquor Fleet is our affordable MDM for Apple devices, with a free 30-day trial and no minimum seats. See the Netquor Fleet page." },
];

export const TITLE = "Netquor SDN: Ubiquiti, VyOS, Cloud & Converged Infrastructure | Fargo, ND";
export const DESCRIPTION = "Software-defined networking for Ubiquiti UniFi and VyOS: WireGuard VPN, cloud and converged infrastructure, hosting and virtualization services, static IPv4 and BGP. Affordable managed networking for small business in Fargo, ND and the Midwest.";
export const KEYWORDS = "Ubiquiti, UniFi, VyOS, software-defined networking, SDN, managed network, cloud infrastructure, converged infrastructure, hosting and virtualization services, Proxmox, WireGuard VPN, BGP, static IPv4, network automation, small business network, Fargo ND, Moorhead MN, North Dakota, Midwest, structured cabling, Wi-Fi 7, managed hosting, affordable";

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
        footer { border-top: 1px solid rgba(255, 255, 255, 0.05); padding: 50px 0; }
        .accordion { --bs-accordion-bg: transparent; --bs-accordion-border-color: rgba(255, 255, 255, 0.08); }
        .accordion-button:not(.collapsed) { background: rgba(47, 143, 224, 0.07); color: #f8fafc; box-shadow: none; }
    `;

const SITE = "https://www.netquor.com";
const LOGO = `${SITE}/brand/nq-logo-primary-plate-600w.png`;

export const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
        { "@type": "Organization", "@id": `${SITE}/#org`, name: "Netquor Technologies LLC", url: `${SITE}/`, logo: LOGO, email: "hello@netquor.com", telephone: "+1-888-717-1701" },
        {
            "@type": ["ProfessionalService", "LocalBusiness"], "@id": `${SITE}/#local`, name: "Netquor Technologies", url: `${SITE}/`, image: LOGO, logo: LOGO, email: "hello@netquor.com", telephone: "+1-888-717-1701", priceRange: "$$",
            description: "Managed networking, Ubiquiti UniFi and VyOS software-defined networking, hosting and virtualization, Apple device management (MDM) and field IT services for small businesses in Fargo, North Dakota, Moorhead and the Midwest.",
            address: { "@type": "PostalAddress", addressLocality: "Fargo", addressRegion: "ND", addressCountry: "US" },
            areaServed: [
                { "@type": "City", name: "Fargo, ND" }, { "@type": "City", name: "West Fargo, ND" }, { "@type": "City", name: "Moorhead, MN" },
                { "@type": "State", name: "North Dakota" }, { "@type": "State", name: "Minnesota" }, { "@type": "State", name: "South Dakota" },
                { "@type": "AdministrativeArea", name: "Midwest United States" },
            ],
            knowsAbout: ["Mobile device management", "MDM", "Apple device management", "Ubiquiti UniFi", "VyOS", "software-defined networking", "WireGuard VPN", "Proxmox virtualization", "converged infrastructure", "managed hosting", "structured cabling"],
            parentOrganization: { "@id": `${SITE}/#org` },
        },
        {
            "@type": "SoftwareApplication", "@id": `${SITE}/sdn.html#app`, name: "Netquor SDN", applicationCategory: "BusinessApplication", applicationSubCategory: "Software-defined networking", operatingSystem: "Web, Linux, macOS, Windows",
            url: `${SITE}/sdn.html`, image: `${SITE}/sdn-logo.svg`,
            description: "Software-defined networking for Ubiquiti UniFi and VyOS with WireGuard VPN, hosting and virtualization, IPAM, BGP and DNS management.",
            publisher: { "@id": `${SITE}/#org` },
            featureList: ["VyOS router automation", "Ubiquiti UniFi automation", "WireGuard VPN and mesh", "Proxmox virtualization", "Static IPv4 and IPAM", "BGP with RPKI", "Centralized monitoring and audit", "REST API"],
        },
        {
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: "Netquor Technologies", item: `${SITE}/` },
                { "@type": "ListItem", position: 2, name: "Netquor SDN", item: `${SITE}/sdn.html` },
            ],
        },
        { "@type": "FAQPage", mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
    ],
};
