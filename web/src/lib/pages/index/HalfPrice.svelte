<script lang="ts">
    // Half of a published price, rounded to the cent (the student price: half of the Homelab plan). A figure derived from a price key, so it is computed from the same price cache and never typed in. Plain text, as in the legacy page.
    import { page } from "$app/state";
    import { PRICE_FALLBACKS } from "#lib/priceFallbacks.ts";
    import { halfPriceText } from "./rich";

    let { key }: { key: string } = $props();
    const text = $derived(halfPriceText(page.data.prices?.[key] ?? PRICE_FALLBACKS[key]));
</script>{text}
