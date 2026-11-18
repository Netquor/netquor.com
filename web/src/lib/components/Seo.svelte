<script lang="ts">
    // Page metadata: title, description, canonical, Open Graph, Twitter card, the rest of the legacy head (keywords, author, geo) and JSON-LD. The origin is the canonical host from the server's settings. Everything beyond title, canonical and origin is optional, so a page can match its legacy head exactly (terms.html has no description, for one).
    // jsonLd + priceMap: the legacy data-price-map mechanism. Pass the JSON-LD as it was written and a map of JSON pointer to price key; the values are filled from the price cache for this request (see src/lib/jsonld.ts).
    import { page } from "$app/state";
    import { withPrices, type PriceMap } from "../jsonld";

    let { title, description, canonical, ogTitle, ogDescription, ogImage = "/brand/og.png", og = true, jsonLd, priceMap, origin, robots = "index, follow, max-image-preview:large, max-snippet:-1", keywords, author, geo, siteName, locale, twitter }: {
        title: string; description?: string; canonical?: string;
        ogTitle?: string; ogDescription?: string;
        /** A path on this site ("/brand/og.png"), an absolute URL, or null for no og:image. */
        ogImage?: string | null;
        /** false for a page with no Open Graph tags at all. */
        og?: boolean;
        jsonLd?: unknown; priceMap?: PriceMap; origin: string;
        /** null for no robots tag. */
        robots?: string | null;
        keywords?: string; author?: string;
        geo?: { region: string; placename: string };
        /** og:site_name and og:locale. */
        siteName?: string; locale?: string;
        /** true or an object adds the Twitter card tags (card defaults to summary_large_image; title, description and image repeat the Open Graph values). */
        twitter?: boolean | { card?: string; site?: string };
    } = $props();

    // JSON inside a <script> must not be able to close it.
    const ld = $derived(jsonLd === undefined ? "" : JSON.stringify(priceMap ? withPrices(jsonLd, priceMap, page.data.prices, page.data.priceVersion ?? 0, typeof window === "undefined" ? undefined : () => {}) : jsonLd).replace(/</g, "\\u003c"));
    const url = $derived(canonical === undefined ? "" : `${origin}${canonical}`);
    const image = $derived(ogImage === null ? "" : ogImage.startsWith("/") ? `${origin}${ogImage}` : ogImage);
    const tw = $derived(twitter ? (twitter === true ? {} : twitter) : null);
</script>

<svelte:head>
    <title>{title}</title>
    {#if description !== undefined}<meta name="description" content={description}>{/if}
    {#if keywords}<meta name="keywords" content={keywords}>{/if}
    {#if robots}<meta name="robots" content={robots}>{/if}
    {#if author}<meta name="author" content={author}>{/if}
    {#if geo}<meta name="geo.region" content={geo.region}><meta name="geo.placename" content={geo.placename}>{/if}
    {#if url}<link rel="canonical" href={url}>{/if}
    {#if og}
        {#if siteName}<meta property="og:site_name" content={siteName}>{/if}
        <meta property="og:type" content="website">
        {#if locale}<meta property="og:locale" content={locale}>{/if}
        {#if url}<meta property="og:url" content={url}>{/if}
        <meta property="og:title" content={ogTitle ?? title}>
        {#if ogDescription !== undefined || description !== undefined}<meta property="og:description" content={ogDescription ?? description}>{/if}
        {#if image}<meta property="og:image" content={image}>{/if}
    {/if}
    {#if tw}
        {#if tw.site}<meta name="twitter:site" content={tw.site}>{/if}
        <meta name="twitter:card" content={tw.card ?? "summary_large_image"}>
        <meta name="twitter:title" content={ogTitle ?? title}>
        {#if ogDescription !== undefined || description !== undefined}<meta name="twitter:description" content={ogDescription ?? description}>{/if}
        {#if image}<meta name="twitter:image" content={image}>{/if}
    {/if}
    {#if ld}{@html `<script type="application/ld+json">${ld}</script>`}{/if}
</svelte:head>
