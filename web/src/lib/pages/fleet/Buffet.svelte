<script lang="ts">
    import { buffetTicks } from "./data";
    import Ticks from "./Ticks.svelte";
</script>

<!-- Buffet -->
<section id="buffet" class="section alt">
  <div class="wrap split">
    <div class="visual-stack" aria-hidden="true">
      <img class="shot-phone" src="/fleet/img/iphone.png" alt="" width="360" height="780" loading="lazy" />
    </div>
    <div>
      <img class="buffet-mark" src="/fleet/img/buffet.png" alt="" width="64" height="64" loading="lazy" />
      <p class="eyebrow">Buffet, our self-service platform</p>
      <h2>Self-serve, buffet style</h2>
      <p class="sub left">Buffet is the app your people open instead of filing a ticket. Lay out the apps and settings they may have, and let them help themselves. Nothing to sign in to: the app is set up by your MDM.</p>
      <Ticks items={buffetTicks} />
    </div>
  </div>
</section>
