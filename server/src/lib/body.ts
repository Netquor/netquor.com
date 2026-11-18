// lib/body.ts: reads a request body without ever holding more than `max` bytes, whether or not the sender says how long it is.
export type BodyResult = { ok: true; bytes: Uint8Array } | { ok: false; reason: "too_large" };

export async function readBodyCapped(request: Request, max: number): Promise<BodyResult> {
    const declared = request.headers.get("content-length");
    if (declared !== null && /^\d+$/.test(declared) && Number(declared) > max) return { ok: false, reason: "too_large" };
    if (!request.body) return { ok: true, bytes: new Uint8Array(0) };
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > max) { await reader.cancel().catch(() => {}); return { ok: false, reason: "too_large" }; }
        chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) { bytes.set(c, at); at += c.byteLength; }
    return { ok: true, bytes };
}
