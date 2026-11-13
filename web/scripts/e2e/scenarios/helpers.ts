// helpers.ts: small things the scenarios share.
import type { Page } from "../browser";
import type { Observed } from "../observe";

/** Throws with a message when the condition is false. */
export const must = (cond: unknown, msg: string): void => { if (!cond) throw new Error(msg); };

export const el = (o: Observed, selector: string, i = 0) => {
    const g = o.elements[selector];
    must(g, `selector ${selector} was not observed`);
    return g.items[i];
};
export const count = (o: Observed, selector: string): number => o.elements[selector]?.count ?? -1;
export const has = (o: Observed, selector: string, cls: string, i = 0): boolean => !!el(o, selector, i)?.classes.includes(cls);
export const attr = (o: Observed, selector: string, name: string, i = 0): string | undefined => el(o, selector, i)?.attrs[name];

/** Waits for the page's own scripts: nav.js ran (html.nq-js), whatever else is named runs after hydration on the Svelte side. */
export const navReady = (page: Page) => page.waitFor(() => document.documentElement.classList.contains("nq-js") && !!document.querySelector(".nq-nav"));
