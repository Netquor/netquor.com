# Deploying netquor.com (doc-iad-c-02)

```
Cloudflare -> netquor-edge (Caddy, 80/443, TLS) -> netquor-web:3000       www.netquor.com   (this repo's image, network web_front)
                                                -> netquor-phone-site:80  phone.netquor.com (Phone's own stack, network edge)
              netquor-web-worker --(signed POST over the internal network)--> netquor-web
```

## What runs

One image, `ghcr.io/netquor/netquor-com-web:main` (built from the `Dockerfile` at the repository root), run twice from `deploy/docker-compose.yml` in `/opt/netquor-web`:

| Container | Command | What it does |
|---|---|---|
| `netquor-web` | default (`bun web/build/index.js`) | SvelteKit renders the pages on the server, per request, from an in-memory price cache. The Elysia API is mounted in the same process: `/api/*`, `/hooks/*`, `/health*`. It is the only writer of the `data` volume (`prices.json`, `prices.prev.json`, `baseline.json`, `leads.jsonl`). Port 3000, **no published ports**, networks `web_front` and `internal` (it is not on the shared `edge` network). |
| `netquor-web-worker` | `bun server/src/worker.ts` | The backup price path. Polls `PRICING_API_URL` every `PRICING_POLL_SECONDS` (default 900, minimum 60) and delivers what it gets to `netquor-web` with a signed POST. Writes nothing, has no volume, `internal` network only (it reaches web by name over it). Starts only when web is healthy. |

Prices: the Netquor API's signed webhook to `/hooks/pricing` is the primary path, the worker's poll is the backup, and an API `prices.changed` nudge makes web pull once. Details, guards and the operator tool are in `server/src/prices/README.md`.

Every page is a Svelte route. `/app/legacy` holds only what the pages load by URL, copied at build time: images (top level, `brand/`, `fleet/img`, `fleet/favicon.svg`), `site.webmanifest`, the three pure calculation scripts (`subnet-calc.js`, `cost-calc.js`, `bundle-calc.js`) and `llms.template.txt` (read by the server, never served). The hand-written HTML pages, `nq.css`, `nav.css`, `nav.js`, `fx.js`, `bg.js`, `nudge.js`, `analytics.js`, `readiness.js`, `fleet/site.css`, `fleet/site.js` and `fleet/pricing.js` are not in the image (`.dockerignore` and the `legacy` build stage) and the web process refuses those names even if a folder holds them. They are not in the working tree either: the legacy site exists only as the `legacy-baseline-2026-11` git tag, which the regression tools in `web/scripts` extract on demand (`bun run baseline` in `web/`). `deploy/smoke.sh` checks both: no `*.html`, `*.css` or other `*.js` under `/app/legacy`, and 200 for every asset a page needs.

There is no static container, no `site_live` volume and no init or stamp step.

## Current state of the host

- **Live:** the edge Caddy (`netquor-edge`, `/opt/edge`) owns ports 80 and 443, and Phone (`phone.netquor.com`, `netquor-phone-site`) is running behind it on the shared `edge` network.
- **www is a holding page:** `www.netquor.com` currently serves a temporary 503 holding page from `/opt/edge/holding`, via `handle_errors` in the edge Caddyfile (the web image has not been deployed, so the upstream is unreachable).
- **No apex block:** the Caddyfile on the host has no `netquor.com` block, because Cloudflare redirects the apex to `www` before it reaches the host.
- The repo's `deploy/edge/Caddyfile` matches what is on the host, plus the new `www` upstream (`netquor-web:3000`, reached over `web_front`). `/opt/netquor-web` and the `web_front` network do not exist on the host yet.

## Networks

| Network | Members | Why |
|---|---|---|
| `edge` (external, exists) | `netquor-edge`, Phone | Phone's own network. The web container is **not** on it, so Phone and web cannot reach each other. |
| `web_front` (external, create once) | `netquor-edge`, `netquor-web` | The only path from the edge to web. |
| `internal` (created by compose) | `netquor-web`, `netquor-web-worker` | The worker's signed POST to web. The worker joins nothing else. |

Create the front network once, before the first `docker compose up` in either stack:

```bash
docker network create web_front
```

## One-time setup (as the deploy user, on the host)

