// servers.ts: the two servers a scenario compares. The legacy site is the baseline (the legacy-baseline-2026-11 tag extracted under .baseline/) behind a tiny static server (no price stamping: legacy pages show the prices written in them). The Svelte site is the built server started exactly as scripts/parity/run.ts does (seed prices, temp data folder, throwaway secret).
import { baselineDirSync } from "../baseline/dir";
import { serveBaseline } from "../baseline/server";
import { startServer, type Served } from "../parity/run";

export { resolveLegacyFile } from "../baseline/server";

export interface Static { base: string; dir: string; stop(): void }

/** The legacy site (the baseline directory unless a root is given) behind a tiny static server. */
export const startLegacyStatic = (root: string = baselineDirSync()): Static => serveBaseline({ dir: root });

export interface Servers { legacy: string; svelte: string; /** The directory the legacy side is served from (under .baseline/). */ baselineDir: string; stop(): void }

/** Starts both servers. The Svelte one builds first unless build is false. */
export const startServers = async (o: { build: boolean; log?: (s: string) => void }): Promise<Servers> => {
    const legacy = startLegacyStatic();
    o.log?.(`baseline: ${legacy.dir}`);
    let svelte: Served;
    try { svelte = await startServer(o); } catch (e) { legacy.stop(); throw e; }
    return { legacy: legacy.base, svelte: svelte.base, baselineDir: legacy.dir, stop: () => { legacy.stop(); svelte.stop(); } };
};

