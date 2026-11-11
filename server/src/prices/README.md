# Pricing

Prices are rendered into pages on the server, per request, from an in-memory price cache, so crawlers and AI agents read them in the HTML itself and nothing is fetched in the browser. The Netquor API (account.netquor.com) is the source of truth.

```
                       PRIMARY                                    BACKUP
Netquor API --signed webhook--> POST /hooks/pricing      worker --poll (ETag)--> Netquor API
                                      |                     |
                                      |   signed delivery   v
                                      +<----------------- POST /hooks/pricing  (snapshot, or poll.ok heartbeat)
                                      v
                       web process: validate -> guards -> data/prices.json (atomic) -> cache.replace -> pages
```

- **Primary:** the API POSTs a signed snapshot to `/hooks/pricing`. Within a second the web process has it on disk and in the cache.
- **Backup:** the `worker` process polls the API every 15 minutes and delivers what it finds to the web process by the same signed endpoint. If a webhook was missed, the next poll repairs it. A 304 sends a `poll.ok` heartbeat, so `/health/detail` can show the last successful poll.
- **Catalog mode (live prices):** with `NETQUOR_CATALOG_URL` set, the worker and the nudge read the Netquor API price catalog directly (see "Catalog mode" below) instead of a snapshot URL.
- **Nudge:** the API may instead POST `{"event":"prices.changed"}`; the web process then pulls once from `PRICING_API_URL` itself.
- **Who writes:** only the web process. It is the single writer of `data/prices.json`, so there is no file lock anywhere. The worker never writes a file.

Phone is early access and is not billed. Its key (`phone.planned_launch.month`) is a planned launch price; the copy around it says so.

## Files (`PRICES_DIR`, else `DATA_DIR`; the `data` volume in the container)

| File | What |
| --- | --- |
| `prices.json` | The live snapshot. Not in git. |
| `prices.prev.json` | The one before it (only ever a valid file). Not in git. |
| `baseline.json` | The key set an operator last accepted, for the cumulative removal guard. Not in git. |
| `server/data/prices.seed.json` | The seed baked into the image and committed. Used only when `prices.json` and `prices.prev.json` are both missing or invalid. Its path is `PRICES_SEED_FILE`, kept apart from `PRICES_DIR` so a volume mounted over the data folder cannot hide it. |

On start the cache loads `prices.json`, else `prices.prev.json`, else the seed, and logs which. A newer seed in a new image does not override the volume: the API (webhook or poll) is what moves prices forward.

## The cache (`cache.ts`)

`createPriceCache({ store, clock })` returns `{ get, version, status, replace, subscribe, markPollOk }`.

- `get()` the snapshot in force (deeply frozen). `version()` a number that changes whenever the content changes: it equals the snapshot version, except after an operator rebase to a lower version, when it keeps counting up, so it is safe in ETags and memo keys.
- `status()` returns `{ version, updatedAt, ageSeconds, lastIngestAt, lastIngestSource, lastPollOkAt }`.
- `replace(snapshot, source)` is called by ingest only, after the snapshot is saved. `subscribe(fn)` is told after every replace. `markPollOk()` records the worker's heartbeat.
- `index.ts` re-exports the public contract: `createPriceCache`, `stampHtml`, `stampHtmlBytes`, `renderLlms`, `createPricing`, and friends. `createPricing()` builds the real store, cache, ingest, nudge and webhook routes from the environment (`routes` is undefined when no valid secret is set).

## The snapshot

```json
{ "schema": 1, "version": 12, "updatedAt": "2026-11-10T00:00:00.000Z", "source": "webhook",
  "prices": { "fleet.mac.month": { "amountCents": 595, "currency": "USD", "unit": "per Mac per month" } } }
```

Integer cents (0 to 10,000,000), USD, keys like `^[a-z0-9]+(\.[a-z0-9_]+)*$`, at most 500, no extra keys. `updatedAt` must be a real calendar date and time with a zone (2026-02-31 is refused). `source` is how it arrived (`seed`, `webhook`, `poll`, `operator`); the sender may leave it out, ingest sets it. Written with sorted keys.

## Ingest rules (`ingest.ts`), in order

One at a time (in-process mutex). Then:

