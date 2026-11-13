import { describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	SCRIPTS, StepError, assetsToSync, choosePrevious, composeUsesWebImage, entrypointInImage, makeImageRef, parseArgs, parseEnvFile,
	parseHashes, parseKv, parseState, realPipe, remoteCmd, requiredNetworks, resolveConfig, run, scpArgv, selectPruneTags, selectRollback,
	shq, sshArgv, summarizeDetail, syncAssets, type Config, type Deps, type ExecResult, type Options, type Script, ConfigError, UsageError,
} from "./deploy";

const CFG: Config = { host: "example.invalid", user: "debian", dir: "/opt/netquor-web" };
const CTL = "/tmp/nqd-test";
const NEW = "netquor-com-web:abc1234-20261110120000";
const OLD = "netquor-com-web:0000000-20261101000000";
const COMPOSE = "services:\n  web:\n    image: ${WEB_IMAGE:-ghcr.io/netquor/netquor-com-web:main}\n";
const DOCKERFILE = "COPY deploy/entrypoint.sh /app/entrypoint.sh\n";

const opts = (o: Partial<Options> = {}): Options => ({ mode: "deploy", dryRun: false, skipTests: false, yes: false, showScripts: false, ...o });

interface Call { argv: string[]; stdin?: string; cwd?: string; script?: string }
type Handler = (c: Call) => Partial<ExecResult> | undefined;

function world(handlers: Record<string, Handler> = {}, files: Record<string, string> = {}, extra: Partial<Deps> = {}) {
	const calls: Call[] = [];
	const pipes: string[][][] = [];
	const out: string[] = [];
	const errs: string[] = [];
	const byBody = new Map<string, string>(Object.values(SCRIPTS).map((s: Script) => [s.body, s.name]));
	const fs: Record<string, string> = { "deploy/docker-compose.yml": COMPOSE, Dockerfile: DOCKERFILE, "deploy/netquor-site-update": "u", "deploy/netquor-site-update.service": "s", "deploy/netquor-site-update.timer": "t", "deploy/edge/Caddyfile": "c", "deploy/edge/docker-compose.yml": "d", ...files };
	const deps: Deps = {
		exec: async (argv, o = {}) => {
			const script = o.stdin !== undefined ? byBody.get(o.stdin) : undefined;
			const call: Call = { argv, stdin: o.stdin, cwd: o.cwd, script };
			calls.push(call);
			const key = script ?? argv[0]!;
			const h = handlers[key] ?? handlers[`${argv[0]} ${argv[1]}`];
			const r = h?.(call);
			if (r) return { code: 0, stdout: "", stderr: "", ...r };
			if (argv[0] === "git" && argv[1] === "rev-parse") return { code: 0, stdout: "abc1234\n", stderr: "" };
			if (argv[0] === "git") return { code: 0, stdout: "", stderr: "" };
			if (argv[0] === "docker" && argv[1] === "image") return { code: 0, stdout: `sha256:${"a".repeat(64)}\n`, stderr: "" };
			return { code: 0, stdout: "", stderr: "" };
		},
		pipe: async (a) => { pipes.push(a); return { codes: a.map(() => 0), bytes: 5 * 1024 * 1024, stdout: "", stderr: "" }; },
		log: (l) => out.push(l),
		err: (l) => errs.push(l),
		confirm: async () => false,
		now: () => new Date(Date.UTC(2026, 10, 10, 12, 0, 0)),
		readText: (p) => fs[p] ?? null,
		repoRoot: "/repo",
		ctlDir: CTL,
		isTTY: false,
		...extra,
	};
	return { deps, calls, pipes, out, errs, scripts: () => calls.filter((c) => c.script).map((c) => c.script!), text: () => [...out, ...errs].join("\n") };
}

const PF_OK = { stdout: "ENV present\nPREFLIGHT ok\n" };
const okDeploy: Record<string, Handler> = {
	preflight: () => PF_OK,
	"ensure-image": (c) => ({ stdout: c.argv.at(-1)!.includes("sha256") ? "ABSENT\n" : "PRESENT\n" }),
	hashes: () => ({ stdout: "HASH compose none\nHASH update none\n" }),
	state: () => ({ stdout: `FILE_WEB_IMAGE=${OLD}\nFILE_PREVIOUS_IMAGE=netquor-com-web:1111111-20261001000000\nRUNNING_IMAGE=${OLD}\n` }),
	"wait-healthy": () => ({ stdout: "HEALTHY after 4 s\n" }),
	timer: () => ({ stdout: "TIMER disabled\n" }),
	"list-images": () => ({ stdout: [NEW, OLD, "netquor-com-web:2222222-20261002000000", "netquor-com-web:3333333-20261001000000", "netquor-com-web:4444444-20260901000000"].join("\n") }),
};

