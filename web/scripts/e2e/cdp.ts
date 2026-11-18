// cdp.ts: a minimal Chrome DevTools Protocol client over Bun's WebSocket. No dependencies.
export interface CdpEvent { method: string; params: any; sessionId?: string }

export class Cdp {
    private id = 0;
    private pending = new Map<number, { res: (v: any) => void; rej: (e: Error) => void; method: string; timer: ReturnType<typeof setTimeout> }>();
    private listeners = new Set<(e: CdpEvent) => void>();
    closed = false;

    private constructor(private ws: WebSocket) {
        ws.onmessage = (ev) => {
            const m = JSON.parse(String(ev.data));
            if (m.id !== undefined) {
                const p = this.pending.get(m.id);
                if (!p) return;
                this.pending.delete(m.id);
                clearTimeout(p.timer);
                if (m.error) p.rej(new Error(`${p.method}: ${m.error.message}`));
                else p.res(m.result);
            } else if (m.method) {
                for (const l of this.listeners) l({ method: m.method, params: m.params, sessionId: m.sessionId });
            }
        };
        ws.onclose = () => {
            this.closed = true;
            for (const p of this.pending.values()) { clearTimeout(p.timer); p.rej(new Error(`${p.method}: the DevTools socket closed`)); }
            this.pending.clear();
        };
    }

    static async connect(url: string): Promise<Cdp> {
        const ws = new WebSocket(url);
        await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = () => rej(new Error(`could not open the DevTools socket ${url}`)); });
        return new Cdp(ws);
    }

    send<T = any>(method: string, params: object = {}, sessionId?: string, timeoutMs = 30000): Promise<T> {
        if (this.closed) return Promise.reject(new Error(`${method}: the DevTools socket is closed`));
        const id = ++this.id;
        return new Promise<T>((res, rej) => {
            const timer = setTimeout(() => { this.pending.delete(id); rej(new Error(`${method}: no answer within ${timeoutMs} ms`)); }, timeoutMs);
            this.pending.set(id, { res, rej, method, timer });
            this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
        });
    }

    /** Subscribe to every event; returns the unsubscribe function. */
    on(fn: (e: CdpEvent) => void): () => void {
        this.listeners.add(fn);
        return () => { this.listeners.delete(fn); };
    }

    close(): void {
        try { this.ws.close(); } catch { /* already closed */ }
    }
}
