<script lang="ts">
    import { facts } from "./data";
    import Rich from "./Rich.svelte";
</script>

<!-- Facts -->
<section class="facts">
  <div class="wrap facts-in">
    {#each facts as f, i (i)}
      <div><b><Rich text={f.b} /></b><span><Rich text={f.s} /></span></div>
    {/each}
  </div>
</section>
