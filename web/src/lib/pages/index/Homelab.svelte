<script lang="ts">
    // Real IPs for your homelab. The terminal types itself out when it scrolls into view (and shows everything at once without JavaScript): the "typing" class on <html> hides the lines and the "play" class on .term runs the animation.
    import { onMount } from "svelte";
    import { page } from "$app/state";
    import { priceText } from "#lib/priceFallbacks.ts";
    import { initTerminal } from "./terminal";

    const fromPrice = $derived(priceText(page.data.prices, "network.from.month", "usd0", undefined, page.data.priceVersion ?? 0, typeof window === "undefined" ? undefined : () => {}));

    onMount(() => initTerminal(document));
</script>

<section class="homelab" id="homelab">
    <div class="container">
        <div class="row align-items-center g-5">
            <div class="col-lg-6">
                <p class="nq-eyebrow">For homelabbers</p>
                <h2 class="hello mb-4">Real IPs for your homelab</h2>
                <p class="lead text-muted mb-4">Your rack deserves real IPs. Bring up a WireGuard tunnel and get a static, routable IPv4 address and an IPv6 /56 from our own network, AS403008. Host your stuff without port-forwarding through a CGNAT or a rotating residential address.</p>
                <div class="d-flex flex-wrap gap-2 mb-4">
                    <span class="chip"><i class="bi bi-globe2"></i> Static IPv4</span>
                    <span class="chip"><i class="bi bi-hash"></i> IPv6 /56 included</span>
                    <span class="chip"><i class="bi bi-shield-lock"></i> Plain WireGuard</span>
                    <span class="chip"><i class="bi bi-diagram-3"></i> VyOS-friendly</span>
                    <span class="chip"><i class="bi bi-calendar-x"></i> No contracts</span>
                    <span class="chip"><i class="bi bi-mortarboard"></i> Half off for students</span>
                </div>
                <div class="d-flex flex-wrap align-items-center gap-3">
                    <div class="price-pop"><span class="text-muted small">from</span><b data-price="network.from.month" data-fmt="usd0">{fromPrice}</b><span class="text-muted small">/ month</span></div>
                    <a href="/network.html#build" class="btn btn-primary-cyber btn-lg">Build your setup</a>
                    <a href="/network.html#pricing" class="btn btn-outline-info btn-lg">See pricing</a>
                    <a href="/subnet-calculator.html" class="btn btn-outline-info btn-lg">Free subnet calculator</a>
                </div>
            </div>
            <div class="col-lg-6">
                <div class="term" role="img" aria-label="Example terminal: bring up a WireGuard tunnel and get a routable public IP address">
                    <div class="term-bar"><span></span><span></span><span></span><em>homelab ~ netquor</em></div>
                    <div class="term-body" aria-hidden="true">
                        <span class="l" style="--d:.3s"><span class="p">~ $</span> sudo wg-quick up netquor</span>
                        <span class="l dim" style="--d:1.3s">[#] ip link add netquor type wireguard</span>
                        <span class="l dim" style="--d:2.2s">[#] ip -4 address add <span class="ip">203.0.113.42</span>/32 dev netquor</span>
                        <span class="l" style="--d:3.2s"><span class="p">~ $</span> curl -4 ifconfig.me</span>
                        <span class="l ip" style="--d:4.2s">{"203.0.113.42   "}<span class="dim"># static, routable, yours</span></span>
                        <span class="l" style="--d:5.2s"><span class="p">~ $</span> nc -vz 203.0.113.42 443</span>
                        <span class="l ok" style="--d:6.2s">Connection succeeded!</span>
                        <span class="l" style="--d:7s"><span class="p">~ $</span> <span class="cur"></span></span>
                    </div>
                </div>
                <p class="text-muted small text-center mt-2 mb-0">Example output with a documentation address.</p>
            </div>
        </div>
    </div>
</section>
