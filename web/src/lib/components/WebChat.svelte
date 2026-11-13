<script lang="ts">
    // The web chat widget of Netquor's phone system (NQ Phone web chat), loaded on every page from our own PBX host. The script is async and renders everything in its own shadow root, so it cannot change the page's styles; it keeps one chat token in localStorage and talks only to its own origin. The site id is public (it is in the embed snippet). Place once in each layout.
    import { WEBCHAT_SRC } from "../webchat";
</script>

<svelte:head>
    <script src={WEBCHAT_SRC} async></script>
</svelte:head>
