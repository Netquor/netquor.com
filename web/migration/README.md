# Migrating a legacy page to Svelte

The playbook for moving one hand-written page (`/<page>.html` at the repository root) to a SvelteKit route with the same URL, the same words and the same behaviour. One agent, one page; the shared pieces below exist so pages do not collide. Read `web/README.md` first for how the process serves pages.

The pilot, `src/routes/(site)/subnet-calculator.html/+page.svelte`, is the worked example.

## The baseline

The legacy site is frozen in git at the annotated tag `legacy-baseline-2026-11` (commit 5d6788e: the root `*.html`, `nq.css`, `nav.css`, the behavior scripts, `fleet/site.*`, `fleet/pricing.js`, `tools/*`). That tag is the permanent regression baseline. It does not depend on those files staying in the working tree.

- `web/scripts/baseline/dir.ts` exports `baselineDirSync()` / `baselineDir()`: the first call extracts the tag with `git archive` into `<repo>/.baseline/<short-sha>` (git-ignored; atomic and idempotent, a `.complete` marker says it is whole) and later calls reuse it. `bun run baseline` (in `web/`) prints the path. It works from any folder of the repository. `NQ_BASELINE_DIR=/some/dir` replaces the extraction with a folder you provide (no git involved). If the tag is missing (a shallow or fresh clone) it fails with the fix: `git fetch --tags`.
- `web/scripts/baseline/server.ts` exports `serveBaseline({ dir?, port?, transformHtml? })`, a small static server for that folder (`/` is `index.html`; only the public files and `fleet/` and `brand/` are served), with no dependency on the app code.
- Tests and tools that need the old site as an oracle call `baselineDirSync()` and read from it. They never read legacy files from the repository root, and the app's runtime never serves them.
- `bun run parity --all`, `bun run visual` and `bun run e2e --all` (and `e2e:audit`, `payload:report`, `smoke` for the pilot comparison) compare the current app with this baseline. Each prints `baseline: <dir>` so you can see which folder it used.
- To refresh the baseline: create a new annotated tag at the commit that should become the reference, change `TAG` in `scripts/baseline/dir.ts`, and rerun. A new commit gets a new `.baseline/<short-sha>` folder; delete `.baseline/` to reclaim the old ones. Pages written new in Svelte (`story.html`) have no baseline page and are skipped by parity and visual.

## Definition of done

A page is migrated when all of these hold, run in `web/`:

1. `bun run parity <page>.html` passes (see "Parity" below). Every intended difference is in `migration/parity-allow.json` with a reason.
2. `bun run smoke` passes.
3. `bun run check` passes: no new `tsc` or `svelte-check` errors.
4. `bun test` passes, and you added tests for what you added: data modules, ported scripts, components. A page of static markup needs no test of its own; parity is its test.
5. The legacy file is not in the working tree: it lives on in the baseline tag (see "The baseline" below) and is neither served nor in the Docker image (the runtime allowlist in `src/lib/server/legacy.ts` has no HTML, CSS or behavior scripts) and `src/lib/pages.ts` is unchanged (the page is already registered; the sitemap picks the route up by itself).

## Where files go

| What | Where |
| --- | --- |
| The route | `src/routes/(site)/<page>.html/+page.svelte` (or `(fleet)/` for `fleet.html`) |
| Page-only components | `src/lib/pages/<page>/*.svelte` |
| Page data (arrays of cards, FAQ items, table rows, copy that repeats) | `src/lib/pages/<page>/data.ts`, typed, no HTML you can avoid |
| Page-only logic and its tests | `src/lib/pages/<page>/*.ts`, `*.test.ts` |
| A component more than one page needs | `src/lib/components/` with props typed and a test in `components.test.ts` |

The directory is named like the URL, `<page>.html`, and the route groups `(site)` and `(fleet)` are not part of the URL. The home page is `src/routes/(site)/+page.svelte`. Do not add a route group of your own, a `+page.ts` that redirects, or a trailing-slash option: one URL per page is already enforced.

Keep a page component thin: the route file imports `Seo`, composes sections from `src/lib/pages/<page>/`, and holds no long arrays.

## Route groups and the layout

