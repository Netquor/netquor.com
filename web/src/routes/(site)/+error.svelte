<script lang="ts">
    // The error page for the whole site: a 404 drawn as a traceroute that reaches netquor.com and then finds no route to the page, with a cable that is not quite plugged in. Any other error gets the plain version. It lives in the (site) group, so the site layout draws the styles, nav, footer, analytics and chat widget around it; an unmatched address reaches it through the catch-all route next to it (it throws a 404). The trace is a joke and says so: nothing is traced.
    import { page } from "$app/state";
    import { EMAIL } from "#lib/contact.ts";

    const missing = $derived(page.status === 404);
    // What the visitor asked for, shortened so a very long address cannot break the card. Svelte escapes it.
    const asked = $derived(page.url.pathname.length > 48 ? `${page.url.pathname.slice(0, 45)}...` : page.url.pathname);
    const hops = $derived([
        { n: 1, who: "your device", state: "ok" },
        { n: 2, who: "your network", state: "ok" },
        { n: 3, who: "the internet", state: "ok" },
        { n: 4, who: "www.netquor.com", state: "reached" },
        { n: 5, who: asked, state: "no route" },
    ]);
    const links = [
        { href: "/fleet.html", label: "Netquor Fleet" },
        { href: "/vpn.html", label: "Netquor VPN" },
        { href: "/network.html", label: "Network Solutions" },
        { href: "/sdn.html", label: "Netquor SDN" },
        { href: "/looking-glass.html", label: "Looking glass" },
        { href: "/subnet-calculator.html", label: "Subnet calculator" },
        { href: "/story.html", label: "Our story" },
    ];
</script>

<svelte:head>
    <title>{missing ? "Page not found" : "Something went wrong"} | Netquor</title>
    <meta name="robots" content="noindex">
</svelte:head>

