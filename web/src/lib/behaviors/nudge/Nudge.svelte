<script lang="ts">
    // The contextual product prompt, port of nudge.js. Renders nothing; after hydration it arms the card for `page` (the file name of the page, "vpn.html"; a page without an entry does nothing). The card is appended to <body> like the legacy script does, so it behaves the same with or without nq.css. Props: page (string).
    import { onMount } from "svelte";
    import { startNudge, type NudgeDoc, type NudgeWin } from "./nudge.ts";

    let { page }: { page: string } = $props();

    onMount(() => startNudge(page, document as unknown as NudgeDoc, window as unknown as NudgeWin));
</script>
