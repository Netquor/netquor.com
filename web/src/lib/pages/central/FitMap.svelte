<script lang="ts">
    import SectionHead from "#lib/components/SectionHead.svelte";
</script>

<section class="nq-section">
    <div class="container">
        <SectionHead eyebrow="How it fits" title="One source of truth for people" lead="Your directory owns the facts about each person. Netquor Central carries them to Google Workspace, and your sign-in service keeps everyone on one login." />
        <svg class="nq-map" viewBox="-20 0 740 320" role="img" aria-label="Netquor Central sits between your directory and sign-in services on one side and Google Workspace on the other"><g class="nq-map-lines" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M292 140H210L170 100H130V50"/><path d="M292 160H130"/><path d="M292 180H210L170 220H130V270"/><path d="M408 140H490L530 100H570V50"/><path d="M408 160H570"/><path d="M408 180H490L530 220H570V270"/></g><g class="nq-map-nodes"><circle cx="130" cy="50" r="6"/><circle cx="130" cy="160" r="6"/><circle cx="130" cy="270" r="6"/><circle cx="570" cy="50" r="6"/><circle cx="570" cy="160" r="6"/><circle cx="570" cy="270" r="6"/></g><image href="brand/nq-mark.svg" x="297" y="107" width="120" height="120"/><g class="nq-map-labels"><g><text x="116" y="54" text-anchor="end">LDAP directory</text><text x="116" y="72" text-anchor="end" class="sub">Source of truth</text></g><g><text x="116" y="164" text-anchor="end">Authentik</text><text x="116" y="182" text-anchor="end" class="sub">Single sign-on</text></g><g><text x="116" y="274" text-anchor="end">Keycloak</text><text x="116" y="292" text-anchor="end" class="sub">Admin console</text></g><g><text x="584" y="54">Users and groups</text><text x="584" y="72" class="sub">Built</text></g><g><text x="584" y="164">Gmail filters and labels</text><text x="584" y="182" class="sub">Built</text></g><g><text x="584" y="274">Email signatures</text><text x="584" y="292" class="sub">Built</text></g></g></svg>
    </div>
</section>
