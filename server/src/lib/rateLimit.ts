// lib/rateLimit.ts: a per-key sliding window kept in memory. One process only (the web container); a restart forgets everything, which is fine for a form.
export interface RateLimiter {
    /** Counts one request for this key. A refused request is not counted, so waiting is always enough. */
    hit(key: string): { allowed: boolean; retryAfterSeconds: number };
}

export interface SlidingWindowOptions {
    max: number;
    windowMs: number;
    /** Milliseconds since the epoch. */
    now: () => number;
    /** Most keys remembered at once; beyond it the oldest key is forgotten. */
    maxKeys?: number;
    /** A different max for particular keys (the shared "unknown" bucket gets a much higher one so it cannot lock everyone out). */
    keyMax?: Record<string, number>;
}

export function slidingWindowLimiter(o: SlidingWindowOptions): RateLimiter {
    const maxKeys = o.maxKeys ?? 10_000;
    const hits = new Map<string, number[]>();
    return {
        hit(key) {
            const now = o.now();
            const cutoff = now - o.windowMs;
            const mine = (hits.get(key) ?? []).filter((t) => t > cutoff);
            const max = o.keyMax && Object.hasOwn(o.keyMax, key) ? o.keyMax[key] : o.max;
            if (mine.length >= max) {
                // Keep a key that is being refused as recent as one being served, so a flood of new keys evicts idle keys first.
                hits.delete(key);
                hits.set(key, mine);
                return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((mine[0] + o.windowMs - now) / 1000)) };
            }
            mine.push(now);
            hits.delete(key); // re-insert so the Map order is least recently used first
            hits.set(key, mine);
            if (hits.size > maxKeys) {
                // O(1) per eviction: the Map is in least-recently-used order, so the first key is the one to forget (an expired key sits near the front anyway). No scan of the whole Map.
                while (hits.size > maxKeys) hits.delete(hits.keys().next().value as string);
            }
            return { allowed: true, retryAfterSeconds: 0 };
        },
    };
}
