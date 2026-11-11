<script lang="ts">
    // The home page (/), migrated from index.html: the same words, links, ids and head metadata. The sections live in src/lib/pages/index/. Prices come from the price cache (Price, Rich, and the JSON-LD price map); the pure scripts cost-calc.js and bundle-calc.js are loaded unchanged and used by two islands (Calculators, Bundles); fx.js (reveal animations, progress bar, map pulses) and bg.js (hero background and its pause control) change nodes Svelte owns, so they load after hydration.
    import { onMount } from "svelte";
    import Seo from "#lib/components/Seo.svelte";
    import { assetUrl } from "#lib/assets.ts";
    import { loadScript } from "#lib/loadScript.ts";
    import Apps from "#lib/pages/index/Apps.svelte";
    import Bundles from "#lib/pages/index/Bundles.svelte";
    import Calculators from "#lib/pages/index/Calculators.svelte";
    import Compare from "#lib/pages/index/Compare.svelte";
    import Contact from "#lib/pages/index/Contact.svelte";
    import { JSON_LD, PRICE_MAP, SEO } from "#lib/pages/index/data.ts";
    import Facts from "#lib/pages/index/Facts.svelte";
    import FaqSection from "#lib/pages/index/FaqSection.svelte";
    import Hero from "#lib/pages/index/Hero.svelte";
    import Homelab from "#lib/pages/index/Homelab.svelte";
    import Local from "#lib/pages/index/Local.svelte";
    import { PAGE_CSS } from "#lib/pages/index/pageCss.ts";
    import Phone from "#lib/pages/index/Phone.svelte";
    import Pricing from "#lib/pages/index/Pricing.svelte";
    import Readiness from "#lib/pages/index/Readiness.svelte";
    import Services from "#lib/pages/index/Services.svelte";
    import Who from "#lib/pages/index/Who.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    // Legacy order: bg.js (deferred) ran after fx.js had run at the end of the body, so fx first.
    onMount(() => {
        void loadScript(assetUrl(data.assets, "fx")).then(() => loadScript(assetUrl(data.assets, "bg"))).catch(() => {});
    });
</script>

<Seo
    origin={data.origin}
    canonical="/"
    title={SEO.title}
    description={SEO.description}
    keywords={SEO.keywords}
    author={SEO.author}
    geo={{ region: "US-ND", placename: "Fargo, North Dakota" }}
    siteName="Netquor Technologies"
    locale="en_US"
    twitter={{ site: "@netquor" }}
    jsonLd={JSON_LD}
    priceMap={PRICE_MAP}
/>
<svelte:head>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/devices.css@0.2.0/dist/devices.min.css">
    {@html `<style>${PAGE_CSS}</style>`}
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" defer></script>
    <script src={assetUrl(data.assets, "costCalc")}></script>
    <script src={assetUrl(data.assets, "bundleCalc")}></script>
</svelte:head>

<Hero />
<Facts />
<Who />
<div class="nq-rule" role="presentation"></div>

<Apps />
<div class="nq-rule" role="presentation"></div>

<Calculators />

<div class="nq-rule" role="presentation"></div>

<Readiness />
<div class="nq-rule" role="presentation"></div>

<Phone />
<div class="nq-rule" role="presentation"></div>

<Homelab />
<div class="nq-rule" role="presentation"></div>

<Services />
<div class="nq-rule" role="presentation"></div>

<Pricing />
<div class="nq-rule" role="presentation"></div>

<Bundles />
<div class="nq-rule" role="presentation"></div>

<Compare />
<div class="nq-rule" role="presentation"></div>

<Local />
<div class="nq-rule" role="presentation"></div>

<FaqSection />
<div class="nq-rule" role="presentation"></div>

<Contact />
