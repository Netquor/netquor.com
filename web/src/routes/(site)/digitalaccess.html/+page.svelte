<script lang="ts">
    import "#lib/pages/digitalaccess/page.css";
    import Nudge from "#lib/behaviors/nudge/Nudge.svelte";
    // Netquor Digital Access. Same markup, head and text as the legacy digitalaccess.html; every plan price comes from the price cache.
    import Seo from "#lib/components/Seo.svelte";
    import Contact from "#lib/pages/digitalaccess/Contact.svelte";
    import { DESCRIPTION, JSON_LD, KEYWORDS, OG_DESCRIPTION, PRICE_MAP, TITLE } from "#lib/pages/digitalaccess/data.ts";
    import Features from "#lib/pages/digitalaccess/Features.svelte";
    import Hero from "#lib/pages/digitalaccess/Hero.svelte";
    import PageFooter from "#lib/pages/digitalaccess/PageFooter.svelte";
    import Pricing from "#lib/pages/digitalaccess/Pricing.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
</script>

<Seo
    origin={data.origin} canonical="/digitalaccess.html" title={TITLE} description={DESCRIPTION} keywords={KEYWORDS}
    author="Netquor Technologies LLC" siteName="Netquor Technologies" locale="en_US" twitter
    ogDescription={OG_DESCRIPTION} jsonLd={JSON_LD} priceMap={PRICE_MAP}
/>

<Nudge page="digitalaccess.html" />

<Hero />

<main>
    <Features />
    <Pricing />
    <Contact />
</main>

<PageFooter />
