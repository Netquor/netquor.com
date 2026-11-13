<script lang="ts">
    import { santaChips, santaTicks } from "./data";
    import Chips from "./Chips.svelte";
    import Ticks from "./Ticks.svelte";
</script>

<!-- Santa: endpoint security for Mac -->
<section id="santa" class="section">
  <div class="wrap split">
    <div>
      <p class="eyebrow">Endpoint security for Mac</p>
      <h2>Santa, hosted and managed for you</h2>
      <p class="sub left">Santa is the open-source tool that decides which programs may run on a Mac. Netquor Fleet is its hosted sync server and console, so there is nothing to build, host or keep patched.</p>
      <Ticks items={santaTicks} />
    </div>
    <div class="vendor-card">
      <p class="ded-label">How Santa decides</p>
      <Chips items={santaChips} />
      <p class="fine">Included on every plan, for Macs. Santa controls which programs run; it complements patching and good habits rather than replacing them. A malware list stops files that have been seen before, so keep Monitor mode on and review what it finds. Santa is an open-source project from North Pole Security; Netquor is not affiliated with or endorsed by North Pole Security.</p>
    </div>
  </div>
</section>
