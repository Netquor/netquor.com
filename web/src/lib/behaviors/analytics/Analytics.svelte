<script lang="ts">
    // Google Analytics 4 for every page, the port of analytics.js. Renders nothing; after hydration it runs startAnalytics (opt-outs, dataLayer, gtag config, one async gtag.js script in <head>). Place once in a layout.
    import { onMount } from "svelte";
    import { startAnalytics } from "./analytics.ts";

    onMount(() => {
        startAnalytics();
    });
</script>
