<script lang="ts">
    import { apiCode, apiTicks } from "./data";
    import Ticks from "./Ticks.svelte";
</script>

<!-- API -->
<section id="api" class="section alt">
  <div class="wrap split">
    <div>
      <p class="eyebrow">PowerAdmin: API and integrations</p>
      <h2>Everything in the console is an API call</h2>
      <p class="sub left">The Netquor Fleet console is built on the same API you get. Anything you can click, a script can do: list devices, push a profile, scope a policy, queue a patch, add an app to Buffet.</p>
      <Ticks items={apiTicks} />
    </div>
    <div class="vendor-card">
      <p class="ded-label">A few things you can script</p>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (the legacy page makes the code block keyboard-scrollable) -->
      <pre class="code" tabindex="0"><code>{apiCode}</code></pre>
      <p class="fine">Included on every plan.</p>
    </div>
  </div>
</section>
