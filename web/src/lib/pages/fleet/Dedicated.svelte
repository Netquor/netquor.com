<script lang="ts">
    import { page } from "$app/state";
    import Price from "#lib/components/Price.svelte";
    import { dedicatedTicks } from "./data";
    import Icon from "./Icon.svelte";
    import Ticks from "./Ticks.svelte";
    import { centsOf, usd0 } from "./tokens";
    import { useFleetModel } from "#lib/behaviors/fleet/context.ts";

    const model = useFleetModel();

    // $360 (twelve months) and $60 (the yearly saving) are derived from the monthly and yearly hosting prices.
    const monthly = $derived(centsOf(page.data.prices, "fleet.dedicated.month"));
    const yearly = $derived(centsOf(page.data.prices, "fleet.dedicated.year"));
</script>

<!-- Dedicated instance -->
<section id="dedicated" class="section">
  <div class="wrap split rev">
    <div>
      <p class="eyebrow">Dedicated cloud instance</p>
      <h2>Your own instance, on your own URL</h2>
      <p class="sub left">Upgrade from the shared Netquor Fleet cloud to a dedicated instance that runs only for you, at an address you choose, such as <span class="mono">mdm.yourcompany.com</span>.</p>
      <Ticks items={dedicatedTicks} />
    </div>
    <div class="ded-card">
      <p class="ded-label">Dedicated instance</p>
      <p class="ded-setup"><span class="amount small"><Price key="fleet.dedicated.setup" /></span><span class="per">one-time setup</span></p>
      <div class="ded-options">
        <div><span class="ded-price"><Price key="fleet.dedicated.year" /></span><span class="per">per year</span><small>billed yearly</small></div>
        <div class="or">or</div>
        <div><span class="ded-price"><Price key="fleet.dedicated.month" /></span><span class="per">per month</span><small>billed monthly ({usd0(monthly * 12)} a year)</small></div>
      </div>
      <p class="fine">Paying yearly saves {usd0(monthly * 12 - yearly)} a year. Added on top of your device licenses.</p>
      <a class="btn" href="#calc" data-add-dedicated onclick={() => model.addDedicated()}>Add it to my estimate <Icon name="arrow" /></a>
    </div>
  </div>
</section>
