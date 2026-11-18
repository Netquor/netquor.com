<script lang="ts">
    import CallButtons from "../../components/CallButtons.svelte";
    import { MAIL_HREF } from "./data";
</script>

<section class="nq-section" style="padding-top: 0;">
    <div class="container">
        <div class="nq-bundle" style="grid-template-columns: 1fr; text-align: left;">
            <div>
                <h2 class="mb-3">Tell us about your Workspace</h2>
                <p class="text-muted mb-4">Write to us with how many people you have, where your directory lives and what you want kept in step. We reply with an honest answer on fit and what it would take.</p>
                <div class="d-flex flex-wrap align-items-center gap-3">
                    <a href={MAIL_HREF} class="btn btn-primary-cyber btn-lg">Email hello@netquor.com</a>
                    <CallButtons cls="btn btn-outline-info btn-lg" prefix="Call " />
                </div>
            </div>
        </div>
    </div>
</section>
