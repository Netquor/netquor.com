// store.ts: where the snapshot lives. data/prices.json is the live copy, prices.prev.json the one before it, prices.seed.json (baked into the image) the fallback, baseline.json the key set an operator last accepted. Only the web process writes (it is the single writer), so there is no lock; every write is a temp file, fsync and rename, so a crash leaves the old file or the new one, never half.
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { commitStaged, discardStaged, stageFile, writeFileAtomic, type AtomicHooks } from "./fsutil";
import { serializeSnapshot, validateSnapshot } from "./snapshot";
import type { Snapshot } from "./types";

export interface Baseline {
    /** The keys that existed when an operator last accepted a snapshot. */
    keys: string[];
    version: number;
    acceptedAt: string;
    reason: string;
}

export interface Loaded {
    snapshot: Snapshot;
    /** Which file it came from. "prev" or "seed" means the newer file was missing or damaged. */
    from: "current" | "prev" | "seed";
    /** One sentence per file that was skipped, for the log. */
    problems: string[];
}

export interface SnapshotStore {
    /** The newest valid snapshot: prices.json, else prices.prev.json, else the seed. Throws when none is valid. Synchronous: it runs once, at start. */
    load(): Loaded;
    /** Persists a snapshot: keeps the current valid file as prices.prev.json, then replaces prices.json. On any failure the files are as they were. */
    write(next: Snapshot): void;
    readBaseline(): Baseline | null;
    writeBaseline(b: Baseline): void;
}

export class StoreError extends Error {
    constructor(message: string) { super(message); this.name = "StoreError"; }
}

const readSnapshotFile = (path: string): { snapshot: Snapshot } | { problem: string } | null => {
    if (!existsSync(path)) return null;
    let parsed: unknown;
    try { parsed = JSON.parse(readFileSync(path, "utf8")); } catch { return { problem: "is not JSON" }; }
    const v = validateSnapshot(parsed);
    return v.ok ? { snapshot: v.snapshot } : { problem: `is not a valid snapshot: ${v.errors[0]}` };
};

export interface FileStoreOptions {
    seedFile: string;
    hooks?: AtomicHooks;
}

export const fileStore = (dir: string, o: FileStoreOptions): SnapshotStore => {
    const file = join(dir, "prices.json"), prev = join(dir, "prices.prev.json"), baseline = join(dir, "baseline.json");
    return {
        load() {
            const problems: string[] = [];
            for (const [path, from] of [[file, "current"], [prev, "prev"], [o.seedFile, "seed"]] as const) {
                const r = readSnapshotFile(path);
                if (r === null) continue;
                if ("snapshot" in r) return { snapshot: r.snapshot, from, problems };
                problems.push(`${from === "seed" ? "the seed" : path.slice(dir.length + 1)} ${r.problem}`);
            }
            throw new StoreError(`no valid price snapshot: ${problems.join("; ") || `${o.seedFile} is missing`}`);
        },

        write(next) {
            const content = serializeSnapshot(next);
            // 1. The new file is complete on disk (as a temp file) before anything else changes.
            const staged = stageFile(file, content);
            let oldPrev: string | null = null, prevTouched = false;
            try {
                // 2. The current file, if it is itself valid, becomes prices.prev.json. A damaged current file never overwrites a good prev.
                const cur = readSnapshotFile(file);
                if (cur && "snapshot" in cur) {
                    oldPrev = existsSync(prev) ? readFileSync(prev, "utf8") : null;
                    prevTouched = true;
                    writeFileAtomic(prev, readFileSync(file, "utf8"), o.hooks);
                }
                // 3. The rename that makes it live.
                commitStaged(staged, file, o.hooks);
            } catch (e) {
                discardStaged(staged);
                // A failed write leaves prices.prev.json exactly as it was.
                if (prevTouched) { try { if (oldPrev === null) unlinkSync(prev); else writeFileAtomic(prev, oldPrev); } catch { /* best effort */ } }
                throw e;
            }
        },

        readBaseline() {
            if (!existsSync(baseline)) return null;
            try {
                const j = JSON.parse(readFileSync(baseline, "utf8"));
                if (j && Array.isArray(j.keys) && j.keys.every((k: unknown) => typeof k === "string") && typeof j.version === "number") {
                    return { keys: j.keys, version: j.version, acceptedAt: String(j.acceptedAt ?? ""), reason: String(j.reason ?? "") };
                }
            } catch { /* fall through */ }
            return null;
        },

        writeBaseline(b) {
            writeFileAtomic(baseline, JSON.stringify({ version: b.version, acceptedAt: b.acceptedAt, reason: b.reason, keys: [...b.keys].sort() }, null, 2) + "\n", o.hooks);
        },
    };
};