```bash
# 1. the update script and its timer (do not enable the timer yet, see "first deploy")
sudo install -m 0755 deploy/netquor-site-update /usr/local/sbin/netquor-site-update
sudo install -m 0644 deploy/netquor-site-update.service deploy/netquor-site-update.timer /etc/systemd/system/
sudo systemctl daemon-reload

# 2. the web stack folder and its secrets file
sudo mkdir -p /opt/netquor-web && sudo chown debian:debian /opt/netquor-web
cp deploy/docker-compose.yml /opt/netquor-web/
install -m 0600 /dev/null /opt/netquor-web/.env
$EDITOR /opt/netquor-web/.env      # see below

# 3. networks: "edge" already exists (Phone uses it); web_front is new
docker network inspect edge >/dev/null 2>&1 || docker network create edge
docker network inspect web_front >/dev/null 2>&1 || docker network create web_front
```

`/opt/netquor-web/.env` (mode 0600, never committed; `server/.env.example` documents every name). The file is **required**: `env_file` has no `required: false`, so a missing file makes `docker compose up` fail loudly instead of starting without secrets. Keys (names only here):

`PRICING_WEBHOOK_SECRET`, `PRICING_API_URL`, `PRICING_API_TOKEN`, `LEAD_FORWARD_URL`, `LEAD_FORWARD_SECRET`, `ORIGIN`.

`LEAD_FORWARD_URL` may stay unset until the Netquor API leads route is deployed: leads then go only to `/data/leads.jsonl`. The ones that matter:

```
PRICING_WEBHOOK_SECRET=<openssl rand -hex 32>   # the Netquor API signs with this; web verifies; the worker signs with it too
PRICING_API_URL=https://api.netquor.com/...     # the address of the price snapshot (worker poll and web nudge pull)
PRICING_API_TOKEN=                              # only if the API wants a bearer token
PRICING_POLL_SECONDS=900
LEAD_FORWARD_URL=                               # optional: also forward leads to the Netquor API
LEAD_FORWARD_SECRET=
```

Without `PRICING_WEBHOOK_SECRET` (16 characters or more) the web process still serves pages from the seed or last saved prices but does not mount `/hooks/pricing`, and the worker idles with a log line. The compose file fixes everything else (`HOST`, `PORT`, `ORIGIN`, `ADDRESS_HEADER=X-Real-IP`, `SITE_ORIGIN`, `ALLOWED_ORIGINS`, `DATA_DIR`, `PRICES_DIR`, `LEAD_FILE`); values in `.env` do not override those.

`ORIGIN` must be exactly `https://www.netquor.com`: SvelteKit refuses form-encoded POSTs whose `Origin` differs. JSON posts (the lead form, the webhook) are not affected.

The first start seeds `/data/prices.json` from the image's seed only if the volume has no price file; an existing `prices.json` (or `prices.prev.json`) is never overwritten, so a new image cannot roll prices back.

## Image selection and local deploy mode

Both services use `image: ${WEB_IMAGE:-ghcr.io/netquor/netquor-com-web:main}`. `/opt/netquor-web/.deploy.env` (written by the local deploy tool, not a secrets file) can set `WEB_IMAGE`; pass it with `docker compose --env-file /opt/netquor-web/.deploy.env ...`. If that file exists and `WEB_IMAGE` in it does not start with `ghcr.io/`, `netquor-site-update` logs `local deploy mode, skipping registry pull` and exits 0, so the timer never replaces an image you loaded by hand. Delete the file (or set a `ghcr.io/` image) to return to registry updates.

## Deploying from your Mac

`deploy/deploy.ts` builds the image locally, ships it to the host and applies it, without GitHub. Run it with `bun deploy/deploy.ts [flags]`:

- `--dry-run`: print what would be done, change nothing.
- `--skip-tests`: skip the test and type-check step before building.
- `--rollback`: put the previous image back.
- `--init-env`: create `/opt/netquor-web/.env` on the host (the required secrets file) the first time.
- `--edge`: also install the edge Caddyfile and compose file and reload the edge.
- `--status`: show container state and health, change nothing.
- `--logs`: follow the web and worker logs.
- `--auto`: run non-interactively, without prompts.

The script header is the authority if a flag changes.

## First deploy WITHOUT GitHub (manual step for the owner)

