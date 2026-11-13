// scenario.ts: runs one scenario's steps against the legacy page and the Svelte page, snapshots after every step and diffs the two traces.
import { Browser, launchBrowser, type Page, type PageOptions, type ViewportOptions } from "./browser";
import { applyAllow, diffTraces, formatReport, reportOk, type AllowEntry, type ScenarioReport, type Trace } from "./diff";
import { observe, type Observed, type ObserveSpec } from "./observe";
import { startServers, type Servers } from "./servers";

export type Side = "legacy" | "svelte";

export interface Step {
    /** Unique within the scenario; it prefixes every diff path. */
    name: string;
    /** What to do. Omit to just snapshot again. */
    run?: (page: Page, side: Side) => Promise<void>;
    /** Extra observation for this step, merged over the scenario's (selectors, attrs and computed are unioned, the rest replaced). */
    observe?: ObserveSpec;
    /** An assertion on the snapshot of EACH side, so a scenario also documents the absolute behaviour, not only parity. Throw to fail. */
    expect?: (observed: Observed, side: Side, page: Page) => void | Promise<void>;
}

export interface Scenario {
    name: string;
    description?: string;
    /** Page URL path on the legacy server, e.g. "/vpn.html". */
    legacyPath: string;
    /** Page URL path on the Svelte server; defaults to legacyPath. */
    sveltePath?: string;
    /** Viewport and per-page settings (reducedMotion, touch, timers, allowAnalytics). Default 1280x900. */
    viewport?: PageOptions;
    /** Runs after the page loaded, before the first snapshot (wait for hydration and for scripts to run). */
    ready?: (page: Page, side: Side) => Promise<void>;
    steps: Step[];
    /** What every snapshot records. */
    observe: ObserveSpec;
    /** Intended differences, each with a reason. */
    allow?: AllowEntry[];
    /** Pixels of slack for bounding boxes (default 1). */
    tolerance?: number;
    /** Pixels of slack for the scroll position (default 2). */
    scrollTolerance?: number;
}

export const mergeObserve = (base: ObserveSpec, extra: ObserveSpec = {}): ObserveSpec => {
    const union = <T>(a?: T[], b?: T[]): T[] | undefined => (a || b ? [...new Set([...(a ?? []), ...(b ?? [])])] : undefined);
    const out: ObserveSpec = { ...base, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined)) };
    out.selectors = union(base.selectors, extra.selectors);
    out.attrs = union(base.attrs, extra.attrs);
    out.computed = union(base.computed, extra.computed);
    if (base.evals || extra.evals) out.evals = { ...base.evals, ...extra.evals };
    if (base.storage || extra.storage) out.storage = { local: union(base.storage?.local, extra.storage?.local), session: union(base.storage?.session, extra.storage?.session) };
    return out;
};

export const stepNames = (s: Scenario): string[] => ["load", ...s.steps.map((x) => x.name)];

/** Throws on a scenario that cannot run: duplicate or reserved step names, no name, bad allowlist. */
export const validateScenario = (s: Scenario): void => {
    if (!s.name || !/^[a-z0-9][a-z0-9-]*$/.test(s.name)) throw new Error(`scenario name "${s.name}" must be lower-case words joined with hyphens`);
    if (!s.legacyPath.startsWith("/")) throw new Error(`${s.name}: legacyPath must start with /`);
    const seen = new Set<string>(["load"]);
    for (const st of s.steps) {
        if (!st.name.trim()) throw new Error(`${s.name}: a step has no name`);
        if (seen.has(st.name)) throw new Error(`${s.name}: step name "${st.name}" is used twice (or is "load", which is reserved)`);
        seen.add(st.name);
    }
    applyAllow([], s.allow ?? []);
};

export interface World { servers: Servers; browser: Browser; own: { servers: boolean; browser: boolean } }

