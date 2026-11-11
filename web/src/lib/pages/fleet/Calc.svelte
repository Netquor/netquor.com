<script lang="ts">
    // The "Estimate your cost" card. The server renders it complete (the cards show a dash until the numbers are worked out); after hydration the shared model (src/lib/behaviors/fleet) fills in the cards, the verdict and the breakdown from the live prices. Ids, classes and aria attributes are the ones fleet/site.js used.
    import Price from "#lib/components/Price.svelte";
    import { useFleetModel } from "#lib/behaviors/fleet/context.ts";

    const model = useFleetModel();
    const { calc } = model;
    const hidden = (live: boolean, tag: string): true | undefined => (live && !tag ? true : undefined);
</script>

<div class="calc card" id="calc">
  <div class="calc-head">
    <div>
      <h3>Estimate your cost</h3>
      <p class="muted">Enter your devices to compare the plans. Prices are in USD, and your first 30 days are free.</p>
    </div>
  </div>
  <div class="calc-grid">
    <label>Macs
      <input id="calc-mac" type="number" min="0" max="100000" value={$calc.macN} inputmode="numeric" oninput={(e) => model.numberInput("mac", e.currentTarget.value)} />
      <input id="calc-mac-r" type="range" min="0" max="500" value={$calc.macR} aria-label="Number of Macs" oninput={(e) => model.rangeInput("mac", e.currentTarget.value)} />
    </label>
    <label>iPhones &amp; iPads
      <input id="calc-ios" type="number" min="0" max="100000" value={$calc.iosN} inputmode="numeric" oninput={(e) => model.numberInput("ios", e.currentTarget.value)} />
      <input id="calc-ios-r" type="range" min="0" max="500" value={$calc.iosR} aria-label="Number of iPhones and iPads" oninput={(e) => model.rangeInput("ios", e.currentTarget.value)} />
    </label>
  </div>
  <label class="check"><input type="checkbox" id="calc-dedicated" checked={$calc.dedicated} onchange={(e) => model.setDedicated(e.currentTarget.checked)} /> <span>Add a <b>dedicated cloud instance</b> on my own URL <small>(<Price key="fleet.dedicated.setup" /> one-time setup, then <Price key="fleet.dedicated.year" /> a year or <Price key="fleet.dedicated.month" /> a month)</small></span></label>
  <div class="compare" role="group" aria-label="Choose a plan" aria-live="polite">
    <button type="button" class={["plan-card", $calc.term === "annual" && "on"]} id="term-annual" aria-pressed={$calc.term === "annual"} onclick={() => model.selectTerm("annual")}>
      <span class="pc-name">Annual <small>2 months free, billed once a year</small></span>
      <span class="pc-tag" id="annual-tag" hidden={hidden($calc.live, $calc.view.annual.tag)}>{$calc.view.annual.tag}</span>
      <span class="pc-amount" id="annual-main">{$calc.view.annual.main}</span>
      <span class="pc-sub" id="annual-sub">{$calc.view.annual.sub}</span>
    </button>
    <button type="button" class={["plan-card", $calc.term === "monthly" && "on"]} id="term-monthly" aria-pressed={$calc.term === "monthly"} onclick={() => model.selectTerm("monthly")}>
      <span class="pc-name">Monthly <small>per device, month to month</small></span>
      <span class="pc-tag" id="monthly-tag" hidden={hidden($calc.live, $calc.view.monthly.tag)}>{$calc.view.monthly.tag}</span>
      <span class="pc-amount" id="monthly-main">{$calc.view.monthly.main}</span>
      <span class="pc-sub" id="monthly-sub">{$calc.view.monthly.sub}</span>
    </button>
    <button type="button" class={["plan-card", $calc.term === "lifetime" && "on"]} id="term-lifetime" aria-pressed={$calc.term === "lifetime"} onclick={() => model.selectTerm("lifetime")}>
      <span class="pc-name">Lifetime <small>pay once, no renewals</small></span>
      <span class="pc-tag" id="lifetime-tag" hidden={hidden($calc.live, $calc.view.lifetime.tag)}>{$calc.view.lifetime.tag}</span>
      <span class="pc-amount" id="lifetime-main">{$calc.view.lifetime.main}</span>
      <span class="pc-sub" id="lifetime-sub">{$calc.view.lifetime.sub}</span>
    </button>
  </div>
  <p class="verdict" id="verdict" aria-live="polite">{$calc.view.verdict}</p>
  <ul class="breakdown" id="breakdown" aria-live="polite">{#each $calc.view.breakdown as line, i (i)}<li>{line}</li>{/each}</ul>
  <p class="fine" id="calc-error" role="status">{$calc.view.error}</p>
  <p class="fine">Larger fleet or special requirements? <a href="#demo">Ask us for a quote.</a></p>
</div>