describe("config", () => {
	test("process env beats the file, the file beats defaults", () => {
		const c = resolveConfig({ DEPLOY_HOST: "a.example", DEPLOY_USER: "" }, { DEPLOY_HOST: "b.example", DEPLOY_USER: "alice", DEPLOY_PORT: "2222", DEPLOY_DIR: "/srv/x/" });
		expect(c).toEqual({ host: "a.example", user: "alice", port: 2222, dir: "/srv/x" });
		expect(resolveConfig({ DEPLOY_HOST: "h" }, {})).toEqual({ host: "h", user: "debian", dir: "/opt/netquor-web" });
	});
	test("DEPLOY_HOST is required", () => { expect(() => resolveConfig({}, {})).toThrow(ConfigError); });
	test("rejects values that could inject ssh options or shell text", () => {
		for (const h of ["-oProxyCommand=x", "a;rm -rf /", "a b", "a$(id)", "a\nb", "`id`", "a'b"]) expect(() => resolveConfig({ DEPLOY_HOST: h }, {})).toThrow(ConfigError);
		for (const d of ["/opt/x; rm -rf /", "relative", "/", "/a/../b", "/a//b", "/a b", "/a$HOME", "/a'b"]) expect(() => resolveConfig({ DEPLOY_HOST: "h", DEPLOY_DIR: d }, {})).toThrow(ConfigError);
		for (const u of ["Root", "a b", "-x", "a;b"]) expect(() => resolveConfig({ DEPLOY_HOST: "h", DEPLOY_USER: u }, {})).toThrow(ConfigError);
		for (const p of ["0", "70000", "22a", "-1"]) expect(() => resolveConfig({ DEPLOY_HOST: "h", DEPLOY_PORT: p }, {})).toThrow(ConfigError);
		expect(() => resolveConfig({ DEPLOY_HOST: "h", DEPLOY_SSH_KEY: "-oFoo" }, {})).toThrow(ConfigError);
	});
	test("key path expands ~/ and is kept as one argv element", () => {
		expect(resolveConfig({ DEPLOY_HOST: "h", DEPLOY_SSH_KEY: "~/.ssh/k" }, {}, "/home/u").sshKey).toBe("/home/u/.ssh/k");
	});
	test("env file parser: comments, quotes, export, blanks", () => {
		expect(parseEnvFile("# c\n\nDEPLOY_HOST=h\nexport DEPLOY_USER=\"bob\"\nDEPLOY_DIR='/x'\nbad line\n")).toEqual({ DEPLOY_HOST: "h", DEPLOY_USER: "bob", DEPLOY_DIR: "/x" });
	});
});

describe("arguments", () => {
	test("modes and flags", () => {
		expect(parseArgs([]).mode).toBe("deploy");
		expect(parseArgs(["--dry-run", "--skip-tests"])).toMatchObject({ mode: "deploy", dryRun: true, skipTests: true });
		expect(parseArgs(["--edge", "--yes"])).toMatchObject({ mode: "edge", yes: true });
		for (const m of ["rollback", "init-env", "status", "logs", "auto"]) expect(parseArgs([`--${m}`]).mode as string).toBe(m);
	});
	test("rejects unknown flags, two commands, misplaced flags", () => {
		expect(() => parseArgs(["--nope"])).toThrow(UsageError);
		expect(() => parseArgs(["--status", "--logs"])).toThrow(UsageError);
		expect(() => parseArgs(["--status", "--skip-tests"])).toThrow(UsageError);
		expect(() => parseArgs(["--yes"])).toThrow(UsageError);
	});
});

describe("argv construction", () => {
	test("ssh and scp carry the required options, key and port", () => {
		const cfg = { ...CFG, sshKey: "/k/id", port: 2200 };
		const s = sshArgv(cfg, CTL, "true");
		expect(s.slice(0, 1)).toEqual(["ssh"]);
		for (const o of ["BatchMode=yes", "ConnectTimeout=10", "ControlMaster=auto", "ControlPersist=60s", `ControlPath=${CTL}/%C`]) expect(s).toContain(o);
		expect(s.join(" ")).toContain("-i /k/id");
		expect(s.join(" ")).toContain("-p 2200");
		expect(s.at(-2)).toBe("debian@example.invalid");
		const c = scpArgv(cfg, CTL, ["a", "b"], "/d");
		expect(c.join(" ")).toContain("-P 2200");
		expect(c.at(-1)).toBe("debian@example.invalid:/d/");
		expect(sshArgv(CFG, CTL, "true").join(" ")).not.toContain("-i ");
	});
	test("remote scripts go through stdin and sh -s with quoted positional args", () => {
		const c = remoteCmd(CFG, CTL, SCRIPTS.state, ["/opt/netquor-web"]);
		expect(c.argv.at(-1)).toBe("sh -s -- /opt/netquor-web");
		expect(c.script).toBe(SCRIPTS.state);
		const h = remoteCmd(CFG, CTL, SCRIPTS.logs, ["a b; rm -rf /", "it's"]);
		expect(h.argv.at(-1)).toBe(`sh -s -- 'a b; rm -rf /' 'it'\\''s'`);
		expect(() => remoteCmd(CFG, CTL, SCRIPTS.logs, ["a\nb"])).toThrow();
	});
	test("shq", () => { expect(shq("abc/def-1.2")).toBe("abc/def-1.2"); expect(shq("")).toBe("''"); expect(shq("a$b")).toBe("'a$b'"); });
	test("image tag format, utc, dirty suffix, bad sha", () => {
		const d = new Date(Date.UTC(2026, 0, 2, 3, 4, 5));
		expect(makeImageRef("abc1234", d, false)).toBe("netquor-com-web:abc1234-20260102030405");
		expect(makeImageRef("abc1234", d, true)).toBe("netquor-com-web:abc1234-20260102030405-dirty");
		expect(makeImageRef("", d, false)).toBe("netquor-com-web:nogit-20260102030405");
	});
});

