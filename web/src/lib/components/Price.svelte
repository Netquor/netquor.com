<script lang="ts">
    // A price from the page data. The server renders it from the in-memory price cache and the same data is sent to the browser, so server output and hydration always agree. The data-price attributes are the same markers the legacy pages carry. It never throws: a key the snapshot lacks shows the fallback prop, else the last-known price (see priceFallbacks.ts), and is logged once per key per version (on the server only).
    import { page } from "$app/state";
    import type { PriceFormat } from "#server/prices/stamp";
    import { priceText } from "../priceFallbacks";

    let { key, fmt = "usd0", fallback }: { key: string; fmt?: PriceFormat; fallback?: string } = $props();

    const text = $derived(priceText(page.data.prices, key, fmt, fallback, page.data.priceVersion ?? 0, typeof window === "undefined" ? undefined : () => {}));
</script>

<span data-price={key} data-fmt={fmt}>{text}</span>
