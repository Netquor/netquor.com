// operator.ts: the logic behind scripts/send-prices.ts, the tool an operator uses to push a snapshot to the local web process: to accept a large change (--allow-large), to lower the version counter to match the API (--rebase-version), or just to set prices by hand. It signs the body with PRICING_WEBHOOK_SECRET exactly as the API does and POSTs it to /hooks/pricing; the web process applies the same rules as for any sender. A reason is required and is logged by the web process.
import { readFileSync } from "node:fs";
import { signBody } from "./signature";
import { validateServiceUrl } from "./url";

export interface OperatorArgs { file: string; reason: string; allowLarge: boolean; rebaseVersion: boolean }

export const USAGE = 'usage: bun server/scripts/send-prices.ts <snapshot.json> --reason "<text>" [--allow-large] [--rebase-version]';

export const parseOperatorArgs = (argv: string[]): OperatorArgs | { error: string } => {
    let file = "", reason = "", allowLarge = false, rebaseVersion = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--allow-large") allowLarge = true;
        else if (a === "--rebase-version") rebaseVersion = true;
        else if (a === "--reason") { reason = argv[++i] ?? ""; }
        else if (a.startsWith("--reason=")) reason = a.slice("--reason=".length);
        else if (a.startsWith("--")) return { error: `unknown option ${a}` };
        else if (!file) file = a;
        else return { error: "only one snapshot file" };
    }
    if (!file) return { error: "a snapshot file is required" };
    if (!reason.trim()) return { error: "--reason is required (it is logged)" };
    if (reason.length > 200) return { error: "--reason must be at most 200 characters" };
    return { file, reason: reason.trim(), allowLarge, rebaseVersion };
};

export interface OperatorRequest { url: string; body: string; headers: Record<string, string> }

/** The signed request, ready to send. `snapshotJson` is the text of the snapshot file. */
export const buildOperatorRequest = (o: { args: OperatorArgs; snapshotJson: string; secret: string; baseUrl: string; nowMs: number }): OperatorRequest | { error: string } => {
    let snapshot: unknown;
    try { snapshot = JSON.parse(o.snapshotJson); } catch { return { error: `${o.args.file} is not JSON` }; }
    const target = validateServiceUrl(o.baseUrl, { plainHttp: "any" });
    if (!target.ok) return { error: `the web address ${target.reason}` };
    const body = JSON.stringify({
        snapshot, via: "operator", reason: o.args.reason,
        ...(o.args.allowLarge ? { allowLargeChange: true } : {}),
        ...(o.args.rebaseVersion ? { rebaseVersion: true } : {}),
    });
    const t = Math.floor(o.nowMs / 1000);
    return { url: new URL("/hooks/pricing", target.url.origin).href, body, headers: { "content-type": "application/json", "x-netquor-signature": `t=${t},v1=${signBody(o.secret, t, body)}` } };
};

/** The whole tool, with its inputs passed in. Returns the process exit code. */
export const runOperator = async (o: { argv: string[]; env: Record<string, string | undefined>; fetch: (url: string, init: RequestInit) => Promise<Response>; now: () => number; out: (l: string) => void; err: (l: string) => void; readFile?: (p: string) => string }): Promise<number> => {
    const args = parseOperatorArgs(o.argv);
    if ("error" in args) { o.err(`send-prices: ${args.error}\n${USAGE}`); return 2; }
    const secret = (o.env.PRICING_WEBHOOK_SECRET ?? "").trim();
    if (secret.length < 16) { o.err("send-prices: PRICING_WEBHOOK_SECRET is not set (16+ characters)"); return 2; }
    let text: string;
    try { text = (o.readFile ?? ((p: string) => readFileSync(p, "utf8")))(args.file); } catch { o.err(`send-prices: cannot read ${args.file}`); return 2; }
    const req = buildOperatorRequest({ args, snapshotJson: text, secret, baseUrl: (o.env.WEB_INTERNAL_URL ?? "").trim() || "http://127.0.0.1:3000", nowMs: o.now() });
    if ("error" in req) { o.err(`send-prices: ${req.error}`); return 2; }
    let res: Response;
    try { res = await o.fetch(req.url, { method: "POST", body: req.body, headers: req.headers, redirect: "error", signal: AbortSignal.timeout(15_000) }); }
    catch { o.err("send-prices: could not reach the web process"); return 1; }
    const answer = (await res.text()).slice(0, 2000);
    if (res.status === 200) { o.out(`send-prices: accepted ${answer}`); return 0; }
    o.err(`send-prices: refused (${res.status}) ${answer}`);
    return 1;
};
