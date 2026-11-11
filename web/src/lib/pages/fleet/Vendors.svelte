<script lang="ts">
    import { vendorChips, vendorTicks } from "./data";
    import Chips from "./Chips.svelte";
    import Ticks from "./Ticks.svelte";
</script>

<!-- Vendor policies -->
<section id="vendors" class="section">
  <div class="wrap split">
    <div>
      <p class="eyebrow">PowerAdmin: vendor policies and Mac tooling</p>
      <h2>Manage the apps, not just the Macs</h2>
      <p class="sub left">Browsers, VPNs and meeting apps read their settings from your MDM. Netquor Fleet turns each app's documented settings into a guided form, so nobody hand-writes a property list.</p>
      <Ticks items={vendorTicks} />
    </div>
    <div class="vendor-card">
      <p class="ded-label">Ready-made settings for</p>
      <Chips items={vendorChips} />
      <p class="fine">Included on every plan. We add apps as vendors document their settings.</p>
    </div>
  </div>
</section>
