// intentional.ts: the baseline is the hand-written site as it was in tag legacy-baseline-2026-11. Content has been changed on purpose since then.
// Each such change is recorded here ONCE, as a named, dated patch of the baseline HTML with its reason, so that parity, the visual diff and the
// browser scenarios keep comparing the app with "the baseline plus the changes we decided on" and stay strict about everything else.
// Rules: a patch is idempotent, touches only what the decision changed, and mirrors the markup the Svelte page now renders. When changes pile
// up, cut a new baseline tag instead of adding patches forever.

import { blocksHtml, SMS_HEADING_PRIVACY, SMS_HEADING_TERMS, smsPrivacy, smsProgram, webchatPrivacy } from "../../src/lib/pages/legal/sms";
import { WEBCHAT_SRC } from "../../src/lib/webchat";

export interface IntentionalChange { id: string; since: string; reason: string; apply(html: string): string }

const TOLL = "+1 (888) 717-1701";
const LOCAL = "+1 (701) 960-1701";
const TEL_TOLL = "tel:+18887171701";
const TEL_LOCAL = "tel:+17019601701";

/** 2026-11-11: the footer shows both numbers, labeled "Toll-free" and "Local", and the structured data lists both. Everywhere else (contact blocks, call buttons, the FAQ) the one toll-free number stays as the baseline has it. */
export const contactNumbers: IntentionalChange = {
    id: "contact-numbers",
    since: "2026-11-11",
    reason: "the footer lists the toll-free and the new local number, labeled, and the structured data lists both",
    apply(html) {
        let h = html;
        // site footer: two lines, separated by <br>
        h = h.replace(`<br><a href="${TEL_TOLL}">${TOLL}</a></p>`, `<br><a href="${TEL_TOLL}">Toll-free ${TOLL}</a><br><a href="${TEL_LOCAL}">Local ${LOCAL}</a></p>`);
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

/** 2026-11-11: the new looking glass page is linked from the footer and from the Network Solutions locations section. */
export const lookingGlassLinks: IntentionalChange = {
    id: "looking-glass-links",
    since: "2026-11-11",
    reason: "the looking glass page was added and is linked from the footer and from network.html",
    apply(html) {
        if (html.includes("looking-glass.html")) return html;
        let h = html.replaceAll(`<a href="subnet-calculator.html">Subnet calculator</a>`, `<a href="subnet-calculator.html">Subnet calculator</a>\n                    <a href="looking-glass.html">Looking glass</a>`);
        h = h.replace(`We add capacity where customers need it.</p>`, `We add capacity where customers need it. See how the network looks from the inside in our <a href="/looking-glass.html">public looking glass</a>.</p>`);
        return h;
    },
};

/** 2026-11-11: in the simple footer the links sit on their own line under the copyright instead of running on after it. */
export const footerLinksBelow: IntentionalChange = {
    id: "footer-links-below-copyright",
    since: "2026-11-11",
    reason: "the simple footer's links were cramped on the copyright line; they now sit under it",
    apply: (html) => html.replaceAll(`Netquor Technologies LLC. <a href="index.html"`, `Netquor Technologies LLC.<br><a href="index.html"`),
};

/** 2026-11-11: Terms of Use and Privacy Policy carry the netquor emblem instead of an icon, and the text-messaging program language (Terms section 13, Privacy section 11) for the toll-free number's carrier registration, with new "Last Updated" dates. */
export const legalPages: IntentionalChange = {
    id: "legal-sms-and-logo",
    since: "2026-11-11",
    reason: "the legal pages show the logo, and carry the text messaging program terms the toll-free registration needs",
    apply(html) {
        if (html.includes(SMS_HEADING_TERMS) || html.includes(SMS_HEADING_PRIVACY)) return html;
        const logo = `<img src="/brand/nq-emblem.svg" alt="" width="48" height="48" class="me-3">`;
        let h = html.replace(`<i class="bi bi-shield-check fs-2 text-primary me-3"></i>`, logo).replace(`<i class="bi bi-shield-lock fs-2 text-primary me-3"></i>`, logo);
        h = h.replace("Last Updated: January 27, 2026", "Last Updated: November 11, 2026").replace("Last Updated: March 24, 2026", "Last Updated: November 13, 2026");
        h = h.replace(/(located\s+in\s+Fargo,\s+North\s+Dakota\.\s*<\/p>)/, (m) => `${m}\n${blocksHtml(SMS_HEADING_TERMS, smsProgram)}`);
        h = h.replace(`<h3>Changes to This Policy</h3>`, () => `${blocksHtml(SMS_HEADING_PRIVACY, smsPrivacy)}\n<h3>Changes to This Policy</h3>`);
        return h;
    },
};

/** 2026-11-13: every page loads the web chat widget (NQ Phone web chat from Netquor's PBX host), and the Privacy Policy says what it stores. */
export const webChat: IntentionalChange = {
    id: "web-chat-widget",
    since: "2026-11-13",
    reason: "the site embeds Netquor's web chat widget on every page and the Privacy Policy describes it",
    apply(html) {
        if (html.includes("/webchat/widget.js")) return html;
        let h = html.replace("</head>", () => `<script src="${WEBCHAT_SRC}" async></script>\n</head>`);
        h = h.replace(/(browser's\s+cookie\s+settings\.\s*<\/p>)/, (m) => `${m}\n${blocksHtml("", [webchatPrivacy]).split("\n").slice(1).join("\n")}`);
        return h;
    },
};

/** Every recorded change, oldest first. */
export const INTENTIONAL_CHANGES: readonly IntentionalChange[] = [contactNumbers, localPageLinks, lookingGlassLinks, footerLinksBelow, legalPages, webChat];

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
- [Looking glass](https://www.netquor.com/looking-glass.html): A free, read-only looking glass for Netquor's network (AS403008): BGP route, route lookup, ping, traceroute and BGP summary, run live from Netquor's routers, with no sign-in.

`;
