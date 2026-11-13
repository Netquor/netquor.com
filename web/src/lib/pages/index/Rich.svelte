<script lang="ts">
    // Trusted HTML from data.ts with prices written as {{price.key}} tokens (or {{price.key|fmt}}). The tokens become the same <span data-price data-fmt> markup <Price> draws, with the text from the same price snapshot, and the whole string goes in as one piece of HTML so a token inside <i> or <b> keeps its tags balanced. Never for visitor input.
    import { page } from "$app/state";
    import type { PriceFormat } from "#server/prices/stamp";
    import { priceText } from "#lib/priceFallbacks.ts";
    import { splitRich } from "./rich";

    let { html }: { html: string } = $props();
    const out = $derived(
        splitRich(html)
            .map((p) => {
                if (!("key" in p)) return p.html;
                const fmt = (p.fmt ?? "usd0") as PriceFormat;
                return `<span data-price="${p.key}" data-fmt="${fmt}">${priceText(page.data.prices, p.key, fmt, undefined, page.data.priceVersion ?? 0, typeof window === "undefined" ? undefined : () => {})}</span>`;
            })
            .join(""),
    );
</script>

{@html out}
