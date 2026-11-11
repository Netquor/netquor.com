<script lang="ts">
    // The "Estimate your cost" card. Static markup: fleet/site.js (loaded by the page after hydration) finds it by id and fills in the numbers, from fleet/pricing.js.
    import Price from "#lib/components/Price.svelte";
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
      <input id="calc-mac" type="number" min="0" max="100000" value="25" inputmode="numeric" />
      <input id="calc-mac-r" type="range" min="0" max="500" value="25" aria-label="Number of Macs" />
    </label>
    <label>iPhones &amp; iPads
      <input id="calc-ios" type="number" min="0" max="100000" value="10" inputmode="numeric" />
      <input id="calc-ios-r" type="range" min="0" max="500" value="10" aria-label="Number of iPhones and iPads" />
    </label>
  </div>
  <label class="check"><input type="checkbox" id="calc-dedicated" /> <span>Add a <b>dedicated cloud instance</b> on my own URL <small>(<Price key="fleet.dedicated.setup" /> one-time setup, then <Price key="fleet.dedicated.year" /> a year or <Price key="fleet.dedicated.month" /> a month)</small></span></label>
  <div class="compare" role="group" aria-label="Choose a plan" aria-live="polite">
    <button type="button" class="plan-card on" id="term-annual" aria-pressed="true">
      <span class="pc-name">Annual <small>2 months free, billed once a year</small></span>
      <span class="pc-tag" id="annual-tag"></span>
      <span class="pc-amount" id="annual-main">&mdash;</span>
      <span class="pc-sub" id="annual-sub">&nbsp;</span>
    </button>
    <button type="button" class="plan-card" id="term-monthly" aria-pressed="false">
      <span class="pc-name">Monthly <small>per device, month to month</small></span>
      <span class="pc-tag" id="monthly-tag"></span>
      <span class="pc-amount" id="monthly-main">&mdash;</span>
      <span class="pc-sub" id="monthly-sub">&nbsp;</span>
    </button>
    <button type="button" class="plan-card" id="term-lifetime" aria-pressed="false">
      <span class="pc-name">Lifetime <small>pay once, no renewals</small></span>
      <span class="pc-tag" id="lifetime-tag"></span>
      <span class="pc-amount" id="lifetime-main">&mdash;</span>
      <span class="pc-sub" id="lifetime-sub">&nbsp;</span>
    </button>
  </div>
  <p class="verdict" id="verdict" aria-live="polite"></p>
  <ul class="breakdown" id="breakdown" aria-live="polite"></ul>
  <p class="fine" id="calc-error" role="status"></p>
  <p class="fine">Larger fleet or special requirements? <a href="#demo">Ask us for a quote.</a></p>
</div>