/** Starts both servers and a browser. Close it when done. */
export const openWorld = async (o: { build: boolean; log?: (s: string) => void; browser?: Browser; servers?: Servers }): Promise<World & { close(): Promise<void> }> => {
    const servers = o.servers ?? (await startServers({ build: o.build, log: o.log }));
    let browser: Browser;
    try { browser = o.browser ?? (await launchBrowser()); } catch (e) { if (!o.servers) servers.stop(); throw e; }
    const world: World = { servers, browser, own: { servers: !o.servers, browser: !o.browser } };
    return { ...world, close: async () => { if (world.own.browser) await browser.close(); if (world.own.servers) servers.stop(); } };
};

export interface SideRun { trace: Trace; errors: string[] }

/** Runs the scenario against one site in a fresh page (its own storage) and returns the snapshot after every step. */
export const runSide = async (world: World, s: Scenario, side: Side): Promise<SideRun> => {
    const base = side === "legacy" ? world.servers.legacy : world.servers.svelte;
    const path = side === "legacy" ? s.legacyPath : s.sveltePath ?? s.legacyPath;
    const page = await world.browser.newPage(s.viewport);
    const trace: Trace = [];
    const errors: string[] = [];
    try {
        let t0 = Date.now();
        const snap = async (name: string, step?: Step): Promise<boolean> => {
            try {
                const observed = await observe(page, mergeObserve(s.observe, step?.observe));
                trace.push({ name, observed, ms: Date.now() - t0 });
                try { await step?.expect?.(observed, side, page); } catch (e) { errors.push(`${side}, step "${name}": expectation failed: ${(e as Error).message}`); }
                return true;
            } catch (e) {
                trace.push({ name, error: `observing failed: ${(e as Error).message}` });
                errors.push(`${side}, step "${name}": ${(e as Error).message}`);
                return false;
            }
        };
        try {
            await page.goto(base + path);
            await s.ready?.(page, side);
            await page.waitForStableLayout();
        } catch (e) {
            trace.push({ name: "load", error: (e as Error).message });
            errors.push(`${side}, step "load": ${(e as Error).message}`);
            return { trace, errors };
        }
        if (!(await snap("load"))) return { trace, errors };
        for (const step of s.steps) {
            t0 = Date.now();
            try { await step.run?.(page, side); } catch (e) {
                trace.push({ name: step.name, error: (e as Error).message });
                errors.push(`${side}, step "${step.name}": ${(e as Error).message}`);
                break;
            }
            if (!(await snap(step.name, step))) break;
        }
        return { trace, errors };
    } finally {
        await page.close();
    }
};

export interface ScenarioResult { report: ScenarioReport; ok: boolean; text: string; legacy: Trace; svelte: Trace; ms: number }

/** Compares two finished traces (pure; used by compareScenario and by the tests). */
export const compareTraces = (s: Pick<Scenario, "name" | "allow" | "tolerance" | "scrollTolerance">, legacy: SideRun, svelte: SideRun): ScenarioResult => {
    const diffs = diffTraces(legacy.trace, svelte.trace, { tolerance: s.tolerance, scrollTolerance: s.scrollTolerance });
    const applied = applyAllow(diffs, s.allow);
    const report: ScenarioReport = { name: s.name, steps: Math.max(legacy.trace.length, svelte.trace.length), diffs: applied.remaining, allowed: applied.allowed, unused: applied.unused, errors: [...legacy.errors, ...svelte.errors] };
    return { report, ok: reportOk(report), text: formatReport(report), legacy: legacy.trace, svelte: svelte.trace, ms: 0 };
};

/** The scenario runner: the same steps on the legacy page and the Svelte page, a snapshot after every step, a readable diff. Pass a world to share servers and browser between scenarios; without one a world is made (building web first) and closed. */
export const compareScenario = async (s: Scenario, world?: World, o: { build?: boolean } = {}): Promise<ScenarioResult> => {
    validateScenario(s);
    const t0 = Date.now();
    const own = world ? undefined : await openWorld({ build: o.build ?? true });
    try {
        const w = world ?? (own as World);
        const legacy = await runSide(w, s, "legacy");
        const svelte = await runSide(w, s, "svelte");
        const r = compareTraces(s, legacy, svelte);
        return { ...r, ms: Date.now() - t0 };
    } finally {
        await own?.close();
    }
};

export type { ViewportOptions };
