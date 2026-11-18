<script lang="ts">
    // /story.html: the timeline of how Netquor started. Copy lives in data.ts.
    import { chapters, closing, credits, hero } from "./data.ts";
</script>

<header class="hero-section" style="padding-bottom: 24px;">
    <div class="container" style="max-width: 820px;">
        <p class="nq-eyebrow">{hero.eyebrow}</p>
        <h1 class="mb-3">{hero.title}</h1>
        <p class="lead text-muted mb-0">{hero.lead}</p>
    </div>
</header>

<section class="nq-section" style="padding-top: 24px;">
    <div class="container" style="max-width: 820px;">
        <ol class="story-timeline" aria-label="Timeline of how Netquor started">
            {#each chapters as c}
                <li>
                    <span class="story-when">{c.when}</span>
                    <h2>{c.title}</h2>
                    <p>{c.body}</p>
                    {#if c.figures}
                        <div class="story-figs" class:multi={c.figures.length > 1}>
                            {#each c.figures as f}
                                <figure class="story-fig" class:portrait={f.height > f.width}>
                                    {#if f.href}
                                        <a class="story-play" href={f.href} target="_blank" rel="noopener" aria-label={`${f.caption} Opens YouTube in a new tab.`}>
                                            <img src={f.src} alt={f.alt} width={f.width} height={f.height} loading="lazy" decoding="async">
                                            <span class="story-play-badge" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></span>
                                        </a>
                                    {:else}
                                        <img src={f.src} alt={f.alt} width={f.width} height={f.height} loading="lazy" decoding="async">
                                    {/if}
                                    <figcaption>{f.caption}</figcaption>
                                </figure>
                            {/each}
                        </div>
                    {/if}
                </li>
            {/each}
        </ol>

        <div class="story-close">
            <h2>{closing.title}</h2>
            <p>{closing.body}</p>
            <div class="d-flex flex-wrap align-items-center gap-3">
                <a href="/#contact" class="btn btn-primary-cyber">Talk to us <i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a>
                <a href="/#apps" class="btn btn-outline-info">See everything we make</a>
            </div>
        </div>

        <aside class="story-credits" aria-labelledby="story-credits-h">
            <h2 id="story-credits-h">{credits.title}</h2>
            <p>{credits.body}</p>
        </aside>
    </div>
</section>

<style>
    .story-timeline { list-style: none; margin: 0; padding: 0 0 0 28px; border-left: 1px solid var(--nq-line-2, rgba(234, 241, 248, 0.14)); }
    .story-timeline li { position: relative; padding: 0 0 40px 0; }
    .story-timeline li::before { content: ""; position: absolute; left: -35px; top: 6px; width: 13px; height: 13px; border-radius: 50%; background: var(--nq-bg, #12161c); border: 2px solid var(--nq-accent-t, #5eaaf0); }
    .story-when { display: block; font: 500 0.8125rem var(--nq-mono, "IBM Plex Mono", monospace); color: var(--nq-accent-t, #5eaaf0); margin-bottom: 4px; }
    .story-timeline h2 { font-size: 1.375rem; font-weight: 500; margin: 0 0 8px; }
    .story-timeline p { color: var(--nq-ink-2, #a9b6c6); margin: 0; max-width: 40rem; }
    .story-figs { display: flex; flex-wrap: wrap; gap: 16px 20px; align-items: flex-start; margin-top: 16px; }
    .story-fig { margin: 0; max-width: 520px; }
    .story-fig.portrait { max-width: 300px; }
    .multi .story-fig { max-width: 440px; }
    .multi .story-fig.portrait { max-width: 300px; }
    .story-fig img { display: block; width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--nq-line, rgba(234, 241, 248, 0.08)); background: var(--nq-s1, #1b212b); }
    .story-fig figcaption { margin-top: 8px; font-size: 0.8125rem; color: var(--nq-ink-3, #8794a7); }
    .story-play { position: relative; display: block; border-radius: 12px; }
    .story-play:focus-visible { outline: 2px solid var(--nq-accent-t, #5eaaf0); outline-offset: 3px; }
    .story-play-badge { position: absolute; left: 50%; top: 50%; width: 56px; height: 56px; margin: -28px 0 0 -28px; display: grid; place-items: center; border-radius: 50%; background: rgba(18, 22, 28, 0.78); color: #eaf1f8; border: 1px solid rgba(234, 241, 248, 0.35); transition: background-color 0.15s, color 0.15s; }
    .story-play:hover .story-play-badge { background: var(--nq-accent, #2f8fe0); color: #fff; }
    .story-close { background: var(--nq-s1, #1b212b); border: 1px solid var(--nq-line, rgba(234, 241, 248, 0.08)); border-radius: 16px; padding: 28px; margin-top: 8px; }
    .story-close h2 { font-size: 1.5rem; font-weight: 500; margin: 0 0 8px; }
    .story-close p { color: var(--nq-ink-2, #a9b6c6); margin: 0 0 20px; max-width: 40rem; }
    .story-credits { margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--nq-line, rgba(234, 241, 248, 0.08)); }
    .story-credits h2 { font: 500 0.75rem var(--nq-mono, "IBM Plex Mono", monospace); color: var(--nq-ink-3, #8794a7); margin: 0 0 8px; }
    .story-credits p { color: var(--nq-ink-3, #8794a7); font-size: 0.9375rem; margin: 0; max-width: 40rem; }
    @media (max-width: 575.98px) { .story-timeline { padding-left: 22px; } .story-timeline li::before { left: -29px; } }
</style>
