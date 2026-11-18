// stamp.ts: the old site's pages carry data-price markers. The comparison tools show both sides at the seed's prices, so the baseline pages are stamped here (the same stamping code the server package uses) instead of by the app.
import { hasPriceMarkers, stampHtml } from "#server/prices/stamp";
import type { Snapshot } from "#server/prices/types";
import { applyIntentionalChanges } from "./intentional";

/** The page stamped with the snapshot; as written when it has no markers or the snapshot lacks one of its keys. */
export const stampBaselineHtml = (html: string, rel: string, snapshot: Snapshot): string => {
    // the recorded content decisions since the tag (scripts/baseline/intentional.ts) are part of the baseline
    const base = applyIntentionalChanges(html);
    if (!hasPriceMarkers(base)) return base;
    try { return stampHtml(base, snapshot, rel); } catch { return base; }
};
