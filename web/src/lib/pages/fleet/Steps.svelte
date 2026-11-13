<script lang="ts">
    import { steps } from "./data";
    import Rich from "./Rich.svelte";
</script>

<!-- How it works -->
<section class="section">
  <div class="wrap">
    <p class="eyebrow">How it works</p>
    <h2>Up and running in three steps</h2>
    <ol class="steps">
      {#each steps as s (s.n)}
        <li><span class="n">{s.n}</span><h3><Rich text={s.h} /></h3><p><Rich text={s.p} /></p></li>
      {/each}
    </ol>
  </div>
</section>
