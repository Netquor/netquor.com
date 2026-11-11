// lib/clientIp.test.ts: the client address: socket by default; X-Real-IP only from a private peer and only when valid.
import { describe, expect, test } from "bun:test";
import { canonicalIp, clientIp, CLIENT_IP_HEADER, rateKey } from "./clientIp";

const req = (headers: Record<string, string> = {}) => new Request("http://x/", { headers });
const at = (address: string | null) => ({ requestIP: () => (address === null ? null : { address }) });

describe("canonicalIp", () => {
    test("IPv4 as is, IPv6 compressed and lower case, v4-mapped unmapped", () => {
        expect(canonicalIp("203.0.113.9")).toBe("203.0.113.9");
        expect(canonicalIp("2001:0DB8:0000:0000:0000:0000:0000:0001")).toBe("2001:db8::1");
        expect(canonicalIp("::ffff:203.0.113.9")).toBe("203.0.113.9");
        expect(canonicalIp("::FFFF:cb00:7109")).toBe("203.0.113.9");
        expect(canonicalIp("::1")).toBe("::1");
    });
    test("not an address", () => {
        for (const v of ["", "abc", "1.2.3", "1.2.3.4.5", "999.1.1.1", "<script>", "1.2.3.4, 5.6.7.8", "fe80::1%eth0", "1.2.3.4:80"]) expect(canonicalIp(v)).toBeNull();
    });
});

describe("clientIp", () => {
    test("trust off: the socket address, whatever the headers say", () => {
        expect(clientIp(req({ "x-nq-client-ip": "1.1.1.1", "x-real-ip": "2.2.2.2" }), at("172.18.0.2"), false)).toBe("172.18.0.2");
        expect(clientIp(req({ "x-nq-client-ip": "1.1.1.1" }), at("::ffff:10.0.0.2"), false)).toBe("10.0.0.2");
    });
    test("trust on and a valid header: the header, canonicalised", () => {
        expect(clientIp(req({ [CLIENT_IP_HEADER]: "203.0.113.9" }), at("172.18.0.2"), true)).toBe("203.0.113.9");
        expect(clientIp(req({ [CLIENT_IP_HEADER]: "2001:DB8::1" }), at("::1"), true)).toBe("2001:db8::1");
        expect(clientIp(req({ [CLIENT_IP_HEADER]: "::ffff:203.0.113.9" }), null, true)).toBe("203.0.113.9");
    });
    test("trust on but the header missing or invalid: the socket, else 'unknown'", () => {
        for (const v of ["garbage", "1.2.3.4, 5.6.7.8", "fe80::1%eth0", ""]) {
            expect(clientIp(req({ [CLIENT_IP_HEADER]: v }), at("172.18.0.2"), true)).toBe("172.18.0.2");
            expect(clientIp(req({ [CLIENT_IP_HEADER]: v }), at(null), true)).toBe("unknown");
        }
        expect(clientIp(req(), at("172.18.0.2"), true)).toBe("172.18.0.2");
    });
    test("other headers are never read", () => {
        expect(clientIp(req({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2", "x-real-ip": "3.3.3.3" }), at("172.18.0.2"), true)).toBe("172.18.0.2");
    });
    test("no socket at all (app.handle): 'unknown'", () => {
        expect(clientIp(req(), at(null), false)).toBe("unknown");
        expect(clientIp(req(), undefined, false)).toBe("unknown");
        expect(clientIp(req(), { requestIP: () => { throw new Error("no socket"); } }, false)).toBe("unknown");
    });
});

describe("rateKey", () => {
    test("IPv4 as is, v4-mapped IPv6 counts as the IPv4, unknown stays unknown", () => {
        expect(rateKey("203.0.113.9")).toBe("203.0.113.9");
        expect(rateKey("::ffff:203.0.113.9")).toBe("203.0.113.9");
        expect(rateKey("::FFFF:cb00:7109")).toBe("203.0.113.9");
        expect(rateKey("unknown")).toBe("unknown");
        expect(rateKey("garbage")).toBe("unknown");
    });
    test("IPv6 is keyed by its /64, whatever the spelling", () => {
        const k = rateKey("2001:db8:1:2::1");
        expect(k).toBe("2001:db8:1:2::/64");
        expect(rateKey("2001:DB8:1:2:ffff:ffff:ffff:ffff")).toBe(k);
        expect(rateKey("2001:0db8:0001:0002:0000:0000:0000:0001")).toBe(k);
        expect(rateKey("2001:db8:1:3::1")).not.toBe(k);
    });
    test("compressed forms that swallow the prefix groups", () => {
        expect(rateKey("::1")).toBe("0:0:0:0::/64");
        expect(rateKey("2001:db8::")).toBe("2001:db8:0:0::/64");
        expect(rateKey("2001::5:6:7:8")).toBe("2001:0:0:0::/64");
        expect(rateKey("fe80::1")).toBe("fe80:0:0:0::/64");
    });
});
