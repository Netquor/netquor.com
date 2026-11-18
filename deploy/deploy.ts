#!/usr/bin/env bun
/**
 * `bun run deploy`: build and test locally, then push the web image to the server over SSH.
 * No dependencies. See DEPLOY-CLI.md for usage.
 *
 * Layout: pure functions first (config, arguments, argv construction, remote scripts, planning), then a thin runner that
 * takes an injected `Deps` (exec, pipe, log, confirm, clock, file reads) so the tests drive it with a fake and never
 * touch a network, Docker or a real remote shell. Remote work is always `ssh ... 'sh -s -- <quoted args>'` with the
 * script on stdin; values reach the script as positional parameters and are validated by strict regexes before that.
 * Nothing here reads or prints a secret: the only secrets (init-env) are generated on the server and never leave it.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

// ---------------------------------------------------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------------------------------------------------

export const DEFAULT_USER = "debian";
export const DEFAULT_DIR = "/opt/netquor-web";
export const IMAGE_REPO = "netquor-com-web";
export const REGISTRY_IMAGE = "ghcr.io/netquor/netquor-com-web:main";
export const WEB_CONTAINER = "netquor-web";
export const WORKER_CONTAINER = "netquor-web-worker";
export const EDGE_CONTAINER = "netquor-edge";
export const EDGE_DIR = "/opt/edge";
export const TIMER = "netquor-site-update.timer";
export const KEEP_TAGS = 3;
export const HEALTH_TIMEOUT_SECONDS = 90;
export const TOTAL_STEPS = 13;

export class ConfigError extends Error {}
export class UsageError extends Error {}
/** A step failed on purpose: the message is for the operator, `code` is the exit code. */
export class StepError extends Error {
	constructor(message: string, public code = 1) { super(message); }
}

// ---------------------------------------------------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------------------------------------------------

export interface Config {
	host: string;
	user: string;
	/** Path of an ssh identity file, passed as -i. Undefined means the user's normal ssh config and agent decide. */
	sshKey?: string;
	port?: number;
	dir: string;
}

const HOST_RE = /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const USER_RE = /^[a-z_][a-z0-9_-]{0,31}$/;
const DIR_RE = /^\/[A-Za-z0-9._/-]{1,200}$/;
/** A local image reference we built or read back from the server. */
const IMAGE_RE = /^[a-z0-9][A-Za-z0-9_./-]{0,120}:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/;
const KEY_PATH_BAD = /[\u0000-\u001f\u007f]/;

/** KEY=VALUE lines. `#` comments, blank lines, an optional `export `, and one pair of matching quotes are understood. */
export function parseEnvFile(text: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
		if (!m) continue;
		let v = m[2]!.trim();
		if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) v = v.slice(1, -1);
		out[m[1]!] = v;
	}
	return out;
}

/** Process env wins over the file, the file over the defaults. Empty values count as unset. Throws ConfigError. */
export function resolveConfig(proc: Record<string, string | undefined>, file: Record<string, string>, home = homedir()): Config {
	const pick = (k: string): string | undefined => {
		const a = proc[k]?.trim();
		if (a) return a;
		const b = file[k]?.trim();
		return b || undefined;
	};
	const host = pick("DEPLOY_HOST");
	if (!host) throw new ConfigError("DEPLOY_HOST is required (set it in the environment or in ./.env.deploy).");
	if (!HOST_RE.test(host)) throw new ConfigError("DEPLOY_HOST must be a plain host name or IPv4 address (letters, digits, dots, hyphens).");
	const user = pick("DEPLOY_USER") ?? DEFAULT_USER;
	if (!USER_RE.test(user)) throw new ConfigError("DEPLOY_USER must be a plain unix user name (lowercase letters, digits, _ and -).");
	let dir = pick("DEPLOY_DIR") ?? DEFAULT_DIR;
	if (dir.length > 1) dir = dir.replace(/\/+$/, "");
	if (!DIR_RE.test(dir) || dir.split("/").some((s, i) => i > 0 && (s === ".." || s === "")) ) {
		throw new ConfigError("DEPLOY_DIR must be an absolute path of letters, digits, . _ - and / without '..' or '//', and not '/'.");
	}
	const cfg: Config = { host, user, dir };
	const key = pick("DEPLOY_SSH_KEY");
	if (key) {
		const k = key.startsWith("~/") ? join(home, key.slice(2)) : key;
		if (k.startsWith("-") || KEY_PATH_BAD.test(k) || k.length > 1024) throw new ConfigError("DEPLOY_SSH_KEY must be a file path.");
		cfg.sshKey = k;
	}
	const port = pick("DEPLOY_PORT");
	if (port !== undefined) {
		const n = Number(port);
		if (!/^\d{1,5}$/.test(port) || n < 1 || n > 65535) throw new ConfigError("DEPLOY_PORT must be a number from 1 to 65535.");
		cfg.port = n;
	}
	return cfg;
}

// ---------------------------------------------------------------------------------------------------------------------
// arguments
// ---------------------------------------------------------------------------------------------------------------------

export type Mode = "deploy" | "rollback" | "init-env" | "edge" | "status" | "logs" | "auto" | "help";

export interface Options {
	mode: Mode;
	dryRun: boolean;
	skipTests: boolean;
	yes: boolean;
	showScripts: boolean;
}

const MODE_FLAGS: Record<string, Mode> = {
	"--rollback": "rollback", "--init-env": "init-env", "--edge": "edge", "--status": "status", "--logs": "logs", "--auto": "auto",
	"--help": "help", "-h": "help",
};

export function parseArgs(argv: string[]): Options {
	const o: Options = { mode: "deploy", dryRun: false, skipTests: false, yes: false, showScripts: false };
	let modeFlag: string | null = null;
	for (const a of argv) {
		if (a === "--dry-run") o.dryRun = true;
		else if (a === "--skip-tests") o.skipTests = true;
		else if (a === "--yes") o.yes = true;
		else if (a === "--show-scripts") o.showScripts = true;
		else if (a in MODE_FLAGS) {
			if (modeFlag && modeFlag !== a) throw new UsageError(`${a} cannot be combined with ${modeFlag}; pick one command.`);
			modeFlag = a;
			o.mode = MODE_FLAGS[a]!;
		} else throw new UsageError(`unknown argument: ${a.slice(0, 40)}`);
	}
	if (o.skipTests && o.mode !== "deploy") throw new UsageError("--skip-tests only applies to a full deploy.");
	if (o.yes && o.mode !== "edge") throw new UsageError("--yes only applies to --edge.");
	return o;
}

export const USAGE = `bun run deploy [command] [options]

Commands (default is a full deploy):
  (none)       preflight, local tests, build, ship, sync, switch, health check, auto-rollback on failure, prune
  --rollback   put the previous image (PREVIOUS_IMAGE in .deploy.env on the server) back
  --init-env   create <DEPLOY_DIR>/.env on the server ONLY IF ABSENT (mode 0600, secrets generated on the server)
  --edge       sync deploy/edge to /opt/edge, validate, reload, verify phone.netquor.com (touches the LIVE edge)
  --status     compose ps, health, price version, image in use, update timer
  --logs       tail the web and worker logs
  --auto       switch back to registry-pull mode (WEB_IMAGE=${REGISTRY_IMAGE}, enable the timer)

Options:
  --dry-run       print every step and the exact commands; execute no remote or build step
  --skip-tests    full deploy without the local tests
  --yes           --edge: skip the typed confirmation
  --show-scripts  with --dry-run: also print the remote scripts
  -h, --help

Config (environment or ./.env.deploy): DEPLOY_HOST (required), DEPLOY_USER (${DEFAULT_USER}), DEPLOY_SSH_KEY, DEPLOY_PORT, DEPLOY_DIR (${DEFAULT_DIR})`;

// ---------------------------------------------------------------------------------------------------------------------
// argv construction (never a local shell; the only shell is the remote one, fed validated and quoted values)
// ---------------------------------------------------------------------------------------------------------------------

