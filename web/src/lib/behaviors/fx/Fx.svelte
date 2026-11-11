<script lang="ts">
    // Everything fx.js did for a page, in one component: the progress line (always), reveal on scroll and the card spotlight (not under reduced motion). The hero map is separate (use:heroMap on the svg) because it is bound to that element. Reveal and spotlight start in onMount, so they run after hydration and never on the server.
    import { onMount } from "svelte";
    import ScrollProgress from "./ScrollProgress.svelte";
    import { initReveal } from "./reveal";
    import { initSpotlight } from "./spotlight";
    let { reveal = true, spotlight = true }: { reveal?: boolean; spotlight?: boolean } = $props();
    onMount(() => {
        const stops = [reveal && initReveal(document, document, window), spotlight && initSpotlight(document, window)];
        return () => { for (const s of stops) if (s) s(); };
    });
</script>

<ScrollProgress />
