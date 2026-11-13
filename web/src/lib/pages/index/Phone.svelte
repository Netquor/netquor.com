<script lang="ts">
    import Price from "#lib/components/Price.svelte";
</script>

<section class="nq-feature" id="phone">
    <div class="container">
        <div class="row align-items-center g-5">
            <div class="col-lg-6">
                <p class="nq-eyebrow">Netquor Phone &middot; early access</p>
                <h2 class="mb-4">A phone number that answers like a receptionist</h2>
                <p class="lead text-muted mb-4">When you are on a job or in a meeting, Netquor Phone picks up, helps the caller and tells you what they needed. It is also a full business phone system, so you can add people and desk phones as you grow.</p>
                <div class="d-flex flex-wrap gap-2 mb-4">
                    <span class="chip">Planned launch price from <Price key="phone.planned_launch.month" /> a month, not billed yet</span>
                    <span class="chip">First 100 partners keep their price for 24 months</span>
                    <span class="chip">Self-hosted option, terms at launch</span>
                </div>
                <div class="d-flex flex-wrap align-items-center gap-3">
                    <a href="https://phone.netquor.com/start/" class="btn btn-primary-cyber btn-lg">Join early access</a>
                    <a href="https://phone.netquor.com/" class="btn btn-outline-info btn-lg">See how it works</a>
                </div>
                <p class="small text-muted mt-3 mb-0"><a href="https://phone.netquor.com/referrals/">Refer a business</a> that misses calls.</p>
            </div>
            <div class="col-lg-6">
                <figure class="nq-sms" aria-label="Example text message summary of a handled call">
                    <figcaption><span>Call summary</span><span>Example</span></figcaption>
                    <div class="nq-sms-body">
                        <p class="nq-sms-meta">Call handled &middot; 2:14 PM</p>
                        <p><b>Caller:</b> Dana R., water heater leaking</p>
                        <p><b>Callback:</b> (701) 555-0142</p>
                        <p><b>They asked for:</b> a same-day visit</p>
                        <p><b>Told them:</b> you would call back by 3:30</p>
                    </div>
                    <p class="nq-sms-note">Illustrative summary. Summaries arrive by email with a transcript today, and text summaries are in preview. Netquor Phone is in early access and its sample calls are scripted.</p>
                </figure>
            </div>
        </div>
    </div>
</section>