describe("pure selection", () => {
	test("choosePrevious never loses the previous image", () => {
		const s = { fileWeb: OLD, filePrevious: "netquor-com-web:1", running: "" };
		expect(choosePrevious(NEW, { fileWeb: OLD, filePrevious: "", running: "" })).toBe(OLD);
		expect(choosePrevious(NEW, { fileWeb: "", filePrevious: "", running: OLD })).toBe(OLD);
		expect(choosePrevious(OLD, { ...s, filePrevious: "netquor-com-web:1" })).toBe("netquor-com-web:1");
		expect(choosePrevious(NEW, { fileWeb: "", filePrevious: "", running: "" })).toBe("");
	});
	test("selectRollback swaps; none recorded is an error", () => {
		expect(selectRollback({ fileWeb: NEW, filePrevious: OLD, running: NEW })).toEqual({ target: OLD, newPrevious: NEW });
		expect(() => selectRollback({ fileWeb: NEW, filePrevious: "", running: "" })).toThrow(StepError);
	});
	test("parseState ignores values that are not image refs", () => {
		expect(parseState(`FILE_WEB_IMAGE=${NEW}\nFILE_PREVIOUS_IMAGE=$(id)\n`)).toEqual({ fileWeb: NEW, filePrevious: "", running: "" });
	});
	test("prune keeps the newest 3 plus anything in use, only netquor-com-web tags", () => {
		const list = [NEW, OLD, "netquor-com-web:c", "netquor-com-web:d", "netquor-com-web:e", "other:x", "netquor-com-web:<none>"];
		expect(selectPruneTags(list, [NEW, OLD])).toEqual(["netquor-com-web:d", "netquor-com-web:e"]);
		expect(selectPruneTags(list, [NEW, "netquor-com-web:e"])).toEqual(["netquor-com-web:d"]);
		expect(selectPruneTags([NEW], [])).toEqual([]);
	});
	test("networks, entrypoint, compose and sync selection", () => {
		expect(requiredNetworks(COMPOSE)).toEqual(["edge"]);
		expect(requiredNetworks("networks: [web_front]")).toEqual(["edge", "web_front"]);
		expect(entrypointInImage(DOCKERFILE)).toBe(true);
		expect(entrypointInImage("COPY x y")).toBe(false);
		expect(composeUsesWebImage(COMPOSE)).toBe(true);
		expect(composeUsesWebImage("image: ghcr.io/x:main")).toBe(false);
		expect(syncAssets(CFG, true).map((a) => a.key)).toEqual(["compose", "update", "service", "timer"]);
		expect(syncAssets(CFG, false).map((a) => a.key)).toContain("entrypoint");
		const a = syncAssets(CFG, true);
		expect(assetsToSync(a, { compose: "x", update: "y", service: "z", timer: "t" }, { compose: "x", update: "OTHER", service: "z", timer: "none" }).map((s) => s.key)).toEqual(["update", "timer"]);
		expect(parseHashes(`HASH compose ${"a".repeat(64)}\nHASH timer none\nHASH x zz`)).toEqual({ compose: "a".repeat(64), timer: "none" });
		expect(parseKv("A=1\nb=2\nC_D=x=y")).toEqual({ A: "1", C_D: "x=y" });
	});
	test("health summary", () => {
		expect(summarizeDetail(JSON.stringify({ ok: true, uptimeSeconds: 60, prices: { version: 7, updatedAt: "2026", ageSeconds: 3 } }))).toContain("prices version 7, updatedAt 2026");
		expect(summarizeDetail('{"ok":true,"prices":null}')).toContain("none loaded");
		expect(summarizeDetail("<html>")).toContain("not answer");
	});
});

