<script lang="ts">
    // The look of fleet.html, which has its own design: its own stylesheet (fleet/site.css), fonts (Geist) and icon, and it does NOT use the site Footer or the Bootstrap and nq.css styles. The site nav bar is part of the legacy fleet page (nq-static, above the Fleet header), so the page places <Nav static /> itself; nothing is drawn here around it. fleet/site.js (a module) and fleet/pricing.js are loaded by the page, because they depend on its ids.
    import type { Snippet } from "svelte";
    import type { LayoutData } from "../$types";

    let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<svelte:head>
    <meta name="theme-color" content="#0B0D14">
    <link rel="icon" href="/fleet/favicon.svg" type="image/svg+xml">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href={`/fleet/site.css?v=${data.assets.fleetCss}`}>
    <link rel="stylesheet" href={`/nav.css?v=${data.assets.nav}`}>
    <script src={`/nav.js?v=${data.assets.navJs}`}></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <script src={`/analytics.js?v=${data.assets.analytics}`} defer></script>
    <script src={`/nudge.js?v=${data.assets.nudge}`} defer></script>
</svelte:head>

{@render children()}
