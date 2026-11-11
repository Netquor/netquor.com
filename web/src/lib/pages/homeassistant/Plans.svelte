<script lang="ts">
    import Price from "#lib/components/Price.svelte";
    import { EXTRAS, TIERS } from "./data";
</script>

<section class="py-5" id="plans">
    <div class="container" style="max-width: 1180px;">
        <div class="text-center mb-5">
            <h2 class="display-6 fw-black">Pick your plan</h2>
            <p class="text-muted mx-auto" style="max-width: 640px;">The bridge device is included on every plan. Month to month, cancel any time.</p>
        </div>
        <div class="row g-4">
            {#each TIERS as t (t.name)}
                <div class="col-md-6 col-xl-3"><div class={["feature-card tier", t.cardClass]}>
                    {#if t.ribbon}<span class="ribbon">{t.ribbon}</span>{/if}
                    <h3 class={["h5 fw-bold", !t.nameStyle && "text-info"]} style={t.nameStyle}>{t.name}</h3>
                    <div class="my-3"><span class="display-5 fw-black"><Price key={t.priceKey} /></span><span class="text-muted">{" "}/ month</span></div>
                    <ul class="list-unstyled small text-muted mb-4 flex-grow-1">
                        {#each t.features as f (f.text)}
                            <li class="mb-2">{#if f.off}<i class="bi bi-dash text-muted me-2"></i>{:else if t.tickStyle}<i class="bi bi-check2 me-2" style={t.tickStyle}></i>{:else}<i class="bi bi-check2 text-info me-2"></i>{/if}{f.text}</li>
                        {/each}
                    </ul>
                    <a href={t.cta.href} class={["btn", t.cta.primary ? "btn-primary-cyber" : "btn-outline-info rounded-pill"]}>{t.cta.label}</a>
                </div></div>
            {/each}
        </div>

        <div class="feature-card mt-4" style="padding: 1.5rem 2rem;">
            <h3 class="h6 fw-bold mb-3">Extras</h3>
            <div class="row g-2 small text-muted">
                {#each EXTRAS as x (x.before)}
                    <div class="col-md-6 col-lg-4">{x.before}{#if x.priceKey}<Price key={x.priceKey} />{x.after}{/if}</div>
                {/each}
            </div>
        </div>
        <p class="text-muted small text-center mt-3 mb-0">Prices in USD. Camera and radio limits keep every plan fast for everyone. The bridge is rented hardware and is returned if you cancel.</p>
    </div>
</section>
