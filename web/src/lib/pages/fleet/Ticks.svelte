<script lang="ts">
    // The ticked list: <ul class="ticks"> (or "ticks small"), one li per item, each item the HTML of its span.
    import Icon from "./Icon.svelte";
    import Rich from "./Rich.svelte";

    let { items, small = false }: { items: string[]; small?: boolean } = $props();
</script>

<ul class={small ? "ticks small" : "ticks"}>
    {#each items as t, i (i)}
        <li><Icon name="check" /><span><Rich text={t} /></span></li>
    {/each}
</ul>
