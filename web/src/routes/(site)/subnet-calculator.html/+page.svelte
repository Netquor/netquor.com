<script lang="ts">
    // Pilot of the Svelte migration: /subnet-calculator.html, same URL, same metadata and same visible text as the legacy page. The maths is the existing pure module subnet-calc.js, loaded unchanged (it sets window.NQSubnet) and used as an island: the server renders the page with empty results (as the legacy page does before its script runs), and the browser fills them in after hydration.
    import { onMount } from "svelte";
    import Price from "#lib/components/Price.svelte";
    import Seo from "#lib/components/Seo.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    interface V4 { error?: string; network: string; prefix: number; netmask: string; wildcard: string; broadcast: string; first: string; last: string; usable: number; total: number; kind: string; point2point?: boolean; host?: boolean; _net: number }
    interface Split { count: number; rows: { cidr: string; first: string; last: string; usable: number }[] }
    interface Engine { calcV4(input: string): V4; splitV4(net: number, prefix: number, to: number): Split; calcV6(prefix: string): { error?: string; prefix: number; lans: bigint } }

    const num = (n: number | bigint) => n.toLocaleString("en-US");

    let engine = $state<Engine | null>(null);
    let v4 = $state("192.168.1.0/24");
    let v6 = $state("56");
    let picked = $state<{ base: number; to: number } | null>(null);

    onMount(() => { engine = (window as unknown as { NQSubnet?: Engine }).NQSubnet ?? null; });

    const r4 = $derived(engine ? engine.calcV4(v4) : null);
    const ok4 = $derived(r4 && !r4.error ? r4 : null);
    const rows = $derived(ok4 ? ([
        ["Network", `${ok4.network}/${ok4.prefix}`], ["Netmask", ok4.netmask], ["Wildcard", ok4.wildcard],
        ["Broadcast", ok4.broadcast], ["First host", ok4.first], ["Last host", ok4.last],
        ["Usable hosts", num(ok4.usable)], ["Total addresses", num(ok4.total)], ["Type", ok4.kind],
    ] as [string, string][]) : []);
    const note = $derived(ok4 ? (ok4.host ? "A /32 is a single host address." : ok4.point2point ? "/31 networks have no network or broadcast address and are used for point-to-point links (RFC 3021)." : "") : "");
    // The prefixes to split into: up to eight longer, never past /32. Like the legacy script, every calculation (typing, Calculate, Enter) rebuilds the list and selects the first prefix, so the choice only lasts until the next calculation.
    const options = $derived(ok4 ? Array.from({ length: Math.max(0, Math.min(ok4.prefix + 8, 32) - ok4.prefix) }, (_, i) => ok4.prefix + 1 + i) : []);
    const splitTo = $derived(ok4 ? (picked && picked.base === ok4.prefix && options.includes(picked.to) ? picked.to : ok4.prefix + 1) : 0);
    const split = $derived(engine && ok4 && ok4.prefix < 32 ? engine.splitV4(ok4._net, ok4.prefix, splitTo) : null);
    const r6 = $derived(engine ? engine.calcV6(v6) : null);
    const v6text = $derived(!r6 ? "" : r6.error ? r6.error : r6.lans === 0n ? `A /${r6.prefix} is smaller than one standard /64 LAN.` : `A /${r6.prefix} holds ${num(r6.lans)} separate /64 networks, one per LAN or VLAN.`);

    const jsonLd = {
        "@context": "https://schema.org", "@type": "WebApplication", name: "Netquor Subnet Calculator",
        url: "https://www.netquor.com/subnet-calculator.html", applicationCategory: "UtilitiesApplication", operatingSystem: "Any (runs in the browser)",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@type": "Organization", name: "Netquor Technologies LLC", url: "https://www.netquor.com/" },
        description: "IPv4 CIDR subnet calculator with subnet splitting and IPv6 /64 network counts.",
    };
</script>

<Seo
    origin={data.origin}
    canonical="/subnet-calculator.html"
    title="Free Subnet Calculator: IPv4 CIDR and IPv6 /64 Counts | Netquor"
    description="Free subnet calculator for homelabs and small offices. Enter an IPv4 address with a CIDR prefix or netmask to get the network, broadcast, host range and usable hosts, split it into smaller subnets, and count the /64 networks in an IPv6 prefix."
    ogTitle="Free Subnet Calculator | Netquor"
    ogDescription="IPv4 CIDR calculator with subnet splitting and IPv6 /64 counts. The calculations run in your browser; the addresses you enter are not sent anywhere."
    {jsonLd}
/>
<svelte:head>
    <script src={`/subnet-calc.js?v=${data.assets.subnet}`}></script>
</svelte:head>


<header class="hero-section" style="padding-bottom: 32px;">
    <div class="container" style="max-width: 900px;">
        <p class="nq-eyebrow">Free tool</p>
        <h1 class="mb-3">Subnet calculator</h1>
        <p class="lead text-muted mb-0">Enter an IPv4 address with a prefix or netmask. See the network, host range and usable hosts, split it into smaller subnets, and count the /64 networks in an IPv6 prefix. The calculations run in your browser, and the addresses you enter are not sent to us.</p>
    </div>
