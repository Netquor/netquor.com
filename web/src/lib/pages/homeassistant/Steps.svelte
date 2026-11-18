<script lang="ts">
    import { STEPS } from "./data";
</script>

<section class="py-5" id="how">
    <div class="container" style="max-width: 1000px;">
        <h2 class="display-6 fw-black text-center mb-5">How it works</h2>
        <div class="row g-4">
            {#each STEPS as s (s.n)}
                <div class="col-md-6 col-lg-3"><div class="step-num">{s.n}</div><h3 class="h6 fw-bold">{s.title}</h3><p class="text-muted small mb-0">{s.text}</p></div>
            {/each}
        </div>
    </div>
</section>