1. Invalid: 422 `invalid`. Same version and content: 200 `unchanged`, nothing written. Same version, other content: 409 `conflict`. Older version: 409 `stale`.
2. Sanity guards (`guards.ts`): refuse with 422 `change_too_large` when any existing price moves by more than 50 percent, more than 25 percent of the keys change, a non-zero price goes to 0, more than 30 percent of the keys are removed at once, or the cumulative removals since the last operator-accepted baseline exceed 30 percent. The refusal is logged with the reasons. A snapshot whose signed body carries `allowLargeChange: true` skips the guards and becomes the new baseline.
3. Persist: temp file, fsync, rename; the previous valid `prices.json` becomes `prices.prev.json`. If the write fails nothing changes, including `prices.prev.json`; the answer is 500 `persist_failed`.
4. Only then `cache.replace`. A crash before step 4 leaves a whole file on disk and a restart loads it, so the cache can never be ahead of the disk and a torn file is never read.

## Webhook (`routes.ts`)

`POST /hooks/pricing`. The signature is `HMAC-SHA256(secret, "<unix seconds>." + raw body)` in hex, sent in EITHER of two forms (the first present wins):

1. `X-Netquor-Signature: t=<unix>,v1=<hex>` (the worker and the operator tool use this).
2. `X-Netquor-Signature-256: <hex>` (a leading `sha256=` is tolerated) together with `X-Netquor-Timestamp: <unix seconds>`.
 Timestamp within 300 s, body at most 256 KB. A body that carries `rebaseVersion` or `allowLargeChange` (it switches a guard off) is honoured only within 60 s of its signature timestamp, and each (timestamp, signature) pair is accepted once (the last 1000 pairs are remembered for 5 minutes); a replay or a late one is a bare 401. A `poll.ok` heartbeat signed more than 60 s ago is a 401 too. During a rotation set `PRICING_WEBHOOK_SECRET_NEXT` as well; either verifies. A secret shorter than 16 characters is ignored with one warning, and with no valid `PRICING_WEBHOOK_SECRET` the routes do not exist.

Bodies (JSON):

- `{ "snapshot": {...}, "via": "poll" | "operator", "allowLargeChange": true, "rebaseVersion": true, "reason": "text" }` (everything but `snapshot` optional). `rebaseVersion` requires a reason.
- `{ "event": "prices.changed" }`, or the Netquor API's own event `{ "id": "...", "type": "price.changed", "at": "...", "data": {...} }` (a body with `snapshot` is always a snapshot): pull once, from the catalog when catalog mode is on, else from `PRICING_API_URL`. The event `id` is remembered for 24 hours (at most 5000 ids): a redelivery answers `200 {"ok":true,"duplicate":true}` and pulls nothing. An id whose pull failed (503) is forgotten, so the sender's retry is processed. Single flight, at most one forced pull per 30 s. A nudge that arrives during a pull or inside that window answers `200 {"ok":true,"coalesced":true}` at once and is remembered: when the window ends exactly one trailing pull runs (however many nudges were coalesced), so a second change is never missed.
- `{ "event": "poll.ok" }`: the worker's heartbeat; sets `lastPollOkAt` and answers `200 {"ok":true,"version":<snapshot version in force here>}`. A snapshot delivery answers `{ok, status, version}` as before.

| Status | Meaning |
| --- | --- |
| 200 | applied, unchanged, coalesced or heartbeat |
| 401 | bad or missing signature, a replayed or late `rebaseVersion`/`allowLargeChange` body, or a heartbeat over 60 s old (empty body). Refusals of this kind are logged at most once per 10 s, with a count of the lines held back |
| 400 | not a known body |
| 409 | `stale` or `conflict` |
| 413 | body over 256 KB |
| 422 | `invalid`, `change_too_large`, `reason_required` |
| 429 | more than 30 signed requests a minute (all senders together) |
| 500 | `persist_failed` |
| 503 | the nudge pull failed |

Only signed requests count toward the 30 a minute, so someone without the secret cannot use up the allowance and lock the worker out. `GET /api/prices` is public: the snapshot in force, `Cache-Control: public, max-age=60`, strong `ETag`, 304 on a match.

## Catalog mode (live prices from the Netquor API)