/** POSIX single-quote a value unless it is plainly safe. */
export function shq(s: string): string {
	if (s !== "" && /^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s;
	return `'${s.replace(/'/g, `'\\''`)}'`;
}

export const target = (cfg: Config): string => `${cfg.user}@${cfg.host}`;

/** Options shared by ssh and scp. `portFlag` is -p for ssh and -P for scp. */
export function sshOptions(cfg: Config, ctlDir: string, portFlag: "-p" | "-P"): string[] {
	const o = [
		"-o", "BatchMode=yes",
		"-o", "ConnectTimeout=10",
		"-o", "ControlMaster=auto",
		"-o", "ControlPersist=60s",
		"-o", `ControlPath=${ctlDir}/%C`,
	];
	if (cfg.sshKey) o.push("-i", cfg.sshKey);
	if (cfg.port) o.push(portFlag, String(cfg.port));
	return o;
}

/** `remote` is one string handed to the remote shell; callers only put validated or constant text in it. */
export const sshArgv = (cfg: Config, ctlDir: string, remote: string): string[] => ["ssh", ...sshOptions(cfg, ctlDir, "-p"), target(cfg), remote];
export const sshExitArgv = (cfg: Config, ctlDir: string): string[] => ["ssh", ...sshOptions(cfg, ctlDir, "-p"), "-O", "exit", target(cfg)];
export const scpArgv = (cfg: Config, ctlDir: string, locals: string[], remoteDir: string, recursive = false): string[] =>
	["scp", ...sshOptions(cfg, ctlDir, "-P"), ...(recursive ? ["-r"] : []), ...locals, `${target(cfg)}:${remoteDir}/`];

export interface Script { name: string; body: string }
export interface Cmd { argv: string[]; cwd?: string; script?: Script; note?: string }

/** `ssh ... 'sh -s -- a b c'` with the script on stdin. */
export function remoteCmd(cfg: Config, ctlDir: string, script: Script, args: string[] = []): Cmd {
	for (const a of args) if (/[\u0000\n\r]/.test(a)) throw new Error("remote argument contains a control character");
	return { argv: sshArgv(cfg, ctlDir, ["sh", "-s", "--", ...args].map(shq).join(" ")), script };
}

/** Drops the -o pairs for the compact line shown during a real run. */
export function display(c: Cmd, full: boolean): string {
	let a = c.argv;
	if (!full) {
		const out: string[] = [];
		for (let i = 0; i < a.length; i++) { if (a[i] === "-o") { i++; continue; } out.push(a[i]!); }
		a = out;
	}
	const cwd = c.cwd ? `(cd ${shq(c.cwd)} && ` : "";
	return `${cwd}${a.map(shq).join(" ")}${cwd ? ")" : ""}${c.script ? `   < script:${c.script.name}` : ""}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// remote scripts: POSIX sh, run as `sh -s -- <args>`, values only through "$1".. positional parameters
// ---------------------------------------------------------------------------------------------------------------------

const S = (name: string, body: string): Script => ({ name, body: body.replace(/^\n/, "") });

export const SCRIPTS = {
	/** $1 dir, then the networks that must exist. Reports with KEY lines; exits 10 only when nothing can be judged. */
	preflight: S("preflight", String.raw`
set -u
dir=$1; shift
fail() { echo "FAIL $1"; exit 10; }
command -v docker >/dev/null 2>&1 || fail docker-missing
docker info >/dev/null 2>&1 || fail docker-not-usable
docker compose version >/dev/null 2>&1 || fail compose-missing
if [ ! -d "$dir" ]; then
	sudo -n mkdir -p "$dir" && sudo -n chown "$(id -u):$(id -g)" "$dir" || fail dir-create-failed
	echo "NOTE created $dir"
fi
[ -w "$dir" ] || fail dir-not-writable
for n in "$@"; do
	docker network inspect "$n" >/dev/null 2>&1 || echo "NETWORK-MISSING $n"
done
if [ -f "$dir/.env" ]; then echo "ENV present"; else echo "ENV missing"; fi
echo "PREFLIGHT ok"
`),

	/** $1 dir. KEY=VALUE lines: what .deploy.env says and what the web container runs. Never reads .env. */
	state: S("state", String.raw`
set -u
f="$1/.deploy.env"
if [ -f "$f" ]; then
	sed -n -e 's/^WEB_IMAGE=/FILE_WEB_IMAGE=/p' -e 's/^PREVIOUS_IMAGE=/FILE_PREVIOUS_IMAGE=/p' "$f"
fi
r=$(docker inspect --format '{{.Config.Image}}' netquor-web 2>/dev/null) && echo "RUNNING_IMAGE=$r"
exit 0
`),

	/** $1 image ref or id to look for, $2 tag to put on it. PRESENT (tagged) or ABSENT. */
	ensureImage: S("ensure-image", String.raw`
set -u
if docker image inspect "$1" >/dev/null 2>&1; then
	if [ "$1" != "$2" ]; then docker tag "$1" "$2" || { echo "FAIL tag"; exit 1; }; fi
	echo PRESENT
else
	echo ABSENT
fi
`),

	/** $1 dir. Stage folder for files to sync and the sha256 of what is installed now. */
	hashes: S("hashes", String.raw`
set -eu
stage="$1/.stage"
mkdir -p "$stage"
rm -f "$stage"/* 2>/dev/null || true
h() { if [ -f "$1" ]; then sha256sum "$1" | cut -d' ' -f1; else echo none; fi; }
echo "HASH compose $(h "$1/docker-compose.yml")"
echo "HASH entrypoint $(h "$1/entrypoint.sh")"
echo "HASH update $(h /usr/local/sbin/netquor-site-update)"
echo "HASH service $(h /etc/systemd/system/netquor-site-update.service)"
echo "HASH timer $(h /etc/systemd/system/netquor-site-update.timer)"
`),

	/** $1 dir, then 0/1 for: compose entrypoint update service timer. Installs from $1/.stage. */
	install: S("install", String.raw`
set -u
dir=$1; stage="$dir/.stage"
if [ "$2" = 1 ]; then
	install -m 0644 "$stage/docker-compose.yml" "$dir/docker-compose.yml" || { echo "FAIL compose"; exit 20; }
	echo "SYNCED compose"
fi
if [ "$3" = 1 ]; then
	install -m 0755 "$stage/entrypoint.sh" "$dir/entrypoint.sh" || { echo "FAIL entrypoint"; exit 20; }
	echo "SYNCED entrypoint"
fi
if [ "$4" = 1 ]; then
	if sudo -n install -m 0755 "$stage/netquor-site-update" /usr/local/sbin/netquor-site-update; then echo "SYNCED update"; else echo "WARN update-not-installed"; fi
fi
units=0
if [ "$5" = 1 ]; then
	if sudo -n install -m 0644 "$stage/netquor-site-update.service" /etc/systemd/system/netquor-site-update.service; then echo "SYNCED service"; units=1; else echo "WARN service-not-installed"; fi
fi
if [ "$6" = 1 ]; then
	if sudo -n install -m 0644 "$stage/netquor-site-update.timer" /etc/systemd/system/netquor-site-update.timer; then echo "SYNCED timer"; units=1; else echo "WARN timer-not-installed"; fi
fi
if [ "$units" = 1 ]; then sudo -n systemctl daemon-reload || echo "WARN daemon-reload-failed"; fi
rm -rf "$stage"
exit 0
`),

	/** $1 dir, $2 WEB_IMAGE, $3 PREVIOUS_IMAGE (may be empty). Atomic replace of .deploy.env. */
	writeEnv: S("write-deploy-env", String.raw`
set -eu
dir=$1
tmp=$(mktemp "$dir/.deploy.env.XXXXXX")
printf 'WEB_IMAGE=%s\nPREVIOUS_IMAGE=%s\n' "$2" "$3" > "$tmp"
chmod 0644 "$tmp"
mv "$tmp" "$dir/.deploy.env"
echo "WROTE .deploy.env"
`),

	/** $1 dir. */
	composeUp: S("compose-up", String.raw`
set -u
cd "$1" || exit 1
docker compose --env-file .deploy.env up -d --pull never
`),

	/** $1 web container, $2 worker container, $3 expected image, $4 seconds. Exit 0 healthy, 30 timed out. */
	wait: S("wait-healthy", String.raw`
set -u
web=$1; worker=$2; want=$3; limit=$4
i=0; img=none; st=none
while [ "$i" -lt "$limit" ]; do
	img=$(docker inspect --format '{{.Config.Image}}' "$web" 2>/dev/null || echo none)
	st=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}nohealth{{end}}' "$web" 2>/dev/null || echo none)
	if [ "$img" = "$want" ] && [ "$st" = healthy ]; then
		w=$(docker inspect --format '{{.State.Status}}' "$worker" 2>/dev/null || echo none)
		if [ "$w" = running ] && docker exec "$web" wget -q -O - http://127.0.0.1:3000/health/detail >/dev/null 2>&1; then
			echo "HEALTHY after $i s"
			exit 0
		fi
	fi
	i=$((i + 2)); sleep 2
done
echo "UNHEALTHY image=$img health=$st"
exit 30
`),

	/** $1 container, $2 line count. */
	logs: S("logs", String.raw`
set -u
docker logs --tail "$2" "$1" 2>&1
exit 0
`),

	/** $1 enable|disable. The registry-pull timer. */
	timer: S("timer", String.raw`
set -u
if ! systemctl list-unit-files netquor-site-update.timer 2>/dev/null | grep -q netquor-site-update.timer; then
	echo "TIMER absent"; exit 0
fi
if [ "$1" = enable ]; then
	if sudo -n systemctl enable --now netquor-site-update.timer; then echo "TIMER enabled"; else echo "TIMER failed"; fi
else
	if sudo -n systemctl disable --now netquor-site-update.timer; then echo "TIMER disabled"; else echo "TIMER failed"; fi
fi
exit 0
`),

	/** Newest first. */
	listImages: S("list-images", String.raw`
docker image ls netquor-com-web --format '{{.Repository}}:{{.Tag}}'
exit 0
`),

	/** Tags as arguments. */
	prune: S("prune", String.raw`
set -u
for t in "$@"; do
	if docker image rm "$t" >/dev/null 2>&1; then echo "REMOVED $t"; else echo "KEPT $t"; fi
done
exit 0
`),

	/** $1 dir. Creates $1/.env only if absent, mode 0600, secrets generated here and never printed. */
	initEnv: S("init-env", String.raw`
set -u
umask 077
dir=$1
f="$dir/.env"
if [ ! -d "$dir" ]; then
	sudo -n mkdir -p "$dir" && sudo -n chown "$(id -u):$(id -g)" "$dir" || { echo "FAIL dir-create-failed"; exit 10; }
fi
if [ -e "$f" ]; then echo "EXISTS"; exit 0; fi
gen() { od -An -tx1 -N32 /dev/urandom | tr -d ' \n'; }
tmp=$(mktemp "$dir/.env.XXXXXX") || { echo "FAIL mktemp"; exit 10; }
{
	printf 'PRICING_WEBHOOK_SECRET=%s\n' "$(gen)"
	printf '#LEAD_FORWARD_SECRET=%s\n' "$(gen)"
	printf 'ORIGIN=https://www.netquor.com\n'
	printf 'PRICING_API_URL=\n'
	printf 'PRICING_API_TOKEN=\n'
	printf 'LEAD_FORWARD_URL=\n'
} > "$tmp"
chmod 0600 "$tmp"
if ln "$tmp" "$f" 2>/dev/null; then
	rm -f "$tmp"
	echo "CREATED PRICING_WEBHOOK_SECRET LEAD_FORWARD_SECRET ORIGIN PRICING_API_URL PRICING_API_TOKEN LEAD_FORWARD_URL"
else
	rm -f "$tmp"
	echo "EXISTS"
fi
exit 0
`),

	/** Makes a staging folder for the edge files. Prints STAGE <path>. */
	edgeStage: S("edge-stage", String.raw`
set -eu
d=$(mktemp -d /tmp/nq-edge.XXXXXX)
chmod 0755 "$d"
echo "STAGE $d"
`),

	/** $1 stage. Validates the staged Caddyfile with the same image the edge runs. Touches nothing live. */
	edgeValidate: S("edge-validate", String.raw`
set -u
docker run --rm -v "$1/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
`),

	/**
	 * $1 edge dir, $2 stage, $3 timestamp. Backs up, installs IN PLACE (the Caddyfile is a single-file bind mount, so a new
	 * inode would leave the running Caddy on the old content), reloads, verifies phone, restores on any failure.
	 * Exit 0 ok, 40 verify failed (restored), 41 reload failed (restored), 42 could not start.
	 */
	edgeApply: S("edge-apply", String.raw`
set -u
edge=$1; stage=$2; ts=$3
cd "$edge" || { echo "FAIL no-edge-dir"; exit 42; }
if [ ! -f Caddyfile ]; then echo "FAIL no-live-caddyfile"; exit 42; fi
cp -p Caddyfile "Caddyfile.bak-$ts" || { echo "FAIL backup"; exit 42; }
echo "BACKUP Caddyfile.bak-$ts"
changed=0
if [ -f docker-compose.yml ]; then
	cmp -s "$stage/docker-compose.yml" docker-compose.yml || changed=1
else
	changed=1
fi
if [ "$changed" = 1 ] && [ -f docker-compose.yml ]; then
	cp -p docker-compose.yml "docker-compose.yml.bak-$ts" || { echo "FAIL backup"; exit 42; }
	echo "BACKUP docker-compose.yml.bak-$ts"
fi
if [ "$changed" = 1 ]; then echo "COMPOSE changed"; else echo "COMPOSE same"; fi
restore() {
	cat "Caddyfile.bak-$ts" > Caddyfile
	if [ "$changed" = 1 ] && [ -f "docker-compose.yml.bak-$ts" ]; then
		cat "docker-compose.yml.bak-$ts" > docker-compose.yml
		docker compose up -d >/dev/null 2>&1
	else
		docker exec netquor-edge caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1
	fi
	echo "RESTORED"
}
cat "$stage/Caddyfile" > Caddyfile || { restore; exit 41; }
if [ -d "$stage/holding" ]; then
	mkdir -p holding && cp -R "$stage/holding/." holding/ || echo "WARN holding-not-synced"
fi
if [ "$changed" = 1 ]; then
	cat "$stage/docker-compose.yml" > docker-compose.yml
	docker compose up -d >/dev/null 2>&1 || { echo "FAIL compose-up"; restore; exit 41; }
else
	docker exec netquor-edge caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || { echo "FAIL reload"; restore; exit 41; }
fi
echo "RELOADED"
ok=0; i=0; code=000
while [ "$i" -lt 8 ]; do
	code=$(curl -sS -o /dev/null -m 8 -w '%{http_code}' --resolve phone.netquor.com:443:127.0.0.1 https://phone.netquor.com/ 2>/dev/null || true)
	if [ "$code" = 200 ]; then ok=1; break; fi
	i=$((i + 1)); sleep 2
done
echo "VERIFY phone.netquor.com=$code"
if [ "$ok" != 1 ]; then restore; exit 40; fi
rm -rf "$stage"
echo "DONE"
exit 0
`),

	/** $1 dir, $2 web, $3 worker, $4 timer. Sections the runner prints; DETAIL is turned into a summary locally. */
	status: S("status", String.raw`
set -u
dir=$1
echo "== compose ps"
( cd "$dir" && if [ -f .deploy.env ]; then docker compose --env-file .deploy.env ps; else docker compose ps; fi ) 2>&1
echo "== web"
echo "HEALTH $(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}nohealth{{end}}' "$2" 2>/dev/null || echo none)"
echo "IMAGE $(docker inspect --format '{{.Config.Image}}' "$2" 2>/dev/null || echo none)"
echo "WORKER $(docker inspect --format '{{.State.Status}}' "$3" 2>/dev/null || echo none)"
d=$(docker exec "$2" wget -q -O - http://127.0.0.1:3000/health/detail 2>/dev/null | tr -d '\n') || d=""
echo "DETAIL $d"
echo "== deploy.env"
if [ -f "$dir/.deploy.env" ]; then cat "$dir/.deploy.env"; else echo "(absent)"; fi
echo "== timer"
echo "TIMER $(systemctl is-active "$4" 2>/dev/null || true)"
exit 0
`),
} as const;

// ---------------------------------------------------------------------------------------------------------------------
// pure helpers
// ---------------------------------------------------------------------------------------------------------------------

const pad = (n: number, w = 2): string => String(n).padStart(w, "0");

/** `netquor-com-web:<shortsha>-<yyyymmddHHMMSS>[-dirty]`, time in UTC. */
export function makeImageRef(shortSha: string, now: Date, dirty: boolean): string {
	const ts = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
	const sha = /^[0-9a-f]{4,40}$/.test(shortSha) ? shortSha : "nogit";
	return `${IMAGE_REPO}:${sha}-${ts}${dirty ? "-dirty" : ""}`;
}

export const isImageRef = (s: string): boolean => IMAGE_RE.test(s);

export function parseKv(text: string): Record<string, string> {
	const o: Record<string, string> = {};
	for (const l of text.split("\n")) {
		const m = /^([A-Z][A-Z_]*)=(.*)$/.exec(l.trim());
		if (m) o[m[1]!] = m[2]!;
	}
	return o;
}

export interface RemoteState { fileWeb: string; filePrevious: string; running: string }
export function parseState(text: string): RemoteState {
	const kv = parseKv(text);
	const ok = (v: string | undefined): string => (v && isImageRef(v) ? v : "");
	return { fileWeb: ok(kv.FILE_WEB_IMAGE), filePrevious: ok(kv.FILE_PREVIOUS_IMAGE), running: ok(kv.RUNNING_IMAGE) };
}

/** Which image to remember as PREVIOUS when `newImage` goes live. The previous one is never lost on a redeploy of the same tag. */
export function choosePrevious(newImage: string, s: RemoteState): string {
	const current = s.fileWeb || s.running;
	if (current && current !== newImage) return current;
	return s.filePrevious || (current && current !== newImage ? current : "");
}

/** Manual rollback: go to PREVIOUS_IMAGE, and remember the one we leave so a second rollback goes forward again. */
export function selectRollback(s: RemoteState): { target: string; newPrevious: string } {
	if (!s.filePrevious) throw new StepError("No PREVIOUS_IMAGE in .deploy.env on the server, so there is nothing to roll back to.");
	return { target: s.filePrevious, newPrevious: s.fileWeb || s.running };
}

/** Local netquor-com-web tags to remove: everything beyond the newest `keep`, except tags in use. `list` is newest first. */
export function selectPruneTags(list: string[], protect: string[], keep = KEEP_TAGS): string[] {
	const own = list.map((t) => t.trim()).filter((t) => /^netquor-com-web:[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(t));
	const uniq = [...new Set(own)];
	const keepSet = new Set([...uniq.slice(0, keep), ...protect]);
	return uniq.filter((t) => !keepSet.has(t));
}

/** Networks that must exist: edge always, web_front only if the compose file uses it. */
export function requiredNetworks(composeText: string): string[] {
	return /\bweb_front\b/.test(composeText) ? ["edge", "web_front"] : ["edge"];
}

/** entrypoint.sh is baked into the image when the Dockerfile copies it; then it is not synced to the server. */
export const entrypointInImage = (dockerfile: string): boolean => /^\s*COPY\s+[^\n#]*deploy\/entrypoint\.sh/m.test(dockerfile);

export const composeUsesWebImage = (compose: string): boolean => /\$\{?WEB_IMAGE\b/.test(compose);

export const sha256 = (s: string | Uint8Array): string => createHash("sha256").update(s).digest("hex");

export interface SyncAsset { key: "compose" | "entrypoint" | "update" | "service" | "timer"; local: string; remote: string; mode: "0644" | "0755" }

export function syncAssets(cfg: Config, entrypointBaked: boolean): SyncAsset[] {
	const a: SyncAsset[] = [
		{ key: "compose", local: "deploy/docker-compose.yml", remote: `${cfg.dir}/docker-compose.yml`, mode: "0644" },
		{ key: "update", local: "deploy/netquor-site-update", remote: "/usr/local/sbin/netquor-site-update", mode: "0755" },
		{ key: "service", local: "deploy/netquor-site-update.service", remote: "/etc/systemd/system/netquor-site-update.service", mode: "0644" },
		{ key: "timer", local: "deploy/netquor-site-update.timer", remote: "/etc/systemd/system/netquor-site-update.timer", mode: "0644" },
	];
	if (!entrypointBaked) a.splice(1, 0, { key: "entrypoint", local: "deploy/entrypoint.sh", remote: `${cfg.dir}/entrypoint.sh`, mode: "0755" });
	return a;
}

/** The assets whose local sha256 differs from the server's. */
export function assetsToSync(assets: SyncAsset[], local: Record<string, string>, remote: Record<string, string>): SyncAsset[] {
	return assets.filter((a) => local[a.key] !== remote[a.key]);
}

export function parseHashes(text: string): Record<string, string> {
	const o: Record<string, string> = {};
	for (const l of text.split("\n")) {
		const m = /^HASH (\w+) ([0-9a-f]{64}|none)$/.exec(l.trim());
		if (m) o[m[1]!] = m[2]!;
	}
	return o;
}

export function summarizeDetail(json: string): string {
	let d: unknown;
	try { d = JSON.parse(json); } catch { return "health detail did not answer with JSON"; }
	const o = d as { ok?: unknown; uptimeSeconds?: unknown; prices?: { version?: unknown; updatedAt?: unknown; ageSeconds?: unknown } | null };
	const up = typeof o.uptimeSeconds === "number" ? `, up ${o.uptimeSeconds}s` : "";
	if (!o.prices) return `ok=${String(o.ok)}${up}, prices: none loaded`;
	return `ok=${String(o.ok)}${up}, prices version ${String(o.prices.version)}, updatedAt ${String(o.prices.updatedAt)}, age ${String(o.prices.ageSeconds)}s`;
}

export function fmtBytes(n: number): string {
	if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
	if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${n} B`;
}

// ---------------------------------------------------------------------------------------------------------------------
// planning (what --dry-run prints; built from the same constructors the runner uses)
// ---------------------------------------------------------------------------------------------------------------------

export interface PlanStep { title: string; notes?: string[]; cmds: Cmd[]; /** commands joined by | */ pipe?: string[][] }

export interface PlanInput {
	cfg: Config;
	opts: Options;
	ctlDir: string;
	imageRef: string;
	dirty: boolean;
	networks: string[];
	entrypointBaked: boolean;
	stamp: string;
}

export function buildPlan(p: PlanInput): PlanStep[] {
	const { cfg, ctlDir, imageRef } = p;
	const r = (s: Script, args: string[] = []): Cmd => remoteCmd(cfg, ctlDir, s, args);
	const dir = cfg.dir;
	const stage = "<STAGE>";
	switch (p.opts.mode) {
		case "rollback":
			return [
				{ title: "Read PREVIOUS_IMAGE from .deploy.env on the server", cmds: [r(SCRIPTS.state, [dir])] },
				{ title: "Check the previous image is still on the server", cmds: [r(SCRIPTS.ensureImage, ["<PREVIOUS_IMAGE>", "<PREVIOUS_IMAGE>"])] },
				{ title: "Swap WEB_IMAGE and PREVIOUS_IMAGE in .deploy.env, then compose up", cmds: [r(SCRIPTS.writeEnv, [dir, "<PREVIOUS_IMAGE>", "<CURRENT_IMAGE>"]), r(SCRIPTS.composeUp, [dir])] },
				{ title: `Wait up to ${HEALTH_TIMEOUT_SECONDS}s for web to be healthy`, cmds: [r(SCRIPTS.wait, [WEB_CONTAINER, WORKER_CONTAINER, "<PREVIOUS_IMAGE>", String(HEALTH_TIMEOUT_SECONDS)])] },
				{ title: "Disable the registry-pull timer so it cannot undo the rollback", cmds: [r(SCRIPTS.timer, ["disable"])] },
			];
		case "init-env":
			return [{
				title: "Create .env on the server only if absent (mode 0600, secrets generated on the server, never shown)",
				notes: ["Prints only the names of the keys it created."],
				cmds: [r(SCRIPTS.initEnv, [dir])],
			}];
		case "edge":
			return [
				{ title: "WARNING and confirmation: this touches the LIVE edge (ports 80/443)", notes: ["Needs --yes or a typed 'yes'."], cmds: [] },
				{ title: "Make a staging folder on the server and copy deploy/edge into it (nothing live is touched)", cmds: [
					r(SCRIPTS.edgeStage),
					{ argv: scpArgv(cfg, ctlDir, ["deploy/edge/Caddyfile", "deploy/edge/docker-compose.yml"], stage), cwd: "<repo>" },
					{ argv: scpArgv(cfg, ctlDir, ["deploy/edge/holding"], stage, true), cwd: "<repo>" },
				] },
				{ title: "Validate the staged Caddyfile BEFORE touching anything", cmds: [r(SCRIPTS.edgeValidate, [stage])] },
				{ title: `Back up to Caddyfile.bak-${p.stamp}, install in place, reload (or compose up -d if the compose file changed), verify phone.netquor.com answers 200 through the edge, restore and reload on any failure`, cmds: [r(SCRIPTS.edgeApply, [EDGE_DIR, stage, p.stamp])] },
			];
		case "status":
			return [{ title: "Report compose ps, web health, price version, image in use and the update timer", cmds: [r(SCRIPTS.status, [dir, WEB_CONTAINER, WORKER_CONTAINER, TIMER])] }];
		case "logs":
			return [{ title: "Tail the web and worker logs", cmds: [r(SCRIPTS.logs, [WEB_CONTAINER, "100"]), r(SCRIPTS.logs, [WORKER_CONTAINER, "100"])] }];
		case "auto":
			return [
				{ title: "Read the current image from the server", cmds: [r(SCRIPTS.state, [dir])] },
				{ title: `Set WEB_IMAGE to ${REGISTRY_IMAGE} in .deploy.env`, cmds: [r(SCRIPTS.writeEnv, [dir, REGISTRY_IMAGE, "<CURRENT_IMAGE>"])] },
				{ title: "Enable the registry-pull timer (it pulls and recreates within 2 minutes)", cmds: [r(SCRIPTS.timer, ["enable"])] },
			];
		default:
			break;
	}
	const compose = `${dir}/docker-compose.yml`;
	void compose;
	const build: Cmd = { argv: ["docker", "buildx", "build", "--platform", "linux/amd64", "--load", "-t", imageRef, "."], cwd: "<repo>" };
	const steps: PlanStep[] = [
		{ title: "Preflight: ssh works, docker and docker compose present, deploy dir exists (or create with sudo -n), networks exist, .env present",
			notes: [`Required networks: ${p.networks.join(", ")}. If one is missing the exact 'docker network create' command is printed and the deploy stops.`],
			cmds: [r(SCRIPTS.preflight, [dir, ...p.networks])] },
		{ title: p.opts.skipTests ? "Local tests: SKIPPED (--skip-tests)" : "Local tests (not run in a dry run)",
			cmds: p.opts.skipTests ? [] : [
				{ argv: ["bun", "test"], cwd: "<repo>/server" }, { argv: ["bunx", "tsc", "--noEmit"], cwd: "<repo>/server" },
				{ argv: ["bun", "test"], cwd: "<repo>/web" }, { argv: ["bunx", "tsc", "--noEmit"], cwd: "<repo>/web" },
			] },
		{ title: "Build the image (linux/amd64)", notes: p.dirty ? ["The git tree is dirty: the tag ends in -dirty. The build continues."] : [], cmds: [build] },
		{ title: "Ship: skip if the server already has this image id, else docker save | gzip | ssh gunzip | docker load",
			cmds: [
				{ argv: ["docker", "image", "inspect", "--format", "{{.Id}}", imageRef] },
				r(SCRIPTS.ensureImage, ["<LOCAL_IMAGE_ID>", imageRef]),
			],
			pipe: [["docker", "save", imageRef], ["gzip"], sshArgv(cfg, ctlDir, "gunzip | docker load")] },
		{ title: "Sync compose file, update script and timer units, only the ones whose sha256 differs",
			notes: [p.entrypointBaked ? "deploy/entrypoint.sh is copied into the image by the Dockerfile, so it is not synced." : "deploy/entrypoint.sh is NOT baked into the image, so it is synced too."],
			cmds: [
				r(SCRIPTS.hashes, [dir]),
				{ argv: scpArgv(cfg, ctlDir, ["<changed files>"], `${dir}/.stage`), cwd: "<repo>/deploy" },
				r(SCRIPTS.install, [dir, "<0|1>", "<0|1>", "<0|1>", "<0|1>", "<0|1>"]),
			] },
		{ title: "Write .deploy.env: WEB_IMAGE=<new>, PREVIOUS_IMAGE=<old, never lost>", cmds: [r(SCRIPTS.state, [dir]), r(SCRIPTS.writeEnv, [dir, imageRef, "<PREVIOUS_IMAGE>"])] },
		{ title: "Refuse if .env is missing on the server (checked right after preflight, before the build)", notes: ["Suggests: bun run deploy --init-env"], cmds: [] },
		{ title: "docker compose --env-file .deploy.env up -d --pull never", cmds: [r(SCRIPTS.composeUp, [dir])] },
		{ title: `Wait up to ${HEALTH_TIMEOUT_SECONDS}s for the web container to be healthy on the new image and /health/detail to answer`, cmds: [r(SCRIPTS.wait, [WEB_CONTAINER, WORKER_CONTAINER, imageRef, String(HEALTH_TIMEOUT_SECONDS)])] },
		{ title: "On failure: roll back to PREVIOUS_IMAGE, show the last 30 web log lines, exit non-zero",
			cmds: [r(SCRIPTS.writeEnv, [dir, "<PREVIOUS_IMAGE>", "<PRIOR_PREVIOUS>"]), r(SCRIPTS.composeUp, [dir]), r(SCRIPTS.logs, [WEB_CONTAINER, "30"])] },
		{ title: "Disable the registry-pull timer (ignored if absent) and say so", cmds: [r(SCRIPTS.timer, ["disable"])] },
		{ title: `Prune local netquor-com-web tags on the server beyond the newest ${KEEP_TAGS} (never the new or previous image)`, cmds: [r(SCRIPTS.listImages), r(SCRIPTS.prune, ["<old tags>"])] },
		{ title: "Summary: image tag, previous tag, health, how to roll back", cmds: [] },
	];
	return steps;
}

export function renderPlan(steps: PlanStep[], p: PlanInput): string[] {
	const lines: string[] = [];
	lines.push(`DRY RUN: nothing is executed. Mode: ${p.opts.mode}. Target: ${target(p.cfg)}${p.cfg.port ? `:${p.cfg.port}` : ""}, dir ${p.cfg.dir}`);
	if (p.opts.mode === "deploy") lines.push(`Image: ${p.imageRef}`);
	steps.forEach((s, i) => {
		lines.push("", `[${i + 1}/${steps.length}] ${s.title}`);
		for (const n of s.notes ?? []) lines.push(`    note: ${n}`);
		if (s.pipe) lines.push(`    $ ${s.pipe.map((a) => display({ argv: a }, true)).join(" | ")}`);
		for (const c of s.cmds) {
			lines.push(`    $ ${display(c, true)}`);
			if (p.opts.showScripts && c.script) for (const l of c.script.body.trimEnd().split("\n")) lines.push(`        | ${l}`);
		}
	});
	return lines;
}

// ---------------------------------------------------------------------------------------------------------------------
// runner
// ---------------------------------------------------------------------------------------------------------------------

export interface ExecResult { code: number; stdout: string; stderr: string }
export interface ExecOpts { stdin?: string; cwd?: string; /** show the child's output live (build, tests) */ stream?: boolean }
export type Exec = (argv: string[], opts?: ExecOpts) => Promise<ExecResult>;
export interface PipeResult { codes: number[]; /** bytes that entered the last process */ bytes: number; stdout: string; stderr: string }
export type Pipe = (argvs: string[][]) => Promise<PipeResult>;

export interface Deps {
	exec: Exec;
	pipe: Pipe;
	log: (line: string) => void;
	err: (line: string) => void;
	confirm: (question: string) => Promise<boolean>;
	now: () => Date;
	/** Text of a file relative to the repository root, or null when it does not exist. */
	readText: (relPath: string) => string | null;
	repoRoot: string;
	ctlDir: string;
	isTTY: boolean;
}

interface Ctx { cfg: Config; opts: Options; deps: Deps }

const indent = (s: string): string[] => s.split("\n").map((l) => l.trimEnd()).filter((l) => l !== "").map((l) => `    ${l}`);

async function rsh(ctx: Ctx, script: Script, args: string[] = [], quiet = false): Promise<ExecResult> {
	const cmd = remoteCmd(ctx.cfg, ctx.deps.ctlDir, script, args);
	ctx.deps.log(`  $ ${display(cmd, false)}`);
	const r = await ctx.deps.exec(cmd.argv, { stdin: script.body });
	if (!quiet) { for (const l of indent(r.stdout)) ctx.deps.log(l); }
	if (r.code !== 0) for (const l of indent(r.stderr).slice(-8)) ctx.deps.err(l);
	return r;
}

/** Explains ssh's own failure (exit 255) or a script's FAIL line. */
function explain(r: ExecResult, what: string): string {
	if (r.code === 255) return `${what}: ssh could not connect or authenticate (BatchMode: no password prompts). Check DEPLOY_HOST/DEPLOY_USER/DEPLOY_SSH_KEY, that the key is loaded in your agent, and that the host key is already in known_hosts.`;
	const f = /^FAIL (\S+)/m.exec(r.stdout)?.[1];
	return `${what} failed${f ? ` (${f})` : ""} with exit code ${r.code}.`;
}

function header(ctx: Ctx, n: number, title: string): void {
	ctx.deps.log("", );
	ctx.deps.log(`[${n}/${TOTAL_STEPS}] ${title}`);
}

async function gitInfo(deps: Deps): Promise<{ sha: string; dirty: boolean }> {
	const sha = (await deps.exec(["git", "rev-parse", "--short=7", "HEAD"], { cwd: deps.repoRoot })).stdout.trim();
	const st = await deps.exec(["git", "status", "--porcelain"], { cwd: deps.repoRoot });
	return { sha, dirty: st.code === 0 && st.stdout.trim() !== "" };
}

function planInput(ctx: Ctx, imageRef: string, dirty: boolean): PlanInput {
	const compose = ctx.deps.readText("deploy/docker-compose.yml") ?? "";
	const dockerfile = ctx.deps.readText("Dockerfile") ?? "";
	const d = ctx.deps.now();
	return {
		cfg: ctx.cfg, opts: ctx.opts, ctlDir: ctx.deps.ctlDir, imageRef, dirty,
		networks: requiredNetworks(compose), entrypointBaked: entrypointInImage(dockerfile),
		stamp: makeImageRef("0000", d, false).split(":")[1]!.split("-")[1]!,
	};
}

export async function run(opts: Options, cfg: Config, deps: Deps): Promise<number> {
	const ctx: Ctx = { cfg, opts, deps };
	try {
		if (opts.dryRun) return await dryRun(ctx);
		switch (opts.mode) {
			case "deploy": return await fullDeploy(ctx);
			case "rollback": return await rollback(ctx);
			case "init-env": return await initEnv(ctx);
			case "edge": return await edge(ctx);
			case "status": return await status(ctx);
			case "logs": return await logs(ctx);
			case "auto": return await auto(ctx);
			default: deps.log(USAGE); return 0;
		}
	} catch (e) {
		if (e instanceof StepError) { deps.err(`ERROR: ${e.message}`); return e.code; }
		throw e;
	}
}

async function dryRun(ctx: Ctx): Promise<number> {
	let imageRef = "<image>", dirty = false;
	if (ctx.opts.mode === "deploy") {
		const g = await gitInfo(ctx.deps); // read-only local git, the only commands a dry run executes
		dirty = g.dirty;
		imageRef = makeImageRef(g.sha, ctx.deps.now(), g.dirty);
	}
	const p = planInput(ctx, imageRef, dirty);
	for (const l of renderPlan(buildPlan(p), p)) ctx.deps.log(l);
	if (ctx.opts.mode === "deploy") {
		const compose = ctx.deps.readText("deploy/docker-compose.yml");
		if (compose !== null && !composeUsesWebImage(compose)) ctx.deps.log("\nWARNING: deploy/docker-compose.yml does not reference WEB_IMAGE, so a real deploy would refuse to run (see DEPLOY-CLI.md).");
		if (dirty) ctx.deps.log("\nWARNING: the git tree is dirty.");
	}
	return 0;
}

// -- full deploy ------------------------------------------------------------------------------------------------------

async function fullDeploy(ctx: Ctx): Promise<number> {
	const { cfg, opts, deps } = ctx;
	const dir = cfg.dir;
	const g = await gitInfo(deps);
	const imageRef = makeImageRef(g.sha, deps.now(), g.dirty);
	if (g.dirty) deps.log("WARNING: the git tree has uncommitted changes. Continuing; the image tag ends in -dirty.");
	deps.log(`Deploying ${imageRef} to ${target(cfg)} (${dir})`);

	// 1 preflight
	header(ctx, 1, "Preflight");
	const compose = deps.readText("deploy/docker-compose.yml");
	if (compose === null) throw new StepError("deploy/docker-compose.yml is missing in this checkout.");
	if (!composeUsesWebImage(compose)) {
		throw new StepError("deploy/docker-compose.yml does not use ${WEB_IMAGE}, so 'docker compose --env-file .deploy.env up -d' would keep running the old image. Ask the owner of deploy/docker-compose.yml to use image: ${WEB_IMAGE:-" + REGISTRY_IMAGE + "}.");
	}
	const networks = requiredNetworks(compose);
	const pf = await rsh(ctx, SCRIPTS.preflight, [dir, ...networks]);
	if (pf.code !== 0) throw new StepError(explain(pf, "Preflight"));
	const f = /^FAIL (\S+)/m.exec(pf.stdout)?.[1];
	if (f) {
		const hints: Record<string, string> = {
			"docker-missing": "docker is not installed on the server.",
			"docker-not-usable": `${cfg.user} cannot talk to the docker daemon (is the user in the docker group?).`,
			"compose-missing": "the docker compose plugin is not installed on the server.",
			"dir-create-failed": `${dir} does not exist and 'sudo -n mkdir' failed (passwordless sudo needed, or create it by hand: sudo mkdir -p ${dir} && sudo chown ${cfg.user} ${dir}).`,
			"dir-not-writable": `${dir} is not writable by ${cfg.user}.`,
		};
		throw new StepError(`Preflight failed: ${hints[f] ?? f}`);
	}
	const missing = [...pf.stdout.matchAll(/^NETWORK-MISSING (\S+)$/gm)].map((m) => m[1]!);
	if (missing.length) {
		const cmds = missing.map((n) => `docker network create ${n}`);
		throw new StepError(`Missing docker network(s): ${missing.join(", ")}. Create with:\n    ssh ${target(cfg)} '${cmds.join(" && ")}'\n  then run the deploy again.`);
	}
	// step 7 happens here on purpose: fail before spending minutes on a build
	if (/^ENV missing$/m.test(pf.stdout)) {
		throw new StepError(`${dir}/.env is missing on the server. Create it with: bun run deploy --init-env`);
	}

	// 2 tests
	header(ctx, 2, opts.skipTests ? "Local tests: skipped (--skip-tests)" : "Local tests");
	if (!opts.skipTests) {
		for (const pkg of ["server", "web"]) {
			for (const argv of [["bun", "test"], ["bunx", "tsc", "--noEmit"]]) {
				const cwd = join(deps.repoRoot, pkg);
				deps.log(`  $ ${display({ argv, cwd: `${pkg}` }, true)}`);
				const r = await deps.exec(argv, { cwd, stream: true });
				if (r.code !== 0) throw new StepError(`${pkg}: '${argv.join(" ")}' failed (exit ${r.code}). Nothing was built or sent.`);
			}
		}
	}

	// 3 build
	header(ctx, 3, `Build ${imageRef} (linux/amd64)`);
	const buildArgv = ["docker", "buildx", "build", "--platform", "linux/amd64", "--load", "-t", imageRef, "."];
	deps.log(`  $ ${buildArgv.map(shq).join(" ")}`);
	const b = await deps.exec(buildArgv, { cwd: deps.repoRoot, stream: true });
	if (b.code !== 0) throw new StepError(`docker build failed (exit ${b.code}). Nothing was sent.`);

	// 4 ship
	header(ctx, 4, "Ship the image");
	const idr = await deps.exec(["docker", "image", "inspect", "--format", "{{.Id}}", imageRef]);
	const localId = idr.stdout.trim();
	const ref = /^sha256:[0-9a-f]{64}$/.test(localId) ? localId : imageRef;
	const have = await rsh(ctx, SCRIPTS.ensureImage, [ref, imageRef], true);
	if (have.code !== 0 && have.code !== 1) throw new StepError(explain(have, "Checking the server for the image"));
	if (/^PRESENT$/m.test(have.stdout)) {
		deps.log("  the server already has this image id; tagged it and skipped the transfer");
	} else {
		const t0 = deps.now().getTime();
		const pipeArgvs = [["docker", "save", imageRef], ["gzip"], sshArgv(cfg, deps.ctlDir, "gunzip | docker load")];
		deps.log(`  $ ${pipeArgvs.map((a) => display({ argv: a }, false)).join(" | ")}`);
		const pr = await deps.pipe(pipeArgvs);
		const secs = Math.max(0, (deps.now().getTime() - t0) / 1000);
		if (pr.codes.some((c) => c !== 0)) throw new StepError(`Shipping the image failed (exit codes ${pr.codes.join(",")}). ${pr.stderr.trim().split("\n").slice(-3).join(" | ")}`);
		deps.log(`  sent ${fmtBytes(pr.bytes)} compressed in ${secs.toFixed(1)}s`);
		const v = await rsh(ctx, SCRIPTS.ensureImage, [imageRef, imageRef], true);
		if (!/^PRESENT$/m.test(v.stdout)) throw new StepError("The server does not have the image after docker load.");
	}

	// 5 sync
	header(ctx, 5, "Sync compose file, update script and units (only what differs)");
	const baked = entrypointInImage(deps.readText("Dockerfile") ?? "");
	deps.log(baked ? "  entrypoint.sh is baked into the image (Dockerfile COPY): not synced" : "  entrypoint.sh is NOT baked into the image: it is synced");
	const assets = syncAssets(cfg, baked);
	const localHashes: Record<string, string> = {};
	for (const a of assets) {
		const t = deps.readText(a.local);
		if (t === null) throw new StepError(`${a.local} is missing in this checkout.`);
		localHashes[a.key] = sha256(t);
	}
	const hs = await rsh(ctx, SCRIPTS.hashes, [dir], true);
	if (hs.code !== 0) throw new StepError(explain(hs, "Reading remote file hashes"));
	const todo = assetsToSync(assets, localHashes, parseHashes(hs.stdout));
	if (todo.length === 0) deps.log("  everything is already up to date");
	else {
		deps.log(`  differs: ${todo.map((a) => a.key).join(", ")}`);
		const cp = await deps.exec(scpArgv(cfg, deps.ctlDir, todo.map((a) => join(deps.repoRoot, a.local)), `${dir}/.stage`));
		if (cp.code !== 0) throw new StepError(explain(cp, "Copying files with scp"));
		const flag = (k: string): string => (todo.some((a) => a.key === k) ? "1" : "0");
		const ins = await rsh(ctx, SCRIPTS.install, [dir, flag("compose"), flag("entrypoint"), flag("update"), flag("service"), flag("timer")]);
		if (ins.code !== 0) throw new StepError(explain(ins, "Installing synced files"));
	}

	// 6 .deploy.env (and 7, already done after preflight)
	header(ctx, 6, "Write .deploy.env");
	const st = await rsh(ctx, SCRIPTS.state, [dir], true);
	const state = parseState(st.stdout);
	const previous = choosePrevious(imageRef, state);
	const w = await rsh(ctx, SCRIPTS.writeEnv, [dir, imageRef, previous]);
	if (w.code !== 0) throw new StepError(explain(w, "Writing .deploy.env"));
	deps.log(`  WEB_IMAGE=${imageRef}`);
	deps.log(`  PREVIOUS_IMAGE=${previous || "(none, first deploy)"}`);
	header(ctx, 7, ".env present on the server: yes (checked after preflight)");

	// 8 up, 9 wait
	header(ctx, 8, "docker compose up -d");
	const up = await rsh(ctx, SCRIPTS.composeUp, [dir]);
	let healthy = up.code === 0;
	header(ctx, 9, `Wait up to ${HEALTH_TIMEOUT_SECONDS}s for health`);
	if (healthy) {
		const wr = await rsh(ctx, SCRIPTS.wait, [WEB_CONTAINER, WORKER_CONTAINER, imageRef, String(HEALTH_TIMEOUT_SECONDS)]);
		healthy = wr.code === 0;
	} else deps.err("  compose up failed; not waiting");

	// 10 rollback on failure
	if (!healthy) {
		header(ctx, 10, "FAILED: rolling back");
		if (!previous) {
			deps.err("  There is no previous image on record (first deploy), so there is nothing to roll back to. The new containers are left as they are.");
		} else {
			const rb = await applyImage(ctx, previous, state.filePrevious);
			deps.err(rb ? `  rolled back to ${previous}, healthy` : `  rollback to ${previous} did not become healthy either; check the server by hand`);
		}
		deps.err("  last 30 web log lines:");
		const lg = await rsh(ctx, SCRIPTS.logs, [WEB_CONTAINER, "30"], true);
		for (const l of indent(lg.stdout)) deps.err(l);
		throw new StepError(`Deploy of ${imageRef} FAILED${previous ? ` and was rolled back to ${previous}` : ""}.`);
	}
	deps.log("  healthy");

	// 11 timer
	header(ctx, 11, "Registry-pull timer");
	const tm = await rsh(ctx, SCRIPTS.timer, ["disable"], true);
	if (/TIMER disabled/.test(tm.stdout)) deps.log(`  ${TIMER} disabled so it cannot replace this image (re-enable with: bun run deploy --auto)`);
	else if (/TIMER absent/.test(tm.stdout)) deps.log(`  ${TIMER} is not installed; nothing to disable`);
	else deps.err(`  WARNING: could not disable ${TIMER} (needs passwordless sudo). It would pull ${REGISTRY_IMAGE} and undo this deploy; disable it by hand.`);

	// 12 prune
	header(ctx, 12, `Prune old local tags (keep ${KEEP_TAGS})`);
	const li = await rsh(ctx, SCRIPTS.listImages, [], true);
	const doomed = selectPruneTags(li.stdout.split("\n"), [imageRef, previous, state.fileWeb, state.running].filter(Boolean));
	if (li.code !== 0 || doomed.length === 0) deps.log("  nothing to prune");
	else await rsh(ctx, SCRIPTS.prune, doomed);

	// 13 summary
	header(ctx, 13, "Summary");
	deps.log(`  image     ${imageRef}`);
	deps.log(`  previous  ${previous || "(none)"}`);
	deps.log("  health    healthy (web healthy on the new image, /health/detail answered, worker running)");
	deps.log("  roll back bun run deploy --rollback");
	return 0;
}

/** Points .deploy.env at `image`, composes up and waits. True when healthy. */
async function applyImage(ctx: Ctx, image: string, newPrevious: string): Promise<boolean> {
	const { cfg } = ctx;
	const w = await rsh(ctx, SCRIPTS.writeEnv, [cfg.dir, image, newPrevious], true);
	if (w.code !== 0) return false;
	const up = await rsh(ctx, SCRIPTS.composeUp, [cfg.dir], true);
	if (up.code !== 0) return false;
	const wr = await rsh(ctx, SCRIPTS.wait, [WEB_CONTAINER, WORKER_CONTAINER, image, String(HEALTH_TIMEOUT_SECONDS)]);
	return wr.code === 0;
}

// -- other commands ----------------------------------------------------------------------------------------------------

async function readState(ctx: Ctx): Promise<RemoteState> {
	const r = await rsh(ctx, SCRIPTS.state, [ctx.cfg.dir], true);
	if (r.code !== 0) throw new StepError(explain(r, "Reading the server state"));
	return parseState(r.stdout);
}

async function disableTimer(ctx: Ctx): Promise<void> {
	const tm = await rsh(ctx, SCRIPTS.timer, ["disable"], true);
	if (/TIMER disabled/.test(tm.stdout)) ctx.deps.log(`${TIMER} disabled (it would otherwise pull ${REGISTRY_IMAGE} and undo this).`);
	else if (/TIMER failed/.test(tm.stdout)) ctx.deps.err(`WARNING: could not disable ${TIMER}; do it by hand.`);
}

async function rollback(ctx: Ctx): Promise<number> {
	const { deps } = ctx;
	const state = await readState(ctx);
	const { target: to, newPrevious } = selectRollback(state);
	deps.log(`Rolling back to ${to} (current: ${state.fileWeb || state.running || "unknown"})`);
	const have = await rsh(ctx, SCRIPTS.ensureImage, [to, to], true);
	if (!/^PRESENT$/m.test(have.stdout)) throw new StepError(`${to} is no longer on the server (pruned or never loaded); it cannot be rolled back to.`);
	const ok = await applyImage(ctx, to, newPrevious);
	if (!ok) {
		const lg = await rsh(ctx, SCRIPTS.logs, [WEB_CONTAINER, "30"], true);
		for (const l of indent(lg.stdout)) deps.err(l);
		throw new StepError(`Rollback to ${to} did not become healthy.`);
	}
	await disableTimer(ctx);
	deps.log(`Rolled back. WEB_IMAGE=${to} PREVIOUS_IMAGE=${newPrevious || "(none)"}. Run --rollback again to go forward.`);
	return 0;
}

async function initEnv(ctx: Ctx): Promise<number> {
	const { cfg, deps } = ctx;
	const r = await rsh(ctx, SCRIPTS.initEnv, [cfg.dir], true);
	if (r.code !== 0) throw new StepError(explain(r, "init-env"));
	const created = /^CREATED (.+)$/m.exec(r.stdout)?.[1]?.split(/\s+/).filter((k) => /^[A-Z_]+$/.test(k));
	if (!created) {
		if (/^EXISTS$/m.test(r.stdout)) { deps.log(`${cfg.dir}/.env already exists on the server: left untouched (never overwritten).`); return 0; }
		throw new StepError("init-env gave an answer that was not understood; nothing is shown. Check the server.");
	}
	deps.log(`Created ${cfg.dir}/.env (mode 0600) with the keys: ${created.join(", ")}`);
	deps.log("The secrets were generated on the server and were not shown or sent through this terminal.");
	deps.log("Next: when the netquor-api leads route is deployed, set LEAD_FORWARD_URL and un-comment LEAD_FORWARD_SECRET in the server .env (the server refuses a secret without a URL), and set the same value as LEADS_WEBHOOK_SECRET in netquor-api.");
	deps.log("      PRICING_WEBHOOK_SECRET is for the Netquor API's webhook client.");
	deps.log("      Fill PRICING_API_URL, PRICING_API_TOKEN and LEAD_FORWARD_URL on the server when they are known.");
	return 0;
}

async function edge(ctx: Ctx): Promise<number> {
	const { cfg, deps, opts } = ctx;
	deps.log(`WARNING: --edge changes the LIVE edge on ${target(cfg)} (${EDGE_DIR}): the Caddy that terminates TLS for www.netquor.com and phone.netquor.com.`);
	deps.log("         The Caddyfile is validated first and backed up, and restored on any failure, but a reload is still live traffic.");
	if (!opts.yes) {
		if (!deps.isTTY) throw new StepError("Refusing to touch the live edge without confirmation: pass --yes (or run in a terminal and type 'yes').", 2);
		if (!(await deps.confirm("Type 'yes' to continue: "))) throw new StepError("Not confirmed; nothing was changed.", 2);
	}
	for (const f of ["deploy/edge/Caddyfile", "deploy/edge/docker-compose.yml"]) {
		if (deps.readText(f) === null) throw new StepError(`${f} is missing in this checkout.`);
	}
	const stageRes = await rsh(ctx, SCRIPTS.edgeStage, [], true);
	const stage = /^STAGE (\/tmp\/nq-edge\.[A-Za-z0-9]+)$/m.exec(stageRes.stdout)?.[1];
	if (stageRes.code !== 0 || !stage) throw new StepError(explain(stageRes, "Creating the staging folder"));
	const clean = async (): Promise<void> => { await deps.exec(sshArgv(cfg, deps.ctlDir, `rm -rf ${shq(stage)}`)); };
	try {
		const base = join(deps.repoRoot, "deploy/edge");
		const c1 = await deps.exec(scpArgv(cfg, deps.ctlDir, [join(base, "Caddyfile"), join(base, "docker-compose.yml")], stage));
		if (c1.code !== 0) throw new StepError(explain(c1, "Copying the edge files"));
		if (deps.readText("deploy/edge/holding/index.html") !== null || existsSync(join(base, "holding"))) {
			const c2 = await deps.exec(scpArgv(cfg, deps.ctlDir, [join(base, "holding")], stage, true));
			if (c2.code !== 0) throw new StepError(explain(c2, "Copying the holding page"));
		}
		const v = await rsh(ctx, SCRIPTS.edgeValidate, [stage]);
		if (v.code !== 0) throw new StepError("The new Caddyfile does not validate. Nothing on the live edge was touched.");
		deps.log("  Caddyfile is valid. Applying.");
		const stamp = planInput(ctx, "x", false).stamp;
		const a = await rsh(ctx, SCRIPTS.edgeApply, [EDGE_DIR, stage, stamp]);
		if (a.code === 40) throw new StepError(`phone.netquor.com did not answer 200 through the edge after the change. The previous Caddyfile (Caddyfile.bak-${stamp}) was restored and reloaded.`, 1);
		if (a.code === 41) throw new StepError(`The edge refused the change. The previous config was restored (Caddyfile.bak-${stamp}).`, 1);
		if (a.code !== 0) throw new StepError(explain(a, "Applying the edge change"));
		deps.log(`Edge updated and verified (phone.netquor.com answers 200). Backup: ${EDGE_DIR}/Caddyfile.bak-${stamp}`);
		return 0;
	} finally {
		await clean();
	}
}

async function status(ctx: Ctx): Promise<number> {
	const { cfg, deps } = ctx;
	const r = await rsh(ctx, SCRIPTS.status, [cfg.dir, WEB_CONTAINER, WORKER_CONTAINER, TIMER], true);
	if (r.code !== 0) throw new StepError(explain(r, "status"));
	let timer = "unknown";
	for (const raw of r.stdout.split("\n")) {
		const line = raw.trimEnd();
		if (line.startsWith("DETAIL ")) deps.log(`prices   ${summarizeDetail(line.slice(7))}`);
		else if (line.startsWith("HEALTH ")) deps.log(`health   ${line.slice(7)}`);
		else if (line.startsWith("IMAGE ")) deps.log(`image    ${line.slice(6)}`);
		else if (line.startsWith("WORKER ")) deps.log(`worker   ${line.slice(7)}`);
		else if (line.startsWith("TIMER ")) { timer = line.slice(6) || "inactive"; deps.log(`timer    ${TIMER} is ${timer}`); }
		else deps.log(line);
	}
	return 0;
}

async function logs(ctx: Ctx): Promise<number> {
	for (const c of [WEB_CONTAINER, WORKER_CONTAINER]) {
		ctx.deps.log(`== ${c} (last 100 lines)`);
		const r = await rsh(ctx, SCRIPTS.logs, [c, "100"], true);
		if (r.code !== 0) throw new StepError(explain(r, "logs"));
		ctx.deps.log(r.stdout.trimEnd());
	}
	return 0;
}

async function auto(ctx: Ctx): Promise<number> {
	const { deps } = ctx;
	const state = await readState(ctx);
	const cur = state.fileWeb || state.running;
	const prev = cur && cur !== REGISTRY_IMAGE ? cur : state.filePrevious;
	const w = await rsh(ctx, SCRIPTS.writeEnv, [ctx.cfg.dir, REGISTRY_IMAGE, prev]);
	if (w.code !== 0) throw new StepError(explain(w, "Writing .deploy.env"));
	const t = await rsh(ctx, SCRIPTS.timer, ["enable"], true);
	if (/TIMER enabled/.test(t.stdout)) deps.log(`${TIMER} enabled. Within about 2 minutes it pulls ${REGISTRY_IMAGE} and recreates web and worker if that image differs.`);
	else if (/TIMER absent/.test(t.stdout)) throw new StepError(`${TIMER} is not installed on the server. Run a full deploy (it syncs the units) or install them as in deploy/README.md.`);
	else throw new StepError(`Could not enable ${TIMER} (needs passwordless sudo).`);
	deps.log(`WEB_IMAGE=${REGISTRY_IMAGE} PREVIOUS_IMAGE=${prev || "(none)"}. A manual deploy switches it off again.`);
	return 0;
}

// ---------------------------------------------------------------------------------------------------------------------
// real exec / pipe / main
// ---------------------------------------------------------------------------------------------------------------------

export const realExec: Exec = async (argv, opts = {}) => {
	try {
		const p = Bun.spawn(argv, {
			cwd: opts.cwd,
			stdin: opts.stdin !== undefined ? Buffer.from(opts.stdin) : "ignore",
			stdout: opts.stream ? "inherit" : "pipe",
			stderr: opts.stream ? "inherit" : "pipe",
		});
		const [stdout, stderr] = await Promise.all([
			opts.stream ? Promise.resolve("") : new Response(p.stdout as ReadableStream).text(),
			opts.stream ? Promise.resolve("") : new Response(p.stderr as ReadableStream).text(),
		]);
		return { code: await p.exited, stdout, stderr };
	} catch (e) {
		return { code: 127, stdout: "", stderr: String((e as Error).message ?? e) };
	}
};

export const realPipe: Pipe = async (argvs) => {
	const procs = argvs.map((argv, i) => Bun.spawn(argv, { stdin: i === 0 ? "ignore" : "pipe", stdout: "pipe", stderr: "pipe" }));
	let bytes = 0;
	const pumps: Promise<void>[] = [];
	for (let i = 0; i < procs.length - 1; i++) {
		const src = procs[i]!.stdout as ReadableStream<Uint8Array>;
		const dst = procs[i + 1]!.stdin as { write(c: Uint8Array): unknown; flush(): unknown; end(): unknown };
		const last = i === procs.length - 2;
		pumps.push((async () => {
			for await (const chunk of src) {
				if (last) bytes += chunk.length;
				dst.write(chunk);
				await dst.flush();
			}
			await dst.end();
		})());
	}
	const tail = procs[procs.length - 1]!;
	const [stdout, ...errs] = await Promise.all([
		new Response(tail.stdout as ReadableStream).text(),
		...procs.map((p) => new Response(p.stderr as ReadableStream).text()),
	]);
	await Promise.all(pumps);
	const codes = await Promise.all(procs.map((p) => p.exited));
	return { codes, bytes, stdout, stderr: errs.join("\n").slice(-2000) };
};

export const REPO_ROOT = resolve(dirname(import.meta.path), "..");

export async function main(argv: string[], env: Record<string, string | undefined> = process.env, root = REPO_ROOT): Promise<number> {
	let opts: Options;
	try { opts = parseArgs(argv); } catch (e) { console.error(`${(e as Error).message}\n\n${USAGE}`); return 2; }
	if (opts.mode === "help") { console.log(USAGE); return 0; }
	const readText = (rel: string): string | null => { try { return readFileSync(join(root, rel), "utf8"); } catch { return null; } };
	let cfg: Config;
	try { cfg = resolveConfig(env, parseEnvFile(readText(".env.deploy") ?? "")); } catch (e) { console.error(`${(e as Error).message}`); return 2; }

	const ctlDir = opts.dryRun ? "/tmp/nqd-XXXXXX" : mkdtempSync("/tmp/nqd-");
	const deps: Deps = {
		exec: realExec,
		pipe: realPipe,
		log: (l) => console.log(l),
		err: (l) => console.error(l),
		confirm: async (q) => (prompt(q) ?? "").trim() === "yes",
		now: () => new Date(),
		readText,
		repoRoot: root,
		ctlDir,
		isTTY: Boolean(process.stdin.isTTY),
	};
	try {
		return await run(opts, cfg, deps);
	} finally {
		if (!opts.dryRun) {
			await realExec(sshExitArgv(cfg, ctlDir)); // closes the shared connection; harmless if there is none
			try { rmSync(ctlDir, { recursive: true, force: true }); } catch { /* best effort */ }
		}
	}
}

if (import.meta.main) {
	process.exit(await main(process.argv.slice(2)));
}
