<script lang="ts">
    import "#lib/pages/sdn/page.css";
    import Nudge from "#lib/behaviors/nudge/Nudge.svelte";
    import { collapse } from "#lib/behaviors/accordion/action.ts";
    // /sdn.html: same URL, head and visible text as the legacy page. Copy and JSON-LD live in $lib/pages/sdn/data.ts. The accordion is Bootstrap's own collapse (bootstrap.bundle.js, loaded as on the legacy page).
    import Seo from "#lib/components/Seo.svelte";
    import { DESCRIPTION, features, faq, jsonLd, KEYWORDS, TITLE } from "#lib/pages/sdn/data.ts";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
</script>

<Seo origin={data.origin} canonical="/sdn.html" title={TITLE} description={DESCRIPTION} keywords={KEYWORDS} author="Netquor Technologies LLC" geo={{ region: "US-ND", placename: "Fargo, North Dakota" }} siteName="Netquor Technologies" locale="en_US" twitter {jsonLd} />
<svelte:head>
    <link rel="icon" href="/sdn-logo.svg" type="image/svg+xml">
</svelte:head>

<Nudge page="sdn.html" />

<header class="hero-section text-center">
    <div class="container">
        <div class="row justify-content-center"><div class="col-lg-9">
            <img src="/sdn-logo.svg" alt="Netquor SDN logo" width="72" height="72" class="rounded-4 mb-4">
            <span class="badge rounded-pill bg-info bg-opacity-10 text-info px-4 py-2 mb-4 border border-info border-opacity-10 d-table mx-auto">Fargo, ND &middot; serving the Midwest</span>
            <h1 class="display-4 fw-black mb-4">Software-defined networking for <span class="text-info">Ubiquiti</span> and <span class="text-info">VyOS</span></h1>
            <p class="lead text-muted mb-5 mx-auto" style="max-width: 760px;">Netquor SDN brings cloud and converged infrastructure, hosting and virtualization services, and secure WireGuard remote access together in one affordable platform for small businesses in Fargo, North Dakota and across the Midwest.</p>
            <div class="d-flex flex-wrap justify-content-center gap-3">
                <a href="mailto:hello@netquor.com?subject=Netquor%20SDN%20quote" class="btn btn-primary-cyber btn-lg">Get a quote</a>
                <a href="https://sdn.netquor.com/" target="_blank" rel="noopener" class="btn btn-outline-info btn-lg rounded-pill px-4">Launch the app</a>
            </div>
        </div></div>
    </div>
</header>

<main>
    <section class="py-5" id="features">
        <div class="container">
            <div class="text-center mb-5">
                <h2 class="display-6 fw-black">Managed networking, hosting and virtualization</h2>
                <p class="text-muted mx-auto" style="max-width: 680px;">One dashboard and API for the routers, Wi-Fi, servers and VPNs that keep your business running.</p>
            </div>
            <div class="row g-4">
                {#each features as f (f.title)}
                    <div class="col-md-6 col-lg-4"><div class="feature-card"><i class={`bi bi-${f.icon} icon-accent`}></i><h3 class="h5 fw-bold">{f.title}</h3><p class="text-muted small mb-0">{f.text}</p></div></div>
                {/each}
            </div>
        </div>
    </section>

    <section class="py-5">
        <div class="container" style="max-width: 820px;">
            <h2 class="display-6 fw-black text-center mb-4">Questions</h2>
            <div class="accordion" id="faq" use:collapse>
                {#each faq as f, i (f.q)}
                    <div class="accordion-item"><h3 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target={`#f${i}`}>{f.q}</button></h3><div id={`f${i}`} class="accordion-collapse collapse" data-bs-parent="#faq"><div class="accordion-body text-muted small">{f.a}</div></div></div>
                {/each}
            </div>
        </div>
    </section>

    <section class="py-5 my-4">
        <div class="container">
            <div class="card p-5 text-center">
                <h2 class="fw-black mb-3">Talk to a Fargo network engineer</h2>
                <p class="text-muted mb-4 mx-auto" style="max-width: 560px;">Tell us about your sites, your Ubiquiti or VyOS gear and what you want to host. We reply within a business day.</p>
                <div class="d-flex flex-wrap justify-content-center gap-3">
                    <a class="btn btn-primary-cyber btn-lg" href="mailto:hello@netquor.com?subject=Netquor%20SDN">hello@netquor.com</a>
                    <a class="btn btn-outline-info btn-lg rounded-pill px-4" href="tel:+18887171701">+1 (888) 717-1701</a>
                </div>
            </div>
        </div>
    </section>
</main>

<footer>
    <div class="container text-center">
        <p class="text-muted small mb-1">Netquor Technologies LLC &middot; Fargo, North Dakota &middot; Serving Fargo-Moorhead, North Dakota, Minnesota, South Dakota and the Midwest</p>
        <p class="text-muted small mb-0">&copy; 2026 Netquor Technologies LLC. All Rights Reserved.</p>
        <div class="mt-3">
            <a href="/" class="text-muted me-3 small text-decoration-none">Home</a>
            <a href="/network.html" class="text-muted me-3 small text-decoration-none">Network Solutions</a>
            <a href="/fleet.html" class="text-muted me-3 small text-decoration-none">Netquor Fleet</a>
            <a href="/terms.html" class="text-muted me-3 small text-decoration-none">Terms</a>
            <a href="/privacy.html" class="text-muted me-3 small text-decoration-none">Privacy</a>
            <a href="https://status.netquor.com/" class="text-muted me-3 small text-decoration-none">Status</a>
        </div>
    </div>
</footer>
