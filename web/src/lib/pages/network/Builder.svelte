<script lang="ts">
    // The stack builder ("Build it your way"): a Svelte island for what the legacy page did with an inline script and innerHTML. The server renders the legacy markup before its script ran (empty tiles and stack, total $0); after hydration the state renders, the same DOM and the same sentences (see builder.ts). Every id the legacy script looked up is kept. The plan and add-on prices come from the price cache (Business keeps the page's literal price, see builder.ts).
    import { onMount, tick } from "svelte";
    import { page } from "$app/state";
    import Price from "#lib/components/Price.svelte";
    import { priceText } from "#lib/priceFallbacks.ts";
    import { clamp, initialState, makeCatalog, view, type AddonId, type Bill, type BuilderState, type PlanId } from "./builder.ts";

    const catalog = $derived(makeCatalog((key) => Number(priceText(page.data.prices, key, "int", undefined, page.data.priceVersion ?? 0, () => {})) / 100));

    let st = $state<BuilderState>(initialState());
    let dropId = $state<AddonId | null>(null);
    // Bumped on every render: tiles and blocks are rebuilt each time, like the legacy page, so the drop animation replays and focus handling is the same.
    let seq = $state(0);
    let ready = $state(false);
    let reduce = $state(false);
    let tilesEl: HTMLElement | undefined = $state();

    const v = $derived(ready ? view(catalog, st, reduce, dropId) : null);

    const render = (drop: AddonId | null) => {
        st.qty = clamp(catalog, st);
        dropId = drop;
        seq++;
    };

    onMount(() => {
        reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        render(null);
        ready = true;
    });

    const pickPlan = (plan: PlanId) => { st.plan = plan; render(null); };
    const pickBill = (bill: Bill) => { st.bill = bill; render(null); };

    const change = async (index: number, id: AddonId, delta: number, which: 0 | 1) => {
        st.qty[id] = (st.qty[id] || 0) + delta;
        render(delta > 0 ? id : null);
        await tick();
        // Keep keyboard focus where it was (the tiles are rebuilt): the same button, or its neighbour if that one is now disabled.
        const btns = tilesEl?.children[index]?.querySelectorAll("button");
        if (!btns) return;
        const want = btns[which].disabled ? btns[1 - which] : btns[which];
        if (!want.disabled) want.focus();
    };
</script>

<div class="builder">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div class="seg" role="group" aria-label="Base plan" id="seg-plan">
            <button type="button" data-plan="homelab" aria-pressed={st.plan === "homelab"} onclick={() => pickPlan("homelab")}>Homelab</button>
            <button type="button" data-plan="startup" aria-pressed={st.plan === "startup"} onclick={() => pickPlan("startup")}>Startup</button>
            <button type="button" data-plan="business" aria-pressed={st.plan === "business"} onclick={() => pickPlan("business")}>Business</button>
        </div>
        <div class="seg" role="group" aria-label="Billing" id="seg-bill">
            <button type="button" data-bill="month" aria-pressed={st.bill === "month"} onclick={() => pickBill("month")}>Monthly</button>
            <button type="button" data-bill="year" aria-pressed={st.bill === "year"} onclick={() => pickBill("year")}>Yearly (2 months free)</button>
        </div>
    </div>
    <div class="row g-4">
        <div class="col-lg-7">
            <div class="small text-muted mb-2">Add blocks</div>
            <div class="d-grid gap-2" id="tiles" bind:this={tilesEl}>
                {#each v?.tiles ?? [] as t, i (`${seq}:${t.id}`)}
                    <div class={["tile", t.on && "on", t.off && "off"]}><div><div class="fw-semibold">{t.name}</div><div class="small text-muted">{t.sub}</div></div><div class="step"><button type="button" aria-label={`Remove one ${t.name}`} disabled={t.removeDisabled} onclick={() => change(i, t.id, -1, 0)}>&minus;</button><span class="n">{t.q}</span><button type="button" aria-label={`Add one ${t.name}`} disabled={t.addDisabled} onclick={() => change(i, t.id, 1, 1)}>+</button></div></div>
                {/each}
            </div>
            <noscript><p class="text-muted small mt-3">Add-ons: extra IPv4 <Price key="network.addon_ipv4.month" />, location <Price key="network.addon_location.month" />, tunnel <Price key="network.addon_tunnel.month" />, volume <Price key="network.addon_volume_tb.month" />/TB, anycast address <Price key="network.addon_anycast.month" />, IPv6 /48 <Price key="network.addon_ipv6_48.month" />, bring your own prefix <Price key="network.addon_byo_prefix.month" />, dedicated transit gateway <Price key="network.addon_gateway.month" /> per location, all per month.</p></noscript>
        </div>
        <div class="col-lg-5">
            <div class="small text-muted mb-2">Your stack</div>
            <div class="stack" id="stack" aria-live="polite">
                {#each v?.blocks ?? [] as b (`${seq}:${b.id}`)}
                    <div class={["blk", b.base && "base", b.drop && "drop"]}><span>{b.label}</span><span class="amt">{b.amt}</span></div>
                {/each}
            </div>
            <div class="border-top border-white border-opacity-10 mt-3 pt-3">
                <div class="d-flex justify-content-between align-items-baseline">
                    <span class="text-muted">Total</span>
                    <span><span class="display-6 fw-black total" id="total">{v?.total ?? "$0"}</span> <span class="text-muted small" id="per">{v?.per ?? "/ month"}</span></span>
                </div>
                <div class="small text-muted mt-2" id="summary">{v?.summary ?? ""}</div>
                <div class="small text-warning mt-2" id="hint" hidden={!v?.hint}>{v?.hint ?? ""}</div>
                <a id="quote" class="btn btn-primary-cyber w-100 mt-3" href={v?.quote ?? "mailto:hello@netquor.com?subject=Network%20Solutions%20quote"}>Request this setup</a>
                <p class="text-muted small mt-2 mb-0" id="note">{v?.note ?? ""}</p>
            </div>
        </div>
    </div>
</div>
