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
