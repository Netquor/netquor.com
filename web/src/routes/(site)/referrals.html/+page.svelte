<script lang="ts">
    // /referrals.html, one of the three program pages drawn by ProgramPage from its data module.
    import ProgramPage from "#lib/pages/programs/ProgramPage.svelte";
    import { referralsPage } from "#lib/pages/referrals/data.ts";
    import Seo from "#lib/components/Seo.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
    const page = $derived(referralsPage());
</script>

<Seo origin={data.origin} canonical="/referrals.html" title={page.meta.title} description={page.meta.description} />
<ProgramPage {page} />
