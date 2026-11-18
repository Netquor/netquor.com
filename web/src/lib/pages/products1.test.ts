// Route-level tests for sdn.html, network.html and vpn.html: each route renders on the server with the page data the layout hands it (prices from the cache), and the prices, head and JSON-LD follow the cache.
import { describe, expect, test } from "bun:test";
import { assetVersions } from "../assets";
import { renderSvelte } from "../server/svelteHarness";
import { snap } from "../server/testkit";

const assets = assetVersions((f) => `h-${f.replace(/\W/g, "")}`);
const pricesOf = (cents: Record<string, number>) => snap(3, cents).prices;
const data = (cents: Record<string, number>) => ({ assets, origin: "https://www.netquor.com", prices: pricesOf(cents), priceVersion: 3 });
// Hydration markers (<!--[-->, <!---->) are not part of what a visitor gets, drop them before asserting on markup.
const render = async (route: string, cents: Record<string, number> = {}) => {
    const out = await renderSvelte(`routes/(site)/${route}/+page.svelte`, { data: data(cents) }, data(cents), `http://localhost/${route}`);
    return { body: out.body.replace(/<!--.*?-->/g, ""), head: out.head.replace(/<!--.*?-->/g, "") };
};
const ldOf = (head: string): any => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(head)![1]);

const VPN = { "vpn.from.month": 700, "vpn.lite.month": 700, "vpn.plus.month": 1250, "vpn.fast.month": 2000, "vpn.gigabit.month": 3000, "network.from.month": 649 };

describe("sdn.html", () => {
    test("renders the hero, nine feature cards, the FAQ and its own footer", async () => {
        const { body, head } = await render("sdn.html");
        expect(body).toContain("Software-defined networking for");
        expect(body.match(/class="feature-card"/g)).toHaveLength(9);
        expect(body.match(/data-bs-toggle="collapse"/g)).toHaveLength(8);
        expect(body).toContain('id="f7"');
        expect(body.match(/<footer/g)).toHaveLength(1);
        expect(head).toContain("<title>Netquor SDN: Ubiquiti, VyOS, Cloud &amp; Converged Infrastructure | Fargo, ND</title>");
    });
    test("the FAQPage JSON-LD is the visible FAQ", async () => {
        const { head } = await render("sdn.html");
        const faq = ldOf(head)["@graph"].find((n: any) => n["@type"] === "FAQPage");
        expect(faq.mainEntity).toHaveLength(8);
        expect(faq.mainEntity[0].name).toBe("What is Netquor SDN?");
    });
});

describe("vpn.html", () => {
    test("plan prices, the badge, title and description follow the price cache", async () => {
        const { body, head } = await render("vpn.html", VPN);
        expect(body).toContain('<span data-price="vpn.plus.month" data-fmt="usd0">$12.50</span>');
        expect(body).toContain('data-price="vpn.from.month" data-fmt="usd0">$7</span>/mo');
        expect(head).toContain("<title>Netquor VPN: Local WireGuard VPN from $7/mo | Fargo, ND</title>");
        expect(head).toContain("From $7 a month for 25/25 Mbps");
        expect(body).toContain('data-price="network.from.month" data-fmt="usd0">$6.49</span> a month');
    });
    test("the JSON-LD offers carry the cache prices as strings", async () => {
        const { head } = await render("vpn.html", VPN);
        const offers = ldOf(head)["@graph"][1].offers;
        expect(offers.map((o: any) => o.price)).toEqual(["7", "12.50", "20", "30"]);
    });
    test("four plan cards, the third marked popular, six questions", async () => {
        const { body } = await render("vpn.html", VPN);
        expect(body.match(/feature-card tier/g)).toHaveLength(4);
        expect(body).toContain("feature-card tier pop");
        expect(body.match(/data-bs-toggle="collapse"/g)).toHaveLength(6);
    });
});

describe("network.html", () => {
    const NET = { "network.homelab.month": 649, "network.startup.month": 3999, "network.from.month": 649, "network.addon_ipv4.month": 400, "network.addon_location.month": 900, "network.addon_tunnel.month": 400, "network.addon_volume_tb.month": 200, "network.addon_anycast.month": 1200, "network.addon_ipv6_48.month": 300, "network.addon_byo_prefix.month": 1500, "network.addon_gateway.month": 1000 };
    test("plan cards and the FAQ price follow the cache; Business stays the literal price", async () => {
        const { body } = await render("network.html", NET);
        expect(body).toContain('data-price="network.startup.month" data-fmt="usd0">$39.99</span>');
        expect(body).toContain('<span class="display-5 fw-black">$129.49</span>');
        expect(body).toContain('Plans start at <span data-price="network.from.month" data-fmt="usd0">$6.49</span> a month. Homelab and Startup are fixed prices, Business starts at $99');
    });
    test("the builder is server rendered as the legacy page was before its script ran, with the same ids", async () => {
        const { body } = await render("network.html", NET);
        expect(body).toContain('<div class="d-grid gap-2" id="tiles"></div>');
        expect(body).toContain('<div class="stack" id="stack" aria-live="polite"></div>');
        expect(body).toContain('id="total">$0</span>');
        for (const id of ["seg-plan", "seg-bill", "summary", "hint", "quote", "note", "per"]) expect(body).toContain(`id="${id}"`);
        expect(body).toContain('aria-pressed="true">Startup</button>');
    });
    test("the no-script add-on sentence uses the cache", async () => {
        const { body } = await render("network.html", NET);
        expect(body).toContain('extra IPv4 <span data-price="network.addon_ipv4.month" data-fmt="usd0">$4</span>, location');
    });
    test("Twitter text differs from the Open Graph text, as on the legacy page", async () => {
        const { head } = await render("network.html", NET);
        expect(head).toContain('name="twitter:description" content="Routable IP space and anycast for distributed applications and workers, delivered over WireGuard tunnels."');
        expect(head).toContain('property="og:description" content="Routable IP space and anycast for distributed applications and workers, delivered over WireGuard tunnels, from Chicago');
    });
});
