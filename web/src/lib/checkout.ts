// checkout.ts: where a plan's button goes. One file, one map. A call to action is a "checkout" link into the Netquor Apps portal when its id is listed in CHECKOUT, and the mailto fallback written next to the plan otherwise. To turn another product or plan on once its checkout exists, add one line here (id: portal URL); to turn one off, delete the line. Nothing else changes: the pages read this map.
//
// Live today (portal order form, GET, signed-out visitors are sent to sign in or sign up and come back to the form): the four Hosted Home Assistant plans. Prices and fees are shown from the price cache, never from here. `&term=annual` is only accepted where an annual price exists, so it is not added.

const PORTAL = "https://account.netquor.com/order";

/** CTA id (product.plan) to the portal order URL. Absent means the mailto fallback. */
export const CHECKOUT: Readonly<Record<string, string>> = {
    "hosted-home-assistant.home": `${PORTAL}/home-assistant?plan=home`,
    "hosted-home-assistant.home-plus": `${PORTAL}/home-assistant?plan=home-plus`,
    "hosted-home-assistant.home-pro": `${PORTAL}/home-assistant?plan=home-pro`,
    "hosted-home-assistant.resilient": `${PORTAL}/home-assistant?plan=resilient`,
};

// A referral code the portal's order form keeps through sign-up. Only a plain code passes: letters, digits, dash and underscore. Anything else is dropped, so a crafted link cannot put text into a checkout link.
const REF = /^[A-Za-z0-9_-]{1,64}$/;
export const cleanRef = (v: string | null | undefined): string | null => (v && REF.test(v) ? v : null);

/** The checkout link for a CTA id, with `&ref=<code>` when the incoming page URL carried a valid `ref`; null when the id has no checkout (use the mailto). Same tab, so no rel is needed. */
export const checkoutHref = (id: string, ref?: string | null): string | null => {
    // own keys only, so ids like "constructor" or "__proto__" are never a checkout
    if (!Object.hasOwn(CHECKOUT, id)) return null;
    const base = CHECKOUT[id];
    const r = cleanRef(ref);
    return r ? `${base}${base.includes("?") ? "&" : "?"}ref=${encodeURIComponent(r)}` : base;
};
