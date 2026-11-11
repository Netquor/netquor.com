<script lang="ts">
    // Netquor Digital Access. Same markup, head and text as the legacy digitalaccess.html; every plan price comes from the price cache.
    import { assetUrl } from "#lib/assets.ts";
    import Seo from "#lib/components/Seo.svelte";
    import Contact from "#lib/pages/digitalaccess/Contact.svelte";
    import { DESCRIPTION, JSON_LD, KEYWORDS, OG_DESCRIPTION, PAGE_CSS, PRICE_MAP, TITLE } from "#lib/pages/digitalaccess/data.ts";
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
<svelte:head>
    {@html `<style>${PAGE_CSS}</style>`}
    <!-- The legacy head has this page's own rules before nq.css, so nq.css wins where both set the same property (body colour, fonts). The shared layout loads nq.css before the page head, so it is linked again here to keep the legacy order. It is the same URL, served from cache. -->
    <link rel="stylesheet" href={assetUrl(data.assets, "nq")}>
    <script src={assetUrl(data.assets, "nudge")} defer></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" defer></script>
</svelte:head>

<Hero />

<main>
    <Features />
    <Pricing />
    <Contact />
</main>

<PageFooter />
