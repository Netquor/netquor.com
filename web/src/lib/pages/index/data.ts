// Data for the home page (/), moved out of the markup. Text here is plain unless a field is documented as HTML. Prices inside strings are written as {{price.key}} tokens and drawn by Rich.svelte from the live price cache. The legacy page lives only in the legacy-baseline-2026-11 tag (see scripts/baseline).
import { EMAIL, MAIN, TELEPHONES } from "../../contact";
import type { PriceMap } from "#lib/jsonld.ts";
import { sameAs } from "#lib/social.ts";

export const SEO = {
    "title": "Netquor Technologies | Fargo, ND: Managed Networking, Ubiquiti & VyOS SDN, Hosting, MDM",
    "description": "Fargo, North Dakota technology company serving the Midwest: managed networking (Netquor SDN, Ubiquiti UniFi, VyOS, WireGuard), hosting and virtualization, Netquor Fleet MDM, and Netquor Phone, a virtual receptionist and business phone system in early access.",
    "keywords": "virtual receptionist, business phone system, Fargo ND IT services, Fargo managed network, Fargo technology company, Midwest managed IT, Ubiquiti UniFi installer Fargo, VyOS, software-defined networking, SDN, hosting and virtualization, converged infrastructure, cloud infrastructure, Proxmox, WireGuard VPN, structured cabling Fargo, MDM, mobile device management, cheap MDM, small business MDM, North Dakota, Minnesota, Moorhead, West Fargo",
    "author": "Netquor Technologies LLC"
} as const;

