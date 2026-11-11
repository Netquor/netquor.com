# bun run deploy

Builds and tests locally, then pushes the web image to the server over SSH. One file, `deploy/deploy.ts`, Bun and TypeScript, no dependencies. The registry-pull timer path in `deploy/README.md` still exists; this is the manual path (and it switches the timer off while it is in charge).

```
bun run deploy                 full deploy
bun run deploy:dry             print the plan and the exact commands, execute nothing remote
bun run deploy:status          same as: bun run deploy --status
bun run deploy --rollback      (any flag after the script name is passed through)
```

## Config

Read from the process environment and from `./.env.deploy` at the repository root (git-ignored; copy `.env.deploy.example`). The environment wins over the file. The file holds no secrets, only where to deploy.

| Name | Default | Notes |
|---|---|---|
| `DEPLOY_HOST` | none, required | host name or IPv4 address, letters, digits, dots, hyphens only |
| `DEPLOY_USER` | `debian` | plain unix user name |
| `DEPLOY_SSH_KEY` | none | path, passed as `-i`; otherwise your ssh config and agent decide |
| `DEPLOY_PORT` | none | 1 to 65535 |
| `DEPLOY_DIR` | `/opt/netquor-web` | absolute path of safe characters, no `..` |

Invalid values are refused before anything runs. Every ssh and scp call uses `BatchMode=yes` (never prompts, so the key must be in your agent and the host key already in `known_hosts`), `ConnectTimeout=10` and a shared connection (`ControlMaster=auto`, `ControlPersist=60s`, socket in a temp dir that is removed at the end).

## Commands and flags

| Command | What it does |
|---|---|
| (none) | full deploy, steps below |
| `--dry-run` | with any command: print every step and the exact argv with the host; only read-only `git` runs locally; nothing remote, no tests, no build. `--show-scripts` also prints the remote scripts |
| `--skip-tests` | full deploy without the local tests |
| `--rollback` | read `PREVIOUS_IMAGE` from `<dir>/.deploy.env`, check that image is still on the server, swap `WEB_IMAGE` and `PREVIOUS_IMAGE`, compose up, wait for health, disable the timer. Run it again to go forward |
| `--init-env` | create `<dir>/.env` only if absent (mode 0600, `ln` makes it atomic, so it can never overwrite). `PRICING_WEBHOOK_SECRET` and `LEAD_FORWARD_SECRET` are 32 random bytes in hex generated on the server; `ORIGIN=https://www.netquor.com`; empty `PRICING_API_URL`, `PRICING_API_TOKEN`, `LEAD_FORWARD_URL`. Only the key names are printed. Reminder printed: `LEAD_FORWARD_SECRET` must be set as `LEADS_WEBHOOK_SECRET` in netquor-api, and `PRICING_WEBHOOK_SECRET` is for the Netquor API's webhook client |
| `--edge` | sync `deploy/edge` to `/opt/edge` (see below). Warns that it touches the live edge and needs `--yes` or a typed `yes` |
| `--yes` | only with `--edge` |
| `--status` | `compose ps`, web health, price version and `updatedAt` from `/health/detail` (via `docker exec netquor-web`), image in use, worker state, `.deploy.env`, whether `netquor-site-update.timer` is active |
| `--logs` | last 100 lines of the web and worker containers |
| `--auto` | back to registry-pull mode: `WEB_IMAGE=ghcr.io/netquor/netquor-com-web:main` in `.deploy.env` (the manual image becomes `PREVIOUS_IMAGE`), enable the timer |

## Full deploy steps

1. Preflight: ssh works; docker and `docker compose` present; the deploy dir exists (or is created with `sudo -n`); the networks exist (`edge`, plus `web_front` when the compose file uses it; if one is missing the exact `docker network create` command is printed and the run stops); `<dir>/.env` exists. A missing `.env` stops here with a pointer to `--init-env`, before any build time is spent. Also refuses if `deploy/docker-compose.yml` does not use `${WEB_IMAGE}`.
2. Local tests: `(cd server && bun test && bunx tsc --noEmit)` and `(cd web && bun test && bunx tsc --noEmit)`.
3. Build: `docker buildx build --platform linux/amd64 --load -t netquor-com-web:<shortsha>-<yyyymmddHHMMSS>[-dirty] .` from the repo root (time is UTC). A dirty tree warns and continues.
4. Ship: if the server already has the image id, tag it and skip; else `docker save | gzip | ssh ... 'gunzip | docker load'`, showing compressed size and elapsed time.
5. Sync, only when the sha256 differs: `docker-compose.yml` to the deploy dir; `netquor-site-update` to `/usr/local/sbin`; the `.service` and `.timer` to `/etc/systemd/system` (then `daemon-reload`). Those three use `sudo -n` and only warn if it is not available. `entrypoint.sh` is baked into the image by the Dockerfile `COPY`, so it is not synced (the CLI checks the Dockerfile and would sync it if that changed).
6. Write `.deploy.env` atomically: `WEB_IMAGE=<new>`, `PREVIOUS_IMAGE=<the image that was current>`. Redeploying never loses the previous one.
7. `.env` check (done in step 1, see above).
8. `docker compose --env-file .deploy.env up -d --pull never` in the deploy dir.
9. Wait up to 90 s for the web container to be healthy on the new image, `/health/detail` to answer, and the worker to be running.
10. On failure of step 8 or 9: automatically point `.deploy.env` back at `PREVIOUS_IMAGE`, compose up, wait, print the last 30 web log lines, exit 1. With no previous image (first deploy) it says so and leaves things as they are.
11. `sudo -n systemctl disable --now netquor-site-update.timer` (ignored if absent), and says so. Otherwise the timer would pull `:main` and undo the deploy.
12. Prune the server's local `netquor-com-web` tags beyond the newest 3, never the new, previous or running one.
13. Summary: image tag, previous tag, health, how to roll back.

Exit codes: 0 success, 1 a step failed, 2 usage or config error or `--edge` not confirmed.

## --edge

1. Shows the warning; needs `--yes` or an interactive `yes` (refuses when stdin is not a terminal and `--yes` is missing).
2. Copies `deploy/edge/Caddyfile`, `docker-compose.yml` and `holding/` to a staging folder in `/tmp` on the server. Nothing live is touched.
3. `docker run --rm -v <stage>/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2-alpine caddy validate ...`. If it fails, the run stops here.
4. Backs up to `/opt/edge/Caddyfile.bak-<timestamp>` (and the compose file when it changed), writes the new Caddyfile in place (same inode, because it is a single-file bind mount), then `docker exec netquor-edge caddy reload`, or `docker compose up -d` when the compose file changed.
5. Verifies `phone.netquor.com` answers 200 through the edge: `curl --resolve phone.netquor.com:443:127.0.0.1` on the server, retried for about 16 s.
6. On a failed reload or verification the backup is restored and Caddy reloaded (or compose restored and brought up); the run exits 1 and says so.

## Failure behaviour in one place

- Before step 6 nothing on the server's running stack has changed; a failure just stops.
- After step 6 any compose or health failure triggers the automatic rollback described in step 10.
- `--rollback` that does not become healthy shows the log tail and exits 1; it does not try anything further.
- Secrets: the CLI never reads `.env` files on this machine or the server, never prints a secret, and `--init-env` generates them on the server only.

## Tests

`bun test deploy/deploy.test.ts` and `bunx tsc --noEmit` at the repository root. Pure functions are tested directly, the runner with a fake exec, and the remote shell scripts (init-env, edge apply with restore, write env, health wait) are executed locally with stubbed `docker` and `curl`.
