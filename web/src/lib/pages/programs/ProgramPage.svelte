<script lang="ts">
    // One page template for startups.html, referrals.html and partners.html (the pages tools/make-program-pages.py writes today). The copy comes from the page's data.ts as a ProgramPageData; this draws the hero, the sections and the blocks inside them, with the same markup as the generated pages. The Fx component adds the reveal animations after hydration.
    import Fx from "#lib/behaviors/fx/Fx.svelte";
    import CmpTable from "#lib/components/CmpTable.svelte";
    import Faq from "#lib/components/Faq.svelte";
    import SectionHead from "#lib/components/SectionHead.svelte";
    import type { ProgramPageData } from "./types";

    let { page }: { page: ProgramPageData } = $props();

    const hero = $derived(page.hero);
    const wide = (w?: number) => (w ? `max-width: ${w}px;` : undefined);
    const mailSubject = (t: string) => `mailto:hello@netquor.com?subject=Work%20with%20Netquor%3A%20${t.replaceAll(" ", "%20").replaceAll(":", "%3A")}`;

</script>

<Fx />

<header class="hero-section" style="padding-bottom: 32px;">
    <div class="container" style={wide(hero.width)}>
        <p class="nq-eyebrow">{hero.eyebrow}</p>
        <h1 class="mb-3">{hero.title}</h1>
        <p class="lead text-muted mb-4" style={hero.leadStyle}>{hero.lead}</p>
        <div class="d-flex flex-wrap align-items-center gap-3">
            <a href={hero.primary.href} class="btn btn-primary-cyber">{hero.primary.label} <i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a>
            <a href={hero.secondary.href} class="btn btn-outline-info">{hero.secondary.label}</a>
        </div>
    </div>
</header>

{#each page.items as item, i (i)}
    {#if item.kind === "rule"}
        <div class="nq-rule" role="presentation"></div>
    {:else}
        <section class="nq-section" id={item.id} style={item.style}>
            <div class="container" style={wide(item.width)}>
                {#if item.head}<SectionHead eyebrow={item.head.eyebrow} title={item.head.title} lead={item.head.lead} />{/if}
                {#each item.blocks as b, j (j)}
                    {#if b.kind === "table"}
                        <CmpTable head={b.head} rows={b.rows} />
                    {:else if b.kind === "p"}
                        <p class={b.cls}>{@html b.html}</p>
                    {:else if b.kind === "safe"}
                        <div class="nq-safe">
                            {#each b.items as s (s.b)}<div><b>{s.b}</b><p>{s.p}</p></div>{/each}
                        </div>
                    {:else if b.kind === "steps"}
                        <ol class="nq-steps nq-steps-row">
                            {#each b.items as s (s)}<li>{@html s}</li>{/each}
                        </ol>
                    {:else if b.kind === "quote"}
                        <blockquote class="nq-quote">{b.text}</blockquote>
                    {:else if b.kind === "faq"}
                        <Faq items={b.items} />
                    {:else if b.kind === "roles"}
                        <div class="nq-who-grid">{#each b.roles as r (r.title)}<article class="nq-who"><h3>{r.title}</h3><p class="nq-who-label" style="margin-top:0">You have</p><ul class="nq-pain">{#each r.have as x (x)}<li>{x}</li>{/each}</ul><p class="nq-who-label" style="margin-top:0">You will</p><ul class="nq-pain">{#each r.do as x (x)}<li>{x}</li>{/each}</ul><a class="nq-who-cta" href={mailSubject(r.title)}>Tell us about yourself</a></article>{/each}</div>
                    {:else if b.kind === "cta"}
                        <div class="nq-start"><div class="nq-start-main"><div><h2>{b.cta.title}</h2><p class="text-muted mb-0">{b.cta.text}</p></div><div class="nq-contact"><a href={b.cta.action.href} class="btn btn-primary-cyber">{b.cta.action.label} <i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a><a href={b.cta.phone.href} class="nq-contact-link"><i class="bi bi-telephone" aria-hidden="true"></i><span>{b.cta.phone.label}</span></a></div></div></div>
                    {/if}
                {/each}
            </div>
        </section>
    {/if}
{/each}
