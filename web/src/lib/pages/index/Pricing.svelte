<script lang="ts">
    import { PRICE_ROWS } from "./data";
    import Rich from "./Rich.svelte";
</script>

<section class="nq-section" id="pricing">
    <div class="container">
        <div class="nq-section-head">
            <p class="nq-eyebrow">Pricing</p>
            <h2>What it costs, before you ask</h2>
            <p class="text-muted">List prices in US dollars. Each product page has the full plan details.</p>
        </div>
            <div class="nq-prices" role="table" aria-label="Netquor product prices">
                <div class="nq-prices-head" role="row"><span role="columnheader">Product</span><span role="columnheader">What you get</span><span role="columnheader">Price</span><span role="columnheader">Terms</span></div>
                {#each PRICE_ROWS as r (r.href)}
                <a class="nq-prices-row" role="row" href={r.href}><span role="cell"><b>{r.name}</b>{#if r.small}<small>{r.small}</small>{/if}</span><span role="cell">{r.what}</span><span role="cell" class="nq-price"><Rich html={r.price} /></span><span role="cell">{r.terms}</span></a>{" "}
                {/each}
            </div>
        </div>
    </section>
