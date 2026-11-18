<script lang="ts">
    import { demoTicks } from "./data";
    import LeadForm from "./LeadForm.svelte";
    import Ticks from "./Ticks.svelte";
</script>

<!-- Demo request -->
<section id="demo" class="section">
  <div class="wrap demo">
    <div>
      <p class="eyebrow">Get started</p>
      <h2>Start your free trial</h2>
      <p class="sub left">Tell us a little about your fleet. We will get you set up with a 30-day free trial, and give you a quote for what comes after.</p>
      <Ticks items={demoTicks} small />
    </div>
    <LeadForm />
  </div>
</section>
