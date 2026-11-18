// contact.ts: the one place for Netquor's phone numbers and email. Everything that shows or links a number (footers, contact blocks, call buttons,
// structured data, the AI agent facts) takes it from here; to change a number, change it here and nowhere else. Contact blocks and call buttons
// show only the toll-free number, unlabeled (MAIN); the footer shows both, labeled.
export const EMAIL = "hello@netquor.com";

export interface PhoneNumber {
    /** "Toll-free" or "Local". */
    label: string;
    /** As shown: +1 (888) 717-1701 */
    display: string;
    /** The tel: link. */
    href: string;
    /** For structured data (schema.org telephone): +1-888-717-1701 */
    schema: string;
}

export const TOLL_FREE: PhoneNumber = { label: "Toll-free", display: "+1 (888) 717-1701", href: "tel:+18887171701", schema: "+1-888-717-1701" };
export const LOCAL: PhoneNumber = { label: "Local", display: "+1 (701) 960-1701", href: "tel:+17019601701", schema: "+1-701-960-1701" };

/** Toll-free first. */
export const PHONES: readonly PhoneNumber[] = [TOLL_FREE, LOCAL];
/** schema.org `telephone`: both numbers, toll-free first. */
export const TELEPHONES: readonly string[] = PHONES.map((p) => p.schema);
/** The one number contact blocks and call buttons show, with no label: the toll-free number. The footer shows both, labeled. */
export const MAIN: PhoneNumber = TOLL_FREE;
/** "Toll-free +1 (888) 717-1701" */
export const labeled = (p: PhoneNumber): string => `${p.label} ${p.display}`;
