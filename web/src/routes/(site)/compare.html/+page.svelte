<script lang="ts">
    // /compare.html: Netquor prices next to other vendors', each with a source and the date it was checked. Same URL, head and text as the legacy page; Netquor's own prices render from the price cache.
    import { onMount } from "svelte";
    import { assetUrl } from "#lib/assets.ts";
    import Seo from "#lib/components/Seo.svelte";
    import { loadScript } from "#lib/loadScript.ts";
    import CompareTables from "#lib/pages/compare/CompareTables.svelte";
    import { CHECKED, TABS } from "#lib/pages/compare/data.ts";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    const description = `Netquor prices next to Jamf, Mosyle, Addigy, JumpCloud, Okta, Tailscale, Twingate, Nabu Casa, ButterflyMX and others, checked ${CHECKED} against each company's own pricing page.`;

    // fx.js adds the reveal classes to what it finds, so it runs after hydration.
    onMount(() => { void loadScript(assetUrl(data.assets, "fx")); });
</script>

<Seo
    origin={data.origin}
    canonical="/compare.html"
    title="How Netquor compares: prices side by side, with sources | Netquor"
    {description}
/>

<header class="hero-section" style="padding-bottom: 24px;">
    <div class="container" style="max-width: 1000px;">
        <p class="nq-eyebrow">How we compare</p>
        <h1 class="mb-3">Side by side, with sources</h1>
        <p class="lead text-muted mb-4">Six categories, real prices from each company's own page, and an honest note under each table about who each option suits. Netquor's rows are highlighted.</p>
        <nav class="nq-check-tabs" aria-label="Categories">{#each TABS as t (t.href)}<a href={t.href}>{t.label}</a>{/each}</nav>
    </div>
</header>
<section class="nq-section" style="padding-top: 24px;">
    <div class="container" style="max-width: 1000px;">
        <div class="nq-section-head">
            <p class="text-muted">Checked on {CHECKED} against each company's own pricing or documentation page, except rows marked third-party. One cloud IP page was last changed in April 2023. Prices in pounds or euros are converted to US dollars at the European Central Bank reference rates for {CHECKED} (1 pound is $1.3423, 1 euro is $1.1214) and rounded. Prices change, so verify with the vendor. Different products do different jobs, so read the note under each table. Not listed does not mean not available.</p>
        </div>
        <CompareTables />
    </div>
</section>
