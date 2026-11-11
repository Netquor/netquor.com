declare global {
    namespace App {
        interface Locals {
            /** The price snapshot taken once for this request, so one page never mixes two versions. */
            prices: import("#server/prices/types").Snapshot;
        }
        interface PageData {
            /** The snapshot's version, for log lines. */
            priceVersion?: number;
            /** The nav and footer choices of the (site) layout; see src/lib/chrome.ts. */
            chrome?: import("#lib/chrome.ts").Chrome;
            prices?: Record<string, { amountCents: number; currency: "USD"; unit?: string }>;
        }
    }
}
export {};
