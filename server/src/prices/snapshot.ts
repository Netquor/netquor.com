// snapshot.ts: the strict validator for a price snapshot, plus how one is written, compared and fingerprinted. Hand-written on purpose: no extra keys, no coercion, every problem listed.
import { createHash } from "node:crypto";
import type { PriceEntry, Snapshot, SnapshotSource } from "./types";

export const MAX_PRICES = 500;
export const MAX_CENTS = 10_000_000;
export const KEY_PATTERN = /^[a-z0-9]+(\.[a-z0-9_]+)*$/;
const SOURCES: SnapshotSource[] = ["seed", "webhook", "poll", "operator"];
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|[+-](\d{2}):(\d{2}))$/;

/** Is this a real moment? Shape alone passes 2026-02-31 and T24:00:00; this checks the calendar and the clock (no leap seconds, no 24:00). */
export const isRealTimestamp = (text: string): boolean => {
    const m = ISO.exec(text);
    if (!m) return false;
    const [y, mo, d, h, mi, sec] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number);
    if (mo < 1 || mo > 12 || d < 1) return false;
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
    if (d > days || h > 23 || mi > 59 || sec > 59) return false;
    if (m[9] !== undefined && (Number(m[9]) > 23 || Number(m[10]) > 59)) return false;
    return true;
};

export type Validated = { ok: true; snapshot: Snapshot } | { ok: false; errors: string[] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const extraKeys = (o: Record<string, unknown>, allowed: string[]): string[] => Object.keys(o).filter((k) => !allowed.includes(k));

export const validateSnapshot = (input: unknown): Validated => {
    const errors: string[] = [];
    if (!isObject(input)) return { ok: false, errors: ["snapshot must be an object"] };
    for (const k of extraKeys(input, ["schema", "version", "updatedAt", "source", "prices"])) errors.push(`unknown key "${k}"`);
    if (input.schema !== 1) errors.push("schema must be 1");
    const version = input.version;
    if (typeof version !== "number" || !Number.isSafeInteger(version) || version < 1) errors.push("version must be an integer of 1 or more");
    const at = input.updatedAt;
    if (typeof at !== "string" || !isRealTimestamp(at) || Number.isNaN(Date.parse(at))) errors.push("updatedAt must be an ISO 8601 timestamp with a time zone");
    if (typeof input.source !== "string" || !SOURCES.includes(input.source as SnapshotSource)) errors.push(`source must be one of ${SOURCES.join(", ")}`);

    const prices: Record<string, PriceEntry> = {};
    if (!isObject(input.prices)) errors.push("prices must be an object");
    else {
        const keys = Object.keys(input.prices);
        if (keys.length > MAX_PRICES) errors.push(`prices has ${keys.length} entries, the most allowed is ${MAX_PRICES}`);
        for (const key of keys.slice(0, MAX_PRICES + 1)) {
            const e = input.prices[key];
            if (!KEY_PATTERN.test(key) || key.length > 120) { errors.push(`price key "${key.slice(0, 60)}" is not a valid dotted key`); continue; }
            if (!isObject(e)) { errors.push(`${key}: must be an object`); continue; }
            for (const k of extraKeys(e, ["amountCents", "currency", "unit"])) errors.push(`${key}: unknown key "${k}"`);
            const c = e.amountCents;
            if (typeof c !== "number" || !Number.isInteger(c) || c < 0 || c > MAX_CENTS) errors.push(`${key}: amountCents must be an integer from 0 to ${MAX_CENTS}`);
            if (e.currency !== "USD") errors.push(`${key}: currency must be "USD"`);
            if (e.unit !== undefined && (typeof e.unit !== "string" || e.unit.length < 1 || e.unit.length > 120)) errors.push(`${key}: unit must be text of 1 to 120 characters`);
            if (errors.length === 0) prices[key] = { amountCents: c as number, currency: "USD", ...(typeof e.unit === "string" ? { unit: e.unit } : {}) };
        }
    }
    if (errors.length) return { ok: false, errors: errors.slice(0, 20) };
    return { ok: true, snapshot: { schema: 1, version: version as number, updatedAt: at as string, source: input.source as SnapshotSource, prices } };
};

/** The one way a snapshot is written: fixed key order, prices sorted, two-space indent, trailing newline. So the same content is always the same bytes and a git diff shows only what changed. */
export const serializeSnapshot = (s: Snapshot): string => {
    const prices: Record<string, PriceEntry> = {};
    for (const key of Object.keys(s.prices).sort()) {
        const p = s.prices[key];
        prices[key] = { amountCents: p.amountCents, currency: p.currency, ...(p.unit !== undefined ? { unit: p.unit } : {}) };
    }
    return JSON.stringify({ schema: s.schema, version: s.version, updatedAt: s.updatedAt, source: s.source, prices }, null, 2) + "\n";
};

/** The same content: version, time and prices. How it arrived (source) does not count, so a retried delivery by another route is still the same snapshot. */
export const sameContent = (a: Snapshot, b: Snapshot): boolean =>
    a.version === b.version && a.updatedAt === b.updatedAt && serializeSnapshot({ ...a, source: "seed" }) === serializeSnapshot({ ...b, source: "seed" });

export const removedKeys = (current: Snapshot, next: Snapshot): string[] => Object.keys(current.prices).filter((k) => !Object.hasOwn(next.prices, k));

/** A strong ETag for the public GET: the version plus a hash of the exact bytes served. */
export const snapshotEtag = (s: Snapshot): string => `"v${s.version}-${createHash("sha256").update(serializeSnapshot(s)).digest("hex").slice(0, 16)}"`;
