// lib/clientIp.ts: which address a request counts against.
// The web process (SvelteKit hooks) works out the real client address from its adapter (ADDRESS_HEADER=X-Real-IP, set by the edge proxy from its own trusted client address) and passes it to this app in the header x-nq-client-ip, overwriting anything the visitor sent. createApp believes that header only when its dep trustPeerIpHeader is true, which only the hooks entry sets. Otherwise the socket address is used, and when there is no socket at all (app.handle(request) inside another server) the answer is "unknown".
// X-Real-IP, X-Forwarded-For and CF-Connecting-IP are never read here.
import { isIP } from "node:net";

export interface HasRequestIP { requestIP(request: Request): { address: string } | null }

/** The header the hooks entry sets to the resolved client address. */
export const CLIENT_IP_HEADER = "x-nq-client-ip";

/** The bucket used when no address is available at all. */
export const UNKNOWN_IP = "unknown";

/** Canonical text of an IP: IPv4 as is, IPv6 lower case and compressed, ::ffff:a.b.c.d turned into a.b.c.d. null when it is not an IP (a zone id such as %eth0 is not accepted). */
export function canonicalIp(value: string): string | null {
    const v = value.trim();
    if (!v || v.includes("%") || v.length > 45) return null;
    const kind = isIP(v);
    if (kind === 4) return v;
    if (kind !== 6) return null;
    let host: string;
    try { host = new URL(`http://[${v}]/`).hostname.slice(1, -1).toLowerCase(); } catch { return null; }
    const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
    if (mapped) {
        const hi = parseInt(mapped[1], 16), lo = parseInt(mapped[2], 16);
        return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    }
    return host;
}

/** Expands a canonical (compressed, lower case) IPv6 text to its eight 16-bit groups, or null when it is not well formed. */
const groups = (host: string): number[] | null => {
    const halves = host.split("::");
    if (halves.length > 2) return null;
    const side = (t: string): string[] => (t === "" ? [] : t.split(":"));
    const head = side(halves[0]), tail = halves.length === 2 ? side(halves[1]) : [];
    const missing = 8 - head.length - tail.length;
    if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
    const all = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
    const nums = all.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
    return nums.length === 8 && nums.every((n) => !Number.isNaN(n)) ? nums : null;
};

/** The key a rate limiter counts an address under: IPv4 as is, IPv6 by its /64 prefix (one subscriber or site holds a whole /64, so the full address would let them pick a fresh key per request), "unknown" as is. The input is canonicalised first, so ::ffff:a.b.c.d counts as the IPv4 a.b.c.d. */
export function rateKey(ip: string): string {
    if (ip === UNKNOWN_IP) return ip;
    const c = canonicalIp(ip);
    if (!c) return UNKNOWN_IP;
    if (!c.includes(":")) return c;
    const g = groups(c);
    if (!g) return UNKNOWN_IP;
    return `${g.slice(0, 4).map((n) => n.toString(16)).join(":")}::/64`;
}

export function clientIp(request: Request, server: HasRequestIP | null | undefined, trustPeerIpHeader: boolean): string {
    if (trustPeerIpHeader) {
        const forwarded = request.headers.get(CLIENT_IP_HEADER);
        const ip = forwarded ? canonicalIp(forwarded) : null;
        if (ip) return ip;
    }
    let raw: string | undefined;
    try { raw = server?.requestIP(request)?.address; } catch { raw = undefined; }
    return (raw ? canonicalIp(raw) : null) ?? UNKNOWN_IP;
}
