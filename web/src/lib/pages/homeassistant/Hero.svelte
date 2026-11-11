<script lang="ts">
    import Price from "#lib/components/Price.svelte";
    import { MAILTO } from "./data";
</script>

<header class="hero-section text-center">
    <div class="container">
        <div class="row justify-content-center"><div class="col-lg-9">
            <span class="badge rounded-pill bg-info bg-opacity-10 text-info px-4 py-2 mb-4 border border-info border-opacity-10 d-table mx-auto">Hosted Home Assistant &middot; from <Price key="homeassistant.from.month" />/mo</span>
            <h1 class="display-4 fw-black mb-4">Your smart home, <span class="text-info">managed</span> and reachable anywhere</h1>
            <p class="lead text-muted mb-5 mx-auto" style="max-width: 740px;">Keep your integrations cloud-native. We run your assistant in the cloud for access from anywhere, and we rent you a small bridge device that connects it to your home network. Updates, backups and support from a local team.</p>
            <div class="d-flex flex-wrap justify-content-center gap-3">
                <a href="#plans" class="btn btn-primary-cyber btn-lg">See plans</a>
                <a href={MAILTO} class="btn btn-outline-info btn-lg rounded-pill px-4">Talk to a human</a>
            </div>
        </div></div>
    </div>
</header>
