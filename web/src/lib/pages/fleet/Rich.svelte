<script lang="ts">
    // Trusted copy from data.ts: HTML with price tokens ({{fleet.mac.month}}). The tokens become the same <span data-price> markers <Price> draws, with the text from the same price snapshot; the whole string goes in as one piece of HTML so a token inside <b> or a link keeps its tags balanced.
    import { page } from "$app/state";
    import { richHtml } from "./tokens";

    let { text }: { text: string } = $props();
    const html = $derived(richHtml(text, page.data.prices, page.data.priceVersion ?? 0, typeof window === "undefined" ? undefined : () => {}));
</script>

{@html html}
