<script lang="ts">
    import { faq } from "./data";
    import Rich from "./Rich.svelte";
</script>

<section id="faq" class="section alt">
  <div class="wrap narrow">
    <p class="eyebrow">Questions</p>
    <h2>The things people ask first</h2>
    {#each faq as f (f.q)}
      <details><summary>{f.q}</summary><p><Rich text={f.a} /></p></details>
    {/each}
  </div>
</section>
