<script lang="ts">
    // A Bootstrap accordion (the page loads bootstrap.bundle.min.js, which drives the data-bs-* attributes).
    import { FAQ } from "./data";
</script>

<section class="py-5">
    <div class="container" style="max-width: 820px;">
        <h2 class="display-6 fw-black text-center mb-4">Questions</h2>
        <div class="accordion" id="faq">
            {#each FAQ as f (f.id)}
                <div class="accordion-item"><h3 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target={`#${f.id}`}>{f.q}</button></h3><div id={f.id} class="accordion-collapse collapse" data-bs-parent="#faq"><div class="accordion-body text-muted small">{@html f.a}</div></div></div>
            {/each}
        </div>
    </div>
</section>
