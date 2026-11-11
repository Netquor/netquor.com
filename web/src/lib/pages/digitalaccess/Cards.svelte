<script lang="ts">
    // A row of three centred feature cards (the intro and the tenant experience use the same markup).
    let { items }: { items: readonly { icon: string; title: string; text: string }[] } = $props();
</script>

<div class="row g-4">
    {#each items as c (c.title)}
        <div class="col-md-4"><div class="feature-card text-center"><i class={["bi", c.icon, "icon-accent"]}></i><h3 class="h5 fw-bold">{c.title}</h3><p class="text-muted small mb-0">{c.text}</p></div></div>
    {/each}
</div>
