<script lang="ts">
    // Hosted Home Assistant. Same markup, head and text as the legacy homeassistant.html; every price comes from the price cache.
    import { assetUrl } from "#lib/assets.ts";
    import Seo from "#lib/components/Seo.svelte";
    import { priceText } from "#lib/priceFallbacks.ts";
    import Contact from "#lib/pages/homeassistant/Contact.svelte";
    import { description, JSON_LD, KEYWORDS, OG_TITLE, ogDescription, PAGE_CSS, PRICE_MAP, TITLE } from "#lib/pages/homeassistant/data.ts";
    import Hero from "#lib/pages/homeassistant/Hero.svelte";
    import PageFooter from "#lib/pages/homeassistant/PageFooter.svelte";
    import Plans from "#lib/pages/homeassistant/Plans.svelte";
    import Questions from "#lib/pages/homeassistant/Questions.svelte";
    import Steps from "#lib/pages/homeassistant/Steps.svelte";
    import Why from "#lib/pages/homeassistant/Why.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    const from = $derived(priceText(data.prices, "homeassistant.from.month", "usd0", undefined, data.priceVersion));
</script>

<Seo
    origin={data.origin} canonical="/homeassistant.html" title={TITLE} description={description(from)} keywords={KEYWORDS}
    author="Netquor Technologies LLC" siteName="Netquor Technologies" locale="en_US" twitter
    ogTitle={OG_TITLE} ogDescription={ogDescription(from)} jsonLd={JSON_LD} priceMap={PRICE_MAP}
/>
<svelte:head>
    {@html `<style>${PAGE_CSS}</style>`}
    <!-- The legacy head has this page's own rules before nq.css, so nq.css wins where both set the same property (body colour, fonts). The shared layout loads nq.css before the page head, so it is linked again here to keep the legacy order. It is the same URL, served from cache. -->
    <link rel="stylesheet" href={assetUrl(data.assets, "nq")}>
    <script src={assetUrl(data.assets, "nudge")} defer></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" defer></script>
</svelte:head>

<Hero />

<main>
    <Steps />
    <Plans />
    <Why />
    <Questions />
    <Contact />
</main>

<PageFooter />
