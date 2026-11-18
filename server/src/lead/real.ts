// lead/real.ts: builds the sinks the environment asks for. Used by index.ts.
import type { Config } from "../lib/config";
import { CompositeSink, FileSink, WebhookSink } from "./sinks";
import type { LeadSink } from "./types";

export function realLeadSink(config: Config): LeadSink {
    const sinks: { name: string; sink: LeadSink }[] = [];
    if (config.leadFile) sinks.push({ name: "file", sink: new FileSink(config.leadFile) });
    if (config.leadForwardUrl) sinks.push({ name: "webhook", sink: new WebhookSink({ url: config.leadForwardUrl, secret: config.leadForwardSecret }) });
    return sinks.length === 1 ? sinks[0].sink : new CompositeSink(sinks);
}
