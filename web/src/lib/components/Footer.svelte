<script lang="ts">
    import { EMAIL, PHONES, labeled } from "../contact";
    // The site footer. "full" is the homepage footer; "simple" is the one line footer the tool pages use.
    import { COPYRIGHT_YEAR } from "#lib/site.ts";
    import { socialLinks } from "#lib/social.ts";
    let { variant = "simple" }: { variant?: "full" | "simple" } = $props();
</script>

{#if variant === "simple"}
    <footer class="py-5">
        <div class="container text-center">
            <p class="text-muted small mb-0">&copy; {COPYRIGHT_YEAR} Netquor Technologies LLC. <a href="/" class="text-muted">Home</a> &middot; <a href="/terms.html" class="text-muted">Terms</a> &middot; <a href="/privacy.html" class="text-muted">Privacy</a> &middot; <a href="https://status.netquor.com/" class="text-muted">Status</a></p>
        </div>
    </footer>
{:else}
    <footer class="nq-footer">
        <div class="container">
            <div class="nq-footer-grid">
                <div>
                    <img src="/brand/nq-logo-primary-color-dark.svg" alt="Netquor Technologies" width="200" height="120">
                    <p>Technical services that connect hardware and software, from Fargo, North Dakota.</p>
                    <p class="nq-footer-contact"><a href={`mailto:${EMAIL}`}>{EMAIL}</a>{#each PHONES as p}<br><a href={p.href}>{labeled(p)}</a>{/each}</p>
                    <p class="nq-social">{#each socialLinks() as s (s.network)}<a href={s.url} rel="me noopener" target="_blank" aria-label={s.ariaLabel}><i class="bi {s.icon}" aria-hidden="true"></i></a>{/each}</p>
                </div>
                <nav aria-label="Business products">
                    <h2>Business</h2>
                    <a href="https://phone.netquor.com/">Netquor Phone (early access)</a>
                    <a href="/fleet.html">Netquor Fleet</a>
                    <a href="/sdn.html">Netquor SDN</a>
                    <a href="/central.html">Netquor Central (in development)</a>
                </nav>
                <nav aria-label="Network and hosting">
                    <h2>Network and hosting</h2>
                    <a href="/network.html">Network Solutions</a>
                    <a href="/vpn.html">Netquor VPN</a>
                    <a href="https://www.allsourcehosting.com/" target="_blank" rel="noopener">All Source Hosting</a>
                </nav>
                <nav aria-label="Home and building">
                    <h2>Home and building</h2>
                    <a href="/homeassistant.html">Hosted Home Assistant</a>
                    <a href="/digitalaccess.html">Digital Access</a>
                </nav>
                <nav aria-label="Company" class="nq-2col">
                    <h2>Company</h2>
                    <a href="/#pricing">Pricing</a>
                    <a href="/compare.html">How we compare</a>
                    <a href="/fargo-moorhead.html">Fargo-Moorhead</a>
                    <a href="/startups.html">For startups</a>
                    <a href="/referrals.html">Referrals</a>
                    <a href="/partners.html">Partners and jobs</a>
                    <a href="/story.html">Our story</a>
                    <a href="/readiness.html">Readiness checklists</a>
                    <a href="/subnet-calculator.html">Subnet calculator</a>
                    <a href="https://account.netquor.com/">Account</a>
                    <a href="https://status.netquor.com/">Status</a>
                    <a href="/terms.html">Terms</a>
                    <a href="/privacy.html">Privacy</a>
                </nav>
            </div>
            <p class="nq-footer-legal">&copy; {COPYRIGHT_YEAR} Netquor Technologies LLC. All rights reserved.</p>
        </div>
    </footer>
{/if}
