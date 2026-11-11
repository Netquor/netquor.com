// Copy and data for /digitalaccess.html (Netquor Digital Access). Prices are keys into the live price cache; Community is free, which is not a price.
export const TITLE = "Netquor Digital Access: Modern Access Control Without Replacing Your Hardware";
export const DESCRIPTION = "Upgrade your building's entry system using what you already have. AI visitor automation, tenant self-service and smart integrations. Free to start, from a local Fargo, ND team.";
export const KEYWORDS = "access control, apartment access control, property management, call box, visitor automation, smart lock, tenant app, Fargo ND, Netquor Digital Access";
export const OG_DESCRIPTION = "Upgrade your building's entry system using what you already have. Free to start.";

const OFFER = (name: string, price: string) => ({ "@type": "Offer", name, price, priceCurrency: "USD" });
export const JSON_LD = {
    "@context": "https://schema.org",
    "@graph": [
        { "@type": "Organization", "@id": "https://www.netquor.com/#org", name: "Netquor Technologies LLC", url: "https://www.netquor.com/" },
        {
            "@type": "Service", name: "Netquor Digital Access", serviceType: "Access control for multi-dwelling buildings",
            provider: { "@id": "https://www.netquor.com/#org" }, url: "https://www.netquor.com/digitalaccess.html",
            description: "Access control for multi-dwelling buildings that works with existing hardware, with AI visitor automation and tenant self-service.",
            offers: [OFFER("Community", "0"), OFFER("Power User Plus", "9.99"), OFFER("Property Manager Pro", "59.99"), OFFER("Property Manager Scale", "199")],
        },
    ],
};
/** JSON pointer to price key. The Community offer is free and has no key. */
export const PRICE_MAP = {
    "/@graph/1/offers/1/price": "digitalaccess.plus.month",
    "/@graph/1/offers/2/price": "digitalaccess.pro.month",
    "/@graph/1/offers/3/price": "digitalaccess.scale.month",
};

export const INTRO: readonly { icon: string; title: string; text: string }[] = [
    { icon: "bi-hdd-network-fill", title: "Use existing hardware", text: "No expensive panel replacements. Works with many existing call boxes and systems." },
    { icon: "bi-gear-fill", title: "Automate access", text: "Handle guests, deliveries and service visits automatically." },
    { icon: "bi-currency-dollar", title: "Lower total cost", text: "Scale without large upfront investments." },
];

export const AI_POINTS: readonly string[] = [
    "Sync with calendars and email to detect upcoming events",
    "Automatically route calls and grant access",
    "Enable secure delivery and vendor access workflows",
    "Reduce missed deliveries and tenant interruptions",
];

export const TENANT: readonly { icon: string; title: string; text: string }[] = [
    { icon: "bi-person-check-fill", title: "Self-service access", text: "Tenants manage guests and entry without calling you." },
    { icon: "bi-phone-fill", title: "Smart integrations", text: "Works with platforms like Alexa and Home Assistant." },
    { icon: "bi-emoji-smile-fill", title: "Fewer interruptions", text: "Reduce calls, texts and manual access requests." },
];

export const PASSPORT: readonly { icon: string; title: string; text: string }[] = [
    { icon: "bi-person-walking", title: "Visitors", text: "A pass for the visit, from the front door to the unit." },
    { icon: "bi-house-heart", title: "Housekeepers and service visits", text: "Regular access that you can change or end at any time." },
    { icon: "bi-suitcase-lg", title: "Guests", text: "Welcome someone for the weekend without meeting them at the door." },
];

export const BUZZER: readonly { icon: string; title: string; text: string }[] = [
    { icon: "bi-key", title: "Secret code", text: "Buzz a secret code or pattern and the door opens." },
    { icon: "bi-bell", title: "Know who is there", text: "Get notified who is at the door." },
    { icon: "bi-mic", title: "Talk", text: "Speak with your visitor before you let them in." },
    { icon: "bi-plus-circle", title: "And more", text: "All managed in the same platform as everything else." },
];

export const VS_YES: readonly string[] = ["Use existing hardware", "No forced upgrades", "Fast deployment", "Flexible integrations", "Lower long-term cost"];
export const VS_NO: readonly string[] = ["Require hardware replacement", "High upfront costs", "Limited integrations", "Vendor lock-in", "Slower deployment"];

