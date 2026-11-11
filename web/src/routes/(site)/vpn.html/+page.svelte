<script lang="ts">
    // /vpn.html: same URL, head and visible text as the legacy page. Copy is in $lib/pages/vpn/data.ts; every price (plan cards, the starting price in the title, description, badge, and the JSON-LD offers) comes from the price cache.
    import Price from "#lib/components/Price.svelte";
    import Seo from "#lib/components/Seo.svelte";
    import { priceText } from "#lib/priceFallbacks.ts";
    import { faq, features, head, jsonLd, KEYWORDS, PAGE_CSS, priceMap, tiers } from "#lib/pages/vpn/data.ts";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    // Prices inside title and meta text cannot be a component: same text from the same snapshot.
    const meta = $derived(head(priceText(data.prices, "vpn.from.month", "usd0", undefined, data.priceVersion ?? 0)));
</script>

<Seo origin={data.origin} canonical="/vpn.html" title={meta.title} description={meta.description} ogTitle={meta.ogTitle} ogDescription={meta.ogDescription} keywords={KEYWORDS} author="Netquor Technologies LLC" siteName="Netquor Technologies" locale="en_US" twitter {jsonLd} {priceMap} />
<svelte:head>
    {@html `<style>${PAGE_CSS}</style>`}
    <script src="/nudge.js" defer></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" defer></script>
</svelte:head>

<header class="hero-section text-center">
    <div class="container">
        <div class="row justify-content-center"><div class="col-lg-9">
            <span class="badge rounded-pill bg-info bg-opacity-10 text-info px-4 py-2 mb-4 border border-info border-opacity-10 d-table mx-auto">Netquor VPN &middot; from <Price key="vpn.from.month" />/mo</span>
            <h1 class="display-4 fw-black mb-4">Stop paying for crowded VPNs. <span class="text-info">Trust local.</span></h1>
            <p class="lead text-muted mb-5 mx-auto" style="max-width: 720px;">A WireGuard VPN run by a Fargo, North Dakota team and routed through our own network, AS403008. Not a faceless app. Pick a speed, add your devices, and connect.</p>
            <div class="d-flex flex-wrap justify-content-center gap-3">
                <a href="#plans" class="btn btn-primary-cyber btn-lg">See plans</a>
                <a href="mailto:hello@netquor.com?subject=Netquor%20VPN" class="btn btn-outline-info btn-lg rounded-pill px-4">Talk to a human</a>
            </div>
            <div class="d-flex flex-wrap justify-content-center gap-2 mt-4 small">
                <span class="badge rounded-pill bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-3 py-2"><i class="bi bi-speedometer2 me-1"></i> Capacity checked daily</span>
                <span class="badge rounded-pill bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-3 py-2"><i class="bi bi-graph-up-arrow me-1"></i> Scales with our customers</span>
                <span class="badge rounded-pill bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-3 py-2"><i class="bi bi-chat-heart me-1"></i> Fast, friendly local support</span>
            </div>
        </div></div>
    </div>
</header>

