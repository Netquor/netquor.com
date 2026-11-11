// runtime.ts: the process-wide objects the hooks and routes share: the price cache, the Elysia app, the legacy server. Built lazily on first use (never at import time, so `vite build` does not start anything) and once per process.
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { readWebEnv, type WebEnv } from "./env";
import type { HandleRuntime } from "./handle";
import { assetFingerprint, createLegacyServer } from "./legacyServer";
import type { PriceSource } from "./types";

export interface Runtime extends HandleRuntime {
    prices: PriceSource;
    env: WebEnv;
    /** The llms.txt template text, read fresh when its file changes. */
    llmsTemplate(): string;
    /** Short content hash of a legacy asset for ?v= cache busting, the same scheme tools/build-nav.py writes into the legacy pages (md5, 8 hex); memoized per mtime. */
    assetVersion(name: string): string;
}

export interface RuntimeParts {
    prices: PriceSource;
    api: HandleRuntime["api"];
    env: WebEnv;
    cachePages: boolean;
    log?: (line: string) => void;
}

export const createRuntime = (p: RuntimeParts): Runtime => {
    const legacy = createLegacyServer({ legacyDir: p.env.legacyDir, prices: p.prices, log: p.log });
    const versions = new Map<string, { mtimeMs: number; v: string }>();
    let template: { mtimeMs: number; text: string } | null = null;
    return {
        prices: p.prices, env: p.env, legacy, api: p.api, cachePages: p.cachePages,
        llmsTemplate() {
            const path = join(p.env.legacyDir, "llms.template.txt");
            const mtimeMs = statSync(path).mtimeMs;
            if (!template || template.mtimeMs !== mtimeMs) template = { mtimeMs, text: readFileSync(path, "utf8") };
            return template.text;
        },
        assetVersion(name) {
            try {
                const path = join(p.env.legacyDir, name);
                const mtimeMs = statSync(path).mtimeMs;
                const hit = versions.get(name);
                if (hit && hit.mtimeMs === mtimeMs) return hit.v;
                const v = assetFingerprint(readFileSync(path));
                versions.set(name, { mtimeMs, v });
                return v;
            } catch { return "0"; }
        },
    };
};

let instance: Runtime | undefined;
let pending: Promise<Runtime> | undefined;
/** Test seam: install (or clear with undefined) the runtime. */
export const setRuntime = (r: Runtime | undefined): void => { instance = r; pending = undefined; };

export const getRuntime = (): Promise<Runtime> => {
    if (instance) return Promise.resolve(instance);
    // One build even when the first requests arrive together. The server's code (file system, timers) is imported here, not at the top, so nothing of it runs at import time.
    pending ??= import("./pricing").then(async ({ buildWebParts }) => {
        instance = createRuntime({ ...(await buildWebParts()), env: readWebEnv(), cachePages: !import.meta.env.DEV });
        return instance;
    }).catch((e) => { pending = undefined; throw e; });
    return pending;
};
