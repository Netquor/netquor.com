<script lang="ts">
    import SectionHead from "#lib/components/SectionHead.svelte";
    import { SAFE_ITEMS } from "./data";
</script>

<section class="nq-section" style="padding-top: 0;">
    <div class="container">
        <SectionHead eyebrow="Safe by design" title="It shows you the change before it makes it" />
        <div class="nq-safe">
            {#each SAFE_ITEMS as s (s.title)}
                <div><b>{s.title}</b><p>{s.text}</p></div>
            {/each}
        </div>
    </div>
</section>

<style>
    /* The safety grid; scoped, see Hero.svelte. */
    .nq-safe { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .nq-safe div { padding: 20px; background: var(--nq-s1); border: 1px solid var(--nq-line); border-radius: 14px; }
    .nq-safe b { display: block; margin-bottom: 6px; font: 500 1rem var(--nq-display); color: var(--nq-ink); }
    .nq-safe p { margin: 0; font-size: .9375rem; color: var(--nq-ink-2); line-height: 1.55; }
</style>
