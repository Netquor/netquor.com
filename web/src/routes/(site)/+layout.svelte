<script lang="ts">
    // The shared look of the site pages: head (icons, fonts, Bootstrap, nav.css, nq.css, nav.js, analytics), the Nav above the page and the Footer below it. A page changes the nav or footer through `chrome` in its own load (see src/lib/chrome.ts). Same markup as the legacy pages, in the same order.
    import type { Snippet } from "svelte";
    import { page } from "$app/state";
    import { resolveChrome } from "#lib/chrome.ts";
    import Footer from "#lib/components/Footer.svelte";
    import Nav from "#lib/components/Nav.svelte";
    import type { LayoutData } from "../$types";

    let { data, children }: { data: LayoutData; children: Snippet } = $props();
    const chrome = $derived(resolveChrome(page.data.chrome, page.url.pathname));
</script>

<svelte:head>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <meta name="theme-color" content="#12161c">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href={`/nav.css?v=${data.assets.nav}`}>
    <script src={`/nav.js?v=${data.assets.navJs}`}></script>
    <link rel="stylesheet" href={`/nq.css?v=${data.assets.nq}`}>
    <script src={`/analytics.js?v=${data.assets.analytics}`} defer></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
</svelte:head>

{#if chrome.nav}<Nav current={chrome.navCurrent} static={chrome.navStatic} />{/if}
{@render children()}
{#if chrome.footer !== "none"}<Footer variant={chrome.footer} />{/if}
