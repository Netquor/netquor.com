<script lang="ts">
    // The site navigation, ported from tools/nav.html. It is deliberately static markup: nav.css styles it and nav.js (loaded by the layout) opens the menu and the Products dropdown by toggling classes, exactly as on the legacy pages. `static` adds nq-static (the nav scrolls with the page; fleet.html uses it). `current` is the path of the page being shown ("/subnet-calculator.html"), which marks its link.
    import Price from "./Price.svelte";

    let { current = "", static: isStatic = false }: { current?: string; static?: boolean } = $props();

    interface Item { href: string; icon?: string; img?: string; title: string; text: string; priceKey?: string; after?: string; external?: boolean }
    const columns: { label: string; items: Item[] }[] = [
        { label: "Business", items: [
            { href: "https://phone.netquor.com/", icon: "telephone", title: "Netquor Phone", text: "AI receptionist and business phone system. Early access" },
            { href: "/fleet.html", icon: "apple", title: "Netquor Fleet", text: "Apple device management for Mac, iPhone and iPad" },
            { href: "/sdn.html", icon: "diagram-3", title: "Netquor SDN", text: "Managed networking on Ubiquiti and VyOS" },
            { href: "/central.html", icon: "people", title: "Netquor Central", text: "People, groups, Gmail filters and sign-in. In development" },
        ] },
        { label: "Network and hosting", items: [
            { href: "/network.html", icon: "broadcast-pin", title: "Network Solutions", text: "Routable IPs and anycast on AS403008" },
            { href: "/vpn.html", icon: "shield-check", title: "Netquor VPN", text: "Local WireGuard VPN from ", priceKey: "vpn.from.month", after: " a month" },
            { href: "https://www.allsourcehosting.com/", img: "/allsource-icon.svg", title: "All Source Hosting", text: "Homelab hosting marketplace", external: true },
        ] },
        { label: "Home and building", items: [
            { href: "/homeassistant.html", icon: "house-gear", title: "Hosted Home Assistant", text: "Managed smart home with a bridge included" },
            { href: "/digitalaccess.html", icon: "door-open", title: "Digital Access", text: "Access control that keeps your door hardware" },
        ] },
    ];
    const foot: { href: string; icon: string; text: string }[] = [
        { href: "/#services", icon: "tools", text: "Engineering and field services" },
        { href: "/subnet-calculator.html", icon: "calculator", text: "Free subnet calculator" },
        { href: "/startups.html", icon: "rocket-takeoff", text: "For startups" },
        { href: "/referrals.html", icon: "gift", text: "Referrals" },
        { href: "/partners.html", icon: "person-workspace", text: "Partners and jobs" },
        { href: "/readiness.html", icon: "clipboard-check", text: "Readiness checklists" },
        { href: "/#pricing", icon: "tag", text: "All prices" },
        { href: "/compare.html", icon: "columns-gap", text: "How we compare" },
        { href: "/#bundles", icon: "boxes", text: "Bundles" },
    ];
    // Highlight the page's own entry, and "Products" when that entry is inside the dropdown.
    const inMenu = $derived([...columns.flatMap((c) => c.items), ...foot].some((i) => i.href === current));
    const here = (href: string) => (href === current ? "page" : undefined);
</script>

<nav class={["nq-nav", isStatic && "nq-static"]} aria-label="Main">
    <div class="nq-in">
        <a class="nq-brand" href="/"><img src="/brand/nq-emblem.svg" alt="" width="36" height="36"><span class="nq-sr">Netquor Technologies, home</span></a>
        <button class="nq-burger" type="button" aria-expanded="false" aria-controls="nq-menu" aria-label="Menu"><span></span><span></span><span></span></button>
        <div class="nq-menu" id="nq-menu">
            <ul class="nq-links">
                <li class="nq-dd">
                    <button class={["nq-link", "nq-dd-btn", inMenu && "is-current"]} type="button" aria-expanded="false" aria-haspopup="true">Products <svg class="nq-caret" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
                    <div class="nq-dd-menu nq-mega">
                        <div class="nq-mega-grid">
                            {#each columns as col (col.label)}
                                <div class="nq-col"><p class="nq-dd-label">{col.label}</p><ul>
                                    {#each col.items as it (it.href)}
                                        <li><a href={it.href} class={it.href === current ? "is-current" : undefined} aria-current={here(it.href)} target={it.external ? "_blank" : undefined} rel={it.external ? "noopener" : undefined}>{#if it.img}<img src={it.img} alt="" width="20" height="20">{:else}<i class={`bi bi-${it.icon}`} aria-hidden="true"></i>{/if}<span><b>{it.title}</b><small>{it.text}{#if it.priceKey}<Price key={it.priceKey} />{it.after}{/if}</small></span></a></li>
                                    {/each}
                                </ul></div>
                            {/each}
                        </div>
                        <div class="nq-mega-foot">
                            {#each foot as f (f.href)}
                                <a href={f.href} class={f.href === current ? "is-current" : undefined} aria-current={here(f.href)}><i class={`bi bi-${f.icon}`} aria-hidden="true"></i>{f.text}</a>{" "}
                            {/each}
                        </div>
                    </div>
                </li>
                <li><a class="nq-link" href="/#homelab">Homelab</a></li>
                <li><a class="nq-link" href="/#pricing">Pricing</a></li>
                <li><a class="nq-link" href="/#local">About</a></li>
            </ul>
            <div class="nq-cta">
                <a class="nq-signin" href="https://account.netquor.com/" target="_blank" rel="noopener">Sign in <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
                <a class="nq-btn" href="/#contact">Talk to us</a>
            </div>
        </div>
    </div>
</nav>