/** The legacy JSON-LD as written. The offer prices are overwritten from the price cache by Seo through PRICE_MAP. */
export const JSON_LD = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Organization",
            "@id": "https://www.netquor.com/#org",
            "name": "Netquor Technologies LLC",
            "url": "https://www.netquor.com/",
            "logo": "https://www.netquor.com/brand/nq-logo-primary-plate-600w.png",
            "email": "hello@netquor.com",
            "telephone": [...TELEPHONES],
            "sameAs": sameAs()
        },
        {
            "@type": [
                "ProfessionalService",
                "LocalBusiness"
            ],
            "@id": "https://www.netquor.com/#local",
            "name": "Netquor Technologies",
            "url": "https://www.netquor.com/",
            "image": "https://www.netquor.com/brand/nq-logo-primary-plate-600w.png",
            "logo": "https://www.netquor.com/brand/nq-logo-primary-plate-600w.png",
            "email": "hello@netquor.com",
            "telephone": [...TELEPHONES],
            "priceRange": "$$",
            "description": "Managed networking, Ubiquiti UniFi and VyOS software-defined networking, hosting and virtualization, Apple device management (MDM) and field IT services for small businesses in Fargo, North Dakota, Moorhead and the Midwest.",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "Fargo",
                "addressRegion": "ND",
                "addressCountry": "US"
            },
            "areaServed": [
                {
                    "@type": "City",
                    "name": "Fargo, ND"
                },
                {
                    "@type": "City",
                    "name": "West Fargo, ND"
                },
                {
                    "@type": "City",
                    "name": "Moorhead, MN"
                },
                {
                    "@type": "State",
                    "name": "North Dakota"
                },
                {
                    "@type": "State",
                    "name": "Minnesota"
                },
                {
                    "@type": "State",
                    "name": "South Dakota"
                },
                {
                    "@type": "AdministrativeArea",
                    "name": "Midwest United States"
                }
            ],
            "knowsAbout": [
                "Mobile device management",
                "MDM",
                "Apple device management",
                "Ubiquiti UniFi",
                "VyOS",
                "software-defined networking",
                "WireGuard VPN",
                "Proxmox virtualization",
                "converged infrastructure",
                "managed hosting",
                "structured cabling",
                "virtual receptionist",
                "business phone systems"
            ],
            "parentOrganization": {
                "@id": "https://www.netquor.com/#org"
            },
            "hasOfferCatalog": {
                "@id": "https://www.netquor.com/#catalog"
            }
        },
        {
            "@type": "WebSite",
            "@id": "https://www.netquor.com/#site",
            "url": "https://www.netquor.com/",
            "name": "Netquor Technologies",
            "publisher": {
                "@id": "https://www.netquor.com/#org"
            }
        },
        {
            "@type": "Service",
            "@id": "https://www.netquor.com/#phone",
            "name": "Netquor Phone",
            "url": "https://phone.netquor.com/",
            "serviceType": "Virtual receptionist and business phone system",
            "provider": {
                "@id": "https://www.netquor.com/#org"
            },
            "description": "A business phone number that answers like a receptionist, on a full phone system. Early access, from $25 a month."
        },
        {
            "@type": "OfferCatalog",
            "@id": "https://www.netquor.com/#catalog",
            "name": "Netquor products",
            "itemListElement": [
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Netquor Phone",
                        "url": "https://phone.netquor.com/",
                        "description": "Virtual receptionist and business phone system, early access. Planned launch price; nobody is billed during early access."
                    },
                    "priceSpecification": {
                        "@type": "UnitPriceSpecification",
                        "price": "25",
                        "priceCurrency": "USD",
                        "unitCode": "MON"
                    }
                },
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Netquor Fleet",
                        "url": "https://www.netquor.com/fleet.html",
                        "description": "Apple device management. Per Mac per month; iPhone and iPad are $3.95 per device. Free 30-day trial."
                    },
                    "priceSpecification": {
                        "@type": "UnitPriceSpecification",
                        "price": "5.95",
                        "priceCurrency": "USD",
                        "unitCode": "MON"
                    }
                },
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Network Solutions",
                        "url": "https://www.netquor.com/network.html",
                        "description": "Routable IPv4 and IPv6 /56 over WireGuard on AS403008. Starting price, month to month."
                    },
                    "priceSpecification": {
                        "@type": "UnitPriceSpecification",
                        "price": "6.49",
                        "priceCurrency": "USD",
                        "unitCode": "MON"
                    }
                },
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Netquor VPN",
                        "url": "https://www.netquor.com/vpn.html",
                        "description": "Local WireGuard VPN, 25 Mbps to 1 Gbps. Starting price, month to month."
                    },
                    "priceSpecification": {
                        "@type": "UnitPriceSpecification",
                        "price": "5",
                        "priceCurrency": "USD",
                        "unitCode": "MON"
                    }
                },
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Hosted Home Assistant",
                        "url": "https://www.netquor.com/homeassistant.html",
                        "description": "Managed smart home. Starting price."
                    },
                    "priceSpecification": {
                        "@type": "UnitPriceSpecification",
                        "price": "12",
                        "priceCurrency": "USD",
                        "unitCode": "MON"
                    }
                },
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": "Digital Access",
                        "url": "https://www.netquor.com/digitalaccess.html",
                        "description": "Access control for existing door hardware. Free to start; paid plans from this price."
                    },
                    "priceSpecification": {
                        "@type": "UnitPriceSpecification",
                        "price": "9.99",
                        "priceCurrency": "USD",
                        "unitCode": "MON"
                    }
                }
            ]
        }
    ]
};

/** JSON pointer in JSON_LD to price key (the legacy data-price-map). */
export const PRICE_MAP: PriceMap = {
    "/@graph/4/itemListElement/0/priceSpecification/price": "phone.planned_launch.month",
    "/@graph/4/itemListElement/1/priceSpecification/price": "fleet.mac.month",
    "/@graph/4/itemListElement/2/priceSpecification/price": "network.from.month",
    "/@graph/4/itemListElement/3/priceSpecification/price": "vpn.from.month",
    "/@graph/4/itemListElement/4/priceSpecification/price": "homeassistant.from.month",
    "/@graph/4/itemListElement/5/priceSpecification/price": "digitalaccess.plus.month"
};