describe("dry run", () => {
	const modes: Partial<Options>[] = [{}, { skipTests: true }, { mode: "rollback" }, { mode: "init-env" }, { mode: "edge" }, { mode: "status" }, { mode: "logs" }, { mode: "auto" }];
	for (const m of modes) {
		test(`${m.mode ?? "deploy"}${m.skipTests ? " --skip-tests" : ""} executes nothing but read-only git and prints the host`, async () => {
			const w = world();
			const code = await run(opts({ ...m, dryRun: true }), CFG, w.deps);
			expect(code).toBe(0);
			expect(w.calls.every((c) => c.argv[0] === "git" && (c.argv[1] === "rev-parse" || c.argv[1] === "status"))).toBe(true);
			expect(w.pipes).toHaveLength(0);
			const t = w.text();
			expect(t).toContain("debian@example.invalid");
			expect(t).toContain("DRY RUN");
		});
	}
	test("the full plan lists 13 steps and the exact build command; --show-scripts adds scripts", async () => {
		const w = world();
		await run(opts({ dryRun: true, showScripts: true }), CFG, w.deps);
		const t = w.text();
		for (let i = 1; i <= 13; i++) expect(t).toContain(`[${i}/13]`);
		expect(t).toContain("docker buildx build --platform linux/amd64 --load -t netquor-com-web:abc1234-20261110120000 .");
		expect(t).toContain("docker save netquor-com-web:abc1234-20261110120000 | gzip |");
		expect(t).toContain("| set -u");
		expect(t).toContain("sudo -n systemctl disable --now");
	});
	test("a dirty tree shows in the tag and a warning", async () => {
		const w = world({ git: (c) => (c.argv[1] === "status" ? { stdout: " M x\n" } : undefined) });
		await run(opts({ dryRun: true }), CFG, w.deps);
		expect(w.text()).toContain("-dirty");
	});
});

