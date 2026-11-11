<script lang="ts">
    // /readiness.html: four short checklists, scored in the browser by the unchanged readiness.js. Same URL, head and text as the legacy page. The page is server-rendered in full (questions, tabs, empty result boxes); readiness.js and fx.js run after hydration, in the legacy order, because they add nodes and classes to what the page renders.
    import { onMount } from "svelte";
    import { assetUrl } from "#lib/assets.ts";
    import Seo from "#lib/components/Seo.svelte";
    import { loadScript } from "#lib/loadScript.ts";
    import Checklist from "#lib/pages/readiness/Checklist.svelte";
    import { CHECKLISTS } from "#lib/pages/readiness/data.ts";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    onMount(() => {
        void loadScript(assetUrl(data.assets, "readiness"));
        void loadScript(assetUrl(data.assets, "fx"));
    });
</script>

<Seo
    origin={data.origin}
    canonical="/readiness.html"
    title="Is your business ready? Free readiness checklists | Netquor"
    description="Four short checklists for small businesses: Apple devices, call handling, network and remote access, and people and access. Answer seven questions, see what is in place and what is missing. Free, private, runs in your browser."
    ogDescription="Seven questions each for devices, calls, network and people access. See what is in place, what is missing and what helps."
/>

<header class="hero-section" style="padding-bottom: 24px;">
    <div class="container" style="max-width: 900px;">
        <p class="nq-eyebrow">Free and private</p>
        <h1 class="mb-3">Is your business ready?</h1>
        <p class="lead text-muted mb-4">Pick a checklist, answer seven yes-or-not-yet questions, and see what is already in place and what is missing. Each gap comes with a plain next step. Your answers stay in your browser.</p>
        <nav class="nq-check-tabs" aria-label="Checklists">
            {#each CHECKLISTS as c (c.key)}<a href={`#${c.key}`}><i class={`bi ${c.icon}`} aria-hidden="true"></i>{c.title}</a>{/each}
        </nav>
    </div>
</header>

<main class="container nq-checks" style="max-width: 900px; padding-bottom: 80px;">
    {#each CHECKLISTS as c (c.key)}<Checklist list={c} />{/each}
</main>
