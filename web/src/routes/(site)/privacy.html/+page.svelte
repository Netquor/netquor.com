<script lang="ts">
    // /privacy.html: a legal page with no description, no Open Graph tags, no canonical and no footer, as the legacy page. The legacy head also links /css/main.css, which does not exist in the repository; it is not recreated (see migration/parity-allow.json).
    import Seo from "#lib/components/Seo.svelte";
    import LegalPage from "#lib/pages/legal/LegalPage.svelte";
    import { privacyPage } from "#lib/pages/privacy/data.ts";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
</script>

<Seo origin={data.origin} title={privacyPage.meta.title} og={false} robots={null} />
<LegalPage page={privacyPage} />
