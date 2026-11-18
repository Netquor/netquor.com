// signature.test.ts: the webhook signature: valid, wrong secret, tampered body, stale and future timestamps, the rotation secret, malformed headers, and the constant-time compare.
import { describe, expect, test } from "bun:test";
import { parseSignatureHeader, safeEqualHex, signBody, verifySignature } from "./signature";

const NOW = 1_800_000_000;
const body = new TextEncoder().encode('{"event":"prices.changed"}');
const header = (secret: string, t = NOW, b: Uint8Array = body) => `t=${t},v1=${signBody(secret, t, b)}`;
const check = (h: string | null, o: { secrets?: string[]; body?: Uint8Array; now?: number } = {}) =>
    verifySignature({ header: h, body: o.body ?? body, secrets: o.secrets ?? ["s3cret"], nowSeconds: o.now ?? NOW });

describe("verifySignature", () => {
    test("a correct signature passes", () => expect(check(header("s3cret"))).toBe(true));
    test("a wrong secret fails", () => expect(check(header("other"))).toBe(false));
    test("a tampered body fails", () => expect(check(header("s3cret"), { body: new TextEncoder().encode('{"event":"prices.changed" }') })).toBe(false));
    test("a signature for another timestamp fails", () => expect(check(`t=${NOW + 1},v1=${signBody("s3cret", NOW, body)}`)).toBe(false));

    test("300 seconds old or ahead is allowed, 301 is not (replay and clock-skew window)", () => {
        expect(check(header("s3cret", NOW - 300))).toBe(true);
        expect(check(header("s3cret", NOW + 300))).toBe(true);
        expect(check(header("s3cret", NOW - 301))).toBe(false);
        expect(check(header("s3cret", NOW + 301))).toBe(false);
    });

    test("the next secret works during a rotation, and a retired one does not", () => {
        expect(check(header("next"), { secrets: ["s3cret", "next"] })).toBe(true);
        expect(check(header("s3cret"), { secrets: ["s3cret", "next"] })).toBe(true);
        expect(check(header("old"), { secrets: ["s3cret", "next"] })).toBe(false);
    });

    test("a sender signing with both secrets sends two v1 values; either is enough", () => {
        const t = NOW;
        expect(check(`t=${t},v1=${signBody("nope", t, body)},v1=${signBody("s3cret", t, body)}`)).toBe(true);
    });

    test("no secrets configured refuses everything", () => expect(check(header(""), { secrets: [] })).toBe(false));

    test("malformed headers are refused", () => {
        const good = signBody("s3cret", NOW, body);
        for (const h of [null, "", "garbage", `t=${NOW}`, `v1=${good}`, `t=abc,v1=${good}`, `t=${NOW},v1=zz`, `t=${NOW},v1=${good.slice(2)}`, `t=${NOW},v1=${good},x=1`, `t=${NOW},t=${NOW},v1=${good}`, `t=-5,v1=${good}`, `t=${NOW};v1=${good}`, "t=,v1="])
            expect(check(h)).toBe(false);
    });

    test("an oversize header is refused outright", () => expect(parseSignatureHeader("t=1,v1=" + "a".repeat(500))).toBeNull());
});

describe("safeEqualHex", () => {
    test("equal, unequal, different length, not hex", () => {
        expect(safeEqualHex("abcd", "abcd")).toBe(true);
        expect(safeEqualHex("ABCD", "abcd")).toBe(true);
        expect(safeEqualHex("abcd", "abce")).toBe(false);
        expect(safeEqualHex("abcd", "abcdef")).toBe(false);
        expect(safeEqualHex("abc", "abc")).toBe(false);
        expect(safeEqualHex("zz", "zz")).toBe(false);
        expect(safeEqualHex("", "")).toBe(false);
    });
});
