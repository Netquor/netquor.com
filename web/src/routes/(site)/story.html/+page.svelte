<script lang="ts">
    // /story.html: how Netquor started. A new page (no legacy HTML file), so the parity checker has nothing to compare it with.
    import Seo from "#lib/components/Seo.svelte";
    import Story from "#lib/pages/story/Story.svelte";
    import { jsonLd, meta } from "#lib/pages/story/data.ts";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
</script>

<Seo origin={data.origin} canonical="/story.html" title={meta.title} description={meta.description} jsonLd={jsonLd(data.origin)} twitter />
<Story />
