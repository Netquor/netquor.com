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
