// The data shape of a program page (startups, referrals, partners). The copy lives in each page's data.ts; ProgramPage.svelte draws it. Strings marked html are trusted static copy written in data.ts (links, <b>, <br>), never visitor input.

/** Same shape as the Faq component's items. */
export interface FaqItem { q: string; a: string; id?: string; open?: boolean }
export interface Action { href: string; label: string }
export interface Hero { eyebrow: string; title: string; lead: string; leadStyle?: string; primary: Action; secondary: Action; width: number }
export interface Role { title: string; have: readonly string[]; do: readonly string[] }
export interface Cta { title: string; text: string; action: Action; phone: Action }

export type Block =
    | { kind: "table"; head: readonly string[]; rows: readonly (readonly string[])[] }
    | { kind: "p"; cls: string; html: string }
    | { kind: "safe"; items: readonly { b: string; p: string }[] }
    | { kind: "steps"; items: readonly string[] }
    | { kind: "quote"; text: string }
    | { kind: "faq"; items: readonly FaqItem[] }
    | { kind: "roles"; roles: readonly Role[] }
    | { kind: "cta"; cta: Cta };

export interface Section {
    kind: "section";
    id?: string;
    style?: string;
    /** max-width of the container in px; undefined for a bare .container. */
    width?: number;
    head?: { eyebrow: string; title: string; lead?: string };
    blocks: readonly Block[];
}
export interface Rule { kind: "rule" }

export interface ProgramMeta { slug: string; title: string; description: string }
export interface ProgramPageData { meta: ProgramMeta; hero: Hero; items: readonly (Section | Rule)[] }
