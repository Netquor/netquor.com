<script lang="ts">
    import Faq from "#lib/components/Faq.svelte";
    import { FAQ } from "./data";
</script>

<section class="nq-section" id="faq">
    <div class="container" style="max-width: 900px;">
        <div class="nq-section-head">
            <p class="nq-eyebrow">Questions</p>
            <h2>Common questions</h2>
        </div>
            <Faq items={FAQ} />
        </div>
    </section>
