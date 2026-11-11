<script lang="ts">
    // The comparison table of the program pages and compare.html: <div class="nq-cmp-wrap"><table class="nq-cmp">. Cells are trusted HTML from the page's data.ts (links, <b>, <br>). `mine` lists the row indexes that are Netquor's own (class nq-me).
    let { head, rows, mine = [] }: { head: readonly string[]; rows: readonly (readonly string[])[]; mine?: readonly number[] } = $props();
</script>

<div class="nq-cmp-wrap"><table class="nq-cmp"><thead><tr>{#each head as h (h)}<th>{h}</th>{/each}</tr></thead><tbody>{#each rows as row, i (i)}<tr class={mine.includes(i) ? "nq-me" : undefined}>{#each row as cell, j (j)}<td>{@html cell}</td>{/each}</tr>{/each}</tbody></table></div>