export interface WhoCard { title: string; pains: string[]; chips: { href: string; label: string }[]; cta: { href: string; label: string } }
export const WHO: WhoCard[] = [
    {
        "title": "Solo owners and small shops",
        "pains": [
            "I am the receptionist, the IT department and the bookkeeper.",
            "The phone rings while I am with a customer, and I let it go."
        ],
        "chips": [
            {
                "href": "https://phone.netquor.com/",
                "label": "Netquor Phone (early access)"
            },
            {
                "href": "/vpn.html",
                "label": "Netquor VPN"
            },
            {
                "href": "/fleet.html",
                "label": "Netquor Fleet"
            }
        ],
        "cta": {
            "href": "#calculators",
            "label": "Missed-call calculator"
        }
    },
    {
        "title": "Dental and medical offices",
        "pains": [
            "After hours the phone goes to voicemail, and patients call the next office.",
            "Front desk Macs, iPads and iPhones all need the same setup."
        ],
        "chips": [
            {
                "href": "https://phone.netquor.com/",
                "label": "Netquor Phone (early access)"
            },
            {
                "href": "/fleet.html",
                "label": "Netquor Fleet"
            },
            {
                "href": "/digitalaccess.html",
                "label": "Digital Access"
            }
        ],
        "cta": {
            "href": "#contact",
            "label": "Ask about your requirements"
        }
    },
    {
        "title": "Plumbing, HVAC and electrical",
        "pains": [
            "The phone rings under a sink, and the caller books the next company.",
            "Every new tech phone or iPad needs apps and logins before the first job."
        ],
        "chips": [
            {
                "href": "https://phone.netquor.com/",
                "label": "Netquor Phone (early access)"
            },
            {
                "href": "/fleet.html",
                "label": "Netquor Fleet"
            },
            {
                "href": "/vpn.html",
                "label": "Netquor VPN"
            }
        ],
        "cta": {
            "href": "#calculators",
            "label": "Missed-call calculator"
        }
    },
    {
        "title": "Property managers",
        "pains": [
            "Replacing door hardware across a building is slow and expensive.",
            "Visitors and deliveries turn into phone calls."
        ],
        "chips": [
            {
                "href": "/digitalaccess.html",
                "label": "Digital Access"
            },
            {
                "href": "/homeassistant.html",
                "label": "Hosted Home Assistant"
            },
            {
                "href": "https://phone.netquor.com/",
                "label": "Netquor Phone (early access)"
            }
        ],
        "cta": {
            "href": "/digitalaccess.html",
            "label": "See Digital Access"
        }
    },
    {
        "title": "Homelabbers and students",
        "pains": [
            "My ISP puts me behind CGNAT, so I cannot host anything.",
            "I forward ports and hope nothing breaks."
        ],
        "chips": [
            {
                "href": "/network.html",
                "label": "Network Solutions"
            },
            {
                "href": "/vpn.html",
                "label": "Netquor VPN"
            },
            {
                "href": "https://www.allsourcehosting.com/",
                "label": "All Source Hosting"
            }
        ],
        "cta": {
            "href": "/subnet-calculator.html",
            "label": "Free subnet calculator"
        }
    },
    {
        "title": "Growing teams and larger organizations",
        "pains": [
            "Accounts live in three places, and a leaver keeps access.",
            "Our directory, Google Workspace and sign-in drift apart."
        ],
        "chips": [
            {
                "href": "/central.html",
                "label": "Netquor Central (in development)"
            },
            {
                "href": "/sdn.html",
                "label": "Netquor SDN (quoted)"
            },
            {
                "href": "/fleet.html",
                "label": "Netquor Fleet"
            }
        ],
        "cta": {
            "href": "/central.html",
            "label": "Ask about Netquor Central"
        }
    }
];

