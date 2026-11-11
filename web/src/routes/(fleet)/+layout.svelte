<script lang="ts">
    // The look of fleet.html, which has its own design: its own stylesheet (styles/fleet, the port of fleet/site.css), fonts (Geist, and Plex for the nav) and icon, and it does NOT use the site Footer or the Bootstrap and site styles. The site nav bar is part of the legacy fleet page (nq-static, above the Fleet header), so the page places <Nav static /> itself; nothing is drawn here around it. The calculator and the form are the shared Fleet model in src/lib/behaviors/fleet (the port of fleet/site.js and fleet/pricing.js, which the page no longer loads).
    // Bundled by Vite and served from our own origin; entry-fleet.css lists the files in the legacy order.
    import "#lib/styles/entry-fleet.css";
    import type { Snippet } from "svelte";
    import Analytics from "#lib/behaviors/analytics/Analytics.svelte";
    import Nudge from "#lib/behaviors/nudge/Nudge.svelte";

    let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
    <meta name="theme-color" content="#0B0D14">
    <link rel="icon" href="/fleet/favicon.svg" type="image/svg+xml">
</svelte:head>

<Analytics />
<Nudge page="fleet.html" />
{@render children()}
