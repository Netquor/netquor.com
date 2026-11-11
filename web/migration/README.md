# Migrating a legacy page to Svelte

The playbook for moving one hand-written page (`/<page>.html` at the repository root) to a SvelteKit route with the same URL, the same words and the same behaviour. One agent, one page; the shared pieces below exist so pages do not collide. Read `web/README.md` first for how the process serves pages.

The pilot, `src/routes/(site)/subnet-calculator.html/+page.svelte`, is the worked example.

## Definition of done

A page is migrated when all of these hold, run in `web/`:

1. `bun run parity <page>.html` passes (see "Parity" below). Every intended difference is in `migration/parity-allow.json` with a reason.
2. `bun run smoke` passes.
3. `bun run check` passes: no new `tsc` or `svelte-check` errors.
4. `bun test` passes, and you added tests for what you added: data modules, ported scripts, components. A page of static markup needs no test of its own; parity is its test.
5. The legacy file is left alone (a later step deletes it; until then the route wins over it) and `src/lib/pages.ts` is unchanged (the page is already registered; the sitemap picks the route up by itself).

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

- `(site)` carries the shared head (icons, Bootstrap, Bootstrap Icons, `nav.css`, `nq.css`, `nav.js`, `analytics.js`, fonts), then `Nav`, then your page, then `Footer`. Do not render `Nav` or `Footer` in your page.
- The nav marks the page's own entry as current from the URL. A page changes the nav and footer by returning `chrome` from `+page.ts` (see `src/lib/chrome.ts`):

  ```ts
  // src/routes/(site)/<page>.html/+page.ts   (for the home page: src/routes/(site)/+page.ts)
  export const load = () => ({ chrome: { footer: "full" } });
  ```

  Options: `footer` (`"simple"` default, `"full"`, `"none"`), `nav` (false for none), `navCurrent` (path to mark), `navStatic` (the `nq-static` nav).
- `(fleet)` is for `fleet.html`, which has its own design. Its layout loads `fleet/site.css`, the Geist fonts, `nav.css`, `nav.js`, `analytics.js` and `nudge.js` and draws nothing else: no footer, no Bootstrap, no `nq.css`. The legacy Fleet page does contain the site nav bar (above its own header, as `nq-static`), so the page places `<Nav current="/fleet.html" static />` itself, then its own header, sections and footer. It also loads `fleet/site.js` (a module) and `fleet/pricing.js` itself, because they depend on the page's ids.
- The shell `src/app.html` is shared by both groups: `<html lang="en-US" data-bs-theme="dark">` and a `viewport` meta of `width=device-width, initial-scale=1.0`. Where the legacy head differs (Fleet's viewport adds `viewport-fit=cover`, no `data-bs-theme`), record it in the allowlist with the reason rather than changing the shell.
- Hooks: a path that matches a SvelteKit route (any group) is served by Kit; a path that does not goes to the legacy file. Nothing to do per page.

## Assets: stylesheets and scripts

Legacy files stay where they are (repository root, `fleet/`, `brand/`) and are served by the legacy asset path. Load them with the fingerprint the layout data carries:

```svelte
<script lang="ts">
    import { assetUrl } from "#lib/assets.ts";
    let { data } = $props();
</script>
<svelte:head><script src={assetUrl(data.assets, "costCalc")}></script></svelte:head>
```

`src/lib/assets.ts` lists the known files (`nq`, `nav`, `navJs`, `analytics`, `subnet`, `costCalc`, `bundleCalc`, `fx`, `nudge`, `bg`, `readiness`, `fleetCss`, `fleetJs`, `fleetPricing`). Add a line there to load another one. Never write a `?v=` by hand.

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

Every dollar amount a legacy page shows is listed in `migration/price-inventory.json` (generated by `scan-prices.ts`; `price-inventory.md` explains the fields). Look up your page there:

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

The program pages (`startups.html`, `referrals.html`, `partners.html`) are generated today by `tools/make-program-pages.py`, which holds their copy in Python (`faq()`, `table()`, the hero). When you migrate them, move that copy into `data.ts` as data, not into the template, so there is one source for each page. The generator and the legacy files stay until the whole migration is accepted. Heroes, chips and per-product blocks differ from page to page, so they are not shared components yet: if two pages need the same block, make the component then, with a test, and tell the others in your report.

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

It fetches the Svelte page from the built server and the legacy file through the legacy server code with the same seed, and compares:

1. text: the visible text as a sequence of blocks (script, style, noscript, template and the head removed, whitespace and entities normalised), with a diff. `-` is legacy only, `+` is Svelte only. A line marked "only in whitespace" differs by a space between inline tags (Svelte trims at block edges; add `{" "}` where the legacy page has the space).
2. links: every `<a href>` and `<img src>` in order. Relative URLs are resolved against the page, and `/index.html` equals `/`.
3. meta: `<title>`, canonical, every `<meta name|property>` (order ignored), and JSON-LD blocks (parsed, deep-equal, the first differing JSON pointer is shown).
4. assets: external `<script src>` and `<link rel=stylesheet>` in order, `?v=` ignored, SvelteKit's own `/_app/` files ignored.
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

1. Read the legacy page, its inline scripts, the scripts it loads, and its entry in `price-inventory.json`.
2. Create the route, the page components and `data.ts`; move copy into data.
3. Wire `Seo` (all legacy meta, JSON-LD, `priceMap`), prices (`Price`), scripts (as islands or `loadScript`), ids.
4. `bun run parity <page>.html`; fix until it passes; allowlist only deliberate differences, each with a reason.
5. `bun test`, `bun run check`, `bun run smoke`.
6. Report: files, tests, allowlist entries and why, anything shared you added, open questions.
