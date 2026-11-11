<script lang="ts">
    // /fargo-moorhead.html, the local page: drawn by ProgramPage from its data module, with LocalBusiness-linked JSON-LD.
    import ProgramPage from "#lib/pages/programs/ProgramPage.svelte";
    import { localPage, localJsonLd, localMeta } from "#lib/pages/local/data.ts";
    import Seo from "#lib/components/Seo.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    const page = localPage();
</script>

<Seo origin={data.origin} canonical="/fargo-moorhead.html" title={page.meta.title} description={page.meta.description} keywords={localMeta.keywords} geo={{ region: "US-ND", placename: "Fargo" }} jsonLd={localJsonLd(data.origin)} />
<ProgramPage {page} />
