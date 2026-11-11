# fx: port of fx.js

Svelte 5 actions and components that reproduce `fx.js` (see `web/migration/behaviors.md`, section fx.js, and the scenarios `fx-desktop` and `fx-reduced` in `web/scripts/e2e/scenarios/fx.ts`). Nothing here loads the legacy script. All of it is optional motion: without JavaScript the server markup is complete (the progress bar is an empty fixed element, no content is ever hidden by the server). None of it changes layout (the bar is fixed, reveal only animates opacity and transform, the spotlight sets custom properties, the tap rects are SVG children).

Reduced motion is read once at init with `matchMedia("(prefers-reduced-motion: reduce)")`, as fx.js did (no change listener). Progress and hero map run under reduced motion; reveal and spotlight do not.

Everything is re-exported from `index.ts`.

## Components

- `<ScrollProgress />`: server-renders `div.nq-progress[aria-hidden="true"]` and drives it with `use:progressBar`. Renders in place; it is `position: fixed`, so put it outside any ancestor with `transform`, `filter` or `contain` (the layout root is fine). Legacy appended it to `<body>`; use `mountProgress()` if you need that exactly.
- `<Fx reveal={true} spotlight={true} />`: `ScrollProgress` plus, in `onMount` (after hydration), `initReveal(document)` and `initSpotlight(document)`. Props switch the two off. Cleanup runs on destroy.

## Actions

- `use:progressBar` (on an element): sets `style.transform = "scaleX(v)"`, `v = h > 0 ? min(1, scrollY / h) : 0`, `h = scrollHeight - innerHeight`; once at start and on every passive `scroll` (not on resize). Destroy removes the listener and clears the transform.
- `use:heroMap` (on `svg.nq-map`): for each `.nq-map-lines path` sets `pathLength="100"` and appends a clone with `class="nq-pulse"`, `pathLength="100"` and `animation-delay` `i * 0.55` s; for each `.nq-map-labels > a` inserts a transparent `rect` as first child (`x = bbox.x - 14`, `y = bbox.y - 22`, `width + 28`, `height + 44`; `getBBox` errors swallowed); `mouseenter`/`focus` add class `hot` to the label's trace and pulse, `mouseleave`/`blur` remove it, with label to trace order `[8, 0, 1, 2, 3, 4, 5, 6, 7]`. Works with no labels (the Central diagram). Destroy removes listeners, clones, rects and `hot`, and restores `pathLength`. Use it on every page that has the map, also under reduced motion.
- `use:reveal` (on an element, scopes the targets to its descendants, or on `<svelte:document>` for the whole page as fx.js did): unless reduced motion or no `IntersectionObserver`, adds `html.nq-reveal-on`, gives every target of the legacy selector (document order) the class `nq-r` and `transition-delay` `(i % 3) * 70` ms, observes them with one observer (`threshold 0.12`, `rootMargin "0px 0px -6% 0px"`), adds `nq-shown` on first intersection and unobserves. Classes are never removed while scrolling. Destroy disconnects and removes `nq-reveal-on`, `nq-r`, `nq-shown` and the delays. Targets are collected once at init (as legacy); content added later is not revealed.
- `use:spotlight` (on `<svelte:document>` or any element): not under reduced motion, one passive `pointermove` listener; the target's `closest(".nq-app, .nq-who, .nq-calc, .nq-check, .nq-prices-row")` gets `--mx` and `--my` (px offset in the card). Destroy removes the listener.

## Plain functions (what the actions call)

`initProgress(bar, doc, win)`, `mountProgress(doc?, win?)`, `initHeroMap(map)`, `initReveal(scope, doc, win?)`, `initSpotlight(target, win?)`: each returns a cleanup function.

## Pure functions (`core.ts`)

`progressScale`, `progressTransform`, `LABEL_TRACE_ORDER`, `traceIndexForLabel`, `pulseDelay`, `revealDelay`, `tapRect`, `spotlightOffset`, `prefersReducedMotion`, the selectors `REVEAL_SELECTOR` and `SPOTLIGHT_SELECTOR`, `REVEAL_OPTIONS`, `CLASSES`.

## Adopting in a page

```svelte
<script>
  import { Fx, heroMap } from "#lib/behaviors/fx";
</script>
<Fx />
<svg class="nq-map" use:heroMap> ... </svg>
```

The CSS is unchanged (`nq.css`: `.nq-progress`, `.nq-pulse`, `.hot`, `.nq-reveal-on .nq-r`, `.nq-shown`).

## Tests

`fx.test.ts` (pure functions, DOM wiring against the hand-written `fakeDom.ts`, server markup). Browser behavior is pinned by the e2e scenarios `fx-desktop` and `fx-reduced` (`bun run e2e`).
