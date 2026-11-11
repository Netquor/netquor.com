<script lang="ts">
    // /sms.html: the text messaging program terms for Netquor's toll-free number, on their own URL (a carrier or registry reviewer can open it directly). The words come from legal/sms.ts, the same as Terms section 13.
    import Seo from "#lib/components/Seo.svelte";
    import "#lib/pages/sms/page.css";
    import LegalPage from "#lib/pages/legal/LegalPage.svelte";
    import { smsPage } from "#lib/pages/legal/smsPage.ts";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
</script>

<Seo origin={data.origin} canonical="/sms.html" title="Text messaging program terms | Netquor" description="How Netquor Technologies text messages work: what we send, how you agree, message frequency, rates, and how to stop or get help." />
<LegalPage page={smsPage} />
