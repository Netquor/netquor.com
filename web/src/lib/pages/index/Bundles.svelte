<script lang="ts">
    // The bundle price tool. Server-rendered with its starting form values and empty result rows (as the legacy page is before its script runs); bundle-calc.js (pure, loaded by the route) and bundleTool.ts fill the rows in after hydration.
    import { onMount } from "svelte";
    import { initBundleTool } from "./bundleTool";

    onMount(() => initBundleTool(document));
</script>

<section class="nq-section" id="bundles">
    <div class="container">
        <div class="nq-bundle">
            <div>
                <p class="nq-eyebrow">Bundles</p>
                <h2 class="mb-3">Use more than one product, pay less</h2>
                <p class="text-muted mb-3">Use two Netquor products together and take 10% off their plan fees. Use three and take 15%. It covers Netquor Fleet, Netquor VPN and, when it starts billing, Netquor Phone. Netquor SDN bundles are quoted per site.</p>
                <p class="text-muted mb-4">The products fit together: Netquor VPN is WireGuard, and Fleet can push a WireGuard tunnel configuration to the Macs, iPhones and iPads you choose. Manage your Netquor subscriptions at <a href="https://account.netquor.com/">account.netquor.com</a>.</p>
                <ul class="nq-bundle-rules">
                    <li>Discounts apply to monthly plan fees. Annual and volume pricing does not combine with them, so you get whichever is lower.</li>
                    <li>Usage is never discounted. That includes Phone AI minutes, extra numbers and premium voices.</li>
                    <li>Netquor Phone is in early access and nobody is billed yet. Its price here is a planned launch price and may change, and it joins bundles when billing starts.</li>
                </ul>
                <a href="mailto:hello@netquor.com?subject=Netquor%20bundle%20quote" class="btn btn-primary-cyber btn-lg">Ask for a bundle quote</a>
            </div>
            <div class="nq-bundle-calc" id="bundle-tool">
                <p class="nq-bundle-title">Price your own setup, per month</p>
                <div class="nq-presets" role="group" aria-label="Example setups">
                    <button type="button" data-preset="solo">Solo owner</button>
                    <button type="button" data-preset="office">Four-person office</button>
                    <button type="button" data-preset="team">Ten-person team</button>
                </div>
                <div class="nq-fields">
                    <label>Macs<input id="b-macs" type="number" inputmode="numeric" min="0" max="500" value="4"></label>
                    <label>iPhones and iPads<input id="b-devs" type="number" inputmode="numeric" min="0" max="500" value="4"></label>
                    <label class="wide">Netquor Phone<select id="b-phone"><option value="none">None</option><option value="starter">Starter, 1 person</option><option value="business" selected>Business, 5 people included</option></select></label>
                    <label id="b-people-wrap">People on Phone<input id="b-people" type="number" inputmode="numeric" min="1" max="100" value="4"></label>
                    <label class="wide">Netquor VPN<select id="b-vpn"><option value="none">None</option><option value="lite">Lite, 25 Mbps, 3 devices</option><option value="plus">Plus, 100 Mbps, 3 devices</option><option value="fast" selected>Fast, 500 Mbps, 5 devices</option><option value="gigabit">Gigabit, 1 Gbps, 10 devices</option></select></label>
                </div>
                <div id="b-rows" class="nq-bundle-rows" role="table" aria-label="Your monthly price" aria-live="polite"></div>
                <p id="b-save" class="nq-bundle-fine"></p>
                <p id="b-note" class="nq-bundle-fine"></p>
                <p class="nq-bundle-fine">US dollars, before tax. Fleet's first 30 days are free, and totals show the regular price. Phone totals show plan fees only, and usage above a plan is billed at published rates. Early-access offers are not included.</p>
            </div>
        </div>
    </div>
</section>
