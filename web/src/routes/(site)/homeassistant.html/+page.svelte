<script lang="ts">
    import "#lib/pages/homeassistant/page.css";
    import Nudge from "#lib/behaviors/nudge/Nudge.svelte";
    // Hosted Home Assistant. Same markup, head and text as the legacy homeassistant.html; every price comes from the price cache.
    import Seo from "#lib/components/Seo.svelte";
    import { priceText } from "#lib/priceFallbacks.ts";
    import Contact from "#lib/pages/homeassistant/Contact.svelte";
    import { description, JSON_LD, KEYWORDS, OG_TITLE, ogDescription, PRICE_MAP, TITLE } from "#lib/pages/homeassistant/data.ts";
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

<Nudge page="homeassistant.html" />

<Hero />

<main>
    <Steps />
    <Plans />
    <Why />
    <Questions />
    <Contact />
</main>

<PageFooter />
