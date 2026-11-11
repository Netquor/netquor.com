// Splits a data string with {{price.key}} / {{price.key|fmt}} tokens into HTML runs and price references.
export type RichPart = { html: string } | { key: string; fmt?: string };

export const splitRich = (s: string): RichPart[] => {
    const out: RichPart[] = [];
    s.split(/\{\{([^}]+)\}\}/).forEach((piece, i) => {
        if (i % 2 === 0) { if (piece) out.push({ html: piece }); return; }
        const [key, fmt] = piece.split("|");
        out.push(fmt ? { key, fmt } : { key });
    });
    return out;
};

import { formatPrice } from "#server/prices/stamp";
import type { PriceEntry } from "#server/prices/types";

/** "$3.25" for an entry of 649 cents (half a cent rounds up). */
export const halfPriceText = (entry: PriceEntry | undefined): string =>
    entry ? formatPrice({ ...entry, amountCents: Math.round(entry.amountCents / 2) }, "usd0") : "see pricing";
