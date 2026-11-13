// testkit.ts: helpers for the web tests: a legacy folder in a temp dir, a snapshot builder and a mutable price source.
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { PriceSource, Snapshot } from "./types";

export const snap = (version: number, prices: Record<string, number> = { "fleet.mac.month": 595, "vpn.from.month": 500 }): Snapshot => ({
    schema: 1,
    version,
    updatedAt: "2026-11-10T00:00:00.000Z",
    source: "seed",
    prices: Object.fromEntries(Object.entries(prices).map(([k, c]) => [k, { amountCents: c, currency: "USD" as const }])),
});

/** A price source the test can move to a new snapshot, like the cache does on replace(): version() is a monotonic counter that equals the snapshot's version except after a rebase to a lower or equal number, when it still counts up. */
export const mutablePrices = (initial: Snapshot): PriceSource & { set(s: Snapshot): void } => {
    let current = initial;
    let revision = initial.version;
    return { get: () => current, version: () => revision, set: (s) => { current = s; revision = Math.max(revision + 1, s.version); } };
};

export const tempLegacy = (files: Record<string, string | Uint8Array>): { dir: string; write(rel: string, content: string, mtimeSec?: number): void; cleanup(): void } => {
    const dir = mkdtempSync(join(tmpdir(), "nq-legacy-"));
    const write = (rel: string, content: string | Uint8Array, mtimeSec?: number) => {
        const p = join(dir, rel);
        mkdirSync(dirname(p), { recursive: true });
        writeFileSync(p, content);
        if (mtimeSec !== undefined) utimesSync(p, mtimeSec, mtimeSec);
    };
    for (const [rel, content] of Object.entries(files)) write(rel, content);
    return { dir, write, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
};

export const PAGE = (price = "$5.95") => `<!DOCTYPE html><html><body><p>Fleet <b data-price="fleet.mac.month">${price}</b> per Mac</p></body></html>`;
