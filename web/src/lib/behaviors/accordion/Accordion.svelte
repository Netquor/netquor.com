<script lang="ts">
    // A Bootstrap-markup accordion that needs no Bootstrap JavaScript. The markup is what the pages render today (div.accordion > .accordion-item > h3.accordion-header > button.accordion-button[data-bs-toggle="collapse"] + .accordion-collapse.collapse[data-bs-parent]), plus aria-expanded and aria-controls from the first paint. The `collapse` action (use:collapse) drives it; the open state in the server markup is `open` on an item.
    // Props: id (the .accordion id, also the data-bs-parent target), items (AccordionItem[]), exclusive (default true: one panel open at a time via data-bs-parent), bodyClass (default "text-muted small"), headingLevel (2 to 6, default 3), showWithoutJs (default false: add a <noscript> rule that shows every panel when scripts are off; the legacy pages hide the answers then).
    import { untrack } from "svelte";
    import { collapse } from "./action";
    import { viewItems, type AccordionItem } from "./model";

    let { id, items, exclusive = true, bodyClass = "text-muted small", headingLevel = 3, showWithoutJs = false }: { id: string; items: AccordionItem[]; exclusive?: boolean; bodyClass?: string; headingLevel?: 2 | 3 | 4 | 5 | 6; showWithoutJs?: boolean } = $props();
    // The open state belongs to the DOM once the page is live (the action toggles classes), so the markup is computed once and never re-rendered from props.
    const views = untrack(() => viewItems(items, exclusive));
    const heading = untrack(() => `h${headingLevel}`);
</script>

<svelte:head>
    {#if showWithoutJs}<noscript>{@html `<style>#${id} .collapse:not(.show){display:block}</style>`}</noscript>{/if}
</svelte:head>

<div class="accordion" {id} use:collapse>
    {#each views as v (v.id)}
        <div class="accordion-item"><svelte:element this={heading} class="accordion-header"><button class={v.buttonClass} type="button" data-bs-toggle="collapse" data-bs-target={`#${v.id}`} aria-expanded={v.ariaExpanded} aria-controls={v.id}>{v.q}</button></svelte:element><div id={v.id} class={v.panelClass} data-bs-parent={exclusive ? `#${id}` : undefined}><div class={`accordion-body ${bodyClass}`}>{@html v.a}</div></div></div>
    {/each}
</div>
