<script lang="ts">
    import CallButtons from "#lib/components/CallButtons.svelte";
    import "#lib/pages/network/page.css";
    import Nudge from "#lib/behaviors/nudge/Nudge.svelte";
    import { collapse } from "#lib/behaviors/accordion/action.ts";
    // /network.html: same URL, head and visible text as the legacy page. Copy is in $lib/pages/network/data.ts, the stack builder is a Svelte island (Builder.svelte, logic in builder.ts). Prices come from the price cache; the Business plan price is the page's literal $129.49 (the FAQ says "starts at $99": an open question, not decided here).
    import Price from "#lib/components/Price.svelte";
    import Seo from "#lib/components/Seo.svelte";
    import Builder from "#lib/pages/network/Builder.svelte";
    import { DESCRIPTION, faq, features, fits, jsonLd, KEYWORDS, locations, OG_DESCRIPTION, plans, steps, TITLE, TWITTER_DESCRIPTION } from "#lib/pages/network/data.ts";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
</script>

<Seo origin={data.origin} canonical="/network.html" title={TITLE} description={DESCRIPTION} ogDescription={OG_DESCRIPTION} keywords={KEYWORDS} author="Netquor Technologies LLC" siteName="Netquor Technologies" locale="en_US" {jsonLd} />
<svelte:head>
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content={TITLE}>
    <meta name="twitter:description" content={TWITTER_DESCRIPTION}>
    <meta name="twitter:image" content={`${data.origin}/brand/og.png`}>
</svelte:head>

<Nudge page="network.html" />

<header class="hero-section text-center">
    <div class="container">
        <div class="row justify-content-center"><div class="col-lg-9">
            <span class="badge rounded-pill bg-info bg-opacity-10 text-info px-4 py-2 mb-4 border border-info border-opacity-10 d-table mx-auto nq-badge-wrap">AS403008 &middot; Chicago &middot; Dallas &middot; New York &middot; Kansas City &middot; Los Angeles &middot; London &middot; Tokyo</span>
            <h1 class="display-4 fw-black mb-4">Your IP addresses, <span class="text-info">anywhere</span> you run</h1>
            <p class="lead text-muted mb-5 mx-auto" style="max-width: 760px;">Routable IP space and anycast for distributed applications and workers, delivered to you over WireGuard tunnels from our own network, AS403008.</p>
            <div class="d-flex flex-wrap justify-content-center gap-3">
                <a href="mailto:hello@netquor.com?subject=Netquor%20Network%20Solutions%20quote" class="btn btn-primary-cyber btn-lg">Get a quote</a>
                <a href="#pricing" class="btn btn-outline-info btn-lg rounded-pill px-4">See pricing</a>
            </div>
        </div></div>
    </div>
</header>

