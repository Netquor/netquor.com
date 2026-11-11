<script lang="ts">
    import { PHONES, labeled } from "../../contact";
</script>

<section class="nq-section" id="contact">
    <div class="container">
        <div class="nq-start">
            <div class="nq-start-main">
                <div>
                    <p class="nq-eyebrow">Start here</p>
                    <h2>Tell us what you run</h2>
                    <p class="text-muted mb-0">A network to fix, devices to manage, calls going unanswered, a lab that needs real IP addresses, or a new build. Write or call and we reply with a plan and a price in writing.</p>
                </div>
                <div class="nq-contact">
                    <a href="mailto:hello@netquor.com" class="nq-contact-link"><i class="bi bi-envelope" aria-hidden="true"></i><span>hello@netquor.com</span></a>
                    {#each PHONES as p, i}
                        {#if i}{" "}{/if}<a href={p.href} class="nq-contact-link"><i class="bi bi-telephone" aria-hidden="true"></i><span>{labeled(p)}</span></a>
                    {/each}
                    <a href="mailto:hello@netquor.com?subject=Question%20for%20Netquor" class="btn btn-primary-cyber">Send a message <i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a>
                </div>
            </div>
            <ol class="nq-steps nq-steps-row">
                <li><b>Tell us what you run today.</b> Devices, network, phones, the building.</li>
                <li><b>We reply in writing.</b> A plan and a price. Published prices stay as listed.</li>
                <li><b>You decide whether to start.</b> Fleet begins with a free 30-day trial.</li>
            </ol>
        </div>
    </div>
</section>
