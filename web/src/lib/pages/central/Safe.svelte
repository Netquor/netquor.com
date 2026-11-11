<script lang="ts">
    import SectionHead from "#lib/components/SectionHead.svelte";
    import { SAFE_ITEMS } from "./data";
</script>

<section class="nq-section" style="padding-top: 0;">
    <div class="container">
        <SectionHead eyebrow="Safe by design" title="It shows you the change before it makes it" />
        <div class="nq-safe">
            {#each SAFE_ITEMS as s (s.title)}
                <div><b>{s.title}</b><p>{s.text}</p></div>
            {/each}
        </div>
    </div>
</section>
