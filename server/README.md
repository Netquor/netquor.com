# Netquor web server

The server code behind netquor.com. In architecture v2 it is **one SvelteKit process that renders every page on the server from an in-memory price cache, with this Elysia API mounted inside it**, plus a small **worker** process that polls for prices as a backup. This folder holds the API, the pricing pipeline and the worker. The pages live in `../web/`.

## Processes

```
                       edge Caddy (TLS, Cloudflare client_ip -> X-Real-IP)
                                         |
                              netquor-web:3000   (container "web", the only public path)
                  SvelteKit (pages, per request, from the price cache)
                    hooks.server.ts --> Elysia app.handle(request)
                                         for /api/*, /hooks/*, /health*
                                         |        ^
              Netquor API --webhook--> /hooks/pricing   (PRIMARY: signed snapshot)
              Netquor API --nudge----> /hooks/pricing   ({event:"prices.changed"}: web pulls once)
              container "worker" --signed POST--> /hooks/pricing  (BACKUP: poll result, or heartbeat)
              web --POST (signed, flat schema 1)--> Netquor API /v1/leads/site
                                         |
                              volume "data": prices.json, baseline.json, leads.jsonl
```

- **web** is the single writer of `data/`. It loads `prices.json` (or the seed baked into the image) into the price cache at start; a verified webhook is validated, saved atomically (temp file, fsync, rename; the previous one kept as `prices.prev.json`), then swapped into the cache. Pages are rendered per request from the cache, so a new price shows on the next request, with `Cache-Control: public, max-age=60, stale-while-revalidate=600`.
- **worker** (`bun server/src/worker.ts`, same image) every `PRICING_POLL_SECONDS` fetches `PRICING_API_URL` with `If-None-Match` and delivers the result to the web process with a signed POST to `WEB_INTERNAL_URL/hooks/pricing` (snapshot on 200, a `poll.ok` heartbeat on 304). It never writes files, so there is no cross-process lock anywhere.
- **The Netquor API** is the source of prices and the receiver of leads. Prices: it POSTs signed snapshots (webhook, primary) and may nudge; the worker poll covers a missed webhook. Leads: see `CONTRACT.md`.

The API app itself (`src/app.ts`, `createApp(deps)`) needs no socket: the web hooks call `app.handle(request)`.

## Folders

| Path | What |
| --- | --- |
| `src/app.ts`, `src/index.ts` | the app and its composition (`buildApp()` for the web hooks; run directly it is an API-only dev server) |
| `src/lib/` | config, client address, rate limit, CORS, capped body reader, deadline |
| `src/lead/` | `POST /api/lead`: validation, sinks (file, webhook), the contract test |
| `src/health/` | `GET /health`, `GET /health/detail` |
| `src/prices/`, `src/worker.ts`, `scripts/send-prices.ts` | the pricing pipeline (see `src/prices/README.md`) |
| `CONTRACT.md` | what is sent to the Netquor API |

## Settings

Everything comes from the environment (`.env.example` lists them with comments). `bun scripts/env-check.ts` checks them and never prints a value.

