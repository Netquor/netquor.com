<script lang="ts">
    // The phone buttons of a contact section: one per number, toll-free first. `cls` is the button class of the page (they differ: pill buttons or plain), `prefix` is "Call " where the page words it that way.
    import { PHONES } from "../contact";
    let { cls = "btn btn-outline-info btn-lg rounded-pill px-4", prefix = "" }: { cls?: string; prefix?: string } = $props();
</script>

{#each PHONES as p, i}
    {#if i}{" "}{/if}<a class={cls} href={p.href}>{prefix ? `${prefix}${p.label.toLowerCase()}` : p.label} {p.display}</a>
{/each}
