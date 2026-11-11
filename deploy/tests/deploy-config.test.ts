import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, chmodSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dir, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("compose", () => {
  const web = read("deploy/docker-compose.yml");
  test("image comes from WEB_IMAGE for both services", () => {
    expect(web.match(/image: \$\{WEB_IMAGE:-ghcr\.io\/netquor\/netquor-com-web:main\}/g)?.length).toBe(2);
  });
  test("env_file is required", () => {
    expect(web).not.toContain("required: false");
    expect(web.match(/- \/opt\/netquor-web\/\.env/g)?.length).toBe(2);
  });
  test("web is on web_front not edge; worker only internal", () => {
    expect(web).toContain("networks: [web_front, internal]");
    expect(web).toContain("networks: [internal]");
    expect(web).not.toMatch(/networks: \[[^\]]*\bedge\b/);
    expect(web).toMatch(/web_front:\n    external: true/);
  });
  test("DATA_DIR kept", () => expect(web).toContain("DATA_DIR: /data"));
  test("edge compose joins edge and web_front and mounts holding", () => {
    const e = read("deploy/edge/docker-compose.yml");
    expect(e).toContain("networks: [edge, web_front]");
    expect(e).toContain("./holding:/srv/holding:ro");
  });
});

describe("Caddyfile", () => {
  const c = read("deploy/edge/Caddyfile");
  test("www block, holding fallback, no apex block", () => {
    expect(c).toContain("reverse_proxy netquor-web:3000");
    expect(c).toContain("header_up X-Real-IP {client_ip}");
    expect(c).toContain("handle_errors");
    expect(c).toContain("{file./srv/holding/index.html}");
    expect(c).toContain("Retry-After");
    expect(c).toMatch(/^www\.netquor\.com \{/m);
    expect(c).not.toMatch(/^netquor\.com \{/m);
    expect(c).toContain("email ops@netquor.com");
    expect(c).toMatch(/^phone\.netquor\.com \{/m);
  });
});

describe("workflow", () => {
  const w = read(".github/workflows/site.yml");
  test("ignores holding page changes and type-checks web", () => {
    expect(w).toContain("'deploy/edge/holding/**'");
    expect(w).toContain("bun run check");
    expect(w).toContain("bun run build");
    expect(w).toContain("needs: test");
  });
});

describe("netquor-site-update", () => {
  function run(deployEnv: string | null) {
    const dir = mkdtempSync(join(tmpdir(), "nq-"));
    const bin = join(dir, "bin");
    mkdirSync(bin);
    const log = join(dir, "calls.log");
    writeFileSync(
      join(bin, "docker"),
      `#!/bin/sh\necho "$@" >> ${log}\ncase "$1" in image) echo sha256:aaa;; inspect) echo sha256:aaa;; esac\nexit 0\n`,
    );
    chmodSync(join(bin, "docker"), 0o755);
    if (deployEnv !== null) writeFileSync(join(dir, ".deploy.env"), deployEnv);
    const r = Bun.spawnSync(["sh", join(root, "deploy/netquor-site-update")], {
      env: { PATH: `${bin}:${process.env.PATH}`, NETQUOR_WEB_DIR: dir },
    });
    let calls = "";
    try { calls = readFileSync(log, "utf8"); } catch {}
    return { code: r.exitCode, out: r.stdout.toString().trim(), calls };
  }
  test("local image skips the registry", () => {
    const r = run("WEB_IMAGE=netquor-com-web:local\n");
    expect(r.code).toBe(0);
    expect(r.out).toBe("local deploy mode, skipping registry pull");
    expect(r.calls).toBe("");
  });
  test("ghcr image uses --env-file", () => {
    const r = run("WEB_IMAGE=ghcr.io/netquor/netquor-com-web:sha-1\n");
    expect(r.code).toBe(0);
    expect(r.out).toContain("unchanged");
    expect(r.calls).toContain("compose --env-file");
  });
  test("no env file behaves as before", () => {
    const r = run(null);
    expect(r.out).toContain("unchanged");
    expect(r.calls).not.toContain("--env-file");
  });
});
