<script lang="ts">
    import { COMPARE } from "./data";
    import ReadyCard from "./ReadyCard.svelte";
</script>

<section class="nq-section" id="compare">
    <div class="container">
        <div class="nq-section-head">
            <p class="nq-eyebrow">How we compare</p>
            <h2>Side by side, with sources</h2>
            <p class="text-muted">Real prices from each company's own page, checked on November 10, 2026, with an honest note under each table. Sometimes a competitor is cheaper, and we say so.</p>
        </div>
            <div class="nq-ready-grid nq-ready-grid-3">{#each COMPARE as c (c.href)}<ReadyCard card={c} />{/each}</div>
        </div>
    </section>
