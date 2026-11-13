<script lang="ts">
    import "#lib/pages/central/page.css";
    import Nudge from "#lib/behaviors/nudge/Nudge.svelte";
    // Netquor Central (in development, no price). Same markup, head and text as the legacy central.html.
    import Faq from "#lib/components/Faq.svelte";
    import Seo from "#lib/components/Seo.svelte";
    import Capabilities from "#lib/pages/central/Capabilities.svelte";
    import Contact from "#lib/pages/central/Contact.svelte";
    import { DESCRIPTION, FAQ_ITEMS, OG_DESCRIPTION, TITLE } from "#lib/pages/central/data.ts";
    import FitMap from "#lib/pages/central/FitMap.svelte";
    import Hero from "#lib/pages/central/Hero.svelte";
    import Safe from "#lib/pages/central/Safe.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
</script>

<Seo origin={data.origin} canonical="/central.html" title={TITLE} description={DESCRIPTION} ogDescription={OG_DESCRIPTION} />

<Nudge page="central.html" />

<Hero />

<div class="nq-rule" role="presentation"></div>

<Capabilities />

<div class="nq-rule" role="presentation"></div>

<FitMap />

<Safe />

<section class="nq-section" id="faq">
    <div class="container" style="max-width: 900px;">
        <div class="nq-section-head"><p class="nq-eyebrow">Questions</p><h2>Common questions</h2></div>
        <Faq items={FAQ_ITEMS} />
    </div>
</section>

<Contact />