- `(site)` imports `src/lib/styles/entry-site.css` (Bootstrap 5.3.3, Bootstrap Icons, `nav.css`, the site system, the Plex fonts: all bundled by Vite from npm and `src/lib/styles`, no CDN), carries the shared head (icons) and the `Analytics` component, then `Nav` (which wires itself with `use:navMenu`), then your page, then `Footer`. `src/app.html` adds `nq-js` to `<html>` before first paint. No page loads `nav.js`, `fx.js`, `bg.js`, `nudge.js`, `analytics.js`, `readiness.js` or the Bootstrap JavaScript: those are ported in `src/lib/behaviors/` (`Fx`, `heroMap`, `HeroBackground`, `Nudge page="<name>.html"`, `use:readiness`, `use:collapse`). Only the pure calculation scripts (`subnet-calc.js`, `cost-calc.js`, `bundle-calc.js`) are still `<script src>`: they are UMD files for the legacy pages and Node tests, and importing them as ES modules would mean editing them. Do not render `Nav` or `Footer` in your page.
- The nav marks the page's own entry as current from the URL. A page changes the nav and footer by returning `chrome` from `+page.ts` (see `src/lib/chrome.ts`):

  ```ts
  // src/routes/(site)/<page>.html/+page.ts   (for the home page: src/routes/(site)/+page.ts)
  export const load = () => ({ chrome: { footer: "full" } });
  ```

  Options: `footer` (`"simple"` default, `"full"`, `"none"`), `nav` (false for none), `navCurrent` (path to mark), `navStatic` (the `nq-static` nav).
