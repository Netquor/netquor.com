<script lang="ts">
    // The shared look of the site pages: the stylesheets (below), the head (icons), the Nav above the page and the Footer below it; the nav and analytics are behaviors, see src/lib/behaviors. A page changes the nav or footer through `chrome` in its own load (see src/lib/chrome.ts). Same markup as the legacy pages, in the same order.
    // The stylesheets are bundled by Vite, hashed and served from our own origin: no CDN. entry-site.css lists them in the cascade order of the legacy pages (Bootstrap, Bootstrap Icons, nav.css, nq.css). A page's own rules (page.css) are imported by the page and come after.
    import "#lib/styles/entry-site.css";
    import type { Snippet } from "svelte";
    import { page } from "$app/state";
    import { resolveChrome } from "#lib/chrome.ts";
    import Analytics from "#lib/behaviors/analytics/Analytics.svelte";
    import Footer from "#lib/components/Footer.svelte";
    import Nav from "#lib/components/Nav.svelte";

    let { children }: { children: Snippet } = $props();
    const chrome = $derived(resolveChrome(page.data.chrome, page.url.pathname));
</script>

<svelte:head>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <meta name="theme-color" content="#12161c">
</svelte:head>

<Analytics />
{#if chrome.nav}<Nav current={chrome.navCurrent} static={chrome.navStatic} />{/if}
{@render children()}
{#if chrome.footer !== "none"}<Footer variant={chrome.footer} />{/if}
