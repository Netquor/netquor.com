// model.ts: the server-rendered state of an accordion (what the markup says before any script runs), as a pure function.

export interface AccordionItem {
    /** The panel id (the toggle's data-bs-target is `#id`). */
    id: string;
    /** The question; plain text, escaped by the template. */
    q: string;
    /** The answer; HTML, rendered unescaped (it comes from the site's own data files). */
    a: string;
    /** Open in the server-rendered markup. */
    open?: boolean;
}

export interface ItemView {
    id: string;
    q: string;
    a: string;
    open: boolean;
    /** `accordion-button` plus `collapsed` while closed (Bootstrap styles the closed arrow with it). */
    buttonClass: string;
    /** `accordion-collapse collapse` plus `show` while open. */
    panelClass: string;
    /** `"true"` / `"false"`, always present (Bootstrap omits it until first use). */
    ariaExpanded: "true" | "false";
}

/** Which items are open. With `exclusive` (data-bs-parent) at most one is: the first one marked open wins, as it would after the first transition. */
export const openIds = (items: readonly AccordionItem[], exclusive: boolean): Set<string> => {
    const ids = items.filter((i) => i.open).map((i) => i.id);
    return new Set(exclusive ? ids.slice(0, 1) : ids);
};

export const viewItems = (items: readonly AccordionItem[], exclusive = true): ItemView[] => {
    const open = openIds(items, exclusive);
    return items.map((i) => {
        const o = open.has(i.id);
        return {
            id: i.id,
            q: i.q,
            a: i.a,
            open: o,
            buttonClass: o ? "accordion-button" : "accordion-button collapsed",
            panelClass: o ? "accordion-collapse collapse show" : "accordion-collapse collapse",
            ariaExpanded: o ? "true" : "false",
        };
    });
};
