// compare.html: the sourced and dated comparison tables. Every competitor price is an editorial fact as of CHECKED (it is not a Netquor price, so it stays text); Netquor's own prices are { price: key } parts and render from the live price cache.

/** The date the competitor prices were checked against each company's own page. */
export const CHECKED = "November 10, 2026";

/** A piece of a cell: plain text, or a Netquor price from the price cache (default format "$5" / "$5.95"). */
export type Part = string | { price: string };

export interface Row {
    /** Netquor's own row (class nq-me). */
    mine?: boolean;
    /** The option's name and where it links. External links open in a new tab. */
    name: string;
    href: string;
    external?: boolean;
    /** The "third-party" marker after the link. */
    thirdParty?: boolean;
    /** "Price as listed". */
    price: readonly Part[];
    /** "Terms". */
    terms: string;
}

export interface Category {
    id: string;
    title: string;
    open?: boolean;
    rows: readonly Row[];
    view: string;
}

export const HEAD = ["Option", "Price as listed", "Terms"] as const;

export const TABS: readonly { href: string; label: string }[] = [
    { href: "#apple", label: "Apple device management" },
    { href: "#identity", label: "Directory, single sign-on and signatures" },
    { href: "#phone", label: "Phone and receptionist" },
    { href: "#vpn", label: "Remote access and VPN" },
    { href: "#ip", label: "Routable IP addresses" },
    { href: "#home", label: "Smart home and building access" },
];

const rx = (name: string, href: string, price: string, terms: string, thirdParty = false): Row => ({ name, href, external: true, thirdParty, price: [price], terms });

const PHONE_SRC = "https://dev.to/voicefleet/ai-receptionist-pricing-breakdown-smithai-vs-ruby-vs-goodcall-vs-voicefleet-2026-38jk";

