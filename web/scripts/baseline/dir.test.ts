import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TAG, baselineDir, baselineDirSync } from "./dir";

const sh = (cwd: string, ...args: string[]) => {
    const r = Bun.spawnSync(args, { cwd, stdout: "pipe", stderr: "pipe", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" } });
    if (r.exitCode !== 0) throw new Error(`${args.join(" ")}: ${r.stderr.toString()}`);
    return r.stdout.toString().trim();
};

let outer = "";
let repo = "";
let sha = "";
const NO_ENV = {};

beforeAll(() => {
    outer = realpathSync(mkdtempSync(join(tmpdir(), "nq-baseline-test-")));
    repo = join(outer, "repo");
    mkdirSync(join(repo, "sub", "deeper"), { recursive: true });
    mkdirSync(join(repo, "fleet"), { recursive: true });
    sh(repo, "git", "init", "-q");
    sh(repo, "git", "config", "user.email", "t@example.com");
    sh(repo, "git", "config", "user.name", "t");
    writeFileSync(join(repo, "index.html"), "<h1>old home</h1>");
    writeFileSync(join(repo, "fleet", "site.js"), "//old");
    sh(repo, "git", "add", "-A");
    sh(repo, "git", "commit", "-q", "-m", "legacy");
    sh(repo, "git", "tag", "-a", "tmp-baseline", "-m", "tmp");
    sha = sh(repo, "git", "rev-parse", "HEAD");
    // The working tree moves on after the tag: the baseline must still be the tagged content.
    writeFileSync(join(repo, "index.html"), "<h1>new home</h1>");
    sh(repo, "git", "commit", "-q", "-am", "newer");
});
afterAll(() => rmSync(outer, { recursive: true, force: true }));

describe("baselineDirSync", () => {
    test("the real tag name is the contract", () => expect(TAG).toBe("legacy-baseline-2026-11"));

    test("extracts the tag's content into <repo>/.baseline/<short-sha> and marks it complete", () => {
        const dir = baselineDirSync({ repo, tag: "tmp-baseline", env: NO_ENV });
        expect(dir).toBe(join(repo, ".baseline", sha.slice(0, 7)));
        expect(readFileSync(join(dir, "index.html"), "utf8")).toBe("<h1>old home</h1>");
        expect(readFileSync(join(dir, "fleet", "site.js"), "utf8")).toBe("//old");
        expect(existsSync(join(dir, ".complete"))).toBe(true);
        expect(readdirSync(join(repo, ".baseline")).filter((n) => n.startsWith(".tmp-"))).toEqual([]);
    });

    test("works from a subfolder and is idempotent: a second call reuses the folder untouched", () => {
        const first = baselineDirSync({ repo, tag: "tmp-baseline", env: NO_ENV });
        const stamp = statSync(join(first, ".complete")).mtimeMs;
        writeFileSync(join(first, "canary.txt"), "still here");
        const again = baselineDirSync({ repo: join(repo, "sub", "deeper"), tag: "tmp-baseline", env: NO_ENV });
        expect(again).toBe(first);
        expect(statSync(join(again, ".complete")).mtimeMs).toBe(stamp);
        expect(readFileSync(join(again, "canary.txt"), "utf8")).toBe("still here");
    });

    test("a folder without the marker is a leftover and is replaced by a clean extraction", () => {
        const dir = baselineDirSync({ repo, tag: "tmp-baseline", env: NO_ENV });
        rmSync(join(dir, ".complete"));
        writeFileSync(join(dir, "junk.txt"), "partial");
        const again = baselineDirSync({ repo, tag: "tmp-baseline", env: NO_ENV });
        expect(again).toBe(dir);
        expect(existsSync(join(dir, "junk.txt"))).toBe(false);
        expect(existsSync(join(dir, ".complete"))).toBe(true);
        expect(readFileSync(join(dir, "index.html"), "utf8")).toBe("<h1>old home</h1>");
    });

    test("NQ_BASELINE_DIR overrides everything and skips git (works outside a repository, even with a missing tag)", () => {
        const plain = mkdtempSync(join(tmpdir(), "nq-baseline-override-"));
        try {
            expect(baselineDirSync({ repo: plain, tag: "no-such-tag", env: { NQ_BASELINE_DIR: plain } })).toBe(plain);
            expect(() => baselineDirSync({ env: { NQ_BASELINE_DIR: join(plain, "missing") } })).toThrow(/does not exist/);
        } finally { rmSync(plain, { recursive: true, force: true }); }
    });

    test("a missing tag throws an Error that says how to fix it", () => {
        let err: unknown;
        try { baselineDirSync({ repo, tag: "no-such-tag", env: NO_ENV }); } catch (e) { err = e; }
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain("git fetch --tags");
        expect((err as Error).message).toContain("no-such-tag");
    });

    test("outside any git repository it says so", () => {
        const plain = mkdtempSync(join(tmpdir(), "nq-baseline-nogit-"));
        try { expect(() => baselineDirSync({ repo: plain, tag: "x", env: NO_ENV })).toThrow(/git repository/); } finally { rmSync(plain, { recursive: true, force: true }); }
    });

    test("baselineDir (async) gives the same path", async () => {
        expect(await baselineDir({ repo, tag: "tmp-baseline", env: NO_ENV })).toBe(baselineDirSync({ repo, tag: "tmp-baseline", env: NO_ENV }));
    });
});

describe("the real baseline of this repository", () => {
    test("is extracted under .baseline and holds the legacy site", () => {
        const dir = baselineDirSync();
        expect(dir).toMatch(/[\\/]\.baseline[\\/][0-9a-f]{7}$/);
        for (const f of ["index.html", "nq.css", "nav.js", "fleet/site.js", "subnet-calculator.html"]) expect(existsSync(join(dir, f))).toBe(true);
    });
});
