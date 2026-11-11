<script lang="ts">
    // The sections between the hero and the pricing: intro cards, AI visitor automation, tenant experience, digital passport, Home Assistant, buzzer, comparison.
    import { AI_POINTS, BUZZER, INTRO, PASSPORT, TENANT, VS_NO, VS_YES } from "./data";
    import Cards from "./Cards.svelte";
</script>

<section class="py-5">
    <div class="container" style="max-width: 1000px;">
        <Cards items={INTRO} />
    </div>
</section>

<section class="py-5" id="ai">
    <div class="container" style="max-width: 1000px;">
        <div class="row align-items-center g-5">
            <div class="col-lg-6">
                <span class="text-info fw-bold  small">AI visitor automation</span>
                <h2 class="display-6 fw-black mb-3">Let the building handle the routine</h2>
                <p class="text-muted">Automatically manage access for guests, deliveries and service visits.</p>
                <ul class="list-unstyled text-muted small">
                    {#each AI_POINTS as p (p)}
                        <li class="mb-2"><i class="bi bi-check2 text-info me-2"></i>{p}</li>
                    {/each}
                </ul>
                <p class="fw-bold mb-0">Eliminate routine access calls and manual entry handling.</p>
            </div>
            <div class="col-lg-6"><div class="feature-card text-center py-5"><i class="bi bi-robot" style="font-size: 4rem; color: var(--cyber-blue);"></i><p class="h5 fw-bold mt-3 mb-1">AI visitor automation</p><p class="text-muted small mb-0">Included with Property Manager Pro and above.</p></div></div>
        </div>
    </div>
</section>

<section class="py-5">
    <div class="container" style="max-width: 1000px;">
        <div class="text-center mb-5">
            <h2 class="display-6 fw-black">A connected tenant experience</h2>
            <p class="text-muted">Give tenants control while reducing your workload.</p>
        </div>
        <Cards items={TENANT} />
    </div>
</section>

<section class="py-5" id="passport">
    <div class="container" style="max-width: 1000px;">
        <div class="row align-items-center g-5">
            <div class="col-lg-6 order-lg-2">
                <span class="text-info fw-bold  small">Digital passport</span>
                <h2 class="display-6 fw-black mb-3">A passport for everyone who needs to get in</h2>
                <p class="text-muted">Give visitors, housekeepers and guests a digital passport that grants full entry to the building and the unit, with no keys to hand over and nothing to collect afterward.</p>
                <div class="row g-3 mt-1">
                    {#each PASSPORT as p (p.title)}
                        <div class="col-12"><div class="d-flex gap-3"><i class={["bi", p.icon, "text-info fs-4"]}></i><div><strong>{p.title}</strong><div class="text-muted small">{p.text}</div></div></div></div>
                    {/each}
                </div>
            </div>
            <div class="col-lg-6 order-lg-1"><div class="phone"><img src="da-screen.jpeg" alt="The Digital Access mobile screen: a secure digital passport marked authorized, a location check, and buttons to unlock and lock the door" loading="lazy"></div></div>
        </div>
    </div>
</section>

<section class="py-5" id="home-assistant">
    <div class="container" style="max-width: 1000px;">
        <div class="feature-card" style="padding: 2.5rem; border-color: rgba(47, 143, 224,.35);">
            <div class="row align-items-center g-4">
                <div class="col-lg-8">
                    <span class="text-info fw-bold  small">Integrates with Hosted Home Assistant</span>
                    <h2 class="h2 fw-black mb-3">Powerful home automations, built on your building's entry</h2>
                    <p class="text-muted mb-2">Digital Access connects with our Hosted Home Assistant service, so entry events can drive automations in your home.</p>
                    <p class="text-muted mb-0">It is a great fit for renters whose buildings already have call boxes, ButterflyMX or similar systems: you keep the hardware you have, and add the smarts on top.</p>
                </div>
                <div class="col-lg-4 text-lg-end">
                    <a href="homeassistant.html" class="btn btn-primary-cyber">See Hosted Home Assistant <i class="bi bi-arrow-right ms-1"></i></a>
                </div>
            </div>
            <p class="text-muted small mt-4 mb-0" style="font-size: .78rem;">ButterflyMX is a trademark of its owner. Netquor is not affiliated with or endorsed by ButterflyMX.</p>
        </div>
    </div>
</section>

<section class="py-5" id="buzzer">
    <div class="container" style="max-width: 1000px;">
        <div class="feature-card" style="padding: 2.5rem; border-style: dashed; border-color: rgba(129,140,248,.55);">
            <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
                <span class="badge rounded-pill px-3 py-2" style="background: transparent; color: var(--nq-ink-2); border: 1px solid var(--nq-line-2);">In development</span>
                <span class="text-muted small">Coming to the Digital Access platform</span>
            </div>
            <h2 class="h2 fw-black mb-3">An in-unit buzzer replacement</h2>
            <p class="text-muted">For units that do not have a telephone call box, we are building an in-unit buzzer replacement, fully integrated into the Digital Access platform.</p>
            <div class="row g-3 mt-1">
                {#each BUZZER as b (b.title)}
                    <div class="col-md-6 col-lg-3"><div class="d-flex gap-3"><i class={["bi", b.icon, "text-info fs-4"]}></i><div><strong>{b.title}</strong><div class="text-muted small">{b.text}</div></div></div></div>
                {/each}
            </div>
            <div class="mt-4"><a href="mailto:hello@netquor.com?subject=Digital%20Access%20in-unit%20buzzer" class="btn btn-outline-info rounded-pill px-4">Tell me when it is ready</a></div>
        </div>
    </div>
</section>

<section class="py-5">
    <div class="container" style="max-width: 900px;">
        <h2 class="display-6 fw-black text-center mb-4">A smarter alternative to traditional access systems</h2>
        <div class="row g-4">
            <div class="col-md-6"><div class="feature-card" style="border-color: rgba(47, 143, 224,.45);"><h3 class="h5 fw-bold text-info">Netquor Digital Access</h3><ul class="vs-yes ps-0 mb-0 small text-muted">
                {#each VS_YES as v (v)}<li><i class="bi bi-check-lg text-info me-2"></i>{v}</li>{/each}</ul></div></div>
            <div class="col-md-6"><div class="feature-card"><h3 class="h5 fw-bold">Typical systems</h3><ul class="vs-no ps-0 mb-0 small text-muted">
                {#each VS_NO as v (v)}<li><i class="bi bi-x-lg text-secondary me-2"></i>{v}</li>{/each}</ul></div></div>
        </div>
    </div>
</section>
