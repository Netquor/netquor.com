<script lang="ts">
    import { features } from "./data";
    import Icon from "./Icon.svelte";
    import Rich from "./Rich.svelte";
</script>

<!-- Features -->
<section id="features" class="section">
  <div class="wrap">
    <p class="eyebrow">What you get</p>
    <h2>Everything a small team needs to run Apple devices properly</h2>
    <p class="sub">No add-ons and no tiers. The same product for every customer, priced by the number of devices.</p>
    <div class="grid">
      {#each features as f (f.title)}
        <article class="card"><Icon name={f.icon} big /><h3>{f.title}</h3><p><Rich text={f.text} /></p></article>
      {/each}
    </div>
  </div>
</section>
