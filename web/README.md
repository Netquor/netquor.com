# web

The netquor.com web process: SvelteKit 3 (Svelte 5, TypeScript) on `@sveltejs/adapter-node`, run under Bun. One process serves everything:

1. `/api/*`, `/hooks/*`, `/health*` go to the Elysia app in `../server/src` (mounted in `src/hooks.server.ts`; the client address goes in `x-nq-client-ip`, overwritten).
2. A path no Svelte route matches but the legacy allowlist serves comes from the legacy folder (`LEGACY_DIR`), with `data-price` markers stamped per request from the in-memory price cache, memoized per (file, mtime, price version).
3. Everything else is SvelteKit: migrated pages (route directories named like the URL inside a route group, e.g. `src/routes/(site)/subnet-calculator.html/`; the groups `(site)` and `(fleet)` carry the layouts and are not part of any URL), `/sitemap.xml`, `/robots.txt`, `/llms.txt`, and the 404.

```
bun install
bun run dev      # vite dev under Bun; LEGACY_DIR defaults to the repo root
bun test         # unit tests (src and scripts)
bun run check    # tsc + svelte-check
bun run parity <page>.html   # compare a migrated page with its legacy file (--all for every migrated page)
bun run smoke    # builds, starts the built server on a free port with temp data, asserts end to end
bun run build && bun build/index.js   # production entry
```

Settings: see `.env.example`. The page list is `src/lib/pages.ts`; a page is migrated by adding `src/routes/(site)/<name>.html/+page.svelte` (`(fleet)` for `fleet.html`) (it then wins over the legacy file, and the sitemap uses the build date for it; legacy pages get no lastmod unless their registry entry carries an explicit `lastmod: "YYYY-MM-DD"`).

## Caching and URLs

- HTML (legacy and Svelte) is `Cache-Control: no-cache` with a weak ETag: the browser revalidates every time, so a price change shows on the very next request and an unchanged page is a cheap 304. The legacy ETag and memo key use the price cache's `version()` (the monotonic counter, which keeps counting up after an operator rebase), never the snapshot's own version number.
- Assets: `?v=` is `immutable` for a year only when the value is the file's own fingerprint (first 8 hex of its md5, the scheme `tools/build-nav.py` writes into the pages); any other `?v=` and plain asset URLs get `public, max-age=3600`.
- One URL per page: `/index.html` is a 301 to `/` (query string kept); a trailing slash on a page (`/fleet.html/`) is a 308 to the `.html` URL.
- A price key missing from the snapshot never fails a page. Svelte pages show the `fallback` prop, else the last-known price from `server/data/prices.seed.json` as of the build (`src/lib/priceFallbacks.ts`); legacy pages are served as written. Each is logged once per key (or page) per version.

## Forms and the CSRF guard

SvelteKit 3's CSRF guard is always on, and our `ORIGIN` is the public origin. It answers **403** to any `POST`, `PUT`, `PATCH` or `DELETE` whose `Content-Type` is form-encoded (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`) **or missing**, unless its `Origin` header equals `ORIGIN` or is one of the `csrf.trustedOrigins` in `vite.config.ts` (the apex and `www`). A form post with no `Origin` at all is refused too. JSON posts (`application/json`: the lead form, the pricing webhook) are not affected. The guard runs before `hooks.server.ts`, so `/api/*` and `/hooks/*` are covered as well. `src/lib/server/csrf.test.ts` pins this against the installed Kit, and `bun run smoke` checks it end to end.

## Migrating pages

`migration/README.md` is the playbook for moving a legacy page to a Svelte route (layout groups, assets, prices, JSON-LD, hydration rules, the parity check and its allowlist, definition of done).