export const CATEGORIES: readonly Category[] = [
    {
        id: "apple", title: "Apple device management", open: true,
        rows: [
            { mine: true, name: "Netquor Fleet", href: "fleet.html", price: [{ price: "fleet.mac.month" }, " per Mac, ", { price: "fleet.mobile.month" }, " per iPhone or iPad a month"], terms: "Month to month, no minimum, free 30-day trial" },
            rx("Jamf for Mac", "https://www.jamf.com/pricing/", "$12.50 per Mac a month", "Billed annually, 25-device minimum"),
            rx("Jamf for Mobile", "https://www.jamf.com/pricing/", "$5.75 per device a month", "Billed annually, 25-device minimum"),
            rx("Jamf Now", "https://www.jamf.com/pricing/", "From $4 per device a month", "For organizations under 25 employees"),
            rx("Mosyle Business", "https://business.mosyle.com/pricing", "$1.00 per device a month", "Billed annually, 30-license minimum. A free tier covers up to 30 devices"),
            rx("Mosyle Fuse", "https://business.mosyle.com/pricing", "$3.00 per Mac, $1.50 per iPhone or iPad a month", "Billed annually, 30-license minimum"),
            rx("Addigy", "https://addigy.com/pricing/", "From $8.25 per Mac a month", "No minimum listed, 14-day trial, iPhone and iPad priced separately"),
            rx("FleetDM Premium", "https://fleetdm.com/pricing", "$7.00 per host a month", "A free tier has basic features and no support"),
            rx("Iru endpoint management", "https://www.iru.com/pricing/", "Not published", "Quote only, annual commitment, 14-day trial"),
        ],
        view: "Mosyle lists lower per-device prices, including a free tier up to 30 devices. Jamf and Mosyle's paid plans have 25 and 30 device minimums, while Netquor Fleet has no minimum and starts with a 30-day trial.",
    },
    {
        id: "identity", title: "Directory, single sign-on and signatures",
        rows: [
            { mine: true, name: "Netquor Central (in development)", href: "central.html", price: ["Not priced yet"], terms: "In development. Directory, groups, Gmail filters, signatures and sign-in in one tool" },
            rx("JumpCloud single sign-on", "https://jumpcloud.com/pricing", "$11 per user a month billed annually, $13 monthly", "No minimum user count listed"),
            rx("Okta Starter", "https://www.okta.com/pricing/", "$6 per user a month, billed annually", "$1,500 a year minimum"),
            rx("Google Cloud Identity Premium", "https://docs.cloud.google.com/identity/docs/how-to/compare-cloud-identity-billing-plans", "$7.20 per user a month, or $6 on a one-year term", "No minimum number of users"),
            rx("Exclaimer signatures", "https://www.exclaimer.com/pricing", "$0.90, $1.45 or $1.75 per user a month, billed annually", "10-user minimum"),
            rx("CodeTwo signatures", "https://www.codetwo.com/email-signatures/pricing/", "$1.22 per license a month yearly for 10 to 25 licenses", "10-license minimum, $1.36 billed monthly"),
        ],
        view: "These are separate tools with separate bills. Netquor Central is meant to cover the directory, groups, Gmail filters and signatures in one place, so the fair comparison is the total of the tools you would otherwise run.",
    },
    {
        id: "phone", title: "Phone and receptionist",
        rows: [
            { mine: true, name: "Netquor Phone", href: "https://phone.netquor.com/", price: ["Planned launch price from ", { price: "phone.planned_launch.month" }, " a month"], terms: "Early access, not billed yet. A phone system and an AI receptionist in one" },
            rx("Ruby", PHONE_SRC, "$250 a month for 50 minutes, $395 for 100, $720 for 200", "Human receptionists, per minute. Sources differ", true),
            rx("Smith.ai", PHONE_SRC, "From $150 a month for 75 calls", "AI-first with human backup, per call. Sources differ", true),
            rx("Rosie", PHONE_SRC, "About $49 a month for 250 minutes", "AI receptionist. No phone system listed in the source", true),
            rx("Per-user phone systems", "https://www.phone2.io/data/business-phone-pricing-index", "$15 to $50 per user a month", "OpenPhone (Quo), Dialpad and others, per seat. Sources differ", true),
        ],
        view: "A human service is proven today, and our AI receptionist is in early access with no customers yet. Netquor Phone is built for people who want a receptionist and a phone system together.",
    },
    {
        id: "vpn", title: "Remote access and VPN",
        rows: [
            { mine: true, name: "Netquor VPN", href: "vpn.html", price: [{ price: "vpn.from.month" }, " to ", { price: "vpn.to.month" }, " a month per account, by speed"], terms: "Month to month, 3 to 10 devices" },
            rx("NordLayer Lite", "https://nordlayer.com/pricing/", "$8 per user a month on yearly billing", "5-user minimum, 6 devices per user"),
            rx("Twingate Teams", "https://www.twingate.com/pricing", "$5 per user a month as shown, with a 15% yearly discount", "Up to 100 users"),
            rx("Cloudflare Zero Trust", "https://www.cloudflare.com/plans/sase-zero-trust.md", "Free for up to 50 users, then $7 per user a month", "Pay-as-you-go has no user limit"),
            rx("Tailscale", "https://tailscale.com/pricing", "Free for up to 6 users, Standard $8 and Premium $18 per user a month", "Unlimited devices"),
            rx("Mullvad VPN", "https://mullvad.net/en/pricing", "About $5.61 a month (5 euros)", "Up to 5 devices"),
            rx("Proton VPN Plus", "https://protonvpn.com/pricing", "$35.88 for the first 12 months, then $83.88 a year", "10 devices"),
        ],
        view: "Several of these are team access tools priced per user. Netquor VPN is a flat per-account WireGuard VPN that runs on our own network.",
    },
    {
        id: "ip", title: "Routable IP addresses",
        rows: [
            { mine: true, name: "Network Solutions", href: "network.html", price: ["From ", { price: "network.from.month" }, " a month: a routable IPv4 and an IPv6 /56 over WireGuard"], terms: "Month to month, no setup fee, half price for students" },
            rx("AWS public IPv4", "https://aws.amazon.com/vpc/pricing/", "$0.005 per hour per address, about $3.65 a month", "Attached to AWS resources"),
            rx("Hetzner IPv4", "https://docs.hetzner.com/general/infrastructure-and-availability/ipv4-pricing", "About $0.56 a month primary and $3.36 floating (0.50 and 3.00 euros), excluding VAT", "Cloud servers"),
            rx("Vultr Reserved IP", "https://docs.vultr.com/support/products/network/are-reserved-ips-free", "$3 a month", "Attaches to one instance at a time"),
            rx("DigitalOcean Reserved IPv4", "https://docs.digitalocean.com/products/networking/reserved-ips/details/pricing/", "$5 a month when unassigned, free while assigned", "Cloud droplets"),
            rx("Comcast Business static IP", "https://business.comcast.com/internet/business-internet", "Static IP not listed", "Quote form only"),
        ],
        view: "Cloud addresses attach to servers in the same cloud. Network Solutions delivers a routable address to your own hardware over WireGuard, so a lab or an office can use it.",
    },
    {
        id: "home", title: "Smart home and building access",
        rows: [
            { mine: true, name: "Hosted Home Assistant", href: "homeassistant.html", price: ["From ", { price: "homeassistant.from.month" }, " a month"], terms: "Managed hosting with a bridge device included, cancel any time" },
            { mine: true, name: "Digital Access", href: "digitalaccess.html", price: ["Free to start, paid plans from ", { price: "digitalaccess.plus.month" }, " a month"], terms: "Built to keep many existing call boxes and systems" },
            rx("Nabu Casa Home Assistant Cloud", "https://www.nabucasa.com/pricing/", "$6.50 a month or $65 a year", "31-day free trial. Home Assistant Cloud becomes Home Assistant Link on December 2"),
            rx("habbb managed Home Assistant", "https://www.itechguides.com/compare/habbb-vs-oneploy/", "From about $40 a month (30 pounds)", "Managed service in the UK", true),
            rx("ButterflyMX", "https://www.butterflymx.com/pricing/", "$30 to $42 per unit a year for software", "Intercom hardware is bought separately"),
            rx("Brivo", "https://www.brivo.com/products/access-control/", "Not published", "Book a demo. Works with existing hardware"),
            rx("Swiftlane", "https://www.swiftlane.com/building-intercom-system", "Not published", "Own PoE panels"),
        ],
        view: "Compare what each plan includes. Hosted Home Assistant includes managed hosting and a bridge device, and Digital Access is built to keep many existing call boxes and systems.",
    },
];
