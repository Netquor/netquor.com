<script lang="ts">
    import { READY } from "./data";
    import ReadyCard from "./ReadyCard.svelte";
</script>

<section class="nq-section" id="ready">
    <div class="container">
        <div class="nq-section-head">
            <p class="nq-eyebrow">Readiness checklists</p>
            <h2>Is your business ready?</h2>
            <p class="text-muted">Four short checklists. Answer seven questions, see what is in place and what is missing, and get a plain next step for each gap. Free, private, and nothing leaves your browser.</p>
        </div>
            <div class="nq-ready-grid">
                {#each READY as c (c.href)}<ReadyCard card={c} />{/each}
            </div>
        </div>
    </section>
