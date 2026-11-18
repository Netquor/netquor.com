<script lang="ts">
    // The six comparison tables of compare.html: <div class="nq-faq nq-cmp-list"> of <details>, each with a table (class nq-cmp, Netquor's rows nq-me) and an "Our view" note. Netquor's prices come from the price cache through <Price>; everything else is text from data.ts.
    import Price from "#lib/components/Price.svelte";
    import { CATEGORIES, HEAD } from "./data";
</script>

<div class="nq-faq nq-cmp-list">{#each CATEGORIES as c (c.id)}<details id={c.id} open={c.open}><summary>{c.title}</summary>
    <div class="nq-cmp-wrap"><table class="nq-cmp"><thead><tr>{#each HEAD as h (h)}<th>{h}</th>{/each}</tr></thead><tbody>
    {#each c.rows as r (r.name)}<tr class={r.mine ? "nq-me" : undefined}><td>{#if r.external}<a href={r.href} target="_blank" rel="noopener">{r.name}</a>{:else}<a href={r.href}>{r.name}</a>{/if}{#if r.thirdParty}{" "}<em>third-party</em>{/if}</td><td>{#each r.price as p, i (i)}{#if typeof p === "string"}{p}{:else}<Price key={p.price} />{/if}{/each}</td><td>{r.terms}</td></tr>{/each}</tbody></table></div>
    <p class="nq-cmp-view"><b>Our view.</b> {c.view}</p></details>{/each}</div>
