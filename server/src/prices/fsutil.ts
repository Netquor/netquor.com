// fsutil.ts: writing a file so a reader or a crash never sees half of it: write a temp file in the same folder, fsync it, rename it over the target (rename is atomic on one filesystem), then fsync the folder. Split in two steps (stage, commit) so the store can order several files.
import { closeSync, fsyncSync, openSync, renameSync, unlinkSync, writeSync } from "node:fs";
import { basename, dirname, join } from "node:path";

export interface AtomicHooks {
    /** Runs after the temp file is complete and before the rename. Tests use it to fail or kill the process at the worst moment. */
    beforeRename?: (tempPath: string, targetPath: string) => void;
}

/** Writes content to a fresh temp file beside `path` and fsyncs it. Returns the temp path; nothing at `path` has changed yet. */
export const stageFile = (path: string, content: string): string => {
    const dir = dirname(path);
    const temp = join(dir, `.${basename(path)}.${process.pid}.${crypto.randomUUID().slice(0, 8)}.tmp`);
    const fd = openSync(temp, "w", 0o644);
    try {
        const bytes = Buffer.from(content, "utf8");
        let at = 0;
        while (at < bytes.length) at += writeSync(fd, bytes, at, bytes.length - at);
        fsyncSync(fd);
    } catch (e) {
        closeSync(fd);
        try { unlinkSync(temp); } catch { /* already gone */ }
        throw e;
    }
    closeSync(fd);
    return temp;
};

export const discardStaged = (temp: string): void => { try { unlinkSync(temp); } catch { /* already gone */ } };

/** Renames the staged file over `path`, then fsyncs the folder. The temp file is removed if the rename fails. */
export const commitStaged = (temp: string, path: string, hooks: AtomicHooks = {}): void => {
    try {
        hooks.beforeRename?.(temp, path);
        renameSync(temp, path);
    } catch (e) {
        discardStaged(temp);
        throw e;
    }
    const dir = dirname(path);
    try { const d = openSync(dir, "r"); try { fsyncSync(d); } finally { closeSync(d); } } catch { /* some filesystems cannot fsync a folder; the rename already happened */ }
};

export const writeFileAtomic = (path: string, content: string, hooks: AtomicHooks = {}): void => commitStaged(stageFile(path, content), path, hooks);