export interface AppCard {
    icon: { bi: string } | { img: string };
    status: string; statusLabel: string; name: string; fix: string; text: string; feats: string[];
    /** HTML with {{price.key}} tokens. */
    meta: string;
    links: { href: string; cls: "primary" | "secondary"; label: string; external?: boolean }[];
}
export interface AppGroup { title: string; cols: string; apps: AppCard[] }
export const APP_GROUPS: AppGroup[] = [
    {
        "title": "Business",
        "cols": "n4",
        "apps": [
            {
                "icon": {
                    "bi": "telephone"
                },
                "status": "early-access",
                "statusLabel": "Early access",
                "name": "Netquor Phone",
                "fix": "Missed calls while you are on a job",
                "text": "A virtual receptionist and business phone system. Answers calls, takes messages and tells you what each caller needed.",
                "feats": [
                    "Answers calls and takes messages",
                    "Tells you what each caller needed",
                    "Extensions and desk phones on a full phone system"
                ],
                "meta": "Planned launch price from {{phone.planned_launch.month}}/mo. Early access, not billed yet",
                "links": [
                    {
                        "href": "https://phone.netquor.com/start/",
                        "cls": "primary",
                        "label": "Join early access"
                    },
                    {
                        "href": "https://phone.netquor.com/",
                        "cls": "secondary",
                        "label": "Learn more"
                    }
                ]
            },
            {
                "icon": {
                    "bi": "apple"
                },
                "status": "available",
                "statusLabel": "Available",
                "name": "Netquor Fleet",
                "fix": "Setting up every new device by hand",
                "text": "Apple device management for Mac, iPhone and iPad, with a self-service app catalog, WireGuard deployment and a full API.",
                "feats": [
                    "Enroll Macs, iPhones and iPads and see everything",
                    "Self-service app library and polite patching",
                    "App blocking, scripts and a full API"
                ],
                "meta": "{{fleet.mac.month}}/Mac, {{fleet.mobile.month}}/iPhone or iPad per month. Free 30-day trial",
                "links": [
                    {
                        "href": "/fleet.html",
                        "cls": "primary",
                        "label": "Features and pricing"
                    },
                    {
                        "href": "https://fleet.netquor.com/",
                        "cls": "secondary",
                        "label": "Open app"
                    }
                ]
            },
            {
                "icon": {
                    "bi": "diagram-3"
                },
                "status": "in-development",
                "statusLabel": "In development",
                "name": "Netquor SDN",
                "fix": "A network nobody can see or manage",
                "text": "Managed networking, hosting and virtualization on Ubiquiti UniFi and VyOS, with centralized monitoring and automation.",
                "feats": [
                    "Ubiquiti UniFi automation",
                    "VyOS routing and firewall, WireGuard VPN and mesh",
                    "Hosting and virtualization with an API"
                ],
                "meta": "Quoted per site",
                "links": [
                    {
                        "href": "/sdn.html",
                        "cls": "primary",
                        "label": "Overview"
                    },
                    {
                        "href": "https://sdn.netquor.com/",
                        "cls": "secondary",
                        "label": "Open app"
                    }
                ]
            },
            {
                "icon": {
                    "bi": "people"
                },
                "status": "in-development",
                "statusLabel": "In development",
                "name": "Netquor Central",
                "fix": "Updating the same person in three places",
                "text": "Run people, groups, Gmail filters, email signatures and sign-in for a Google Workspace team from one dashboard. Used at Netquor.",
                "feats": [
                    "People, groups and Google Workspace users",
                    "Gmail filters, labels and signatures",
                    "Policies for people who join, move or leave"
                ],
                "meta": "In development. Talk to us",
                "links": [
                    {
                        "href": "/central.html",
                        "cls": "primary",
                        "label": "See Netquor Central"
                    }
                ]
            }
        ]
    },
    {
        "title": "Network and hosting",
        "cols": "n3",
        "apps": [
            {
                "icon": {
                    "bi": "broadcast-pin"
                },
                "status": "available",
                "statusLabel": "Available",
                "name": "Network Solutions",
                "fix": "No public address behind CGNAT",
                "text": "Routable IPv4 and IPv6 addresses over WireGuard from our own network, AS403008, with seven locations.",
                "feats": [
                    "A routable IPv4 and an IPv6 /56",
                    "Anycast and BGP on Startup and Business plans",
                    "Seven locations, delivered over WireGuard"
                ],
                "meta": "From {{network.from.month}}/mo, month to month",
                "links": [
                    {
                        "href": "/network.html#pricing",
                        "cls": "primary",
                        "label": "Pricing and plans"
                    }
                ]
            },
            {
                "icon": {
                    "bi": "shield-check"
                },
                "status": "available",
                "statusLabel": "Available",
                "name": "Netquor VPN",
                "fix": "A VPN with no local support",
                "text": "A local WireGuard VPN with plans from 25 Mbps to 1 Gbps.",
                "feats": [
                    "Plans from 25 Mbps to 1 Gbps",
                    "Runs on our own network",
                    "Month to month, cancel by email"
                ],
                "meta": "{{vpn.from.month}} to {{vpn.to.month}}/mo, month to month",
                "links": [
                    {
                        "href": "/vpn.html",
                        "cls": "primary",
                        "label": "Choose a speed"
                    }
                ]
            },
            {
                "icon": {
                    "img": "/allsource-icon.svg"
                },
                "status": "marketplace",
                "statusLabel": "Marketplace",
                "name": "All Source Hosting",
                "fix": "A lab with nowhere to run workloads or share capacity",
                "text": "A homelab hosting marketplace: rent a virtual machine or sell capacity from your lab.",
                "feats": [
                    "Rent a virtual machine",
                    "Sell capacity from your own lab"
                ],
                "meta": "Priced by hosts",
                "links": [
                    {
                        "href": "https://www.allsourcehosting.com/",
                        "cls": "primary",
                        "label": "Visit All Source Hosting",
                        "external": true
                    }
                ]
            }
        ]
    },
    {
        "title": "Home and building",
        "cols": "n2",
        "apps": [
            {
                "icon": {
                    "bi": "house-gear"
                },
                "status": "available",
                "statusLabel": "Available",
                "name": "Hosted Home Assistant",
                "fix": "A smart home only one person can maintain",
                "text": "A managed smart home that stays up to date and is reachable anywhere. A bridge device is included.",
                "feats": [
                    "Runs in the cloud, kept updated and backed up",
                    "A bridge device included",
                    "Open it from anywhere"
                ],
                "meta": "From {{homeassistant.from.month}}/mo, cancel any time",
                "links": [
                    {
                        "href": "/homeassistant.html",
                        "cls": "primary",
                        "label": "See plans"
                    }
                ]
            },
            {
                "icon": {
                    "bi": "door-open"
                },
                "status": "in-deployment",
                "statusLabel": "In deployment",
                "name": "Digital Access",
                "fix": "Replacing door hardware just to modernize access",
                "text": "Access control that keeps many existing call boxes and systems, with mobile entry, guest access and smart lock integrations.",
                "feats": [
                    "Works with many existing call boxes and systems",
                    "Mobile entry and guest access",
                    "Smart integrations, including Home Assistant"
                ],
                "meta": "Free to start, paid from {{digitalaccess.plus.month}}/mo",
                "links": [
                    {
                        "href": "/digitalaccess.html",
                        "cls": "primary",
                        "label": "Learn more"
                    },
                    {
                        "href": "https://da.netquor.com/",
                        "cls": "secondary",
                        "label": "Open app"
                    }
                ]
            }
        ]
    }
];

