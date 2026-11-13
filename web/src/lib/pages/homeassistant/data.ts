// Copy and data for /homeassistant.html (Hosted Home Assistant). Prices are keys into the live price cache, never typed amounts.
export const TITLE = "Hosted Home Assistant: Managed, Cloud-Native Smart Home | Netquor";
export const KEYWORDS = "hosted Home Assistant, managed Home Assistant, Home Assistant cloud, smart home hosting, Raspberry Pi bridge, Zigbee, Z-Wave, Netquor";
export const OG_TITLE = "Hosted Home Assistant, managed by a local team";
/** The price in the descriptions is the starting price, put in by the route from the price cache. */
export const description = (from: string) => `Hosted Home Assistant from a local team: your assistant runs in the cloud, backed up and managed, with a rented bridge device that connects your home network. From ${from} a month.`;
export const ogDescription = (from: string) => `Your assistant in the cloud for access anywhere, plus a rented bridge for your home network. From ${from} a month.`;

const OFFER = (name: string, price: string) => ({ "@type": "Offer", name, price, priceCurrency: "USD" });
export const JSON_LD = {
    "@context": "https://schema.org",
    "@graph": [
        { "@type": "Organization", "@id": "https://www.netquor.com/#org", name: "Netquor Technologies LLC", url: "https://www.netquor.com/" },
        {
            "@type": "Service", name: "Netquor Hosted Home Assistant", serviceType: "Managed Home Assistant hosting",
            provider: { "@id": "https://www.netquor.com/#org" }, url: "https://www.netquor.com/homeassistant.html",
            offers: [OFFER("Home", "14"), OFFER("Home Plus", "24"), OFFER("Home Pro", "39"), OFFER("Resilient", "12")],
        },
    ],
};
/** JSON pointer to price key: the offer prices are written from the price cache. */
export const PRICE_MAP = {
    "/@graph/1/offers/0/price": "homeassistant.home.month",
    "/@graph/1/offers/1/price": "homeassistant.plus.month",
    "/@graph/1/offers/2/price": "homeassistant.pro.month",
    "/@graph/1/offers/3/price": "homeassistant.resilient.month",
};

export const MAILTO = "mailto:hello@netquor.com?subject=Hosted%20Home%20Assistant";

export const STEPS: readonly { n: number; title: string; text: string }[] = [
    { n: 1, title: "Pick a plan", text: "Choose how much assistant you need. You can move up or down any month." },
    { n: 2, title: "We ship the bridge", text: "A small, pre-configured device arrives at your door. It is rented, so there is nothing to buy." },
    { n: 3, title: "Plug it in", text: "Power and a network cable to your router. It connects your home to your assistant over a secure, encrypted link." },
    { n: 4, title: "Open it anywhere", text: "Your assistant is online. We can restore a backup from your existing setup so nothing is lost." },
];

export interface Feature { text: string; /** the minus icon of an add-on the plan does not include */ off?: boolean }
export interface Tier {
    /** extra classes on the card after "feature-card tier" */
    cardClass?: string;
    ribbon?: string;
    name: string;
    /** the plan name is cyan unless it carries its own colour */
    nameStyle?: string;
    priceKey: string;
    /** the colour of the tick icons when it is not the default cyan */
    tickStyle?: string;
    features: readonly Feature[];
    cta: { href: string; label: string; primary?: boolean };
}
export const TIERS: readonly Tier[] = [
    {
        name: "Home", priceKey: "homeassistant.home.month",
        features: [
            { text: "Your own isolated Home Assistant in the cloud" }, { text: "Bridge device included" }, { text: "2 users" },
            { text: "Daily backups, kept 7 days" }, { text: "Radios (Zigbee, Z-Wave, Bluetooth) as an add-on", off: true }, { text: "Email support" },
        ],
        cta: { href: `${MAILTO}%20-%20Home`, label: "Choose Home" },
    },
    {
        cardClass: "pop", name: "Home Plus", priceKey: "homeassistant.plus.month",
        features: [
            { text: "Dedicated container with more CPU and memory" }, { text: "Bridge device included" }, { text: "5 users" },
            { text: "Daily backups, kept 30 days" }, { text: "Zigbee, Z-Wave and Bluetooth radios included" }, { text: "Up to 2 cameras" }, { text: "Email support, one business day" },
        ],
        cta: { href: `${MAILTO}%20-%20Home%20Plus`, label: "Choose Home Plus", primary: true },
    },
    {
        name: "Home Pro", priceKey: "homeassistant.pro.month",
        features: [
            { text: "Dedicated virtual machine" }, { text: "Bridge device included, with a spare shipped if one fails" }, { text: "Unlimited users" },
            { text: "Daily backups, kept 90 days, with an off-site copy" }, { text: "Radios included" }, { text: "Up to 8 cameras" }, { text: "Priority support, same day, plus a setup session" },
        ],
        cta: { href: `${MAILTO}%20-%20Home%20Pro`, label: "Choose Home Pro" },
    },
    {
        cardClass: "alt", ribbon: "Works without internet", name: "Resilient", nameStyle: "color: var(--nq-accent-t);", priceKey: "homeassistant.resilient.month", tickStyle: "color: var(--nq-accent-t);",
        features: [
            { text: "Home Assistant runs on the bridge in your home" }, { text: "Your automations keep working if the internet goes down" }, { text: "Remote access through our cloud" },
            { text: "A standby copy in the cloud that we help you switch to" }, { text: "3 users, daily backups kept 30 days" }, { text: "Radios and cameras stay on your own network" }, { text: "Email support, one business day" },
        ],
        cta: { href: `${MAILTO}%20-%20Resilient`, label: "Choose Resilient" },
    },
];

