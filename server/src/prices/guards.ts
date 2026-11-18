// guards.ts: sanity checks on a snapshot about to replace the one in force. A price feed that is wrong in bulk (a bad deploy at the API, a unit mix-up, a half-empty export) must not reach customers by itself: such a snapshot is refused until an operator accepts it (allowLargeChange). Pure: no clock, no files.
import type { Snapshot } from "./types";

export const MAX_PRICE_CHANGE = 0.5;        // any one price moving by more than 50 percent
export const MAX_CHANGED_SHARE = 0.25;      // more than 25 percent of the existing keys changing at once
export const MAX_REMOVED_SHARE = 0.3;       // more than 30 percent of the existing keys, or of the baseline keys, gone

export interface GuardInput {
    current: Snapshot;
    next: Snapshot;
    /** The keys of the last operator-accepted baseline; removals are counted against it cumulatively. */
    baselineKeys: string[];
}

/** Every reason this change is too large, as short sentences with no secrets; empty when it is fine. */
export const largeChangeReasons = ({ current, next, baselineKeys }: GuardInput): string[] => {
    const reasons: string[] = [];
    const keys = Object.keys(current.prices);
    let changed = 0;
    for (const k of keys) {
        if (!Object.hasOwn(next.prices, k)) continue;
        const was = current.prices[k].amountCents, now = next.prices[k].amountCents;
        if (was === now) continue;
        changed++;
        if (was > 0 && now === 0) reasons.push(`${k} goes from a price to 0`);
        else if (was > 0 && Math.abs(now - was) / was > MAX_PRICE_CHANGE) reasons.push(`${k} changes by more than 50 percent (${was} to ${now} cents)`);
    }
    if (keys.length > 0 && changed / keys.length > MAX_CHANGED_SHARE) reasons.push(`${changed} of ${keys.length} prices change at once (more than 25 percent)`);
    const gone = keys.filter((k) => !Object.hasOwn(next.prices, k)).length;
    if (keys.length > 0 && gone / keys.length > MAX_REMOVED_SHARE) reasons.push(`${gone} of ${keys.length} prices are removed at once (more than 30 percent)`);
    const goneFromBaseline = baselineKeys.filter((k) => !Object.hasOwn(next.prices, k)).length;
    if (baselineKeys.length > 0 && goneFromBaseline / baselineKeys.length > MAX_REMOVED_SHARE) {
        reasons.push(`${goneFromBaseline} of ${baselineKeys.length} prices from the last accepted baseline are gone (more than 30 percent cumulative)`);
    }
    return reasons;
};
