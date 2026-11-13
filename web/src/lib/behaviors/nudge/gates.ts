// gates.ts: the pure rules of nudge.js: which page gets which prompt, and when the card may appear.
export interface Nudge { key: string; title: string; body: string }

const body = (what: string) => `See the ${what} checklist. Seven questions, about two minutes.`;

/** The legacy table, keyed by file name. The card links to readiness.html#<key>. */
export const NUDGES: Readonly<Record<string, Nudge>> = {
    "fleet.html": { key: "devices", title: "Looking at Netquor Fleet?", body: body("Apple device readiness") },
    "vpn.html": { key: "network", title: "Looking at remote access?", body: body("network and remote access") },
    "network.html": { key: "network", title: "Looking at routable IPs?", body: body("network and remote access") },
    "sdn.html": { key: "network", title: "Looking at managed networking?", body: body("network readiness") },
    "homeassistant.html": { key: "people", title: "Looking at a smarter building?", body: body("people and access") },
    "digitalaccess.html": { key: "people", title: "Looking at building access?", body: body("people and access") },
    "central.html": { key: "people", title: "Looking at Netquor Central?", body: body("people and access") },
};

/** The file name of a path, as nudge.js reads it: the last segment, or index.html for an empty one. */
export const pageOf = (pathname: string): string => pathname.split("/").pop() || "index.html";

/** The nudge for a page name ("vpn.html" or "/vpn.html"); null when the page has none. Own properties only. */
export const nudgeFor = (page: string): Nudge | null => {
    const name = pageOf(page);
    return Object.prototype.hasOwnProperty.call(NUDGES, name) ? NUDGES[name] : null;
};

export interface GateState { keyboard: boolean; ready: boolean; scrolled: boolean; shown: boolean }

/** The card shows once, when the timer fired and the page was scrolled, and never after a Tab key. */
export const readyToShow = (g: GateState): boolean => !(g.shown || !g.ready || !g.scrolled || g.keyboard);

/** Fraction of the document seen at the bottom of the viewport. */
export const scrollRatio = (scrollTop: number, innerHeight: number, scrollHeight: number): number => (scrollTop + innerHeight) / scrollHeight;
