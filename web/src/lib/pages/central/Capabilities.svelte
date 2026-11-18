<script lang="ts">
    import SectionHead from "#lib/components/SectionHead.svelte";
    import { CAPABILITIES } from "./data";
</script>

<section class="nq-section" id="status">
    <div class="container">
        <SectionHead eyebrow="What Netquor Central does" title="What is built, and what is not" lead="Most of this runs Netquor today. Netquor Central is not yet a product you can buy: it has no published price or self-serve sign-up. This is the state of each part." />
        <table class="nq-cap">
            <thead><tr><th>Capability</th><th>What it does</th><th>Status</th></tr></thead>
            <tbody>
                {#each CAPABILITIES as c (c.name)}
                    <tr><td>{c.name}</td><td>{c.what}</td><td><span class="nq-app-status" data-status={c.status}>{c.statusLabel}</span></td></tr>
                {/each}
            </tbody>
        </table>
    </div>
</section>

<style>
    /* The capability table; scoped, see Hero.svelte. */
    .nq-cap { width: 100%; border-collapse: collapse; }
    .nq-cap th { text-align: left; font: 400 .75rem var(--nq-mono); color: var(--nq-ink-3); padding: 0 16px 12px 0; border-bottom: 1px solid var(--nq-line); }
    .nq-cap td { padding: 18px 16px 18px 0; vertical-align: top; border-bottom: 1px solid var(--nq-line); color: var(--nq-ink-2); font-size: .9375rem; line-height: 1.55; }
    .nq-cap td:first-child { color: var(--nq-ink); font: 500 1.0625rem var(--nq-display); white-space: nowrap; }
    .nq-cap td:last-child { white-space: nowrap; padding-right: 0; }
    @media (max-width: 767.98px) { .nq-cap, .nq-cap tbody, .nq-cap tr, .nq-cap td { display: block; } .nq-cap thead { display: none; } .nq-cap tr { padding: 16px 0; border-bottom: 1px solid var(--nq-line); } .nq-cap td { border: 0; padding: 2px 0; white-space: normal !important; } }
</style>
