<script lang="ts">
    import { FOOTER_LINKS } from "./data";
</script>

<footer>
    <div class="container text-center">
        <p class="text-muted small mb-1">Netquor Technologies LLC &middot; Fargo, North Dakota</p>
        <p class="text-muted small mb-0">&copy; 2026 Netquor Technologies LLC. All Rights Reserved.</p>
        <div class="mt-3">
            {#each FOOTER_LINKS as l, i (l.href)}
                {#if i > 0}{" "}{/if}<a href={l.href} class="text-muted me-3 small text-decoration-none">{l.label}</a>
            {/each}
        </div>
    </div>
</footer>