export interface PriceRow { href: string; name: string; small?: string; what: string; /** HTML with {{price.key}} tokens. */ price: string; terms: string }
export const PRICE_ROWS: PriceRow[] = [
    {
        "href": "https://phone.netquor.com/",
        "name": "Netquor Phone",
        "what": "A virtual receptionist and business phone system",
        "price": "From {{phone.planned_launch.month}}<i>/mo</i>",
        "terms": "Planned launch price. Nobody is billed during early access, and the first 100 founding partners keep the price for 24 months",
        "small": "Early access"
    },
    {
        "href": "/fleet.html",
        "name": "Netquor Fleet",
        "what": "Apple device management for Mac, iPhone and iPad",
        "price": "{{fleet.mac.month}}<i>/Mac/mo</i><br>{{fleet.mobile.month}}<i>/iPhone or iPad/mo</i>",
        "terms": "Free 30-day trial, no minimum seats"
    },
    {
        "href": "/network.html#pricing",
        "name": "Network Solutions",
        "what": "A routable IPv4 address and an IPv6 /56 over WireGuard, from our own network",
        "price": "From {{network.from.month}}<i>/mo</i>",
        "terms": "Month to month, no setup fee. Half price for students"
    },
    {
        "href": "/vpn.html",
        "name": "Netquor VPN",
        "what": "A local WireGuard VPN, 25 Mbps to 1 Gbps",
        "price": "{{vpn.from.month}} to {{vpn.to.month}}<i>/mo</i>",
        "terms": "Month to month, cancel by email"
    },
    {
        "href": "/homeassistant.html",
        "name": "Hosted Home Assistant",
        "what": "Managed smart home, reachable anywhere",
        "price": "From {{homeassistant.from.month}}<i>/mo</i>",
        "terms": "Cancel any time"
    },
    {
        "href": "/digitalaccess.html",
        "name": "Digital Access",
        "what": "Access control that keeps your existing door hardware",
        "price": "Free to start<br><i>paid from {{digitalaccess.plus.month}}/mo</i>",
        "terms": "Plans by property count and tenants"
    },
    {
        "href": "/central.html",
        "name": "Netquor Central",
        "what": "People, groups, Gmail filters, signatures and sign-in for Google Workspace teams",
        "price": "Not priced yet",
        "terms": "Tell us about your Workspace and we reply on fit",
        "small": "In development"
    },
    {
        "href": "/sdn.html",
        "name": "Netquor SDN",
        "what": "Managed networking, hosting and virtualization for a site",
        "price": "Quoted",
        "terms": "Tell us what you run and we reply with a price"
    }
];

