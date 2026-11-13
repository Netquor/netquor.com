// dir.ts: the legacy site as it was at the annotated tag legacy-baseline-2026-11, materialized from git into <repo>/.baseline/<short-sha> (git-ignored). It is the permanent regression baseline for the comparison tools (parity, visual, e2e, hydration, payload, smoke) and for tests that use the old site as an oracle, so none of them depend on the stale files being present in the working tree.
// Refreshing the baseline means creating a new tag and changing TAG; the old extraction folder is then simply no longer used (delete .baseline/ to reclaim it).
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const TAG = "legacy-baseline-2026-11";
/** The environment override: a directory used as the baseline as it is, with no git involved. */
export const OVERRIDE_ENV = "NQ_BASELINE_DIR";
const MARKER = ".complete";

export interface BaselineOptions {
    /** A folder inside the repository to resolve the baseline for. Default: this file's folder (so any working directory works). */
    repo?: string;
    /** The tag to extract. Default TAG. */
    tag?: string;
    /** Where the override is read from. Default process.env. */
    env?: Record<string, string | undefined>;
}

const git = (args: string[], cwd: string): { ok: boolean; out: Buffer; err: string } => {
    const r = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
    return { ok: r.exitCode === 0, out: Buffer.from(r.stdout), err: r.stderr.toString().trim() };
};

/** Absolute path of a directory holding the legacy site exactly as in the tag. Extracted on first use, then reused. Throws an Error saying how to fix it when the tag is missing. */
export const baselineDirSync = (o: BaselineOptions = {}): string => {
    const env = o.env ?? process.env;
    const override = env[OVERRIDE_ENV];
    if (override && override.trim()) {
        const dir = resolve(override.trim());
        if (!existsSync(dir)) throw new Error(`${OVERRIDE_ENV} is set to ${dir}, which does not exist`);
        return dir;
    }
    const tag = o.tag ?? TAG;
    const from = o.repo ?? import.meta.dir;
    const top = git(["rev-parse", "--show-toplevel"], from);
    if (!top.ok) throw new Error(`cannot find the git repository from ${from}: ${top.err}`);
    const root = top.out.toString().trim();
    const sha = git(["rev-parse", "--verify", "--quiet", `${tag}^{commit}`], root);
    if (!sha.ok) throw new Error(`the baseline tag ${tag} is missing in ${root}: run "git fetch --tags" (or create the tag at the commit that holds the legacy site) and try again`);
    const full = sha.out.toString().trim();
    const dest = join(root, ".baseline", full.slice(0, 7));
    if (existsSync(join(dest, MARKER))) return dest;

    mkdirSync(dirname(dest), { recursive: true });
    const tmp = mkdtempSync(join(dirname(dest), `.tmp-${full.slice(0, 7)}-`));
    try {
        const archive = git(["archive", "--format=tar", full], root);
        if (!archive.ok) throw new Error(`git archive ${tag} failed: ${archive.err}`);
        const tar = Bun.spawnSync(["tar", "-x", "-C", tmp], { stdin: archive.out, stdout: "pipe", stderr: "pipe" });
        if (tar.exitCode !== 0) throw new Error(`tar failed extracting ${tag}: ${tar.stderr.toString().trim()}`);
        writeFileSync(join(tmp, MARKER), `${tag} ${full}\n`);
        try { renameSync(tmp, dest); } catch (e) {
            // Another process finished first: use its folder. A folder with no marker is a leftover: replace it.
            if (existsSync(join(dest, MARKER))) { rmSync(tmp, { recursive: true, force: true }); return dest; }
            rmSync(dest, { recursive: true, force: true });
            renameSync(tmp, dest);
        }
    } catch (e) {
        rmSync(tmp, { recursive: true, force: true });
        throw e;
    }
    return dest;
};

export const baselineDir = async (o: BaselineOptions = {}): Promise<string> => baselineDirSync(o);