/** Extras: text is split around the price so the price comes from the cache; `after` follows it. */
export interface Extra { before: string; priceKey?: string; after: string }
export const EXTRAS: readonly Extra[] = [
    { before: "Extra bridge for a second home: about ", priceKey: "homeassistant.extra_bridge.month", after: " / month" },
    { before: "Zigbee or Z-Wave USB radio: ", priceKey: "homeassistant.zigbee_radio.once", after: " one-time each" },
    // "about $4 / month off" is a discount, not a published price
    { before: "Bring your own Raspberry Pi: about $4 / month off", after: "" },
    { before: "Setup session or migration from your current setup: ", priceKey: "homeassistant.setup_session.once", after: " one-time (about an hour with an engineer), free on yearly plans and included with Home Pro" },
    { before: "Rent to own: the bridge is yours after 24 months", after: "" },
    { before: "Yearly billing: 2 months free", after: "" },
];

export const WHY: readonly { icon: string; title: string; text: string }[] = [
    { icon: "bi-cloud-check", title: "Always on, always updated", text: "Your assistant is not a box in a closet. We keep it running, patched and backed up, so a power flicker at home does not take it offline." },
    { icon: "bi-hdd-network", title: "A bridge to your home", text: "The rented device connects your local network to your assistant, so local devices keep working with a cloud-hosted setup." },
    { icon: "bi-lock", title: "Yours alone", text: "Every customer gets their own isolated instance, with encrypted backups. No shared accounts and no shared home." },
    { icon: "bi-arrow-repeat", title: "Easy to move in", text: "Already have Home Assistant? We restore your backup, so your automations, dashboards and history come with you." },
    { icon: "bi-chat-heart", title: "Fast, friendly local support", text: "A Fargo, North Dakota team that can look at your actual setup. Not a ticket queue in another time zone." },
    { icon: "bi-calendar-check", title: "No lock-in", text: "Month to month. Take a full backup with you any time, and send the bridge back when you leave." },
];

/** Accordion entries in page order (the ids are not in sequence, as on the legacy page). `a` is trusted HTML. */
export const FAQ: readonly { id: string; q: string; a: string }[] = [
    { id: "h0", q: "What is the bridge?", a: "A small, pre-configured computer you plug into your router. It connects your home network to your assistant, and it can also carry your Zigbee, Z-Wave and Bluetooth radios. We ship it, we manage it, and you send it back if you cancel." },
    { id: "h1", q: "What happens if my home internet goes down?", a: "On the cloud plans (Home, Home Plus, Home Pro) your assistant needs the connection to reach your devices, so automations pause until it returns. If you want your home to keep working through an outage, choose Resilient: Home Assistant runs on the bridge in your home, and our cloud adds remote access, backups and a standby copy." },
    { id: "h2", q: "Can I bring my existing Home Assistant?", a: "Yes. Send us a backup and we restore it, so your automations, dashboards and history come with you. We can also do a setup session with you." },
    { id: "h3", q: "Which devices and integrations work?", a: "Most integrations work, including cloud services and many local devices through the bridge. A few that rely on discovery inside your home network need extra setup, and we will tell you before you sign up if something on your list is a poor fit." },
    { id: "h4", q: "Do I have to buy hardware?", a: "No. The bridge is included on every plan, and you can bring your own Raspberry Pi for a lower price. If you rent, it becomes yours after 24 months." },
    { id: "h6", q: "Does it work with Netquor Digital Access?", a: "Yes. Hosted Home Assistant integrates with <a href=\"digitalaccess.html\" class=\"text-info\">Netquor Digital Access</a>, so entry events from your building can drive your home automations. It is a good fit if your building already has a call box or ButterflyMX." },
    { id: "h5", q: "Is this official Home Assistant?", a: "No. This is an independent hosting and support service for the open-source Home Assistant software. Home Assistant is a trademark of the Open Home Foundation, and Raspberry Pi is a trademark of Raspberry Pi Ltd. Netquor is not affiliated with or endorsed by either." },
];

export const FOOTER_LINKS: readonly { href: string; label: string }[] = [
    { href: "index.html", label: "Home" }, { href: "vpn.html", label: "Netquor VPN" }, { href: "network.html", label: "Network Solutions" },
    { href: "sdn.html", label: "Netquor SDN" }, { href: "fleet.html", label: "Netquor Fleet" }, { href: "terms.html", label: "Terms" }, { href: "privacy.html", label: "Privacy" }, { href: "https://status.netquor.com/", label: "Status" },
];