<main>
    <section class="py-5" id="features">
        <div class="container">
            <div class="text-center mb-5">
                <h2 class="display-6 fw-black">Network Solutions</h2>
                <p class="text-muted mx-auto" style="max-width: 680px;">Addresses and routing as a service, so your applications keep the same IPs wherever they run.</p>
            </div>
            <div class="row g-4">
                {#each features as f (f.title)}
                    <div class="col-md-6 col-lg-4"><div class="feature-card"><i class={`bi bi-${f.icon} icon-accent`}></i><h3 class="h5 fw-bold">{f.title}</h3><p class="text-muted small mb-0">{f.text}</p></div></div>
                {/each}
            </div>
        </div>
    </section>

    <section class="py-5" id="build">
        <div class="container" style="max-width: 1100px;">
            <div class="text-center mb-4">
                <h2 class="display-6 fw-black">Build it your way</h2>
                <p class="text-muted mx-auto" style="max-width: 640px;">Start with a plan, then snap on the blocks you need. The total updates as you go.</p>
            </div>
            <Builder />
        </div>
    </section>

    <section class="py-5" id="locations">
        <div class="container" style="max-width: 900px;">
            <h2 class="display-6 fw-black text-center mb-4">Where we are</h2>
            <div class="row g-3">
                {#each locations as l (l.code)}
                    <div class="col-6 col-md-3"><div class="pop"><strong>{l.city}</strong><span class="text-muted small">{l.code}</span></div></div>
                {/each}
            </div>
            <p class="text-muted small text-center mt-3 mb-0">Need a location that is not listed? Ask. We add capacity where customers need it. See how the network looks from the inside in our <a href="/looking-glass.html">public looking glass</a>.</p>
        </div>
    </section>

    <section class="py-5" id="how">
        <div class="container" style="max-width: 1000px;">
            <h2 class="display-6 fw-black text-center mb-5">How it works</h2>
            <div class="row g-4">
                {#each steps as s (s.n)}
                    <div class="col-md-6 col-lg-3"><div class="step-num">{s.n}</div><h3 class="h6 fw-bold">{s.title}</h3><p class="text-muted small mb-0">{s.text}</p></div>
                {/each}
            </div>
        </div>
    </section>

    <section class="py-5" id="pricing">
        <div class="container" style="max-width: 1100px;">
            <div class="text-center mb-5">
                <h2 class="display-6 fw-black">Simple pricing</h2>
                <p class="text-muted mx-auto" style="max-width: 640px;">Month to month, no setup fee. IPv6 is included on every plan. We love homelabs, so the entry plan is built for them.</p>
            </div>
            <div class="row g-4 align-items-stretch">
                {#each plans as p (p.name)}
                    <div class="col-lg-4"><div class="feature-card d-flex flex-column" style={p.cardStyle}>
                        <h3 class="h5 fw-bold text-info">{p.name}</h3>
                        <div class="my-3">{#if p.from}<span class="text-muted">{"from "}</span>{/if}<span class="display-5 fw-black">{#if p.priceKey}<Price key={p.priceKey} />{:else}{p.literal}{/if}</span><span class="text-muted">{" / month"}</span></div>
                        <ul class="list-unstyled small text-muted mb-4 flex-grow-1">
                            {#each p.items as item, i (item)}
                                <li class={i < p.items.length - 1 ? "mb-2" : undefined}><i class="bi bi-check2 text-info me-2"></i>{item}</li>
                            {/each}
                        </ul>
                        <a href={p.cta.href} class={p.cta.cls}>{p.cta.label}</a>
                    </div></div>
                {/each}
            </div>
            <p class="text-muted small text-center mt-3 mb-0">Speeds are "up to" and depend on the endpoints at your end. Fair-use applies. Prices in USD.</p>
            <p class="text-center small mt-2 mb-0"><i class="bi bi-mortarboard text-info me-1"></i> <span class="text-muted">Student or learner? The Homelab plan is half price.</span> <a class="text-info text-decoration-none" href="mailto:hello@netquor.com?subject=Student%20or%20learner%20pricing">Ask us</a></p>
        </div>
    </section>

    <section class="py-5">
        <div class="container" style="max-width: 900px;">
            <h2 class="display-6 fw-black text-center mb-4">Good fits</h2>
            <div class="row g-3">
                {#each fits as f (f.title)}
                    <div class="col-md-6"><div class="feature-card"><h3 class="h6 fw-bold text-info">{f.title}</h3><p class="text-muted small mb-0">{f.text}</p></div></div>
                {/each}
            </div>
        </div>
    </section>

    <section class="py-5">
        <div class="container" style="max-width: 820px;">
            <h2 class="display-6 fw-black text-center mb-4">Questions</h2>
            <div class="accordion" id="faq" use:collapse>
                {#each faq as f, i (f.q)}
                    <div class="accordion-item"><h3 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target={`#q${i}`}>{f.q}</button></h3><div id={`q${i}`} class="accordion-collapse collapse" data-bs-parent="#faq"><div class="accordion-body text-muted small">{#each f.a as part, k (k)}{#if typeof part === "string"}{part}{:else}<Price key={part.priceKey} />{/if}{/each}</div></div></div>
                {/each}
            </div>
        </div>
    </section>

    <section class="py-5 my-4">
        <div class="container">
            <div class="card p-5 text-center">
                <h2 class="fw-black mb-3">Tell us what you are building</h2>
                <p class="text-muted mb-4 mx-auto" style="max-width: 560px;">Which locations, how many addresses, and what runs behind them. We reply within a business day.</p>
                <div class="d-flex flex-wrap justify-content-center gap-3">
                    <a class="btn btn-primary-cyber btn-lg" href="mailto:hello@netquor.com?subject=Netquor%20Network%20Solutions">hello@netquor.com</a>
                    <CallButtons />
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
            <a href="/sdn.html" class="text-muted me-3 small text-decoration-none">Netquor SDN</a>
            <a href="/fleet.html" class="text-muted me-3 small text-decoration-none">Netquor Fleet</a>
            <a href="/terms.html" class="text-muted me-3 small text-decoration-none">Terms</a>
            <a href="/privacy.html" class="text-muted me-3 small text-decoration-none">Privacy</a>
            <a href="https://status.netquor.com/" class="text-muted me-3 small text-decoration-none">Status</a>
        </div>
    </div>
</footer>
