<script lang="ts">
    // The two calculators. The markup is server-rendered with empty outputs, as in the legacy page; cost-calc.js (pure maths, loaded by the route) and the wiring in calculators.ts fill them in after hydration.
    import { onMount } from "svelte";
    import { initCostCalcs } from "./calculators";

    onMount(() => initCostCalcs(document));
</script>

<section class="nq-section" id="calculators">
    <div class="container">
        <div class="nq-section-head">
            <p class="nq-eyebrow">Calculators</p>
            <h2>What it costs you</h2>
            <p class="text-muted">Enter your own numbers. Every figure comes from what you enter, and nothing leaves your browser. We add only our own list prices so you can set them side by side.</p>
        </div>
        <div class="nq-calcs">
            <form class="nq-calc" id="dev-calc" autocomplete="off" aria-labelledby="dev-title">
                <h3 id="dev-title">Device setup and sign-ins</h3>
                <p class="nq-calc-sub">How much of your week goes to setting up devices, installing apps and answering "what is the password?"</p>
                <div class="nq-fields">
                    <label>New devices a year<input id="d-new" type="number" min="0" inputmode="numeric"></label>
                    <label>Hours to set up one<input id="d-hrs" type="number" min="0" step="0.5" inputmode="decimal"></label>
                    <label>App or setting requests a week<input id="d-chg" type="number" min="0" inputmode="numeric"></label>
                    <label>Minutes each<input id="d-chgm" type="number" min="0" inputmode="numeric"></label>
                    <label>Password and sign-in asks a week<input id="d-sig" type="number" min="0" inputmode="numeric"></label>
                    <label>Minutes each<input id="d-sigm" type="number" min="0" inputmode="numeric"></label>
                    <label>What an hour of your time is worth ($)<input id="d-rate" type="number" min="0" inputmode="decimal"></label>
                    <label>Macs you manage<input id="d-macs" type="number" min="0" inputmode="numeric"></label>
                    <label>iPhones and iPads<input id="d-devs" type="number" min="0" inputmode="numeric"></label>
                </div>
                <button type="button" class="nq-linkbtn" data-example="dev">Use example numbers</button>
                <div id="dev-out" class="nq-calc-out" aria-live="polite"></div>
            </form>
            <form class="nq-calc" id="miss-calc" autocomplete="off" aria-labelledby="miss-title">
                <h3 id="miss-title">Missed calls</h3>
                <p class="nq-calc-sub">A call you do not answer can be a job that goes to another company.</p>
                <div class="nq-fields">
                    <label class="wide">What a typical job is worth ($)<input id="m-val" type="number" min="0" inputmode="decimal"></label>
                    <label>Calls you miss a week<input id="m-miss" type="number" min="0" inputmode="numeric"></label>
                    <label>Of those, jobs you lose<input id="m-jobs" type="number" min="0" inputmode="numeric"></label>
                </div>
                <button type="button" class="nq-linkbtn" data-example="miss">Use example numbers</button>
                <div id="miss-out" class="nq-calc-out" aria-live="polite"></div>
            </form>
        </div>
    </div>
</section>
