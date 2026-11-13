<script lang="ts">
    // /fleet.html: Netquor Fleet, which has its own design (src/lib/styles/fleet) and no site footer. The page keeps the site nav bar above its own header, as the legacy page does. The sections live in src/lib/pages/fleet; every price comes from the price snapshot.
    // The cost calculator and the free-trial form are the shared model in src/lib/behaviors/fleet (a port of fleet/site.js and fleet/pricing.js, which this page no longer loads). It starts after hydration and takes its prices from the live price snapshot.
    import { onMount, untrack } from "svelte";
    import { provideFleetModel } from "#lib/behaviors/fleet/context.ts";
    import { createFleetModel } from "#lib/behaviors/fleet/model.ts";
    import { fleetPricesFrom } from "#lib/behaviors/fleet/prices.ts";
    import Nav from "#lib/components/Nav.svelte";
    import Seo from "#lib/components/Seo.svelte";
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

    const model = provideFleetModel(createFleetModel({ prices: fleetPricesFrom(untrack(() => data.prices)) }));
    $effect(() => model.setPrices(fleetPricesFrom(data.prices)));
    onMount(() => model.mount());
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
