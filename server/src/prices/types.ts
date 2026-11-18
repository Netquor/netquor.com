// types.ts: the shape of a price snapshot (server/data/prices.json). Money is integer cents; the site, the webhook and the poll worker all read this one shape.
export type SnapshotSource = "seed" | "webhook" | "poll" | "operator";

export interface PriceEntry {
    amountCents: number;
    currency: "USD";
    /** Free text such as "per Mac per month". Optional. */
    unit?: string;
}

export interface Snapshot {
    schema: 1;
    /** Strictly increasing: a snapshot is accepted only when its version is higher than the one on disk. */
    version: number;
    /** ISO 8601. */
    updatedAt: string;
    source: SnapshotSource;
    /** Dotted key (fleet.mac.month) to price. */
    prices: Record<string, PriceEntry>;
}