Until the workflow has published an image (or the GHCR package is public or the host is logged in), load the image over SSH. Run this from a machine with Docker and the repository:

```bash
docker build --platform linux/amd64 -t ghcr.io/netquor/netquor-com-web:main .
docker save ghcr.io/netquor/netquor-com-web:main | gzip | ssh debian@doc-iad-c-02 'gunzip | docker load'
```

Then on the host:

```bash
# new edge routing (www -> netquor-web:3000, Cloudflare client address handling). Check it first:
docker run --rm -v /opt/edge/Caddyfile.new:/etc/caddy/Caddyfile:ro caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
cp /opt/edge/Caddyfile /opt/edge/Caddyfile.bak && mv /opt/edge/Caddyfile.new /opt/edge/Caddyfile

cd /opt/netquor-web && docker compose up -d --pull never      # web, then worker once web is healthy
docker compose ps                                              # both "running", web "healthy"
cp /opt/edge/docker-compose.yml /opt/edge/docker-compose.yml.bak   # then install deploy/edge/docker-compose.yml only if it differs
docker exec netquor-edge caddy reload --config /etc/caddy/Caddyfile
curl -sS -o /dev/null -w '%{http_code}\n' https://www.netquor.com/        # 200
curl -sS https://www.netquor.com/health/detail                             # prices version, ages, no secrets
```

(Copy `deploy/edge/Caddyfile` to `/opt/edge/Caddyfile.new` first. Keep the timer **disabled** while you are loading images by hand: it would pull `:main` from GHCR and replace what you loaded.)

## First deploy WITH GitHub (CI)

