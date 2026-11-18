<script lang="ts">
    import { mdmTicks } from "./data";
    import Ticks from "./Ticks.svelte";
</script>

<!-- MDM overview (plain-language, for people searching) -->
<section id="mdm" class="section">
  <div class="wrap narrow">
    <p class="eyebrow">Mobile device management (MDM)</p>
    <h2>Affordable MDM for small business, schools and IT teams</h2>
    <p class="sub left">Mobile device management lets you configure, secure, update and support company Macs, iPhones and iPads from one place, without touching each one. Netquor Fleet gives a small business the features usually reserved for big enterprise MDM tools, at a price that starts with a free 30 days.</p>
    <Ticks items={mdmTicks} />
    <p class="sub left">Looking for a free trial of an MDM, a Jamf, Kandji or Mosyle alternative, or MDM with no minimum seats? <a href="#demo">Start your free 30 days</a>.</p>
  </div>
</section>