| Variable | Default | Used by | Meaning |
| --- | --- | --- | --- |
| `PORT`, `HOST` | `4200`, `127.0.0.1` (dev) | API dev server; the SvelteKit adapter reads the same names (container: 3000, 0.0.0.0) | where it listens |
| `ADDRESS_HEADER` | `X-Real-IP` in the container | SvelteKit adapter | header carrying the client address; the edge proxy overwrites it |
| `SITE_ORIGIN` | `https://www.netquor.com` | web | canonical origin for the sitemap and links |
| `WEB_INTERNAL_URL` | `http://netquor-web:3000` | worker | where the worker delivers polls |
| `ALLOWED_ORIGINS` | the two production origins | web | browser origins allowed to post the form |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_SECONDS` | `5`, `600` | web | per client address on `POST /api/lead` |
| `LEAD_FILE` | `<PRICES_DIR or DATA_DIR>/leads.jsonl` | web | JSON lines, mode 0600; off only when a webhook is set and this is not |
| `LEAD_FORWARD_URL`, `LEAD_FORWARD_SECRET` | none | web | forward leads to the Netquor API; the secret (16+ characters) must equal the API's `LEADS_WEBHOOK_SECRET` |
| `PRICING_WEBHOOK_SECRET`, `PRICING_WEBHOOK_SECRET_NEXT` | none | web, worker | verify and sign `/hooks/pricing`; the NEXT one is for rotation |
| `PRICING_API_URL`, `PRICING_API_TOKEN`, `PRICING_POLL_SECONDS` | none, none, `900` (min 60) | worker, web (nudge pull) | the price source, optional bearer, poll period |
| `PRICES_DIR` | `$DATA_DIR`, else `data` | web | the data volume folder (`prices.json`, `baseline.json`) |
| `DATA_DIR` | `data` | web | default folder for `prices.json`, `baseline.json` and `leads.jsonl` when `PRICES_DIR` and `LEAD_FILE` are unset (the compose file sets it to `/data`) |

Removed in v2: `TRUST_CLOUDFLARE`, `TRUSTED_PROXY_HEADER`, `SERVE_STATIC`, `SITE_DIR`.

## Client address and the rate limit

The hooks entry (`web/src/hooks.server.ts`) takes the address the SvelteKit adapter resolved (from `ADDRESS_HEADER`), **overwrites** the request header `x-nq-client-ip` with it (whatever the visitor sent is discarded), and builds the app with `trustPeerIpHeader: true`. `createApp` believes `x-nq-client-ip` only when that flag is true and the value is a valid IP; otherwise it uses the socket address; with no socket (`app.handle`) or no valid address it uses the shared bucket `unknown`, whose limit is 20 times higher so it can never lock everyone out. `X-Real-IP`, `X-Forwarded-For` and `CF-Connecting-IP` are never read by the app. The container publishes no port, and the edge Caddy overwrites `X-Real-IP` from its trusted Cloudflare `client_ip`, so a visitor cannot choose their address. An IPv6 address is counted by its /64 prefix (one subscriber holds a whole /64, so the full address would let them take a fresh allowance per request), an IPv4-mapped IPv6 address as its IPv4; the raw address is still the one used for the keyed `ipHash`. The limiter is in memory in the one web process, remembers at most 10,000 keys (the least recently used is forgotten, in constant time) and a restart forgets it.

`Origin` is checked on `POST /api/lead` only to stop cross-site browser posts: a request that names an origin not in `ALLOWED_ORIGINS` gets 403, and a request with no `Origin` header (curl, a server) is not refused for that. It is not authentication; the per-address rate limit, size caps and validation apply to every caller the same, whether it comes through the web app or not.

## Security notes

- Every response is `no-store` except the ones that set their own header; errors are a stable code and never carry input, a stack or a message.
- The body is read with a hard cap (16 KB for a lead, 256 KB for the pricing webhook), whatever `content-length` says.
- Leads are personal data. Nothing logs a lead's content. The client address is only ever used to make the keyed `ipHash` sent to the API (`CONTRACT.md`); it is never stored or forwarded raw.
- Spreadsheet formula hygiene: an email whose local part starts with `=`, `+`, `-` or `@` is refused; leading `= + - @` are stripped from name and company.
- **A 503 after a timeout may still have stored the lead.** The sinks are cut off after 8 s, but a cut-off write may still land (the file append, or the Netquor API storing it after we gave up). The visitor is told to retry, so a lead can arrive twice with different ids; the API de-duplicates only on the same id, and flags a same-email repeat within 24 hours (`repeatOf`). Treat a repeat as normal.
- Secrets are only ever compared in constant time and are never printed, logged or put in a URL. Webhook signatures are `t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`, 300 s tolerance.
- An Elysia quirk: `app.handle()` answers 404 for a request whose host is one or two characters (`http://x/...`). Real hosts, and `localhost`, are fine; build test requests with `http://localhost/...`.

## Running it

Development, API only (no pages, no price cache):

```
cd server && bun install
cp .env.example .env        # fill in what you need; the defaults work with nothing set
bun run dev                 # bun --watch src/index.ts, http://127.0.0.1:4200
curl -s localhost:4200/health
curl -s localhost:4200/health/detail
```

The whole site (pages and API in one process) is started from `../web/` (see its README); the worker is `bun server/src/worker.ts` with the `PRICING_*` and `WEB_INTERNAL_URL` settings. Tests and types:

```
bun test src
bunx tsc --noEmit
```

## Health

`GET /health` is `{"ok":true}` for the load balancer. `GET /health/detail` adds only non-sensitive status: `uptimeSeconds`, `prices` (the price cache `status()`: `version`, `updatedAt`, `ageSeconds`, `lastIngestAt`, `lastIngestSource`, `lastPollOkAt`, `lastRefusal` as `{version, code, at}` or null, and `stale`) and `leadSinks` (`file` and `webhook` as booleans). No secrets, addresses, paths or lead data. The edge proxies only `/health`; the detail is for the private network.
