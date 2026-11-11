<script lang="ts">
    // <ul class="vendor-chips">: a bold name and a short line under it.
    import type { Chip } from "./data";
    import Rich from "./Rich.svelte";

    let { items }: { items: Chip[] } = $props();
</script>

<ul class="vendor-chips">
    {#each items as c, i (i)}
        <li><b><Rich text={c.b} /></b><span><Rich text={c.s} /></span></li>
    {/each}
</ul>
