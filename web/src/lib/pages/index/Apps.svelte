<script lang="ts">
    import { APP_GROUPS } from "./data";
    import Rich from "./Rich.svelte";
</script>

<section class="nq-section" id="apps">
    <div class="container">
        <div class="nq-section-head">
            <p class="nq-eyebrow">Proprietary software</p>
            <h2>The Netquor app ecosystem</h2>
            <p class="text-muted">Software we build and run ourselves. Manage your Netquor subscriptions at <a href="https://account.netquor.com/">account.netquor.com</a>.</p>
        </div>
            {#each APP_GROUPS as g (g.title)}
            <h3 class="nq-group">{g.title}</h3>
            <div class="nq-apps {g.cols}">
                {#each g.apps as a (a.name)}
                <article class="nq-app">
                    <div class="nq-app-top"><span class="nq-app-icon">{#if "bi" in a.icon}<i class="bi bi-{a.icon.bi}" aria-hidden="true"></i>{:else}<img src={a.icon.img} alt="" width="20" height="20">{/if}</span><span class="nq-app-status" data-status={a.status}>{a.statusLabel}</span></div>
                    <h4>{a.name}</h4>
                    <p class="nq-app-fix"><span>Fixes</span> {a.fix}</p><p>{a.text}</p><ul class="nq-app-feats">{#each a.feats as f (f)}<li>{f}</li>{/each}</ul>
                    <p class="nq-app-meta"><Rich html={a.meta} /></p>
                    <div class="nq-app-links">{#each a.links as l (l.href)}<a href={l.href} class="nq-app-{l.cls}" target={l.external ? "_blank" : undefined} rel={l.external ? "noopener" : undefined}>{l.label}</a>{/each}</div>
                </article>
                {/each}
            </div>

            {/each}
            <ul class="nq-together" aria-label="How the apps work together">
                <li><b>Fleet and VPN</b> Fleet can push a WireGuard tunnel configuration to the devices you choose, and Netquor VPN is WireGuard.</li>
                <li><b>Bundles</b> Use two products and take 10% off their plan fees, three and take 15%. <a href="#bundles">See the bundle</a>.</li>
                <li><b>One account</b> Manage your Netquor subscriptions at account.netquor.com.</li>
            </ul>
        </div>
    </section>