</header>

<section class="pb-5">
    <div class="container" style="max-width: 900px;">
        <div class="calc-card mb-4">
            <label class="form-label" for="v4">IPv4 address and prefix</label>
            <div class="d-flex flex-wrap gap-2">
                <input id="v4" class="form-control calc-input" style="flex: 1 1 260px;" bind:value={v4} oninput={() => (picked = null)} onkeydown={(e) => { if (e.key === "Enter") picked = null; }} inputmode="text" autocomplete="off" spellcheck="false" aria-describedby="v4err">
                <button id="v4go" class="btn btn-primary-cyber" type="button" onclick={() => { picked = null; v4 = v4.trim(); }}>Calculate</button>
            </div>
            <p id="v4err" class="calc-err mt-2 mb-3" aria-live="polite">{r4?.error ?? ""}</p>
            <dl id="v4out" class="calc-grid mb-0" hidden={!ok4}>
                {#each rows as [label, value] (label)}
                    <div><dt>{label}</dt><dd>{value}</dd></div>
                {/each}
            </dl>
            <p id="v4note" class="calc-note mt-3 mb-0">{note}</p>
        </div>

        <div class="calc-card mb-4" id="splitcard" hidden={!split}>
            <h2 class="h5 mb-3">Split into smaller subnets</h2>
            <div class="d-flex align-items-center gap-3 flex-wrap mb-3">
                <label class="form-label mb-0" for="splitto">New prefix</label>
                <select id="splitto" class="form-select" style="width: auto;" value={splitTo} onchange={(e) => { if (ok4) picked = { base: ok4.prefix, to: Number(e.currentTarget.value) }; }}>
                    {#each options as q (q)}<option value={q}>/{q}</option>{/each}
                </select>
                <span id="splitcount" class="calc-note">{split ? `${num(split.count)} subnets of ${num(split.rows[0] ? split.rows[0].usable : 0)} usable hosts each` : ""}</span>
            </div>
            <div class="table-responsive"><table class="calc-table"><thead><tr><th>Subnet</th><th>First host</th><th>Last host</th><th>Usable</th></tr></thead><tbody id="splitrows">
                {#each split?.rows ?? [] as x (x.cidr)}
                    <tr><td>{x.cidr}</td><td>{x.first}</td><td>{x.last}</td><td>{num(x.usable)}</td></tr>
                {/each}
            </tbody></table></div>
            <p id="splitmore" class="calc-note mt-3 mb-0">{split && split.count > 64 ? `Showing the first 64 of ${num(split.count)} subnets.` : ""}</p>
        </div>

        <div class="calc-card mb-5">
            <h2 class="h5 mb-3">IPv6: how many LANs fit in a prefix</h2>
            <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                <label class="form-label mb-0" for="v6">Prefix length</label>
                <span class="calc-input">/</span>
                <input id="v6" class="form-control calc-input" style="width: 6rem;" bind:value={v6} inputmode="numeric" autocomplete="off" aria-describedby="v6out">
            </div>
            <p id="v6out" class="calc-note mb-0" aria-live="polite">{v6text}</p>
        </div>

        <div class="calc-card">
            <h2 class="h5 mb-2">A public, routable block for your lab</h2>
            <p class="calc-note mb-3">Netquor Network Solutions gives you a routable IPv4 address and an IPv6 /56 over WireGuard, from our own network (AS403008). It starts at <Price key="network.from.month" fmt="usd" /> a month, month to month, and is half price for students.</p>
            <a href="/network.html#pricing" class="btn btn-primary-cyber">See Network Solutions pricing</a>
        </div>
    </div>
</section>


<style>
    .calc-card { background: var(--nq-s1); border: 1px solid var(--nq-line); border-radius: 16px; padding: 24px; }
    .calc-input { font-family: var(--nq-mono); font-size: 1.0625rem; }
    .calc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1px; background: var(--nq-line); border: 1px solid var(--nq-line); border-radius: 12px; overflow: hidden; }
    .calc-grid > div { background: var(--nq-s1); padding: 14px 16px; }
    .calc-grid dt { font: 400 .75rem var(--nq-mono); color: var(--nq-ink-3); margin: 0 0 4px; }
    .calc-grid dd { margin: 0; font: 500 1.0625rem var(--nq-mono); color: var(--nq-ink); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
    .calc-note { color: var(--nq-ink-2); font-size: .9375rem; }
    .calc-err { color: #f0907f; font-size: .9375rem; min-height: 1.5em; }
    .calc-table { width: 100%; font: 400 .875rem var(--nq-mono); font-variant-numeric: tabular-nums; }
    .calc-table th { color: var(--nq-ink-3); font-weight: 400; padding: 8px 12px 8px 0; border-bottom: 1px solid var(--nq-line); }
    .calc-table td { padding: 8px 12px 8px 0; border-bottom: 1px solid var(--nq-line); color: var(--nq-ink-2); }
    .calc-table td:first-child { color: var(--nq-ink); }
</style>
