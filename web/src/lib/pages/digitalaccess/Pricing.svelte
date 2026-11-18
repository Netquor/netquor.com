<script lang="ts">
    import Price from "#lib/components/Price.svelte";
    import { ADDON_FEATURES, TIERS } from "./data";
</script>

<section class="py-5" id="pricing">
    <div class="container" style="max-width: 1150px;">
        <div class="text-center mb-5">
            <h2 class="display-6 fw-black">Simple, scalable pricing</h2>
            <p class="text-muted">Start free. Upgrade as your properties grow.</p>
        </div>
        <div class="row g-4">
            {#each TIERS as t (t.name)}
                <div class="col-md-6 col-xl-3"><div class={["feature-card tier", t.cardClass]}>
                    <h3 class="h5 fw-bold text-info">{t.name}{#if t.badge}{" "}<span class="badge rounded-pill bg-info bg-opacity-10 text-info border border-info border-opacity-25 ms-1">{t.badge}</span>{/if}</h3>
                    <p class="text-muted small mb-0">{t.blurb}</p>
                    <div class="my-3">{#if t.priceKey}<span class="display-5 fw-black"><Price key={t.priceKey} /></span><span class="text-muted">{" "}/ month</span>{:else}<span class="display-5 fw-black">Free</span>{/if}</div>
                    {#if t.includes}<p class="small mb-2">{t.includes}</p>{/if}
                    <ul class="list-unstyled small text-muted mb-4 flex-grow-1">
                        {#each t.features as f (f)}
                            <li class="mb-2"><i class="bi bi-check2 text-info me-2"></i>{f}</li>
                        {/each}
                    </ul>
                    <a href={t.cta.href} class={["btn", t.cta.primary ? "btn-primary-cyber" : "btn-outline-info rounded-pill"]}>{t.cta.label}</a>
                </div></div>
            {/each}
        </div>
        <div class="feature-card mt-4 text-center" style="max-width: 760px; margin-left: auto; margin-right: auto;">
            <h3 class="h5 fw-bold">Connected Tenant Experience add-on</h3>
            <p class="text-muted small">Enable tenant self-service and reduce manual access requests.</p>
            <div class="mb-3"><span class="display-6 fw-black"><Price key="digitalaccess.tenant_addon.month" /></span><span class="text-muted">{" "}/ tenant / month</span></div>
            <ul class="list-unstyled small text-muted mb-0 text-start d-inline-block">
                {#each ADDON_FEATURES as f, i (f)}
                    <li class={i < ADDON_FEATURES.length - 1 ? "mb-2" : undefined}><i class="bi bi-check2 text-info me-2"></i>{f}</li>
                {/each}
            </ul>
        </div>
        <p class="text-muted small text-center mt-3 mb-0">Prices in USD.</p>
    </div>
</section>