The Netquor API (https://api.netquor.com) is already public for reads: `GET /v1/catalog/products` and `GET /v1/catalog/price-books/current?product=<id>` (ETag, `Cache-Control: public, max-age=60, stale-while-revalidate=600`, 120 requests per minute per IP, then 429 with `Retry-After`). No token is needed. Real captured books are in `fixtures/pricebook-*.json`.

`catalog.ts` is pure code with injected fetch. `server/data/catalog-map.json` is the reviewed mapping from site price keys to catalog sources.

**Catalog-managed keys** (derived exactly; each equals the seed today, and a test fails if the seed and the books ever disagree silently):

| Key | From |
| --- | --- |
| `phone.planned_launch.month` | `netquor-phone` sku `phone.starter.monthly`, `amountMicros / 10000` (must divide exactly, else that key is refused with a warning) |
| `fleet.mac.month`, `fleet.mobile.month` | `netquor-fleet` engine entry `fleet.device-packs`, `config.kinds` `fleet-mac` / `fleet-ios` `monthlyCents` |
| `fleet.mac.year`, `fleet.mobile.year` | `monthlyCents x annualMonthsPaid` |
| `fleet.mac.lifetime`, `fleet.mobile.lifetime` | year `x lifetimeAnnualMultiple` |
| `fleet.dedicated.month`, `.setup`, `.year` | `config.dedicated` `monthlyCents`, `setupCents`, `yearlyCents` |

**Manual keys** (`vpn.*`, `network.*`, `homeassistant.*`, `digitalaccess.*`) are not in the map and are never touched by the catalog; they change only by a signed snapshot (webhook or operator tool). The map never adds or deletes a key: a mapped key missing from the snapshot is left out with a warning (add it to the seed first), and every amount must be a whole number of cents from 0 to 10,000,000.

**Fetch plan.** Products come from the map, limited to `NETQUOR_CATALOG_PRODUCTS`. One conditional GET per product (its own `If-None-Match`), 10 s timeout, body read as a stream and cut at 512 KB, https only (http only to localhost, for tests), `User-Agent: netquor-web-worker`, redirects refused. A 429 is honoured: that product is not asked again until `Retry-After` passes (bounded to an hour) and the worker waits at least that long. A product that fails (error, timeout, 5xx, not published, malformed) leaves its keys unchanged and never blocks the others.

**Candidate.** `buildCandidate(current, books, map)` returns `{candidate | null, changes, warnings, sources}`. The candidate is the web process's current snapshot with only the changed catalog-managed prices replaced (units kept), `version = current.version + 1`, `source: "poll"`. There is no candidate unless a price actually changed. It goes through the normal ingest, so the sanity guards still apply.

**Worker cycle** (every `PRICING_POLL_SECONDS`, default 300 in this mode, minimum 60): read the web process's `GET /api/prices`; conditional-GET each product; build the candidate; deliver `{snapshot, via: "poll", sources}` by the signed POST. With nothing to change it sends the signed `poll.ok` heartbeat carrying `sources`. `sources` is `{ "<product>": { version, checksum, fetchedAt } }`; the web process keeps the latest per product in `cache.status().catalogSources` and shows it in `/health/detail` under `prices.catalogSources`. A 409 (the web moved on) is retried next cycle after re-reading `/api/prices`. A 422 `change_too_large` is logged once per set of book versions and checksums and not retried until a book changes; the log line says an operator can accept it with `scripts/send-prices.ts --allow-large`. If both `NETQUOR_CATALOG_URL` and `PRICING_API_URL` are set, catalog mode wins and a startup line says so (worker and web).

**Setup for the Netquor API team: register the webhook subscriber.**

| Field | Value |
| --- | --- |
| URL | `https://www.netquor.com/hooks/pricing` |
| Event | `price.changed` |
| Body | `{ "id", "type": "price.changed", "at", "data" }` (the content of `data` is not read) |
| Signature | HMAC-SHA256, hex, over `"<unix seconds>." + raw body`, with the subscriber's secret. Send either `X-Netquor-Signature: t=<unix>,v1=<hex>` or `X-Netquor-Signature-256: <hex>` plus `X-Netquor-Timestamp: <unix seconds>` |
| Timestamp | unix seconds, within 5 minutes of the receiver's clock |
| Retries | safe: the same `id` is accepted once per 24 hours |

The receiver answers 200 when it pulled (or already handled the id), 401 for a bad signature, 503 when the catalog pull failed (retry later), 429 over 30 signed requests a minute. Where the secret goes: generate the subscriber secret at the API, then put it in `/opt/netquor-web/.env` as `PRICING_WEBHOOK_SECRET_NEXT` (16 or more characters; the web process accepts both secrets, no code change), restart the web container, and confirm a delivery. Later promote it to `PRICING_WEBHOOK_SECRET` and drop `_NEXT`; the worker signs with `PRICING_WEBHOOK_SECRET`, so keep that one set and 16+ characters.

Example environment (web and worker containers):

```
NETQUOR_CATALOG_URL=https://api.netquor.com
NETQUOR_CATALOG_PRODUCTS=netquor-fleet,netquor-phone
PRICING_POLL_SECONDS=300
PRICING_WEBHOOK_SECRET=<openssl rand -hex 32>
PRICING_WEBHOOK_SECRET_NEXT=<the API-generated subscriber secret>
```

**Reading status.** `bun run deploy --status` shows container state and health. `GET /health/detail` shows `prices.version`, `lastIngestSource`, `lastPollOkAt`, `stale`, `lastRefusal` and `catalogSources` (the book version and checksum each product's prices came from, and when it was last checked). The worker log says `delivered`, `unchanged`, or why a change was refused.

## The worker (`../worker.ts`)

`bun server/src/worker.ts`, the same image as the web process. Every `PRICING_POLL_SECONDS` (default 900, minimum 60) it fetches `PRICING_API_URL` with `If-None-Match` and the optional bearer `PRICING_API_TOKEN` (10 s timeout, no redirects, body read as a stream and cut at 256 KB; the address must be https, or http to localhost, with no user name or password) and delivers to `WEB_INTERNAL_URL` (default `http://netquor-web:3000`) `/hooks/pricing` with a signed POST: the snapshot on a 200 (`via: "poll"`), a `poll.ok` heartbeat on a 304.

- **Healing.** The heartbeat answer carries the web's snapshot version. When the API's last 200 body had a higher version than the web reports (for example the web restarted from the seed), the worker drops its ETag and fetches and delivers again at once, not after the interval. It does this once per (API version, web version) pair, never while it holds a version the web refused, so a web that stays behind cannot make it spin.

- Failures back off exponentially (interval doubled each time, jittered, never under the interval, never over an hour) and recover on the next success.
- A version the web answered 409, or 422 `change_too_large`, for is not sent again until the API shows a newer version (heartbeats continue). Content the web called invalid is not resent unchanged. The log line says so, once per poll.
- One log line per outcome, never a URL, token or secret. SIGTERM or SIGINT stops it cleanly (in-flight requests are cancelled). Without a valid API address, web address or secret it logs once and idles (alive, so a container does not restart in a loop).
- An API wrapper `{ snapshot, ... }` is unwrapped; any flag in it is ignored. Only a signed operator body can accept a large change.

## Status (`GET /health/detail`, `prices`)

`cache.status()` adds to `version`, `updatedAt`, `ageSeconds`, `lastIngestAt`, `lastIngestSource` and `lastPollOkAt`: `catalogSources` (catalog mode: `{product: {version, checksum, fetchedAt}}`), `lastRefusal` (`{version, code, at}`: the last snapshot ingest refused with `stale`, `conflict`, `invalid`, `change_too_large` or `reason_required`, whichever path sent it; `version` is null when the body had none) and `stale` (true only when `PRICING_API_URL` or `NETQUOR_CATALOG_URL` is set and neither an ingest nor a worker heartbeat has happened for more than 3 x `PRICING_POLL_SECONDS`, counted from process start at the earliest). The worker only reports; the web process decides staleness, so a dead worker shows as `stale: true`.

## Operator: accepting a large change, recovering a stuck version

`bun server/scripts/send-prices.ts <snapshot.json> --reason "<text>" [--allow-large] [--rebase-version]` signs the file with `PRICING_WEBHOOK_SECRET` and POSTs it to the web process (`WEB_INTERNAL_URL`, default `http://127.0.0.1:3000`). The reason is required and logged. In the container:

```
docker exec netquor-web sh -c 'cat > /tmp/s.json' < snapshot.json
docker exec netquor-web bun server/scripts/send-prices.ts /tmp/s.json --reason "retired the Plus plan" --allow-large
```

**The API sent something the guards refused** (the worker log says `refused version N ... change_too_large`; the web log has the reasons). If the change is right: save the API's snapshot as a file and send it with `--allow-large`. The poll then sees the same version and answers unchanged. If it is wrong: fix it at the API and publish a newer version; the worker resumes by itself.

**The web process holds a higher version than the API** (the API's counter was reset or restored: the web answers 409 `stale`, the worker logs `holding version N`). Send the API's current snapshot with `--rebase-version --reason "..."`. The version moves down to match; the guards still apply, add `--allow-large` if the content also differs a lot. From then on normal rules apply from the new number.

**A bad price is live** (the API sent a wrong snapshot that passed the guards): send the corrected snapshot with a higher version, or copy `prices.prev.json` to a file, raise its `version`, and send it. Do not edit `prices.json` by hand while the web process runs; it is the single writer.

**`prices.json` is damaged**: the web process starts from `prices.prev.json`, else the seed, and logs which. Fix it by sending a snapshot.

## Markup (`stamp.ts`)

Pure functions, nothing touches a file. The web process decodes a page as strict UTF-8 (an invalid file is refused, never repaired), stamps it, and memoizes the result per (file, mtime, `cache.version()`).

HTML pages:

```html
<b data-price="network.from.month">$6.49</b>
<span data-price="vpn.from.month" data-fmt="usd">$5.00</span>
```

The element's text is replaced. `data-fmt`: `usd0` (default: `$5` when the cents are zero, else `$5.95`), `usd` (`$5.00`), `int` (cents, `595`), `plain` (`5.95`, no symbol, for JSON-LD). The element must hold text only. Output is HTML-escaped; every other byte is left alone, so stamping the snapshot a page already shows changes nothing. An unknown key or format is an error (`StampError`, listing every problem) and the caller must not serve a half-stamped page. Markers inside comments, `<script>` and `<style>` are ignored.

JSON-LD: `data-price-map` on the `application/ld+json` script tag is a JSON object of JSON pointer to key, optionally `key|format`. The value at each pointer is replaced in place and keeps its type, default format `plain`.

`llms.txt`: rendered by `renderLlms(template, snapshot)` from `llms.template.txt` (tokens `{{price:fleet.mac.month}}` or `{{price:vpn.from.month|usd}}`; a stray `{{` is an error).

## Settings

| Variable | Meaning |
| --- | --- |
| `PRICING_WEBHOOK_SECRET` | Shared secret, 16+ characters; the webhook and `GET /api/prices` exist only when set; without it the web process logs one line at startup saying the pricing routes are off and prices stay at the last snapshot |
| `PRICING_WEBHOOK_SECRET_NEXT` | Second secret accepted during a rotation |
| `NETQUOR_CATALOG_URL` | Catalog mode: the Netquor API base (`https://api.netquor.com`; https, or http to localhost). Wins over `PRICING_API_URL`. Set it on the web AND the worker container |
| `NETQUOR_CATALOG_PRODUCTS` | Products to read, comma separated; default `netquor-fleet,netquor-phone` |
| `CATALOG_MAP_FILE` | The catalog map; default `server/data/catalog-map.json` |
| `PRICING_API_URL` | Where to pull the snapshot (https, or http to localhost) |
| `PRICING_API_TOKEN` | Bearer token for that API, optional |
| `PRICING_POLL_SECONDS` | Worker poll interval, default 900 (300 in catalog mode), minimum 60 |
| `WEB_INTERNAL_URL` | Where the worker (and the operator tool) reach the web process; default `http://netquor-web:3000` (the tool defaults to `http://127.0.0.1:3000`) |
| `PRICES_DIR` | Folder of `prices.json`, `prices.prev.json`, `baseline.json`; default `DATA_DIR`, else `server/data` |
| `DATA_DIR` | The default data folder for `prices.json`, `prices.prev.json`, `baseline.json` and `leads.jsonl` when the specific variables (`PRICES_DIR`, `LEAD_FILE`) are unset (the compose file sets it to `/data`) |
| `PRICES_SEED_FILE` | The seed; default `server/data/prices.seed.json` |

An empty value counts as unset. The worker needs only the pricing variables and `WEB_INTERNAL_URL`; it does not need `PRICES_DIR`.

## Adding a price to a page

Add the key to the API (or to the seed for a first deploy), wrap the number in the page with `data-price`, keep the existing text inside, and run the tests: the real-site test fails on any page that does not stamp to itself against the seed.
