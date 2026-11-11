// seo.ts: the head of fleet.html: title, description, keywords and the JSON-LD graph, written once. Prices in the description and the FAQ answers come from the price snapshot; the Offer prices are filled by Seo from PRICE_MAP.
import { TELEPHONES } from "../../contact";
import type { PriceEntry } from "#server/prices/types";
import { priceText } from "#lib/priceFallbacks.ts";
import { faq } from "./data";
import { plainText } from "./tokens";

type Prices = Readonly<Record<string, PriceEntry>> | undefined;

export const TITLE = "Netquor Fleet: Affordable MDM for Mac, iPhone and iPad | Free 30-Day Trial, No Minimum Seats";
export const KEYWORDS = "Santa, endpoint security for Mac, Mac application allowlisting, MDM, mobile device management, Apple MDM, Mac MDM, iPhone MDM, iPad MDM, cheap MDM, affordable MDM, free MDM trial, discounted MDM, small business MDM, MDM no minimum seats, self-service app catalog, MDM API, Mac management, Apple device management, Jamf alternative, Kandji alternative, Mosyle alternative, MDM Fargo ND, MDM Midwest";
export const OG_IMAGE = "/fleet/img/console.png";

export const description = (prices: Prices, version: number | string): string =>
    `Cheap, fully-featured mobile device management (MDM) for small business. ${priceText(prices, "fleet.mac.month", "usd0", undefined, version)} per Mac, ${priceText(prices, "fleet.mobile.month", "usd0", undefined, version)} per iPhone or iPad a month, no minimum seats, self-service app catalog, full API, free for 30 days. Fargo, ND.`;

/** Where the live prices go in the JSON-LD (JSON pointer to price key), as the legacy data-price-map did. */
export const PRICE_MAP: Record<string, string> = {
    "/@graph/2/offers/0/price": "fleet.mac.month",
    "/@graph/2/offers/0/priceSpecification/price": "fleet.mac.month",
    "/@graph/2/offers/1/price": "fleet.mobile.month",
    "/@graph/2/offers/1/priceSpecification/price": "fleet.mobile.month",
};

const STATIC_GRAPH = [
        {
            "@type": "Organization",
            "@id": "https://www.netquor.com/#org",
            "name": "Netquor Technologies LLC",
            "url": "https://www.netquor.com/",
            "logo": "https://www.netquor.com/brand/nq-logo-primary-plate-600w.png",
            "email": "hello@netquor.com",
            "telephone": [...TELEPHONES]
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
                "structured cabling"
            ],
            "parentOrganization": {
                "@id": "https://www.netquor.com/#org"
            }
        },
        {
            "@type": "SoftwareApplication",
            "@id": "https://www.netquor.com/fleet.html#app",
            "name": "Netquor Fleet",
            "alternateName": "Netquor Fleet MDM",
            "applicationCategory": "BusinessApplication",
            "applicationSubCategory": "Mobile device management (MDM)",
            "operatingSystem": "macOS, iOS, iPadOS",
            "url": "https://www.netquor.com/fleet.html",
            "image": "https://www.netquor.com/fleet/img/console.png",
            "description": "Affordable cloud MDM for Macs, iPhones and iPads with self-service app catalog, app patching, policies, scripts and a full REST API. No minimum seats, free for the first 30 days.",
            "featureList": [
                "Apple device enrollment and inventory",
                "Configuration profile builder",
                "Self-service app catalog (Buffet)",
                "App patch management",
                "Policies, scripts and packages",
                "Restricted software blocking",
                "Full REST API"
            ],
            "publisher": {
                "@id": "https://www.netquor.com/#org"
            },
            "offers": [
                {
                    "@type": "Offer",
                    "name": "Per Mac, monthly",
                    "price": "5.95",
                    "priceCurrency": "USD",
                    "url": "https://www.netquor.com/fleet.html#pricing",
                    "priceSpecification": {
                        "@type": "UnitPriceSpecification",
                        "price": "5.95",
                        "priceCurrency": "USD",
                        "unitText": "device per month",
                        "billingDuration": "P1M"
                    }
                },
                {
                    "@type": "Offer",
                    "name": "Per iPhone or iPad, monthly",
                    "price": "3.95",
                    "priceCurrency": "USD",
                    "url": "https://www.netquor.com/fleet.html#pricing",
                    "priceSpecification": {
                        "@type": "UnitPriceSpecification",
                        "price": "3.95",
                        "priceCurrency": "USD",
                        "unitText": "device per month",
                        "billingDuration": "P1M"
                    }
                },
                {
                    "@type": "Offer",
                    "name": "30-day free trial",
                    "price": "0",
                    "priceCurrency": "USD",
                    "url": "https://www.netquor.com/fleet.html#demo"
                }
            ]
        },
        {
            "@type": "BreadcrumbList",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": 1,
                    "name": "Netquor Technologies",
                    "item": "https://www.netquor.com/"
                },
                {
                    "@type": "ListItem",
                    "position": 2,
                    "name": "Netquor Fleet",
                    "item": "https://www.netquor.com/fleet.html"
                }
            ]
        }
    ];

export const jsonLd = (prices: Prices, version: number | string) => ({
    "@context": "https://schema.org",
    "@graph": [
        ...STATIC_GRAPH,
        {
            "@type": "FAQPage",
            mainEntity: faq.filter((f) => f.ld).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: plainText(f.a, prices, version) } })),
        },
    ],
});
