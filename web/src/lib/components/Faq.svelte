<script lang="ts">
    // The FAQ list of the program pages, the homepage and Central: <div class="nq-faq"> of <details>. `a` is trusted HTML written in the page's data.ts (it holds links such as <a href="mailto:...">), never visitor input. `id` and `open` are for the few entries that need them (compare.html).
    export interface FaqItem { q: string; a: string; id?: string; open?: boolean }
    let { items, class: extra }: { items: readonly FaqItem[]; class?: string } = $props();
</script>

<div class={["nq-faq", extra]}>
    {#each items as it (it.q)}
        <details id={it.id} open={it.open}><summary>{it.q}</summary><p>{@html it.a}</p></details>
    {/each}
</div>