describe("full deploy", () => {
	test("happy path order, tag, previous kept, timer disabled, prune of old tags", async () => {
		const w = world(okDeploy);
		const code = await run(opts(), CFG, w.deps);
		expect(code).toBe(0);
		const kinds = w.calls.map((c) => c.script ?? `${c.argv[0]} ${c.argv[1]}`);
		const idx = (k: string): number => kinds.indexOf(k);
		expect(idx("preflight")).toBeLessThan(idx("bun test"));
		expect(idx("bun test")).toBeLessThan(idx("docker buildx"));
		expect(idx("docker buildx")).toBeLessThan(idx("write-deploy-env"));
		expect(idx("write-deploy-env")).toBeLessThan(idx("compose-up"));
		expect(idx("compose-up")).toBeLessThan(idx("wait-healthy"));
		expect(idx("wait-healthy")).toBeLessThan(idx("timer"));
		expect(idx("timer")).toBeLessThan(idx("prune"));
		expect(w.calls.filter((c) => c.argv[0] === "bun" || c.argv[0] === "bunx").map((c) => `${c.cwd}:${c.argv.join(" ")}`)).toEqual([
			"/repo/server:bun test", "/repo/server:bunx tsc --noEmit", "/repo/web:bun test", "/repo/web:bunx tsc --noEmit",
		]);
		const wr = w.calls.find((c) => c.script === "write-deploy-env")!;
		expect(wr.argv.at(-1)).toContain(`${NEW} ${OLD}`);
		const pr = w.calls.find((c) => c.script === "prune")!;
		expect(pr.argv.at(-1)).toContain("netquor-com-web:3333333-20261001000000");
		expect(pr.argv.at(-1)).toContain("netquor-com-web:4444444-20260901000000");
		expect(pr.argv.at(-1)).not.toContain(OLD);
		expect(w.pipes).toHaveLength(1);
		expect(w.text()).toContain("5.0 MB");
		expect(w.text()).toContain("disabled");
		expect(w.text()).toContain("--rollback");
	});
	test("--skip-tests runs no tests", async () => {
		const w = world(okDeploy);
		await run(opts({ skipTests: true }), CFG, w.deps);
		expect(w.calls.some((c) => c.argv[0] === "bun" || c.argv[0] === "bunx")).toBe(false);
	});
	test("an image the server already has is tagged and not transferred", async () => {
		const w = world({ ...okDeploy, "ensure-image": () => ({ stdout: "PRESENT\n" }) });
		expect(await run(opts(), CFG, w.deps)).toBe(0);
		expect(w.pipes).toHaveLength(0);
		expect(w.text()).toContain("skipped the transfer");
	});
	test("only differing files are synced; none when equal", async () => {
		const w = world(okDeploy);
		await run(opts(), CFG, w.deps);
		expect(w.calls.some((c) => c.argv[0] === "scp")).toBe(true);
		const inst = w.calls.find((c) => c.script === "install")!;
		expect(inst.argv.at(-1)).toBe("sh -s -- /opt/netquor-web 1 0 1 1 1");
		const { sha256 } = await import("./deploy");
		const same = world({ ...okDeploy, hashes: () => ({ stdout: `HASH compose ${sha256(COMPOSE)}\nHASH update ${sha256("u")}\nHASH service ${sha256("s")}\nHASH timer ${sha256("t")}\n` }) });
		await run(opts(), CFG, same.deps);
		expect(same.calls.some((c) => c.argv[0] === "scp")).toBe(false);
		expect(same.text()).toContain("already up to date");
	});
	test("tests that fail stop before the build", async () => {
		const w = world({ ...okDeploy, bun: () => ({ code: 1 }) });
		expect(await run(opts(), CFG, w.deps)).toBe(1);
		expect(w.calls.some((c) => c.argv[1] === "buildx")).toBe(false);
	});
	test("missing .env refuses before build and suggests --init-env", async () => {
		const w = world({ ...okDeploy, preflight: () => ({ stdout: "ENV missing\nPREFLIGHT ok\n" }) });
		expect(await run(opts(), CFG, w.deps)).toBe(1);
		expect(w.text()).toContain("--init-env");
		expect(w.calls.some((c) => c.argv[1] === "buildx")).toBe(false);
	});
	test("missing network prints the exact create command and stops", async () => {
		const w = world({ ...okDeploy, preflight: () => ({ stdout: "NETWORK-MISSING edge\nENV present\nPREFLIGHT ok\n" }) });
		expect(await run(opts(), CFG, w.deps)).toBe(1);
		expect(w.text()).toContain("docker network create edge");
		expect(w.calls.some((c) => c.argv[1] === "buildx")).toBe(false);
	});
	test("a compose file that ignores WEB_IMAGE is refused up front", async () => {
		const w = world(okDeploy, { "deploy/docker-compose.yml": "image: ghcr.io/x:main" });
		expect(await run(opts(), CFG, w.deps)).toBe(1);
		expect(w.text()).toContain("WEB_IMAGE");
		expect(w.calls).toHaveLength(2);
	});
	test("ssh failure is explained", async () => {
		const w = world({ ...okDeploy, preflight: () => ({ code: 255, stderr: "Permission denied" }) });
		expect(await run(opts(), CFG, w.deps)).toBe(1);
		expect(w.text()).toContain("BatchMode");
	});
	test("an unhealthy deploy rolls back to the previous image, shows 30 log lines, exits non-zero, skips timer and prune", async () => {
		const w = world({ ...okDeploy, "wait-healthy": (c) => (c.argv.at(-1)!.includes(NEW) || w.calls.filter((x) => x.script === "wait-healthy").length === 1 ? { code: 30, stdout: "UNHEALTHY\n" } : { stdout: "HEALTHY\n" }), logs: () => ({ stdout: "boom line\n" }) });
		const code = await run(opts(), CFG, w.deps);
		expect(code).toBe(1);
		const envWrites = w.calls.filter((c) => c.script === "write-deploy-env");
		expect(envWrites).toHaveLength(2);
		expect(envWrites[1]!.argv.at(-1)).toContain(`${OLD} netquor-com-web:1111111-20261001000000`);
		expect(w.calls.filter((c) => c.script === "compose-up")).toHaveLength(2);
		expect(w.calls.find((c) => c.script === "logs")!.argv.at(-1)).toBe("sh -s -- netquor-web 30");
		expect(w.text()).toContain("boom line");
		expect(w.text()).toContain("rolled back to " + OLD);
		expect(w.scripts()).not.toContain("timer");
		expect(w.scripts()).not.toContain("prune");
	});
	test("first deploy failure has no previous: says so, no rollback attempt", async () => {
		const w = world({ ...okDeploy, state: () => ({ stdout: "" }), "wait-healthy": () => ({ code: 30 }) });
		expect(await run(opts(), CFG, w.deps)).toBe(1);
		expect(w.calls.filter((c) => c.script === "write-deploy-env")).toHaveLength(1);
		expect(w.text()).toContain("nothing to roll back to");
	});
	test("a failed compose up also rolls back and never waits on the new image", async () => {
		let ups = 0;
		const w = world({ ...okDeploy, "compose-up": () => (++ups === 1 ? { code: 1 } : { code: 0 }) });
		expect(await run(opts(), CFG, w.deps)).toBe(1);
		expect(w.calls.filter((c) => c.script === "write-deploy-env")).toHaveLength(2);
	});
});

