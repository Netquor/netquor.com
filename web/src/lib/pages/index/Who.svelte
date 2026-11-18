<script lang="ts">
    import { WHO } from "./data";
</script>

<section class="nq-section" id="who">
    <div class="container">
        <div class="nq-section-head">
            <p class="nq-eyebrow">Built for how you work</p>
            <h2>Start with the frustration</h2>
            <p class="text-muted">Pick the one that sounds like you. Each lists what usually goes wrong, then the Netquor products that help.</p>
        </div>
        <div class="nq-load" role="group" aria-label="One person doing three jobs, and what Netquor takes over">
            <div class="nq-load-col"><h3>Today</h3>
                <div class="nq-load-job"><i></i>IT and network<small>nights</small></div>
                <div class="nq-load-job"><i></i>Phones and lines<small>weekdays</small></div>
                <div class="nq-load-job"><i></i>Hosting and backups<small>weekends</small></div>
                <p class="nq-load-who">One person, no backup</p></div>
            <div class="nq-load-mid" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="#5eaaf0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 32h32l6-10 6 20 4-10"/><circle cx="56" cy="32" r="3" fill="#5eaaf0"/></svg></div>
            <div class="nq-load-col is-nq"><h3>With Netquor</h3>
                <div class="nq-load-job"><i></i>Network, SDN and VPN<small>us</small></div>
                <div class="nq-load-job"><i></i>Phone and Fleet<small>us</small></div>
                <div class="nq-load-job"><i></i>Hosting<small>us</small></div>
                <p class="nq-load-who">Same person, one team to call</p></div>
        </div>
        <div class="nq-who-grid">
                {#each WHO as w (w.title)}
                <article class="nq-who">
                    <h3>{w.title}</h3>
                    <ul class="nq-pain">{#each w.pains as p (p)}<li>{p}</li>{/each}</ul>
                    <p class="nq-who-label">Start with</p>
                    <div class="nq-chips2">{#each w.chips as c (c.href + c.label)}<a href={c.href}>{c.label}</a>{/each}</div>
                    <a class="nq-who-cta" href={w.cta.href}>{w.cta.label}</a>
                </article>
                {/each}
            </div>
        </div>
    </section>
