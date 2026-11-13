// signature.ts: the webhook signature. The sender puts "X-Netquor-Signature: t=<unix seconds>,v1=<hex>" on the request, where v1 is HMAC-SHA256 over "<t>.<raw body>" with the shared secret. We recompute it with each secret in force (the current one and, during a rotation, the next), compare in constant time, and refuse a timestamp more than five minutes off. A replay inside those five minutes is harmless for a plain snapshot (ingest of the same snapshot changes nothing); the bodies that switch a guard off get a tighter 60 s and are accepted once (see routes.ts).
import { createHmac, timingSafeEqual } from "node:crypto";

export const TOLERANCE_SECONDS = 300;
/** A signed body that carries rebaseVersion or allowLargeChange (it switches a guard off) is honoured only this close to its timestamp, and only once (routes.ts keeps the seen signatures). A poll.ok heartbeat must be no older than this either. */
export const DANGEROUS_TOLERANCE_SECONDS = 60;
/** How long a dangerous body's signature is remembered, and how many are remembered at most. */
export const REPLAY_MEMORY_SECONDS = 300;
export const REPLAY_MEMORY_MAX = 1000;

/** Equal hex strings, compared without stopping at the first difference. Different lengths are simply not equal (a length is not a secret). */
export const safeEqualHex = (a: string, b: string): boolean => {
    if (!/^[0-9a-f]+$/i.test(a) || !/^[0-9a-f]+$/i.test(b) || a.length !== b.length || a.length % 2 !== 0) return false;
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
};

export const signBody = (secret: string, t: number, body: Uint8Array | string): string =>
    createHmac("sha256", secret).update(`${t}.`).update(body).digest("hex");

/** "t=1700000000,v1=ab12..." -> parts, or null when malformed. More than one v1 is allowed (a sender may sign with both secrets while rotating). */
export const parseSignatureHeader = (header: string | null | undefined): { t: number; v1: string[] } | null => {
    if (!header || header.length > 400) return null;
    let t: number | null = null;
    const v1: string[] = [];
    for (const part of header.split(",")) {
        const eq = part.indexOf("=");
        if (eq < 1) return null;
        const k = part.slice(0, eq).trim(), v = part.slice(eq + 1).trim();
        if (k === "t") { if (t !== null || !/^\d{1,12}$/.test(v)) return null; t = Number(v); }
        else if (k === "v1") { if (!/^[0-9a-f]{64}$/i.test(v)) return null; v1.push(v); }
        else return null;
    }
    return t === null || v1.length === 0 ? null : { t, v1 };
};

export const verifySignature = (o: { header: string | null | undefined; body: Uint8Array; secrets: string[]; nowSeconds: number; toleranceSeconds?: number }): boolean => {
    const parsed = parseSignatureHeader(o.header);
    if (!parsed || o.secrets.length === 0) return false;
    if (Math.abs(o.nowSeconds - parsed.t) > (o.toleranceSeconds ?? TOLERANCE_SECONDS)) return false;
    let ok = false;
    // Every secret against every signature, no early exit.
    for (const secret of o.secrets) {
        const expected = signBody(secret, parsed.t, o.body);
        for (const given of parsed.v1) if (safeEqualHex(given, expected)) ok = true;
    }
    return ok;
};

/** Remembers (timestamp, signature) pairs for a while, bounded, so a signed dangerous body cannot be replayed. Oldest forgotten first (a Map keeps insertion order, so every step is O(1) amortised). */
export const createSeenSignatures = (o: { now: () => number; memoryMs?: number; max?: number }) => {
    const memoryMs = o.memoryMs ?? REPLAY_MEMORY_SECONDS * 1000, max = o.max ?? REPLAY_MEMORY_MAX;
    const seen = new Map<string, number>();
    const prune = (now: number) => {
        for (const [k, at] of seen) { if (now - at <= memoryMs) break; seen.delete(k); }
        while (seen.size > max) seen.delete(seen.keys().next().value as string);
    };
    return {
        /** True when none of these pairs was seen before; they are all remembered from now on. False (and nothing new remembered) when any was seen. */
        accept(t: number, v1: string[]): boolean {
            const now = o.now();
            prune(now);
            const keys = v1.map((s) => `${t}.${s.toLowerCase()}`);
            if (keys.some((k) => seen.has(k))) return false;
            for (const k of keys) seen.set(k, now);
            prune(now);
            return true;
        },
        size: () => seen.size,
    };
};
