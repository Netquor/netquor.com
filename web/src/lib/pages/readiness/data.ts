// readiness.html: the four checklists. The source is the repository's readiness-data.json (also what readiness.js was generated from); it is read at build time and not copied, so the questions, titles and icons have one source. readiness.js (loaded unchanged) holds the scoring and the "what to look at next" text and fills the result boxes in the browser.
import raw from "../../../../../readiness-data.json";

/** A question: [the statement answered Yes or Not yet, the gap's title, the gap's advice, where "Read more" goes]. Only the statement is rendered here; the rest is readiness.js's. */
export type Question = readonly [string, string, string, string];

export interface Checklist {
    key: string;
    title: string;
    /** The line under the title. */
    sub: string;
    /** A Bootstrap Icons class, "bi-laptop". */
    icon: string;
    intro: string;
    qs: readonly Question[];
    cta: readonly [string, string];
    calc: readonly [string, string];
}

/** The order the legacy page shows them in. */
export const ORDER = ["devices", "calls", "network", "people"] as const;

const data = raw as unknown as Record<string, Checklist>;

export const CHECKLISTS: readonly Checklist[] = ORDER.map((k) => data[k]);
