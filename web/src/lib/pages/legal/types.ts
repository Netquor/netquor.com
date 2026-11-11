// The data shape of a legal page (terms.html, privacy.html): the same card with a heading, a "Last Updated" line, optional intro box and a list of blocks. Strings of kind "html" are trusted static copy from the page's data.ts.
export type LegalBlock =
    | { k: "h3"; t: string }
    | { k: "p"; t: string }
    | { k: "html"; t: string }
    | { k: "ul"; items: readonly string[] };

export interface LegalPageData {
    meta: { title: string };
    /** terms-card or policy-card: the class the page's own CSS styles. */
    cardClass: string;
    /** Bootstrap Icons class of the heading icon. */
    icon: string;
    subtitle: string;
    updated: string;
    /** Text of the highlight box above the first heading, or null. */
    intro: string | null;
    /** The page's own <style> block, kept where the legacy page has it (in the body, before the card). */
    css: string;
    blocks: readonly LegalBlock[];
}