- `(fleet)` is for `fleet.html`, which has its own design. Its layout imports `src/lib/styles/entry-fleet.css` (Fleet's stylesheet, the Geist fonts, `nav.css`, Bootstrap Icons, Plex for the nav), renders `Analytics` and `Nudge`, and draws nothing else: no footer, no Bootstrap, no site system. The legacy Fleet page does contain the site nav bar (above its own header, as `nq-static`), so the page places `<Nav current="/fleet.html" static />` itself, then its own header, sections and footer. It also loads `fleet/site.js` (a module) and `fleet/pricing.js` itself, because they depend on the page's ids.
- The shell `src/app.html` is shared by both groups: `<html lang="en-US" data-bs-theme="dark">` and a `viewport` meta of `width=device-width, initial-scale=1.0`. Where the legacy head differs (Fleet's viewport adds `viewport-fit=cover`, no `data-bs-theme`), record it in the allowlist with the reason rather than changing the shell.
- Hooks: a path that matches a SvelteKit route (any group) is served by Kit; a path that does not goes to the runtime allowlist (images, `site.webmanifest`, the three calculation scripts), otherwise to Kit's 404. Nothing to do per page. A new legacy file a page needs by URL must be added to `RUNTIME_FILES` or be an image, and to the `Dockerfile` and `.dockerignore` (a test in `src/lib/server/legacy.test.ts` ties the script names to `src/lib/assets.ts`).

## Styles

All CSS is bundled by Vite and served from our own origin (hashed files under `/_app/immutable/assets/`, immutable); no page links a stylesheet, a font or an icon font from a CDN, and the app does not load `nq.css`, `nav.css` or `fleet/site.css` (the legacy pages still do, until they are deleted). Where things are:

| What | Where |
| --- | --- |
| Design tokens (`--nq-*`), documented | `src/lib/styles/tokens.css` |
| The site system, what `nq.css` was, split by concern | `src/lib/styles/{base,utilities,hero,sections,cards,components,buttons,footer,bundles,calculators,motion,home}.css`, imported in that order by `site.css` |
| The navigation | `src/lib/styles/nav.css` |
| Fleet's stylesheet (`fleet/site.css`), split by section | `src/lib/styles/fleet/*.css`, imported in order by `fleet/index.css` |
| Fonts (Plex Sans 400/500/600, Plex Mono 400/500; Geist for Fleet), latin subset, `font-display: swap` | `src/lib/styles/fonts.css`, `fonts-fleet.css` (`@fontsource` packages) |
| The cascade order of each layout (Bootstrap, Bootstrap Icons, nav, site system) | `entry-site.css`, `entry-fleet.css`: one entry file with `@import`, so the order survives bundling |
| A page's own rules (the legacy inline `<style>` block) | `src/lib/pages/<page>/page.css`, imported by the route (`import "#lib/pages/<page>/page.css";`), so they come after the layout's styles |
| Rules for exactly one component | a Svelte `<style>` block in that component (see the caveat below) |

Rules of thumb:

- Order is the cascade. nq.css was one file and later rules override earlier ones, so the parts are imported in the original order; do not reorder them or move a rule between files without `bun run visual`. `src/lib/styles/styles.test.ts` proves the parts hold exactly the blocks of `nq.css` (while the legacy file exists), that `nav.css` and Fleet's parts are the legacy files moved, and that no source names a CDN.
- Scoped `<style>` adds a class to every selector, which raises its specificity by one class. A page rule such as `.feature-card { padding: 2rem }` is out-ranked by the site system's `body .feature-card` on purpose (that is how the legacy pages look); scoped, it would tie with it and, coming later, win. So rules that share a name with Bootstrap or the site system stay plain CSS in `page.css`; rules with names only that component uses may be scoped (the subnet calculator and the story page do).
- A page whose legacy head had its own rules before `nq.css` has the `body { background-color; color; font-family }` rule left out of `page.css`: `nq.css` overrode all three there, and here the page sheet comes after.
- Do not add a `<link rel="stylesheet">`, a `@import url(https://...)` or an `{@html "<style>..."}` string. Add the package (exact version) and import it.
- `bun run payload [/path ...]` reports the CSS and font bytes (raw and gzip) a page loads and its third-party requests; the target is no third party but analytics. `bun run visual` is the pixel check against the legacy pages (it never rewrites a baseline).

## Assets: scripts

The three pure calculation scripts stay where they are (repository root) and are served by the runtime legacy asset path (the only JavaScript the image serves from the repository root). Load them with the fingerprint the layout data carries:

```svelte
<script lang="ts">
    import { assetUrl } from "#lib/assets.ts";
    let { data } = $props();
</script>
<svelte:head><script src={assetUrl(data.assets, "costCalc")}></script></svelte:head>
```

`src/lib/assets.ts` lists the known files (`subnet`, `costCalc`, `bundleCalc`; no stylesheet). Add a line there to load another one. Never write a `?v=` by hand.

Which way to load a vanilla script:

| The script | How |
| --- | --- |
| Only defines a window global or pure functions (`subnet-calc.js`, `cost-calc.js`, `bundle-calc.js`) | `<script src>` in `<svelte:head>`, as the pilot does. |
| Adds attributes, classes or nodes to what the page renders (`fx.js` reveal classes and the progress bar, `bg.js` hero canvas, `readiness.js` result boxes) | `loadScript(assetUrl(...))` from `onMount`, so it runs after hydration. Running it before would change nodes Svelte is about to adopt. |
| Appends only to the end of `<body>` and waits (`nudge.js`, `analytics.js`) | `<script src defer>` in `<svelte:head>`; it is safe before hydration. |

`loadScript` is in `src/lib/loadScript.ts`: one load per URL, rejects on failure, browser only. A script loaded this way is not in the server HTML, so parity reports it as missing; allow it: `{"match": "script:/fx.js", "reason": "loaded after hydration with loadScript"}`.

Preferred shape for a calculator or other widget: a Svelte island. Keep the pure module (`subnet-calc.js` and friends) unchanged and tested where it is, load it as above, and write the interactive part as a component that reads the module's window global in `onMount`, the way the pilot does. The server renders the page with empty results (as the legacy page does before its script runs); the browser fills them in. Do not port the maths into Svelte unless the module cannot be used as is, and then port it as a typed `.ts` file with tests that compare it with the original on a table of inputs.

Page-local inline scripts in the legacy page: port them to the component (`onMount`, event handlers, `$state`). Keep every id they look up (see below).

## Prices

Every dollar amount a legacy page shows is a price key in `server/data/prices.seed.json` (the source of truth for price keys; the old price inventory files are retired). Look up your page there:

- `kind: "price"` with a `key`: render `<Price key="vpn.from.month" />`. Formats: `fmt="usd0"` (default, `$5` or `$5.95`), `"usd"` (`$5.00`), `"int"` (cents), `"plain"` (`5.95`). It renders the same `data-price` markers as the legacy page, from the price cache on the server, and never throws: a missing key shows the `fallback` prop, else the last-known seed price.
- Amounts that are not a published price (derived figures, ranges, examples): follow the inventory's `kind` and `note`. A derived figure is computed in `data.ts` from the keys it comes from, not typed in.
- Prices inside a `title`, `meta description` or an attribute cannot use `<Price>`. Build the string in the route script with `priceText(data.prices, key, fmt, undefined, data.priceVersion)` from `#lib/priceFallbacks.ts`, and pass it to `Seo`. The legacy pages bake these in as text; check how the inventory marks them.
- JSON-LD prices: see the next section.

## Head metadata and JSON-LD

Use `Seo` (once per page) for everything that is in the legacy `<head>` and not in the layout:

```svelte
<Seo origin={data.origin} canonical="/vpn.html" title="..." description="..." keywords="..." author="Netquor Technologies LLC"
     geo={{ region: "US-ND", placename: "Fargo, North Dakota" }} siteName="Netquor Technologies" locale="en_US"
     twitter ogTitle="..." ogImage="/brand/og.png" {jsonLd} {priceMap} />
```

Every prop but `title`, `canonical` and `origin` is optional so the tags match the legacy page exactly: `terms.html` has no description or Open Graph (`og={false}`, `robots={null}`), the program pages have no keywords or Twitter tags. `ogImage` is a site path, an absolute URL or `null`. Match the legacy page's tags one for one; parity compares them.

JSON-LD: pass the object as written in the legacy page as `jsonLd`. Keep it as a typed constant in `data.ts` (not hand-minified JSON).

Prices in JSON-LD (the legacy `data-price-map`): the legacy home page puts `data-price-map='{"/@graph/4/itemListElement/1/priceSpecification/price":"fleet.mac.month", ...}'` on the JSON-LD script and the legacy server rewrites those values per request. For a Svelte page, copy that map into a `priceMap` constant and give it to `Seo` next to `jsonLd`: `Seo` calls `withPrices` (`src/lib/jsonld.ts`), which writes the values from the same price snapshot as the visible prices. A pointer is a JSON pointer, the spec is `"key"` or `"key|format"` (default `plain`, so `25` and `5.95`), a string stays a string and a number stays a number. A pointer that does not exist throws, so a typo fails the first render and the parity run, never in production. A key missing from the snapshot uses the last-known seed price. There is a test that `withPrices` gives the same JSON-LD as the legacy stamper for the legacy home page.

A page with several JSON-LD blocks is not supported by `Seo` today: put the blocks in one `@graph`, or if the legacy page really has two scripts, add the prop to `Seo` with a test and say so in your report.

## Ids, anchors and reveal animations

- Every `id` the page's scripts look up (`getElementById`, `querySelector("#x")`) and every `#anchor` the nav or other pages link to must exist in the rendered HTML with the same name. Parity (e) asserts the first set; anchors are in the links check.
- Reveal animations are `fx.js`: it adds `nq-r` and `nq-shown` classes to the elements it selects (`.nq-section-head`, `.nq-cmp-list details`, ...) and `nq-reveal-on` on `<html>`. Keep those class names on your markup and load `fx.js` with `loadScript` in `onMount` of the page. Do not write your own reveal code.
- Do not put a class that `fx.js` or `nav.js` toggles in a Svelte `class={...}` expression on the same element if the expression can change after hydration; a static class or `class:` directive on another element is fine. The nav is static markup for this reason.

## Shared components

In `src/lib/components/`, for markup the legacy pages repeat:

- `Faq` (`items: {q, a, id?, open?}[]`): the `<div class="nq-faq">` of `<details>`. `a` is trusted HTML from `data.ts`.
- `SectionHead` (`eyebrow?`, `title`, `lead?`): `<div class="nq-section-head">`.
- `CmpTable` (`head`, `rows`, `mine?`): `<div class="nq-cmp-wrap"><table class="nq-cmp">`; cells are trusted HTML; `mine` marks Netquor's own rows (`nq-me`).
- `Price`, `Nav`, `Footer`, `Seo` as above.

The program pages (`startups.html`, `referrals.html`, `partners.html`) were generated by `tools/make-program-pages.py` (removed; it lives in the `legacy-baseline-2026-11` tag), and their copy is now data in each page's `data.ts`, not in the template, so there is one source for each page. Heroes, chips and per-product blocks differ from page to page, so they are not shared components yet: if two pages need the same block, make the component then, with a test, and tell the others in your report.

## SSR and hydration rules

- Pages are rendered on the server per request. Nothing is prerendered (do not export `prerender`): the prices must never be baked into a build.
- The server HTML must contain the full content, prices and JSON-LD: crawlers and AI agents read it, and nothing is fetched in the browser for content. Do not render content only after `onMount`, and do not read `window`, `document` or `localStorage` outside `onMount`, event handlers or a `typeof window` guard.
- Server and first client render must agree: no `Date.now()`, `Math.random()`, locale-dependent formatting or window size in markup. Use `toLocaleString("en-US")` as the pilot does. Values that need the browser go in `$state` set in `onMount`.
- Page data comes from the layout (`data.prices`, `data.priceVersion`, `data.origin`, `data.assets`). A page that needs more data uses `+page.server.ts`; it must not call the API and must never fail the render for a missing price.
- The app shell wraps the body in `data-sveltekit-reload`, so every link is a normal page load: no client-side navigation, and nothing carries over between pages. Do not rely on SvelteKit's router.
- A form that posts to `/api/lead` sends JSON (`fetch` with `application/json`). A plain form post is refused by SvelteKit's CSRF guard unless it sends our `Origin` (see `web/README.md`).
- `{@html ...}` is for trusted static strings from your `data.ts` only, never for visitor input.

## Parity

```
bun run parity subnet-calculator.html     # builds, starts the built server on a free loopback port with the seed prices, compares
bun run parity --all                      # every page that has a route now
bun run parity <page>.html --no-build     # reuse web/build (run `bun run build` yourself after changes)
```

It fetches the Svelte page from the built server and the legacy page from the baseline (stamped with the same seed prices by `scripts/baseline/stamp.ts`), and compares:

1. text: the visible text as a sequence of blocks (script, style, noscript, template and the head removed, whitespace and entities normalised), with a diff. `-` is legacy only, `+` is Svelte only. A line marked "only in whitespace" differs by a space between inline tags (Svelte trims at block edges; add `{" "}` where the legacy page has the space).
2. links: every `<a href>` and `<img src>` in order. Relative URLs are resolved against the page, and `/index.html` equals `/`.
3. meta: `<title>`, canonical, every `<meta name|property>` (order ignored), and JSON-LD blocks (parsed, deep-equal, the first differing JSON pointer is shown).
4. assets: external `<script src>` and `<link rel=stylesheet>` in order, `?v=` ignored, SvelteKit's own `/_app/` files ignored (the bundled CSS is one of them; `parity-allow.json` lists the legacy stylesheets and fonts that are gone, per page, with the reason).
5. ids: every id that the legacy page's own scripts (inline and local external) look up and that the legacy page has must exist in the Svelte page.

Exit code 1 when anything differs, with a concise report. An intended difference goes in `migration/parity-allow.json`:

```json
{ "pages": { "fleet.html": {
    "meta": [ { "match": "name:viewport = width=device-width, initial-scale=1, viewport-fit=cover", "reason": "app.html is shared; Fleet's viewport-fit=cover is not needed" } ],
    "assets": [ { "match": "script:/fx.js", "reason": "loaded after hydration with loadScript" } ]
} } }
```

Categories: `text`, `links`, `meta`, `jsonld`, `assets`, `ids`. `match` is the item exactly as the report prints it after the `-` or `+` (it allows both sides), or `"*"` for the whole category (use only for a page rewritten on purpose, and say so in the reason). A reason is required. An entry that matches nothing is reported as a note so the file does not collect dead entries: remove it. Add entries only for page-specific, deliberate differences; a difference you have not understood is a bug.

The checker itself is `scripts/parity.ts` and `scripts/parity/*`, with tests next to it (`bun test scripts`). It is a tolerant tokenizer, not a browser: it does not run scripts, and it cannot see layout or styling. After parity passes, look at the page in a browser next to the legacy one (`bun run dev`, and the legacy file served from the repository root) for what the checker cannot see: spacing, the reveal animations, the calculators.

## Checklist for a page agent

1. Read the legacy page (from the baseline), its inline scripts, the scripts it loads, and its price keys in `server/data/prices.seed.json`.
2. Create the route, the page components and `data.ts`; move copy into data.
3. Wire `Seo` (all legacy meta, JSON-LD, `priceMap`), prices (`Price`), scripts (as islands or `loadScript`), ids.
4. `bun run parity <page>.html`; fix until it passes; allowlist only deliberate differences, each with a reason.
5. `bun test`, `bun run check`, `bun run smoke`.
6. Report: files, tests, allowlist entries and why, anything shared you added, open questions.
