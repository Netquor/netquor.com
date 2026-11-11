// intentional.ts: the baseline is the hand-written site as it was in tag legacy-baseline-2026-11. Content has been changed on purpose since then.
// Each such change is recorded here ONCE, as a named, dated patch of the baseline HTML with its reason, so that parity, the visual diff and the
// browser scenarios keep comparing the app with "the baseline plus the changes we decided on" and stay strict about everything else.
// Rules: a patch is idempotent, touches only what the decision changed, and mirrors the markup the Svelte page now renders. When changes pile
// up, cut a new baseline tag instead of adding patches forever.

export interface IntentionalChange { id: string; since: string; reason: string; apply(html: string): string }

const TOLL = "+1 (888) 717-1701";
const LOCAL = "+1 (701) 960-1701";
const TEL_TOLL = "tel:+18887171701";
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TEL_LOCAL = "tel:+17019601701";

/** 2026-11-11: the 888 number is shown as "Toll-free", and the new local number (701) 960-1701 is listed wherever contact numbers are offered (footer, home contact block, call buttons, structured data, the FAQ answer). */
export const contactNumbers: IntentionalChange = {
    id: "contact-numbers",
    since: "2026-11-11",
    reason: "the 888 number is labeled toll-free and the local number +1 (701) 960-1701 was added",
    apply(html) {
        let h = html;
        // site footer (home page): two lines, separated by <br>
        h = h.replace(`<br><a href="${TEL_TOLL}">${TOLL}</a></p>`, `<br><a href="${TEL_TOLL}">Toll-free ${TOLL}</a><br><a href="${TEL_LOCAL}">Local ${LOCAL}</a></p>`);
        // home page contact block: an icon link per number
        h = h.replace(`<a href="${TEL_TOLL}" class="nq-contact-link"><i class="bi bi-telephone" aria-hidden="true"></i><span>${TOLL}</span></a>`, `<a href="${TEL_TOLL}" class="nq-contact-link"><i class="bi bi-telephone" aria-hidden="true"></i><span>Toll-free ${TOLL}</span></a>\n                    <a href="${TEL_LOCAL}" class="nq-contact-link"><i class="bi bi-telephone" aria-hidden="true"></i><span>Local ${LOCAL}</span></a>`);
        // call buttons (vpn, sdn, network, home assistant): a second button for the local number
        h = h.replace(`<a class="btn btn-outline-info btn-lg rounded-pill px-4" href="${TEL_TOLL}">${TOLL}</a>`, `<a class="btn btn-outline-info btn-lg rounded-pill px-4" href="${TEL_TOLL}">Toll-free ${TOLL}</a>\n                    <a class="btn btn-outline-info btn-lg rounded-pill px-4" href="${TEL_LOCAL}">Local ${LOCAL}</a>`);
        // Netquor Central call button
        h = h.replace(`<a href="${TEL_TOLL}" class="btn btn-outline-info btn-lg">Call ${TOLL}</a>`, `<a href="${TEL_TOLL}" class="btn btn-outline-info btn-lg">Call toll-free ${TOLL}</a>\n                    <a href="${TEL_LOCAL}" class="btn btn-outline-info btn-lg">Call local ${LOCAL}</a>`);
        // the SDN FAQ sentence
        h = h.replace(`or call <a href="${TEL_TOLL}">${TOLL}</a>.`, `or call <a href="${TEL_TOLL}">toll-free ${TOLL}</a> or <a href="${TEL_LOCAL}">locally at ${LOCAL}</a>.`);
        // every other plain number link (program pages and similar) only gets the label
        h = h.replace(new RegExp(`(href="${esc(TEL_TOLL)}"[^>]*>)${esc(TOLL)}</a>`, "g"), `$1Toll-free ${TOLL}</a>`);
        // structured data: both numbers, toll-free first
        h = h.replaceAll(`"telephone": "+1-888-717-1701"`, `"telephone": ["+1-888-717-1701", "+1-701-960-1701"]`);
        return h;
    },
};

/** 2026-11-11: the new local page /fargo-moorhead.html is linked from the site footer and from the home page's local section. */
export const localPageLinks: IntentionalChange = {
    id: "local-page-links",
    since: "2026-11-11",
    reason: "the Fargo-Moorhead page was added and is linked from the footer and the home page",
    apply(html) {
        if (html.includes(`fargo-moorhead.html`)) return html; // already applied
        let h = html.replaceAll(`<a href="startups.html">For startups</a>`, `<a href="fargo-moorhead.html">Fargo-Moorhead</a>\n                    <a href="startups.html">For startups</a>`);
        h = h.replace(`and remotely anywhere in the Midwest.</p>`, `and remotely anywhere in the Midwest.</p>\n        <p class="small"><a href="/fargo-moorhead.html">Fargo-Moorhead: what we do here, and who sells business internet in the area</a></p>`);
        return h;
    },
};

/** Every recorded change, oldest first. */
export const INTENTIONAL_CHANGES: readonly IntentionalChange[] = [contactNumbers, localPageLinks];

/** The baseline page with every recorded decision applied. */
export const applyIntentionalChanges = (html: string): string => INTENTIONAL_CHANGES.reduce((h, c) => c.apply(h), html);

/** The baseline's llms.txt with the decided changes applied: both contact numbers, and the Local section for /fargo-moorhead.html. The text comes from llms.template.txt, so it must be the same words (the server test compares the rendered template with this). */
export const applyIntentionalLlms = (txt: string): string => {
    let t = txt.replace(`Contact: hello@netquor.com, ${TOLL}.`, `Contact: hello@netquor.com, toll-free ${TOLL}, local ${LOCAL}.`);
    if (!t.includes("fargo-moorhead.html")) t = t.replace("## Programs\n", LLMS_LOCAL + "## Programs\n");
    return t;
};
const LLMS_LOCAL = `## Local
- [Business networking and IT in Fargo-Moorhead](https://www.netquor.com/fargo-moorhead.html): What Netquor does for businesses in Fargo, West Fargo, Moorhead and the Midwest (network design on Ubiquiti UniFi and VyOS, Apple device management, VPN), what it does not do (Netquor does not sell a last-mile internet connection), and a dated, sourced list of the business internet providers that publish Fargo-Moorhead service, read from each provider's own page on November 11, 2026.

`;
