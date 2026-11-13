<script lang="ts">
    import Price from "#lib/components/Price.svelte";
    import HeroVisual from "./HeroVisual.svelte";
    import Icon from "./Icon.svelte";
</script>

<!-- Hero -->
<section class="hero">
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow">Mobile device management (MDM) for Mac, iPhone and iPad</p>
      <h1>Every Mac, iPhone and iPad.<br /><span class="grad">Managed. Patched. Self&#8209;serve.</span></h1>
      <p class="lede">Netquor Fleet enrolls your Apple devices, deploys and updates their apps, and gives your people Buffet, a friendly self-service app they will actually open. Every feature included, priced per device, and your first 30 days are free, with as many devices as you like.</p>
      <div class="cta-row">
        <a class="btn" href="#demo">Try it free for 30 days <Icon name="arrow" /></a>
        <a class="btn btn-ghost" href="#pricing">See pricing</a>
      </div>
      <ul class="price-pills" aria-label="Pricing at a glance">
        <li class="free-pill"><span><strong>30 days free</strong>, any number of devices</span></li>
        <li><Icon name="laptop" /><strong><Price key="fleet.mac.month" /></strong> per Mac / month</li>
        <li><Icon name="phone" /><strong><Price key="fleet.mobile.month" /></strong> per iPhone or iPad / month</li>
        <li><Icon name="shield" />Love it or your money back</li>
        <li class="soon"><Icon name="devices" />Windows and Android: coming soon</li>
      </ul>
    </div>
    <HeroVisual />
  </div>
</section>
