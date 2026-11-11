<script lang="ts">
    import { DIFF_ROWS, MAIL_HREF } from "./data";
</script>

<header class="hero-section">
    <div class="container">
        <div class="row align-items-center g-5">
            <div class="col-lg-6 nq-rise">
                <p class="nq-eyebrow">Netquor Central &middot; in development</p>
                <h1 class="mb-4">People, groups, inbox filters and sign-in, in one place</h1>
                <p class="lead text-muted mb-4" style="max-width: 34rem;">Netquor Central is the dashboard Netquor runs its own team on. It keeps your directory and Google Workspace in step, works with your single sign-on service, manages groups, Gmail filters, labels and signatures, and reacts when someone joins, moves or leaves.</p>
                <div class="d-flex flex-wrap align-items-center gap-3">
                    <a href={MAIL_HREF} class="btn btn-primary-cyber">Tell us about your Workspace <i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a>
                    <a href="#status" class="btn btn-outline-info">See what is built</a>
                </div>
                <p class="nq-micro">Not sold as a product yet. We use it every day, and we are shaping it with a few Google Workspace teams.</p>
            </div>
            <div class="col-lg-6 nq-rise d2">
                <figure class="nq-diff" aria-label="Example change preview">
                    <figcaption><span>Change preview</span><span>Example data</span></figcaption>
                    {#each DIFF_ROWS as r (r.title)}
                        <div class="nq-diff-row"><b class={r.kind || undefined}>{r.label}</b><span>{r.title}<small>{@html r.detail}</small></span></div>
                    {/each}
                    <p class="nq-diff-foot">Plans and policies can be previewed before they run. Names and values are made up.</p>
                </figure>
            </div>
        </div>
    </div>
</header>

<style>
    /* The change-preview figure belongs to this component only (class names no other page uses), so its rules are scoped here. */
    .nq-diff { margin: 0; max-width: 520px; margin-inline: auto; background: var(--nq-s1); border: 1px solid var(--nq-line-2); border-radius: 20px; overflow: hidden; }
    .nq-diff figcaption { display: flex; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--nq-line); font: 400 .75rem var(--nq-mono); color: var(--nq-ink-3); }
    .nq-diff figcaption span:first-child { color: var(--nq-ink-2); }
    .nq-diff-row { display: grid; grid-template-columns: 4.5rem 1fr; gap: 12px; padding: 12px 20px; border-bottom: 1px solid var(--nq-line); font-size: .9375rem; color: var(--nq-ink-2); }
    .nq-diff-row b { font: 500 .75rem var(--nq-mono); color: var(--nq-accent-t); padding-top: 3px; }
    .nq-diff-row b.add { color: var(--nq-ok); }
    .nq-diff-row b.rm { color: #f0907f; }
    .nq-diff-row span { color: var(--nq-ink); }
    .nq-diff-row small { display: block; color: var(--nq-ink-3); font-size: .8125rem; margin-top: 2px; }
    .nq-diff-foot { margin: 0; padding: 14px 20px 18px; font-size: .8125rem; color: var(--nq-ink-3); line-height: 1.5; }
</style>
