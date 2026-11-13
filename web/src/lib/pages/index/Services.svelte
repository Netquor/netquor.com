<script lang="ts">
    import { SERVICES } from "./data";
</script>

<section class="pb-5" id="services">
    <div class="container">
        <div class="row g-4">
            {#each SERVICES as s (s.title)}
            <div class="col-md-4">
                <div class="service-card shadow-lg">
                    <i class="bi bi-{s.icon} icon-accent"></i>
                    <h3 class="fw-bold mb-3">{s.title}</h3>
                    <p class="text-muted">{s.text}</p>
                    <ul class="list-unstyled mt-4 small text-info">
                        {#each s.items as i (i)}<li><i class="bi bi-check2 me-2"></i>{i}</li>{/each}
                    </ul>
                </div>
            </div>
            {/each}
        </div>
    </div>
</section>