describe("rollback and auto", () => {
	test("rolls back to PREVIOUS_IMAGE and swaps the two", async () => {
		const w = world({ ...okDeploy, state: () => ({ stdout: `FILE_WEB_IMAGE=${NEW}\nFILE_PREVIOUS_IMAGE=${OLD}\n` }), "ensure-image": () => ({ stdout: "PRESENT\n" }) });
		expect(await run(opts({ mode: "rollback" }), CFG, w.deps)).toBe(0);
		expect(w.calls.find((c) => c.script === "write-deploy-env")!.argv.at(-1)).toContain(`${OLD} ${NEW}`);
		expect(w.scripts()).toContain("timer");
	});
	test("no previous or a pruned previous is an error that changes nothing", async () => {
		const a = world({ ...okDeploy, state: () => ({ stdout: `FILE_WEB_IMAGE=${NEW}\n` }) });
		expect(await run(opts({ mode: "rollback" }), CFG, a.deps)).toBe(1);
		expect(a.scripts()).not.toContain("write-deploy-env");
		const b = world({ ...okDeploy, state: () => ({ stdout: `FILE_WEB_IMAGE=${NEW}\nFILE_PREVIOUS_IMAGE=${OLD}\n` }), "ensure-image": () => ({ stdout: "ABSENT\n" }) });
		expect(await run(opts({ mode: "rollback" }), CFG, b.deps)).toBe(1);
		expect(b.scripts()).not.toContain("write-deploy-env");
	});
	test("--auto writes the registry image, keeps the manual one as previous, enables the timer", async () => {
		const w = world({ ...okDeploy, timer: () => ({ stdout: "TIMER enabled\n" }) });
		expect(await run(opts({ mode: "auto" }), CFG, w.deps)).toBe(0);
		expect(w.calls.find((c) => c.script === "write-deploy-env")!.argv.at(-1)).toContain(`ghcr.io/netquor/netquor-com-web:main ${OLD}`);
		expect(w.calls.find((c) => c.script === "timer")!.argv.at(-1)).toBe("sh -s -- enable");
	});
});

describe("init-env", () => {
	test("reports only key names, never a value", async () => {
		const w = world({ "init-env": () => ({ stdout: "CREATED PRICING_WEBHOOK_SECRET LEAD_FORWARD_SECRET ORIGIN PRICING_API_URL PRICING_API_TOKEN LEAD_FORWARD_URL\n" }) });
		expect(await run(opts({ mode: "init-env" }), CFG, w.deps)).toBe(0);
		const t = w.text();
		expect(t).toContain("PRICING_WEBHOOK_SECRET");
		expect(t).toContain("LEADS_WEBHOOK_SECRET");
		expect(t).not.toMatch(/[0-9a-f]{32}/);
	});
	test("an existing .env is left alone", async () => {
		const w = world({ "init-env": () => ({ stdout: "EXISTS\n" }) });
		expect(await run(opts({ mode: "init-env" }), CFG, w.deps)).toBe(0);
		expect(w.text()).toContain("left untouched");
		expect(w.text()).not.toContain("Created");
	});
	test("unrecognised output prints nothing from the server", async () => {
		const w = world({ "init-env": () => ({ stdout: "weird secretish output\n" }) });
		expect(await run(opts({ mode: "init-env" }), CFG, w.deps)).toBe(1);
		expect(w.text()).not.toContain("secretish");
	});
});

describe("edge", () => {
	test("refuses without --yes when not a terminal, and when the typed answer is not yes", async () => {
		const a = world();
		expect(await run(opts({ mode: "edge" }), CFG, a.deps)).toBe(2);
		expect(a.calls).toHaveLength(0);
		expect(a.text()).toContain("LIVE edge");
		const b = world({}, {}, { isTTY: true, confirm: async () => false });
		expect(await run(opts({ mode: "edge" }), CFG, b.deps)).toBe(2);
		expect(b.calls).toHaveLength(0);
	});
	const edgeOk: Record<string, Handler> = { "edge-stage": () => ({ stdout: "STAGE /tmp/nq-edge.AbC123\n" }), "edge-apply": () => ({ stdout: "DONE\n" }) };
	test("validate failure stops before anything live is touched", async () => {
		const w = world({ ...edgeOk, "edge-validate": () => ({ code: 1 }) });
		expect(await run(opts({ mode: "edge", yes: true }), CFG, w.deps)).toBe(1);
		expect(w.scripts()).not.toContain("edge-apply");
		expect(w.text()).toContain("Nothing on the live edge was touched");
		expect(w.calls.at(-1)!.argv.at(-1)).toContain("rm -rf /tmp/nq-edge.AbC123");
	});
	test("success order and a typed yes", async () => {
		const w = world(edgeOk, {}, { isTTY: true, confirm: async () => true });
		expect(await run(opts({ mode: "edge" }), CFG, w.deps)).toBe(0);
		const s = w.scripts();
		expect(s.indexOf("edge-validate")).toBeLessThan(s.indexOf("edge-apply"));
		expect(w.calls.find((c) => c.script === "edge-apply")!.argv.at(-1)).toBe("sh -s -- /opt/edge /tmp/nq-edge.AbC123 20261110120000");
	});
	test("verify failure (exit 40) reports the restore", async () => {
		const w = world({ ...edgeOk, "edge-apply": () => ({ code: 40, stdout: "RESTORED\n" }) });
		expect(await run(opts({ mode: "edge", yes: true }), CFG, w.deps)).toBe(1);
		expect(w.text()).toContain("restored");
	});
});