export interface ReadyCard { href: string; icon: string; title: string; text: string; go: string }
export const READY: ReadyCard[] = [
    {
        "href": "/readiness.html#devices",
        "icon": "laptop",
        "title": "Apple device readiness",
        "text": "For teams with Macs, iPhones and iPads",
        "go": "Seven questions, two minutes"
    },
    {
        "href": "/readiness.html#calls",
        "icon": "telephone",
        "title": "Call handling readiness",
        "text": "For owners who miss calls while working",
        "go": "Seven questions, two minutes"
    },
    {
        "href": "/readiness.html#network",
        "icon": "diagram-3",
        "title": "Network and remote access readiness",
        "text": "For offices, labs and anyone hosting from home",
        "go": "Seven questions, two minutes"
    },
    {
        "href": "/readiness.html#people",
        "icon": "people",
        "title": "People and access readiness",
        "text": "For teams on Google Workspace, and for buildings",
        "go": "Seven questions, two minutes"
    }
];
export const COMPARE: ReadyCard[] = [
    {
        "href": "/compare.html#apple",
        "icon": "laptop",
        "title": "Apple device management",
        "text": "Fleet against Jamf, Mosyle, Addigy, FleetDM and Iru. Mosyle lists lower prices; we have no minimum.",
        "go": "See the table and sources"
    },
    {
        "href": "/compare.html#identity",
        "icon": "people",
        "title": "Directory, single sign-on and signatures",
        "text": "Netquor Central against JumpCloud, Okta, Google Cloud Identity and signature tools.",
        "go": "See the table and sources"
    },
    {
        "href": "/compare.html#phone",
        "icon": "telephone",
        "title": "Phone and receptionist",
        "text": "Netquor Phone against Ruby, Smith.ai, Rosie and per-user phone systems.",
        "go": "See the table and sources"
    },
    {
        "href": "/compare.html#vpn",
        "icon": "shield-check",
        "title": "Remote access and VPN",
        "text": "Netquor VPN against NordLayer, Twingate, Cloudflare, Tailscale, Mullvad and Proton.",
        "go": "See the table and sources"
    },
    {
        "href": "/compare.html#ip",
        "icon": "broadcast-pin",
        "title": "Routable IP addresses",
        "text": "Network Solutions against cloud IPs from AWS, Hetzner, Vultr and DigitalOcean.",
        "go": "See the table and sources"
    },
    {
        "href": "/compare.html#home",
        "icon": "house-gear",
        "title": "Smart home and building access",
        "text": "Hosted Home Assistant and Digital Access against Nabu Casa, ButterflyMX, Brivo and others.",
        "go": "See the table and sources"
    }
];