export interface Tier {
    name: string;
    badge?: string;
    cardClass?: string;
    blurb: string;
    /** a price key, or null for the free plan */
    priceKey: string | null;
    /** a line under the price, before the feature list */
    includes?: string;
    features: readonly string[];
    cta: { href: string; label: string; primary?: boolean };
}
const MAIL = "mailto:hello@netquor.com?subject=Digital%20Access";
export const TIERS: readonly Tier[] = [
    {
        name: "Community", blurb: "For individuals and basic setups", priceKey: null,
        features: ["Basic access control", "Shared ingress number", "Single property support"],
        cta: { href: `${MAIL}%20-%20Community`, label: "Get started" },
    },
    {
        name: "Power User Plus", blurb: "For advanced users and integrations", priceKey: "digitalaccess.plus.month",
        features: ["Everything in Community", "API access", "Dedicated ingress number", "Smart integrations (Alexa, Home Assistant)", "Mobile app access"],
        cta: { href: `${MAIL}%20-%20Power%20User%20Plus`, label: "Upgrade" },
    },
    {
        name: "Property Manager Pro", badge: "Most popular", cardClass: "pop", blurb: "For property managers", priceKey: "digitalaccess.pro.month",
        features: ["Up to 10 properties", "Up to 250 tenants", "5 manager accounts", "Reporting and insights", "AI visitor automation"],
        cta: { href: `${MAIL}%20-%20Property%20Manager%20Pro%20trial`, label: "Start free trial", primary: true },
    },
    {
        name: "Property Manager Scale", blurb: "For growing property management companies", priceKey: "digitalaccess.scale.month", includes: "Includes 25 properties and 1,000 tenants",
        features: ["Everything in Pro", "SSO and identity provider integration", "Custom API integrations", "Advanced analytics", "Priority support", "Dedicated account manager"],
        cta: { href: `${MAIL}%20-%20Property%20Manager%20Scale`, label: "Scale your business" },
    },
];

export const ADDON_FEATURES: readonly string[] = ["Tenant mobile access controls", "Guest and visitor pre-authorization", "Delivery and service automation", "Smart lock integrations"];

export const FOOTER_LINKS: readonly { href: string; label: string }[] = [
    { href: "index.html", label: "Home" }, { href: "sdn.html", label: "Netquor SDN" }, { href: "network.html", label: "Network Solutions" },
    { href: "vpn.html", label: "Netquor VPN" }, { href: "homeassistant.html", label: "Hosted Home Assistant" }, { href: "https://phone.netquor.com/", label: "Netquor Phone" },
    { href: "fleet.html", label: "Netquor Fleet" }, { href: "terms.html", label: "Terms" }, { href: "privacy.html", label: "Privacy" }, { href: "https://status.netquor.com/", label: "Status" },
];

/** The page's own rules, as the legacy page wrote them in its head. */
export const PAGE_CSS = `
        :root { --cyber-blue: #5eaaf0; --obsidian: #12161c; }
        body { background-color: var(--obsidian); color: #f8fafc; font-family: 'IBM Plex Sans', -apple-system, sans-serif; }
        .hero-section { padding: 90px 0 60px; background: none; }
        .fw-black { font-weight: 900; }
        .feature-card { background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 2rem; height: 100%; transition: border-color .3s, background .3s; }
        .feature-card:hover { border-color: var(--cyber-blue); background: rgba(30, 41, 59, 0.5); }
        .icon-accent { font-size: 1.8rem; color: var(--cyber-blue); margin-bottom: 1rem; display: inline-block; }
        .btn-primary-cyber { background: var(--cyber-blue); color: var(--obsidian); border: none; border-radius: 50px; padding: 12px 32px; font-weight: 700; transition: .3s; }
        .btn-primary-cyber:hover { background: #8cc4f7; color: var(--obsidian); box-shadow: none; }
        .phone { max-width: 300px; margin: 0 auto; border-radius: 38px; padding: 10px; background: #0b1220; border: 1px solid rgba(47, 143, 224, .3); box-shadow: 0 30px 80px rgba(2, 6, 23, .7), 0 0 60px rgba(47, 143, 224, .1); }
        .phone img { display: block; width: 100%; height: auto; border-radius: 30px; }
        .step-num { width: 38px; height: 38px; border-radius: 50%; background: rgba(47, 143, 224, 0.12); color: var(--cyber-blue); font-weight: 800; display: inline-flex; align-items: center; justify-content: center; margin-bottom: .75rem; }
        .tier { display: flex; flex-direction: column; }
        .tier.pop { border-color: rgba(47, 143, 224, .5); }
        .vs-yes li, .vs-no li { list-style: none; margin-bottom: .5rem; }
        footer { border-top: 1px solid rgba(255, 255, 255, 0.05); padding: 50px 0; }
    `;
