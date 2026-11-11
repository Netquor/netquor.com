// lead/sinks.ts: where a lead is handed over. FileSink appends a JSON line; WebhookSink posts it, signed; CompositeSink does several and is happy if one works. None of them log what is in a lead.
import { createHmac } from "node:crypto";
import { appendFile, chmod, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { DeliveryMeta, Lead, LeadSink } from "./types";

/** One JSON object per line, in a file only the service's user can read (0600). */
export class FileSink implements LeadSink {
    private queue: Promise<unknown> = Promise.resolve();
    constructor(private readonly path: string) {}

    deliver(lead: Lead, _meta?: DeliveryMeta): Promise<void> {
        // One write at a time, so two leads at once can never interleave in the file.
        const run = this.queue.then(async () => {
            await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
            await appendFile(this.path, JSON.stringify(lead) + "\n", { mode: 0o600 });
            await chmod(this.path, 0o600); // also fixes a file that already existed with wider rights
        });
        this.queue = run.catch(() => {});
        return run;
    }
}

/** X-Netquor-Signature value: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">. */
export const signBody = (secret: string, t: number, body: string): string =>
    `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

/** The body the Netquor API expects (its schema 1, flat; see CONTRACT.md). Empty optionals are left out, and nothing outside the schema is sent. */
export interface LeadPayload {
    schema: 1;
    id: string;
    receivedAt: string;
    source: string;
    name: string;
    email: string;
    company?: string;
    message?: string;
    macs?: number;
    ios?: number;
    term?: string;
    page?: string;
    utm?: { source?: string; medium?: string; campaign?: string };
    ipHash?: string;
}

/** First 32 hex characters of HMAC-SHA256(key = secret, data = client address): lets the API see repeat senders without ever being given an address. */
export const hashIp = (secret: string, ip: string): string => createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);

export function leadPayload(lead: Lead, ipHash?: string): LeadPayload {
    const p: LeadPayload = { schema: 1, id: lead.id, receivedAt: lead.receivedAt, source: lead.source || "site", name: lead.name, email: lead.email };
    if (lead.company) p.company = lead.company;
    if (lead.message) p.message = lead.message;
    if (lead.macs) p.macs = lead.macs;
    if (lead.ios) p.ios = lead.ios;
    if (lead.term) p.term = lead.term;
    if (lead.page) p.page = lead.page;
    if (lead.utm && Object.keys(lead.utm).length) p.utm = { ...lead.utm };
    if (ipHash) p.ipHash = ipHash;
    return p;
}

export interface WebhookSinkOptions {
    url: string;
    secret: string;
    fetch?: typeof fetch;
    /** Milliseconds since the epoch. */
    now?: () => number;
    timeoutMs?: number;
    retryDelayMs?: number;
}

/** POSTs the flat schema-1 lead (leadPayload). One retry on a network error, a timeout, 408, 429 or 5xx; any other answer is final. */
export class WebhookSink implements LeadSink {
    private readonly fetchFn: typeof fetch;
    private readonly now: () => number;
    private readonly timeoutMs: number;
    private readonly retryDelayMs: number;
    constructor(private readonly o: WebhookSinkOptions) {
        this.fetchFn = o.fetch ?? fetch;
        this.now = o.now ?? Date.now;
        this.timeoutMs = o.timeoutMs ?? 5000;
        this.retryDelayMs = o.retryDelayMs ?? 250;
    }

    async deliver(lead: Lead, meta?: DeliveryMeta): Promise<void> {
        const body = JSON.stringify(leadPayload(lead, meta?.clientIp ? hashIp(this.o.secret, meta.clientIp) : undefined));
        let last = "no attempt";
        for (let attempt = 0; attempt < 2; attempt++) {
            if (attempt > 0) await new Promise((r) => setTimeout(r, this.retryDelayMs));
            const t = Math.floor(this.now() / 1000);
            try {
                const res = await this.fetchFn(this.o.url, {
                    method: "POST",
                    headers: { "content-type": "application/json", "x-netquor-signature": signBody(this.o.secret, t, body) },
                    body,
                    redirect: "error",
                    signal: AbortSignal.timeout(this.timeoutMs),
                });
                await res.body?.cancel().catch(() => {});
                if (res.ok) return;
                last = `webhook answered ${res.status}`;
                if (!(res.status >= 500 || res.status === 408 || res.status === 429)) break;
            } catch (e) {
                last = e instanceof Error && e.name === "TimeoutError" ? "webhook timed out" : "webhook could not be reached";
            }
        }
        throw new Error(last);
    }
}

/** Delivers to every sink at once; fine if at least one takes it. */
export class CompositeSink implements LeadSink {
    constructor(private readonly sinks: { name: string; sink: LeadSink }[], private readonly log: (message: string) => void = console.error) {}

    async deliver(lead: Lead, meta?: DeliveryMeta): Promise<void> {
        const results = await Promise.allSettled(this.sinks.map((s) => s.sink.deliver(lead, meta)));
        let ok = false;
        results.forEach((r, i) => {
            if (r.status === "fulfilled") ok = true;
            else this.log(`lead sink ${this.sinks[i].name} failed: ${r.reason instanceof Error ? r.reason.message : "unknown error"}`);
        });
        if (!ok) throw new Error("no lead sink accepted the lead");
    }
}