describe("status and logs", () => {
	test("status summarises the health detail", async () => {
		const w = world({ status: () => ({ stdout: `== web\nHEALTH healthy\nIMAGE ${NEW}\nDETAIL {"ok":true,"prices":{"version":9,"updatedAt":"T","ageSeconds":1}}\nTIMER inactive\n` }) });
		expect(await run(opts({ mode: "status" }), CFG, w.deps)).toBe(0);
		expect(w.text()).toContain("prices version 9");
		expect(w.text()).toContain("inactive");
	});
	test("logs asks for web and worker", async () => {
		const w = world({ logs: () => ({ stdout: "line\n" }) });
		await run(opts({ mode: "logs" }), CFG, w.deps);
		expect(w.calls.map((c) => c.argv.at(-1))).toEqual(["sh -s -- netquor-web 100", "sh -s -- netquor-web-worker 100"]);
	});
});

// ---- the shell scripts themselves, run locally against stub commands ----------------------------------------------------

function sandbox(): { dir: string; bin: string; log: string; sh: (s: Script, args: string[], env?: Record<string, string>) => Promise<{ code: number; out: string }>; stub: (name: string, body: string) => void } {
	const dir = mkdtempSync(join(tmpdir(), "nq-deploy-test-"));
	const bin = join(dir, "bin");
	mkdirSync(bin);
	const log = join(dir, "calls.log");
	writeFileSync(log, "");
	const stub = (name: string, body: string): void => { writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`); chmodSync(join(bin, name), 0o755); };
	stub("sleep", "exit 0");
	const sh = async (s: Script, args: string[], env: Record<string, string> = {}) => {
		const p = Bun.spawn(["sh", "-s", "--", ...args], { stdin: Buffer.from(s.body), stdout: "pipe", stderr: "pipe", env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, LOG: log, ...env } });
		const [o, e] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
		return { code: await p.exited, out: o + e };
	};
	return { dir, bin, log, sh, stub };
}

describe("remote scripts (run locally with stubs)", () => {
	test("init-env creates a 0600 file with two distinct 64-hex secrets, prints only names, never overwrites", async () => {
		const sb = sandbox();
		const target = join(sb.dir, "web");
		mkdirSync(target);
		const r = await sb.sh(SCRIPTS.initEnv, [target]);
		expect(r.code).toBe(0);
		expect(r.out).toMatch(/^CREATED PRICING_WEBHOOK_SECRET LEAD_FORWARD_SECRET ORIGIN PRICING_API_URL PRICING_API_TOKEN LEAD_FORWARD_URL\n$/);
		expect(r.out).not.toMatch(/[0-9a-f]{32}/);
		const f = join(target, ".env");
		expect(statSync(f).mode & 0o777).toBe(0o600);
		const kv = Object.fromEntries(readFileSync(f, "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
		expect(kv.PRICING_WEBHOOK_SECRET).toMatch(/^[0-9a-f]{64}$/);
		// commented out until LEAD_FORWARD_URL exists: the server refuses a secret without a URL
		expect(kv.LEAD_FORWARD_SECRET).toBeUndefined();
		expect(kv["#LEAD_FORWARD_SECRET"]).toMatch(/^[0-9a-f]{64}$/);
		expect(kv.PRICING_WEBHOOK_SECRET).not.toBe(kv["#LEAD_FORWARD_SECRET"]);
		expect(kv.ORIGIN).toBe("https://www.netquor.com");
		expect([kv.PRICING_API_URL, kv.PRICING_API_TOKEN, kv.LEAD_FORWARD_URL]).toEqual(["", "", ""]);
		const before = readFileSync(f, "utf8");
		const again = await sb.sh(SCRIPTS.initEnv, [target]);
		expect(again.out).toBe("EXISTS\n");
		expect(readFileSync(f, "utf8")).toBe(before);
		expect(require("node:fs").readdirSync(target)).toEqual([".env"]);
	});

	test("write-deploy-env writes exactly the two lines", async () => {
		const sb = sandbox();
		const r = await sb.sh(SCRIPTS.writeEnv, [sb.dir, NEW, ""]);
		expect(r.code).toBe(0);
		expect(readFileSync(join(sb.dir, ".deploy.env"), "utf8")).toBe(`WEB_IMAGE=${NEW}\nPREVIOUS_IMAGE=\n`);
	});

	function edgeBox(opts2: { composeChanged: boolean; phone: string }) {
		const sb = sandbox();
		const edge = join(sb.dir, "edge"), stage = join(sb.dir, "stage");
		mkdirSync(edge); mkdirSync(join(stage, "holding"), { recursive: true });
		writeFileSync(join(edge, "Caddyfile"), "OLD");
		writeFileSync(join(edge, "docker-compose.yml"), "C1");
		writeFileSync(join(stage, "Caddyfile"), "NEW");
		writeFileSync(join(stage, "docker-compose.yml"), opts2.composeChanged ? "C2" : "C1");
		writeFileSync(join(stage, "holding", "index.html"), "hold");
		sb.stub("docker", 'echo "docker $*" >> "$LOG"');
		sb.stub("curl", `echo "curl $*" >> "$LOG"; printf ${opts2.phone}`);
		return { sb, edge, stage };
	}

	test("edge apply: backup, in-place install (same inode), reload, verify, stage removed", async () => {
		const { sb, edge, stage } = edgeBox({ composeChanged: false, phone: "200" });
		const ino = statSync(join(edge, "Caddyfile")).ino;
		const r = await sb.sh(SCRIPTS.edgeApply, [edge, stage, "TS1"]);
		expect(r.code).toBe(0);
		expect(readFileSync(join(edge, "Caddyfile"), "utf8")).toBe("NEW");
		expect(readFileSync(join(edge, "Caddyfile.bak-TS1"), "utf8")).toBe("OLD");
		expect(statSync(join(edge, "Caddyfile")).ino).toBe(ino);
		expect(readFileSync(join(edge, "holding", "index.html"), "utf8")).toBe("hold");
		const calls = readFileSync(sb.log, "utf8");
		expect(calls).toContain("docker exec netquor-edge caddy reload --config /etc/caddy/Caddyfile");
		expect(calls).not.toContain("compose up");
		expect(calls).toContain("--resolve phone.netquor.com:443:127.0.0.1 https://phone.netquor.com/");
		expect(existsSync(stage)).toBe(false);
	});

	test("edge apply: a changed compose file uses compose up -d", async () => {
		const { sb, edge, stage } = edgeBox({ composeChanged: true, phone: "200" });
		const r = await sb.sh(SCRIPTS.edgeApply, [edge, stage, "TS2"]);
		expect(r.code).toBe(0);
		expect(readFileSync(sb.log, "utf8")).toContain("docker compose up -d");
		expect(readFileSync(join(edge, "docker-compose.yml.bak-TS2"), "utf8")).toBe("C1");
	});

	test("edge apply: phone not 200 restores the Caddyfile and reloads, exit 40", async () => {
		const { sb, edge, stage } = edgeBox({ composeChanged: false, phone: "502" });
		const r = await sb.sh(SCRIPTS.edgeApply, [edge, stage, "TS3"]);
		expect(r.code).toBe(40);
		expect(r.out).toContain("RESTORED");
		expect(readFileSync(join(edge, "Caddyfile"), "utf8")).toBe("OLD");
		expect((readFileSync(sb.log, "utf8").match(/caddy reload/g) ?? []).length).toBe(2);
	});

	test("edge apply: failed reload restores, exit 41; failed compose up restores compose too", async () => {
		const a = edgeBox({ composeChanged: false, phone: "200" });
		a.sb.stub("docker", 'echo "docker $*" >> "$LOG"; case "$*" in *reload*) [ -f "$LOG.reloaded" ] && exit 0; touch "$LOG.reloaded"; exit 1;; esac');
		const r = await a.sb.sh(SCRIPTS.edgeApply, [a.edge, a.stage, "TS4"]);
		expect(r.code).toBe(41);
		expect(readFileSync(join(a.edge, "Caddyfile"), "utf8")).toBe("OLD");
		const b = edgeBox({ composeChanged: true, phone: "200" });
		b.sb.stub("docker", 'echo "docker $*" >> "$LOG"; case "$*" in *"compose up"*) [ -f "$LOG.up" ] && exit 0; touch "$LOG.up"; exit 1;; esac');
		const r2 = await b.sb.sh(SCRIPTS.edgeApply, [b.edge, b.stage, "TS5"]);
		expect(r2.code).toBe(41);
		expect(readFileSync(join(b.edge, "Caddyfile"), "utf8")).toBe("OLD");
		expect(readFileSync(join(b.edge, "docker-compose.yml"), "utf8")).toBe("C1");
	});

	test("wait-healthy: succeeds when healthy on the expected image, times out otherwise", async () => {
		const sb = sandbox();
		sb.stub("docker", `case "$*" in
*"inspect --format {{.Config.Image}}"*) echo "$IMG";;
*"State.Health"*) echo healthy;;
*"State.Status"*) echo running;;
*exec*) exit 0;;
esac`);
		const ok = await sb.sh(SCRIPTS.wait, ["web", "worker", NEW, "4"], { IMG: NEW });
		expect(ok.code).toBe(0);
		const bad = await sb.sh(SCRIPTS.wait, ["web", "worker", NEW, "4"], { IMG: OLD });
		expect(bad.code).toBe(30);
		expect(bad.out).toContain("UNHEALTHY");
	});
});

describe("real pipe", () => {
	test("chains processes and counts the bytes entering the last one", async () => {
		const r = await realPipe([["printf", "hello"], ["tr", "a-z", "A-Z"]]);
		expect(r.codes).toEqual([0, 0]);
		expect(r.stdout).toBe("HELLO");
		expect(r.bytes).toBe(5);
	});
});
