<script lang="ts">
    // The root layout draws nothing. What surrounds a page comes from its route group: (site) for the pages that use the site nav and footer, (fleet) for fleet.html, which has its own design.
    import type { Snippet } from "svelte";
    let { children }: { children: Snippet } = $props();
</script>

{@render children()}
