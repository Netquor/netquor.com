// ingest.ts: taking in a new snapshot, whoever sent it (the webhook, the worker's delivery, the operator tool, a nudge pull). The web process is the single writer, so one in-process mutex is the only lock. In order: validate, compare with the snapshot in force, run the sanity guards, persist atomically (the previous file kept as prices.prev.json), and only then replace the cache. A crash at any point leaves the old snapshot or the new one on disk, and a restart loads whichever is newest and valid.
import type { PriceCache } from "./cache";
import { largeChangeReasons } from "./guards";
import { sameContent, validateSnapshot } from "./snapshot";
import type { SnapshotStore } from "./store";
import type { SnapshotSource } from "./types";

export type IngestCode = "invalid" | "stale" | "conflict" | "change_too_large" | "reason_required" | "persist_failed";

export class IngestError extends Error {
    constructor(readonly code: IngestCode, message: string, readonly details: string[] = []) { super(message); this.name = "IngestError"; }
}

export interface IngestResult {
    /** "applied": a new snapshot is in force. "unchanged": the same snapshot already was. */
    status: "applied" | "unchanged";
    version: number;
    at: string;
}

export interface IngestOptions {
    /** How this snapshot arrived; recorded as its source (a sender need not know it). Default "webhook". */
    source?: Exclude<SnapshotSource, "seed">;
    /** The signed body says a large change is intended: skips the sanity guards and, once applied, becomes the new baseline. */
    allowLargeChange?: boolean;
    /** The operator lets the version go down (or sideways) to match the API. Requires a reason. */
    rebaseVersion?: boolean;
    /** Why, in the operator's words; logged. Required with rebaseVersion. */
    reason?: string;
}

export interface IngestDeps {
    cache: PriceCache;
    store: Pick<SnapshotStore, "write" | "readBaseline" | "writeBaseline">;
    /** Milliseconds since the epoch (a Date is accepted too). */
    clock: () => number | Date;
    log?: (line: string) => void;
}

/** The codes that are a refusal of the snapshot itself (not a failure to save it). */
const REFUSALS = new Set<IngestCode>(["invalid", "stale", "conflict", "change_too_large", "reason_required"]);

export const createIngest = (d: IngestDeps) => {
    const log = d.log ?? (() => {});
    const iso = (): string => { const t = d.clock(); return (t instanceof Date ? t : new Date(t)).toISOString(); };
    // One ingest at a time; a failed one does not block the next.
    let chain: Promise<unknown> = Promise.resolve();
    const serialized = <T>(fn: () => Promise<T>): Promise<T> => {
        const run = chain.then(fn, fn);
        chain = run.catch(() => {});
        return run;
    };
    const clean = (s: string): string => s.replace(/[\r\n\t]+/g, " ").slice(0, 200);

    const apply = async (candidate: unknown, o: IngestOptions): Promise<IngestResult> => {
        const source = o.source ?? "webhook";
        const input = typeof candidate === "object" && candidate !== null && !Array.isArray(candidate) ? { ...(candidate as object), source } : candidate;
        const checked = validateSnapshot(input);
        if (!checked.ok) throw new IngestError("invalid", `invalid snapshot: ${checked.errors[0]}`, checked.errors);
        const next = checked.snapshot;
        const reason = o.reason ? clean(o.reason) : "";
        if (o.rebaseVersion && !reason) throw new IngestError("reason_required", "rebaseVersion needs a reason");
        const current = d.cache.get();
        const at = iso();

        if (sameContent(current, next)) return { status: "unchanged", version: current.version, at };
        if (!o.rebaseVersion) {
            if (next.version === current.version) throw new IngestError("conflict", `version ${next.version} is already in place with different content`);
            if (next.version < current.version) throw new IngestError("stale", `version ${next.version} is older than the current ${current.version}`);
        }

        if (!o.allowLargeChange) {
            // The first time, the baseline is the key set in force now.
            let baseline = d.store.readBaseline();
            if (!baseline) {
                baseline = { keys: Object.keys(current.prices), version: current.version, acceptedAt: at, reason: "initial" };
                try { d.store.writeBaseline(baseline); } catch { log("prices: could not write baseline.json; using the keys in force"); }
            }
            const reasons = largeChangeReasons({ current, next, baselineKeys: baseline.keys });
            if (reasons.length) {
                log(`prices: refused version ${next.version} (${source}): change too large: ${reasons.slice(0, 3).join("; ")}`);
                throw new IngestError("change_too_large", `this snapshot changes too much at once; an operator must accept it: ${reasons.slice(0, 3).join("; ")}`, reasons);
            }
        }

        try { d.store.write(next); }
        catch (e) {
            log(`prices: could not persist version ${next.version}: ${e instanceof Error ? e.name : "error"}`);
            throw new IngestError("persist_failed", "the snapshot could not be saved; the previous one stays in force");
        }
        // Persisted: from here a crash is safe, a restart loads this file.
        d.cache.replace(next, source);

        if (o.allowLargeChange) {
            try { d.store.writeBaseline({ keys: Object.keys(next.prices), version: next.version, acceptedAt: at, reason: reason || "accepted large change" }); }
            catch { log("prices: could not write baseline.json after an accepted large change"); }
        }
        log(`prices: version ${next.version} applied (${source})${o.allowLargeChange ? " [large change accepted]" : ""}${o.rebaseVersion ? ` [rebased from ${current.version}]` : ""}${reason ? ` reason: ${reason}` : ""}`);
        return { status: "applied", version: next.version, at };
    };

    return {
        ingestSnapshot: (candidate: unknown, o: IngestOptions = {}): Promise<IngestResult> => serialized(async () => {
            try { return await apply(candidate, o); }
            catch (e) {
                // Every path (webhook, worker delivery, operator, nudge pull) lands here, so the cache can always say what was last refused.
                if (e instanceof IngestError && REFUSALS.has(e.code)) {
                    const v = (candidate as { version?: unknown } | null)?.version;
                    d.cache.markRefusal({ version: typeof v === "number" ? v : null, code: e.code });
                }
                throw e;
            }
        }),
    };
};

export type Ingest = ReturnType<typeof createIngest>["ingestSnapshot"];
