<script lang="ts">
    // The heading block above a section: an eyebrow, an h2 and an optional lead paragraph (<div class="nq-section-head">). `lead` is trusted HTML from the page's data (it may hold a link).
    let { eyebrow, title, lead }: { eyebrow?: string; title: string; lead?: string } = $props();
</script>

<div class="nq-section-head">
    {#if eyebrow}<p class="nq-eyebrow">{eyebrow}</p>{/if}
    <h2>{title}</h2>
    {#if lead}<p class="text-muted">{@html lead}</p>{/if}
</div>