<main class="nf">
    <div class="container nf-wrap">
        <p class="nq-eyebrow">{missing ? "Error 404" : `Error ${page.status}`}</p>
        <h1>{missing ? "No route to that page" : "Something broke on our side"}</h1>
        <p class="lead text-muted nf-lead">
            {#if missing}
                We reached netquor.com fine, but nothing lives at that address. The link may be old, or mistyped.
            {:else}
                The server hit an error. Try again in a moment. If it keeps happening, tell us at <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
            {/if}
        </p>

        {#if missing}
            <div class="nf-card" role="img" aria-label="A traceroute that reaches www.netquor.com, then finds no route to the requested page">
                <p class="nf-cmd"><span aria-hidden="true">$</span> traceroute www.netquor.com{asked}</p>
                <ol class="nf-hops">
                    {#each hops as h, i (h.n)}
                        <li class={`nf-hop nf-${h.state.replace(" ", "-")}`} style={`--i: ${i}`}>
                            <span class="nf-n">{h.n}</span>
                            <span class="nf-who">{h.who}</span>
                            <span class="nf-st">{h.state}</span>
                        </li>
                    {/each}
                    <li class="nf-hop nf-stars" style="--i: 5"><span class="nf-n">6</span><span class="nf-who">* * *</span><span class="nf-st">request timed out<span class="nf-cursor" aria-hidden="true"></span></span></li>
                </ol>
                <p class="nf-note">A joke: nothing was traced, and the page really is missing.</p>
            </div>

            <svg class="nf-cable" viewBox="0 0 260 72" width="260" height="72" aria-hidden="true" focusable="false">
                <path d="M0 36 H62" class="nf-wire"/>
                <g class="nf-plug">
                    <rect x="62" y="20" width="44" height="32" rx="6" class="nf-body"/>
                    <rect x="106" y="26" width="14" height="20" rx="2" class="nf-tip"/>
                    <path d="M112 30 v12 M116 30 v12" class="nf-pins"/>
                    <rect x="70" y="14" width="14" height="8" rx="2" class="nf-latch"/>
                </g>
                <g>
                    <rect x="150" y="14" width="86" height="44" rx="8" class="nf-port"/>
                    <rect x="158" y="24" width="30" height="24" rx="3" class="nf-socket"/>
                    <circle cx="214" cy="26" r="4" class="nf-led"/>
                    <text x="206" y="48" class="nf-label">LINK</text>
                </g>
            </svg>
        {/if}

        <div class="nf-actions">
            <a href="/" class="btn btn-primary-cyber">Back to the home page <i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a>
            <a href="/looking-glass.html" class="btn btn-outline-info">Try the looking glass</a>
        </div>

        <nav class="nf-links" aria-label="Popular pages">
            <h2>Or try one of these</h2>
            <ul>{#each links as l (l.href)}<li><a href={l.href}>{l.label}</a></li>{/each}</ul>
        </nav>
    </div>
</main>


<style>
    .nf { padding: 72px 0 96px; }
    .nf-wrap { max-width: 760px; }
    h1 { margin: 0 0 16px; }
    .nf-lead { max-width: 34rem; margin-bottom: 32px; }

    .nf-card { background: var(--nq-s1); border: 1px solid var(--nq-line-2); border-radius: 14px; padding: 20px 24px; font-family: var(--nq-mono); font-size: .875rem; line-height: 1.5; overflow-x: auto; }
    .nf-cmd { margin: 0 0 12px; color: var(--nq-ink); white-space: nowrap; }
    .nf-cmd span { color: var(--nq-accent-t); margin-right: 8px; }
    .nf-hops { list-style: none; margin: 0; padding: 0; }
    .nf-hop { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; gap: 16px; padding: 4px 0; color: var(--nq-ink-2); animation: nf-in .35s var(--nq-ease) both; animation-delay: calc(var(--i) * 420ms + 300ms); }
    .nf-n { color: var(--nq-ink-3); text-align: right; }
    .nf-who { overflow-wrap: anywhere; }
    .nf-st { color: var(--nq-ink-3); white-space: nowrap; }
    .nf-ok .nf-st { color: var(--nq-ok); }
    .nf-reached .nf-who { color: var(--nq-ink); }
    .nf-reached .nf-st { color: var(--nq-accent-t); }
    .nf-no-route .nf-who { color: var(--nq-ink); }
    .nf-no-route .nf-st { color: #e8907f; }
    .nf-stars { color: var(--nq-ink-3); }
    .nf-cursor { display: inline-block; width: 8px; height: 1em; margin-left: 6px; vertical-align: -2px; background: var(--nq-ink-2); animation: nf-blink 1.1s steps(1) infinite; animation-delay: 3s; }
    .nf-note { margin: 14px 0 0; padding-top: 12px; border-top: 1px solid var(--nq-line); font-family: var(--nq-body); font-size: .8125rem; color: var(--nq-ink-3); }

    .nf-cable { display: block; margin: 36px 0 8px; max-width: 100%; height: auto; }
    .nf-wire { stroke: var(--nq-ink-3); stroke-width: 6; stroke-linecap: round; fill: none; }
    .nf-body { fill: var(--nq-s3); stroke: var(--nq-line-2); }
    .nf-tip { fill: var(--nq-ink-3); }
    .nf-pins { stroke: var(--nq-s1); stroke-width: 2; stroke-linecap: round; }
    .nf-latch { fill: var(--nq-s2); stroke: var(--nq-line-2); }
    .nf-port { fill: var(--nq-s2); stroke: var(--nq-line-2); }
    .nf-socket { fill: var(--nq-bg); stroke: var(--nq-line-2); }
    .nf-led { fill: #e8907f; animation: nf-led 2.4s ease-in-out infinite; }
    .nf-label { font: 500 8px var(--nq-mono); fill: var(--nq-ink-3); }
    .nf-plug { animation: nf-nudge 3.6s var(--nq-ease) infinite; }

    .nf-actions { display: flex; flex-wrap: wrap; gap: 12px; margin: 32px 0 40px; }
    .nf-links h2 { margin: 0 0 12px; font: 500 .75rem var(--nq-mono); color: var(--nq-ink-3); text-transform: none; letter-spacing: 0; }
    .nf-links ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 20px; }
    .nf-links a { color: var(--nq-ink-2); text-decoration: none; border-bottom: 1px solid var(--nq-line-2); }
    .nf-links a:hover { color: var(--nq-ink); border-color: var(--nq-accent); }

    @keyframes nf-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    @keyframes nf-blink { 50% { opacity: 0; } }
    @keyframes nf-led { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
    @keyframes nf-nudge { 0%, 55%, 100% { transform: translateX(0); } 70% { transform: translateX(22px); } 78% { transform: translateX(14px); } 88% { transform: translateX(0); } }
    @media (prefers-reduced-motion: reduce) {
        .nf-hop, .nf-cursor, .nf-led, .nf-plug { animation: none; }
    }
    @media (max-width: 575.98px) { .nf { padding: 48px 0 72px; } .nf-card { padding: 16px; font-size: .8125rem; } .nf-hop { gap: 10px; } }
</style>
