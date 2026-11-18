<script lang="ts">
    import CallButtons from "../../components/CallButtons.svelte";
    import { MAILTO } from "./data";
</script>

<section class="py-5 my-4">
    <div class="container">
        <div class="card p-5 text-center">
            <h2 class="fw-black mb-3">Tell us about your home</h2>
            <p class="text-muted mb-4 mx-auto" style="max-width: 560px;">What devices you have, and whether you already run Home Assistant. We reply within a business day.</p>
            <div class="d-flex flex-wrap justify-content-center gap-3">
                <a class="btn btn-primary-cyber btn-lg" href={MAILTO}>hello@netquor.com</a>
                <CallButtons />
            </div>
        </div>
    </div>
</section>
