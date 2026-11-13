// schedule.ts: the timing pieces of the poll worker: the interval setting, the backoff and the clock it sleeps on (replaceable, so a test runs hours of polling in a moment).

export const DEFAULT_INTERVAL_SECONDS = 900;
export const MIN_INTERVAL_SECONDS = 60;
export const MAX_BACKOFF_MS = 3_600_000;

/** PRICING_POLL_SECONDS: default 900, never below 60, and a value that is not a number is the default. */
export const parseIntervalSeconds = (raw: string): number => {
    const n = Number(raw);
    if (!raw.trim() || !Number.isFinite(n)) return DEFAULT_INTERVAL_SECONDS;
    return Math.max(MIN_INTERVAL_SECONDS, Math.floor(n));
};

/** After `failures` failures in a row: the interval doubled each time, at most an hour (or the interval itself if that is longer), with jitter that takes off up to half. Never shorter than the interval. */
export const backoffMs = (intervalMs: number, failures: number, random: () => number): number => {
    const cap = Math.max(MAX_BACKOFF_MS, intervalMs);
    const raw = Math.min(cap, intervalMs * 2 ** Math.min(failures, 20));
    return Math.max(intervalMs, Math.round(raw * (0.5 + 0.5 * random())));
};

export interface Clock {
    /** Resolves after ms, or at once when the signal aborts. */
    sleep(ms: number, signal: AbortSignal): Promise<void>;
}

export const realClock: Clock = {
    sleep: (ms, signal) => new Promise<void>((resolve) => {
        if (signal.aborted) return resolve();
        const done = () => { clearTimeout(t); signal.removeEventListener("abort", done); resolve(); };
        const t = setTimeout(done, ms);
        signal.addEventListener("abort", done);
    }),
};