<main>
    <section class="py-5" id="plans">
        <div class="container" style="max-width: 1150px;">
            <div class="text-center mb-5">
                <h2 class="display-6 fw-black">Pick your speed</h2>
                <p class="text-muted mx-auto" style="max-width: 620px;">Month to month. Every plan includes WireGuard on all your devices, with a simple config for each one.</p>
            </div>
            <div class="row g-4">
                {#each tiers as t (t.name)}
                    <div class="col-md-6 col-lg-3"><div class={["feature-card", "tier", t.pop && "pop"]}>
                        <h3 class="h5 fw-bold text-info">{t.name}</h3>
                        <div class="my-3"><span class="display-5 fw-black"><Price key={t.priceKey} /></span><span class="text-muted">{" / month"}</span></div>
                        <div class="speed">{t.speed}</div>
                        <div class="bar my-2" aria-hidden="true"><i style={`width: ${t.bar}`}></i></div>
                        <p class="text-muted small mb-3">{t.sub}</p>
                        <ul class="list-unstyled small text-muted mb-4 flex-grow-1">
                            {#each t.items as item, i (item)}
                                <li class={i < t.items.length - 1 ? "mb-2" : undefined}><i class="bi bi-check2 text-info me-2"></i>{item}</li>
                            {/each}
                        </ul>
                        <a href={t.cta.href} class={t.cta.cls}>{t.cta.label}</a>
                    </div></div>
                {/each}
            </div>
            <p class="text-muted small text-center mt-3 mb-0">Speeds are "up to" and also depend on your own internet connection and device. Prices in USD.</p>
        </div>
    </section>

    <section class="py-5">
        <div class="container" style="max-width: 1000px;">
            <h2 class="display-6 fw-black text-center mb-5"><i class="bi bi-house-heart text-info me-2" aria-hidden="true"></i>Why local?</h2>
            <div class="row g-4">
                {#each features as f (f.title)}
                    <div class="col-md-6 col-lg-4"><div class="feature-card"><i class={`bi bi-${f.icon} icon-accent`}></i><h3 class="h5 fw-bold">{f.title}</h3><p class="text-muted small mb-0">{f.text}</p></div></div>
                {/each}
            </div>
            <p class="text-center text-muted small mt-4 mb-0">Running your own gear? <a href="/network.html" class="text-info text-decoration-none">Network Solutions</a> has a static IP and IPv6 of your own from <Price key="network.from.month" /> a month.</p>
        </div>
    </section>

    <section class="py-5">
        <div class="container" style="max-width: 820px;">
            <h2 class="display-6 fw-black text-center mb-4">Questions</h2>
            <div class="accordion" id="faq">
                {#each faq as f, i (f.q)}
                    <div class="accordion-item"><h3 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target={`#v${i}`}>{f.q}</button></h3><div id={`v${i}`} class="accordion-collapse collapse" data-bs-parent="#faq"><div class="accordion-body text-muted small">{f.a}</div></div></div>
                {/each}
            </div>
        </div>
    </section>

    <section class="py-5 my-4">
        <div class="container">
            <div class="card p-5 text-center">
                <h2 class="fw-black mb-3">Ready to trust local?</h2>
                <p class="text-muted mb-4 mx-auto" style="max-width: 560px;">Tell us the plan and how many devices. We reply within a business day.</p>
                <div class="d-flex flex-wrap justify-content-center gap-3">
                    <a class="btn btn-primary-cyber btn-lg" href="mailto:hello@netquor.com?subject=Netquor%20VPN">hello@netquor.com</a>
                    <a class="btn btn-outline-info btn-lg rounded-pill px-4" href="tel:+18887171701">+1 (888) 717-1701</a>
                </div>
            </div>
        </div>
    </section>
</main>

<footer>
    <div class="container text-center">
        <p class="text-muted small mb-1">Netquor Technologies LLC &middot; Fargo, North Dakota &middot; AS403008</p>
        <p class="text-muted small mb-0">&copy; 2026 Netquor Technologies LLC. All Rights Reserved.</p>
        <div class="mt-3">
            <a href="/" class="text-muted me-3 small text-decoration-none">Home</a>
            <a href="/network.html" class="text-muted me-3 small text-decoration-none">Network Solutions</a>
            <a href="/sdn.html" class="text-muted me-3 small text-decoration-none">Netquor SDN</a>
            <a href="/fleet.html" class="text-muted me-3 small text-decoration-none">Netquor Fleet</a>
            <a href="/terms.html" class="text-muted me-3 small text-decoration-none">Terms</a>
            <a href="/privacy.html" class="text-muted me-3 small text-decoration-none">Privacy</a>
            <a href="https://status.netquor.com/" class="text-muted me-3 small text-decoration-none">Status</a>
        </div>
    </div>
</footer>
