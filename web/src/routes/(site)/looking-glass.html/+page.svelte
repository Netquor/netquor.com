<script lang="ts">
    // /looking-glass.html: the public looking glass for Netquor's network (AS403008). The widget is a custom element served by our own SDN dashboard (sdn.netquor.com/looking-glass.js); it loads after the page and talks to that dashboard's public, read-only API, which allows cross-origin reads. The server renders everything around it, so the page has its text with no script.
    import Fx from "#lib/behaviors/fx/Fx.svelte";
    import Seo from "#lib/components/Seo.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    const title = "Looking glass for AS403008: BGP, route, ping and traceroute | Netquor";
    const description = "Run read-only BGP route, route lookup, ping and traceroute queries from Netquor's routers on AS403008, live, with no sign-in.";
    const jsonLd = {
        "@context": "https://schema.org", "@type": "WebApplication", name: "Netquor Looking Glass",
        url: "https://www.netquor.com/looking-glass.html", applicationCategory: "UtilitiesApplication", operatingSystem: "Any (runs in the browser)",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": "https://www.netquor.com/#org" },
        description,
    };
</script>

<svelte:head>
    <script src="https://sdn.netquor.com/looking-glass.js" defer></script>
</svelte:head>

<Seo origin={data.origin} canonical="/looking-glass.html" {title} {description} {jsonLd} />
<Fx />

<header class="hero-section" style="padding-bottom: 32px;">
    <div class="container" style="max-width: 900px;">
        <p class="nq-eyebrow">Network tools &middot; AS403008</p>
        <h1 class="mb-3">Netquor looking glass</h1>
        <p class="lead text-muted mb-0" style="max-width: 720px;">See how our network sees the internet. Pick a router, then look up a BGP route, a route, a ping or a traceroute, live from Netquor's routers. It is read-only and needs no account.</p>
    </div>
</header>

<section class="nq-section" style="padding-top: 8px;">
    <div class="container" style="max-width: 900px;">
        <netquor-looking-glass></netquor-looking-glass>
        <noscript><p class="text-muted small mt-3">The looking glass needs JavaScript. You can also ask us to run a query: <a href="mailto:hello@netquor.com?subject=Looking%20glass%20query">hello@netquor.com</a>.</p></noscript>
    </div>
</section>

<section class="nq-section" style="padding-top: 0;">
    <div class="container" style="max-width: 900px;">
        <div class="nq-safe">
            <div><b>BGP route</b><p>Shows the route a router holds for a prefix or an address, including the path it learned.</p></div>
            <div><b>Route lookup</b><p>Shows which next hop a router would use to reach an address.</p></div>
            <div><b>Ping and traceroute</b><p>Measure reachability and the path from the router you choose to a public address. Use a public IPv4 or IPv6 address.</p></div>
            <div><b>BGP summary</b><p>Lists the router's BGP sessions and their state, with no input needed.</p></div>
        </div>
        <p class="text-muted small mt-3 mb-0">This runs from our routers and only reads state. It is for diagnosing connectivity and routing. Customers of <a href="/network.html">Network Solutions</a> can use it to confirm their prefix is announced. Questions? <a href="mailto:hello@netquor.com">hello@netquor.com</a>.</p>
    </div>
</section>
