<script lang="ts">
    // /fleet.html: Netquor Fleet, which has its own design (fleet/site.css) and no site footer. The page keeps the site nav bar above its own header, as the legacy page does. The sections live in src/lib/pages/fleet; every price comes from the price snapshot.
    // fleet/site.js (a module: the cost calculator and the free-trial form) finds the page by id and fills in what the server leaves empty, so it is loaded after hydration. It imports fleet/pricing.js itself.
    import { onMount } from "svelte";
    import Nav from "#lib/components/Nav.svelte";
    import Seo from "#lib/components/Seo.svelte";
    import { assetUrl } from "#lib/assets.ts";
    import Api from "#lib/pages/fleet/Api.svelte";
    import Buffet from "#lib/pages/fleet/Buffet.svelte";
    import Dedicated from "#lib/pages/fleet/Dedicated.svelte";
    import Demo from "#lib/pages/fleet/Demo.svelte";
    import Facts from "#lib/pages/fleet/Facts.svelte";
    import Faq from "#lib/pages/fleet/Faq.svelte";
    import Features from "#lib/pages/fleet/Features.svelte";
    import Foot from "#lib/pages/fleet/Foot.svelte";
    import Header from "#lib/pages/fleet/Header.svelte";
    import Hero from "#lib/pages/fleet/Hero.svelte";
    import Mdm from "#lib/pages/fleet/Mdm.svelte";
    import Pricing from "#lib/pages/fleet/Pricing.svelte";
    import Roadmap from "#lib/pages/fleet/Roadmap.svelte";
    import Santa from "#lib/pages/fleet/Santa.svelte";
    import { description, jsonLd, KEYWORDS, OG_IMAGE, PRICE_MAP, TITLE } from "#lib/pages/fleet/seo.ts";
    import Showcase from "#lib/pages/fleet/Showcase.svelte";
    import Sprite from "#lib/pages/fleet/Sprite.svelte";
    import Steps from "#lib/pages/fleet/Steps.svelte";
    import Vendors from "#lib/pages/fleet/Vendors.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    const desc = $derived(description(data.prices, data.priceVersion));
    const ld = $derived(jsonLd(data.prices, data.priceVersion));

    onMount(() => { void import(/* @vite-ignore */ assetUrl(data.assets, "fleetJs")); });
</script>

<Seo
    origin={data.origin}
    canonical="/fleet.html"
    title={TITLE}
    description={desc}
    keywords={KEYWORDS}
    author="Netquor Technologies LLC"
    geo={{ region: "US-ND", placename: "Fargo, North Dakota" }}
    siteName="Netquor Technologies"
    locale="en_US"
    twitter
    ogImage={OG_IMAGE}
    jsonLd={ld}
    priceMap={PRICE_MAP}
/>

<svelte:head>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
</svelte:head>

<Sprite />
<Nav current="/fleet.html" static />
<Header />

<main>
    <Hero />
    <Facts />
    <Features />
    <Buffet />
    <Showcase />
    <Vendors />
    <Santa />
    <Steps />
    <Pricing />
    <Dedicated />
    <Api />
    <Roadmap />
    <Mdm />
    <Faq />
    <Demo />
</main>

<Foot />
