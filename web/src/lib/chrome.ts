// chrome.ts: what the (site) layout draws around a page, and how a page changes it. A page that is happy with the defaults says nothing. A page that wants something else returns `chrome` from its own load:
//   // src/routes/(site)/x.html/+page.ts
//   export const load = () => ({ chrome: { footer: "full" } });
export type FooterVariant = "full" | "simple" | "none";

export interface Chrome {
    /** Draw the site nav (default true). */
    nav?: boolean;
    /** The path whose nav entry is marked current. Default: the page's own path ("/index.html" counts as "/"). */
    navCurrent?: string;
    /** nq-static: the nav scrolls away with the page instead of sticking (fleet.html's own look). */
    navStatic?: boolean;
    /** "simple" is the one-line footer of the tool pages, "full" the homepage footer. Default "simple". */
    footer?: FooterVariant;
}

export interface ResolvedChrome { nav: boolean; navCurrent: string; navStatic: boolean; footer: FooterVariant }

const FOOTERS: readonly FooterVariant[] = ["full", "simple", "none"];

export const resolveChrome = (chrome: Chrome | undefined, pathname: string): ResolvedChrome => {
    const own = pathname === "/index.html" ? "/" : pathname;
    return {
        nav: chrome?.nav ?? true,
        navCurrent: chrome?.navCurrent ?? own,
        navStatic: chrome?.navStatic ?? false,
        footer: chrome?.footer && FOOTERS.includes(chrome.footer) ? chrome.footer : "simple",
    };
};
