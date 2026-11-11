<script lang="ts">
    // /partners.html, one of the three program pages drawn by ProgramPage from its data module.
    import ProgramPage from "#lib/pages/programs/ProgramPage.svelte";
    import { partnersPage } from "#lib/pages/partners/data.ts";
    import Seo from "#lib/components/Seo.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    const page = $derived(partnersPage(data.prices));
</script>

<Seo origin={data.origin} canonical="/partners.html" title={page.meta.title} description={page.meta.description} />
<ProgramPage {page} assets={data.assets} />
