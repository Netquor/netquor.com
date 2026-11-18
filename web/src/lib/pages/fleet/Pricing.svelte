<script lang="ts">
    import { page } from "$app/state";
    import Price from "#lib/components/Price.svelte";
    import Calc from "./Calc.svelte";
    import { iosPlanList, macPlanList, packsTicks, tiers } from "./data";
    import Icon from "./Icon.svelte";
    import Rich from "./Rich.svelte";
    import Ticks from "./Ticks.svelte";
    import { centsOf, discounted, usd } from "./tokens";

    // The per-license figures in the pack table and the "down to" prices are the annual prices less the pack discount, worked out from the price snapshot.
    const volume = (key: string, bps: number) => usd(discounted(centsOf(page.data.prices, key), bps));
    const top = tiers[tiers.length - 1];
    const macDown = $derived(volume("fleet.mac.year", top.bps));
    const iosDown = $derived(volume("fleet.mobile.year", top.bps));
</script>

<!-- Pricing -->
<section id="pricing" class="section alt">
  <div class="wrap">
    <p class="eyebrow">Pricing</p>
    <h2>Simple, per device</h2>
    <p class="sub">Pay for the devices you manage. Every feature is included, on every plan.</p>

    <div class="free-banner">
      <div>
        <h3>Try it free for 30 days</h3>
        <p>Enroll as many Macs, iPhones and iPads as you like, with nothing held back. When the 30 days are up you choose what to pay for. Keep paying and you earn free devices for staying: up to five a year, and they never expire.</p>
      </div>
      <a class="btn" href="#demo">Start free <Icon name="arrow" /></a>
    </div>

    <div class="guarantee">
      <Icon name="shield" big />
      <div><h3>We guarantee you'll love it, or your money back</h3><p>Try it free for 30 days with as many devices as you like, and buy only when you are sure.</p></div>
    </div>

    <div class="plans">
      <article class="plan">
        <header><Icon name="laptop" big /><h3>Mac</h3></header>
        <p class="price"><span class="amount"><Price key="fleet.mac.month" /></span><span class="per">per Mac / month</span></p>
        <p class="annual-line">Or <b><Price key="fleet.mac.year" /> a year</b> per Mac (2 months free), in packs of 10, down to <b>{macDown}</b> at volume</p>
        <ul class="plan-list">
          {#each macPlanList as t, i (i)}
            <li><Icon name="check" /><Rich text={t} /></li>
          {/each}
        </ul>
      </article>
      <article class="plan">
        <header><Icon name="phone" big /><h3>iPhone &amp; iPad</h3></header>
        <p class="price"><span class="amount"><Price key="fleet.mobile.month" /></span><span class="per">per device / month</span></p>
        <p class="annual-line">Or <b><Price key="fleet.mobile.year" /> a year</b> per device (2 months free), in packs of 10, down to <b>{iosDown}</b> at volume</p>
        <ul class="plan-list">
          {#each iosPlanList as t, i (i)}
            <li><Icon name="check" /><Rich text={t} /></li>
          {/each}
        </ul>
      </article>
    </div>
    <p class="plans-note">The prices above are month to month. Pay for a year at once and you pay for 10 months instead of 12 (2 months free, about 17% off), with annual licenses sold in packs of 10, and save more as the packs add up: up to <b>37% off list</b>.</p>

    <div class="packs card">
      <div class="packs-text">
        <h3>Annual: 10 months for 12, in packs of 10</h3>
        <Ticks items={packsTicks} small />
      </div>
      <div class="table-wrap">
        <table class="tiers">
          <thead><tr><th>Licenses</th><th>You buy</th><th>Pack discount</th><th class="num">Mac / year*</th><th class="num">iPhone &amp; iPad / year*</th></tr></thead>
          <tbody>
            {#each tiers as t (t.lic)}
              <tr><td>{t.lic}</td><td>{t.buy}</td><td><b>{t.pct}</b></td><td class="num">{volume("fleet.mac.year", t.bps)}</td><td class="num">{volume("fleet.mobile.year", t.bps)}</td></tr>
            {/each}
          </tbody>
        </table>
        <p class="fine">*Per license for a year. Before any pack discount a license is <Price key="fleet.mac.year" /> (Mac) or <Price key="fleet.mobile.year" /> (iPhone &amp; iPad). The tier is set by the number of packs in one purchase.</p>
      </div>
    </div>

    <Calc />
  </div>
</section>