1. Push to `main` (changes limited to `deploy/edge/holding/**`, docs, tools, mockups and `.agents` do not trigger it). `.github/workflows/site.yml` runs `test` (server: install, `bun test`, `tsc`; web: install, `bun test`, `bun run check` type check, `bun run build`), then `publish`: builds the image, runs `deploy/smoke.sh` against it (it waits for the image's own Docker `HEALTHCHECK`), and only then pushes `:main` and `:sha-<commit>` to GHCR.
2. Make the package `netquor-com-web` public in GitHub (like the Phone image), or run `docker login ghcr.io` on the host with a read-only `read:packages` token.
3. On the host (with `web_front` created): `cd /opt/netquor-web && docker compose up -d`, then `sudo systemctl enable --now netquor-site-update.timer`. The timer runs `netquor-site-update` every 2 minutes: it pulls `:main`, and recreates web and worker only when the image the containers run differs from the one pulled. It prints one line (`updated to sha256:...` or `unchanged ...`) and is safe to run twice.

The old `netquor-site` container and image are no longer used. `docker compose up --remove-orphans` (done by the update script) removes the container; `docker rm -f netquor-site` does the same by hand.

## Day to day

- Logs: `docker logs -f netquor-web`, `docker logs -f netquor-web-worker`.
- Health: `docker exec netquor-web wget -qO- http://127.0.0.1:3000/health/detail` (version, age and last poll of the prices; never secrets).
- Change a price by hand (operator): copy a snapshot in and sign it with the secret the container already has:
  `docker cp snapshot.json netquor-web:/tmp/ && docker exec netquor-web bun server/scripts/send-prices.ts /tmp/snapshot.json --reason "why"` (add `--allow-large` or `--rebase-version` when needed; the reason is required and logged).
- Leads: `docker exec netquor-web cat /data/leads.jsonl` (mode 0600, on the `data` volume).
- Back up the `data` volume (`docker run --rm -v netquor-web_data:/data -v $PWD:/out alpine tar czf /out/data.tgz -C /data .`). It holds the leads.

## Rollback

Web or worker misbehaves after an update:

```bash
sudo systemctl stop netquor-site-update.timer            # or the timer will put :main back within 2 minutes
docker images ghcr.io/netquor/netquor-com-web            # pick the previous sha-<commit> (or the image id you kept)
docker pull ghcr.io/netquor/netquor-com-web:sha-<previous>     # skip if it is still local
docker tag  ghcr.io/netquor/netquor-com-web:sha-<previous> ghcr.io/netquor/netquor-com-web:main
cd /opt/netquor-web && docker compose up -d --no-deps --pull never web worker
```

Re-enable the timer once `:main` has been fixed and republished. The `data` volume is not touched by a rollback.

Edge change goes wrong: `cp /opt/edge/Caddyfile.bak /opt/edge/Caddyfile && docker exec netquor-edge caddy reload --config /etc/caddy/Caddyfile`. Phone is not affected by any of this (its block is unchanged).

## The edge (`deploy/edge`)

- `Caddyfile`: global `servers` block trusts Cloudflare's published ranges (fetched 2026-11-10 from `https://www.cloudflare.com/ips-v4` and `/ips-v6`; refresh them when Cloudflare changes the lists) and reads the visitor from `CF-Connecting-IP`. The `www` block does `reverse_proxy netquor-web:3000` with `header_up X-Real-IP {client_ip}`, which **overwrites** whatever the client sent; the web process reads the visitor from that header (and nothing else), so a spoofed header cannot choose a rate-limit bucket. A request that does not come from a Cloudflare address cannot name its own client address. If the web container is down, `handle_errors` serves `/srv/holding/index.html` (mounted from `./holding`) with status 503 and `Retry-After`. There is no apex block: Cloudflare redirects the apex to `www`. The phone block is unchanged.
- `docker-compose.yml`: matches the host: the certificate store is the existing external volume `netquor-phone_caddy_data` (mounted at `/data`; it was created by Phone's old stack and holds the issued certificates), ports 80 and 443 over tcp only. It joins `edge` (Phone) and `web_front` (web) and mounts `./holding:/srv/holding:ro`.
- Validate a Caddyfile without touching the host: `docker run --rm -v "$PWD/deploy/edge/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile`.
- `edge/holding/` holds the holding page itself and is maintained separately.

Hostnames: the edge serves the site on `www.netquor.com` only; Cloudflare redirects the apex to it. Do not add a Cloudflare redirect from `www` to the apex: it would loop.

## Testing the image locally

`bash deploy/smoke.sh` builds the image (for the machine's own architecture: `linux/amd64` on an x86 machine or CI runner, `linux/arm64` on Apple silicon, because Bun crashes under qemu amd64 emulation; override with `PLATFORM=linux/amd64`), then runs web, the worker, a tiny fake pricing API and two throwaway Caddys that mimic the edge on a throwaway network and volume, asserts the list below and removes everything it created. `SKIP_BUILD=1 IMAGE=<tag>` tests an existing image (CI does this). It takes about two minutes because it waits for the worker's second poll. The amd64 image itself builds fine on Apple silicon (the build stages run natively; only the final stage is amd64), it just cannot be run there.

It checks: homepage 200 and `/health`; private paths refused; no published ports; non-root; seed placed on first start; a price delivered by the worker; a signed webhook change visible on the next page request, also through the edge mimic, and still in force after `docker restart` of web; stale version refused; the worker's 304 heartbeat; `/api/lead` 202 with a line in the volume, a silent honeypot, and a spoofed `X-Real-IP` ignored; no secret in any log; SIGTERM stops both containers cleanly.

## What is and is not live (honest status)

Live now: the edge Caddy and Phone behind it.

Built and tested here, **not yet live**: the web image, the worker, the compose file, the new edge `Caddyfile` and compose file (www upstream, `web_front`), the update script and the workflow. Nothing was committed, pushed or deployed from this work; the GitHub workflow has never run; the image has never been pulled on the host; the host's `/opt/edge/Caddyfile` and `/opt/netquor-web` have not been changed.

Verified only locally (smoke test above): routing through a Caddy that mimics the edge. The real Cloudflare to Caddy to web chain, including the Cloudflare ranges in the Caddyfile, is checked only by `caddy validate`, not end to end.

Not part of this repository and not verified: the Netquor API actually sending the signed `prices.changed` or snapshot webhook and serving `PRICING_API_URL`; until it does, prices stay at the seed (or the last accepted snapshot) and the worker idles or polls nothing. Prices on every page come from the Svelte `<Price>` component and the in-memory cache. Phone is early access and is not billed; the planned price shown on the site is not a charge.

Known limits: responses are compressed by the edge Caddy, not by the web process; a form-encoded POST to `/api/lead` without a matching `Origin` is refused by SvelteKit's CSRF guard (JSON posts are fine); the operator tool works only inside the web container because it publishes no port.
