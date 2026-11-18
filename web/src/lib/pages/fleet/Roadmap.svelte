<script lang="ts">
    import { roadmap } from "./data";
    import Rich from "./Rich.svelte";
</script>

<!-- What's next -->
<section class="section">
  <div class="wrap narrow">
    <p class="eyebrow">What's next</p>
    <h2>We are still building</h2>
    <p class="sub">Honest about where things are: these are on the way, and your feedback shapes the order.</p>
    <ul class="roadmap">
      {#each roadmap as r, i (i)}
        <li><b><Rich text={r.b} /></b><span><Rich text={r.s} /></span></li>
      {/each}
    </ul>
  </div>
</section>