export interface ServiceCard { icon: string; title: string; text: string; items: string[] }
export const SERVICES: ServiceCard[] = [
    {
        "icon": "code-square",
        "title": "Software engineering",
        "text": "Custom web applications, EJS-driven template engines, and scalable backend architectures tailored to your workflow.",
        "items": [
            "Full-stack development",
            "API design and integration"
        ]
    },
    {
        "icon": "cpu",
        "title": "Hardware and repair",
        "text": "Precision diagnostics and repair for essential hardware. We keep your local device ecosystem running at peak performance.",
        "items": [
            "Component-level repair",
            "Hardware optimization"
        ]
    },
    {
        "icon": "person-gear",
        "title": "Field consulting",
        "text": "Hands-on technical implementation and field infrastructure. We bridge the gap between high-level theory and real-world deployment.",
        "items": [
            "Infrastructure deployment",
            "Systems integration"
        ]
    },
    {
        "icon": "router",
        "title": "Network infrastructure",
        "text": "Professional low-voltage wiring, rack management, and Ubiquiti-based network deployments for residential and commercial spaces.",
        "items": [
            "Structured cabling and cleanup",
            "Wi-Fi 6/7 mesh optimization"
        ]
    },
    {
        "icon": "server",
        "title": "Hosting and virtualization",
        "text": "Self-hosting solutions designed for privacy and control. We specialize in state of the art virtual machine clusters and secure software-defined networking.",
        "items": [
            "Virtual machines and service orchestration",
            "Secure remote access (VPN/SDN)"
        ]
    },
    {
        "icon": "gear-wide-connected",
        "title": "Field operations",
        "text": "Specialized on-site technical deployment and hardware integration. We bridge the gap between digital design and physical installation.",
        "items": [
            "Device commissioning and setup",
            "Infrastructure troubleshooting"
        ]
    }
];

/** a is trusted HTML. */
export const FAQ: { q: string; a: string }[] = [
    {
        "q": "Where do you work?",
        "a": "Netquor is based in Fargo, North Dakota. On-site installation and repair covers Fargo-Moorhead and the Midwest. Hosted services such as Netquor Fleet and Network Solutions are delivered over the internet."
    },
    {
        "q": "Do I need a contract?",
        "a": "Network Solutions and Netquor VPN are month to month, and Hosted Home Assistant can be cancelled any time. Netquor Fleet starts with a free 30-day trial and has no minimum number of devices."
    },
    {
        "q": "Is Netquor Phone available today?",
        "a": "It is in early access. You can join as a founding partner at phone.netquor.com. Billing is not built yet, so nobody is charged during early access, and the first 100 accounts keep the launch price for 24 months. The sample calls on that site are scripted, and the product has no customer case studies yet."
    },
    {
        "q": "Do you offer student pricing?",
        "a": "Yes. The Network Solutions Homelab plan is half price for students and learners."
    },
    {
        "q": "How do I get a quote for managed networking?",
        "a": `Email <a href="mailto:${EMAIL}">${EMAIL}</a> or call <a href="${MAIN.href}">${MAIN.display}</a>. Netquor SDN is quoted per site, so tell us what you run today.`
    }
];
