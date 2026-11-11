<script lang="ts">
    // The card of terms.html and privacy.html. The page's own <style> block sits before the card, as in the legacy page, and Bootstrap's script comes last (the legacy pages load it at the end of the body). The legacy pages have no footer and no fx.js.
    import type { LegalPageData } from "./types";

    let { page }: { page: LegalPageData } = $props();
    // A <script> tag cannot be written as markup in a component that has its own script block.
    const BOOTSTRAP_JS = `<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"><\/script>`;
</script>

{@html `<style>${page.css}</style>`}

<div class="container py-5 my-lg-5">
    <div class="row justify-content-center">
        <div class="col-12 col-lg-10 col-xl-8">
            <div class={`card ${page.cardClass} shadow-lg`}>
                <div class="card-header border-0 bg-transparent pt-5 px-4 px-md-5">
                    <div class="d-flex align-items-center mb-4">
                        <i class={`bi ${page.icon} fs-2 text-primary me-3`}></i>
                        <div>
                            <h1 class="h3 fw-black mb-0 brand-accent">Netquor Technologies</h1>
                            <p class="small text-muted  mb-0">{page.subtitle}</p>
                        </div>
                    </div>
                    <hr class="border-white-10">
                </div>

                <div class="card-body px-4 px-md-5 pb-5 legal-content">
                    <p class="small text-muted mb-4 italic">{page.updated}</p>
                    {#if page.intro}<div class="highlight-box"><p class="mb-0">{page.intro}</p></div>{/if}
                    {#each page.blocks as b, i (i)}
                        {#if b.k === "h3"}
                            <h3>{b.t}</h3>
                        {:else if b.k === "p"}
                            <p>{b.t}</p>
                        {:else if b.k === "html"}
                            <p>{@html b.t}</p>
                        {:else}
                            <ul>{#each b.items as li (li)}<li>{li}</li>{/each}</ul>
                        {/if}
                    {/each}

                    <div class="mt-5 pt-4 border-top border-white-10 d-flex flex-wrap justify-content-between align-items-center gap-3">
                        <div class="d-flex gap-2">
                            <button id="actionBtn" onclick={() => history.back()} class="btn btn-secondary rounded-pill px-4 fw-bold small">
                                <i class="bi bi-arrow-left me-2" id="btnIcon"></i>
                                <span id="btnText">BACK</span>
                            </button>
                        </div>
                    </div>
                    <p class="text-center text-obsidian-muted small mt-4">
                        <span class="opacity-50">&copy; 2026 Netquor Technologies LLC</span><br>
                        <span class="text-info fw-bold">Fargo, ND</span>
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>
{@html BOOTSTRAP_JS}
