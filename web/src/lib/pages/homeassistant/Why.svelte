<script lang="ts">
    import { WHY } from "./data";
</script>

<section class="py-5">
    <div class="container" style="max-width: 1000px;">
        <h2 class="display-6 fw-black text-center mb-5">Why have us run it</h2>
        <div class="row g-4">
            {#each WHY as w (w.title)}
                <div class="col-md-6 col-lg-4"><div class="feature-card"><i class={["bi", w.icon, "icon-accent"]}></i><h3 class="h5 fw-bold">{w.title}</h3><p class="text-muted small mb-0">{w.text}</p></div></div>
            {/each}
        </div>
    </div>
</section>
