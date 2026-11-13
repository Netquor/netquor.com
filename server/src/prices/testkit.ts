// testkit.ts: helpers shared by the pricing tests: a snapshot builder, a memory store, a ready-made world (cache + store + ingest), temp folders.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPriceCache } from "./cache";
import { createIngest } from "./ingest";
import type { Baseline, SnapshotStore } from "./store";
import type { Snapshot } from "./types";

export const snap = (version: number, prices: Record<string, number> = { "a.one": 100, "b.two": 200, "c.three": 300, "d.four": 400 }, extra: Partial<Snapshot> = {}): Snapshot => ({
    schema: 1,
    version,
    updatedAt: `2026-11-10T00:00:${String(version % 60).padStart(2, "0")}.000Z`,
    source: "webhook",
    prices: Object.fromEntries(Object.entries(prices).map(([k, c]) => [k, { amountCents: c, currency: "USD" as const }])),
    ...extra,
});

export const memoryStore = (initial: Snapshot = snap(1)) => {
    const state = { persisted: initial, previous: null as Snapshot | null, writes: 0, baseline: null as Baseline | null, failWrites: false };
    const store: SnapshotStore = {
        load: () => ({ snapshot: state.persisted, from: "current", problems: [] }),
        write: (s) => { if (state.failWrites) throw new Error("disk full"); state.previous = state.persisted; state.persisted = s; state.writes++; },
        readBaseline: () => state.baseline,
        writeBaseline: (b) => { state.baseline = b; },
    };
    return { store, state };
};

export const NOW_MS = Date.parse("2026-11-10T12:00:00.000Z");

/** A cache, a memory store and an ingest wired together, with a fixed clock. */
export const world = (initial: Snapshot = snap(1)) => {
    const m = memoryStore(initial);
    const cache = createPriceCache({ store: m.store, clock: () => NOW_MS });
    const lines: string[] = [];
    const { ingestSnapshot } = createIngest({ cache, store: m.store, clock: () => NOW_MS, log: (l) => lines.push(l) });
    return { ...m, cache, ingest: ingestSnapshot, lines };
};

export const tempDir = (): { dir: string; cleanup: () => void } => {
    const dir = mkdtempSync(join(tmpdir(), "nq-prices-"));
    return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};
