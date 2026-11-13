# bg

Part of the small-script ports (bg, nudge, analytics, readiness): Svelte 5 ports with no legacy script loaded; pure logic is unit tested, DOM wiring runs against a fake DOM, and the legacy script is run in a vm for differential tests. Routes, layouts, Nav and Footer are untouched; the WIRE stage places these.

##  the home hero background

| Export | What |
| --- | --- |
| `HeroBackground.svelte` (no props) | Renders `div.nq-bg[aria-hidden=true] > svg + canvas`. Place it as the FIRST child of the `.hero-section` element (the legacy script inserts it there). After hydration it finds `closest(".hero-section")`, builds the grid and traces, and unless reduced motion or Save-Data is on, runs the pulse and appends `button.nq-bg-pause` to the hero (last child, as before). Cleanup on destroy removes listeners, frame, observer, timer and the button. Without JS the wrapper is empty (the legacy page also had no background without JS). |
| `background.ts` `startBackground(hero, svg, canvas, env?)` | The wiring. `env` (`BgEnv`) injects matchMedia, Save-Data, storage, rAF, resize, timers and IntersectionObserver for tests; `browserEnv()` is the default. Returns the cleanup. No-op when `hero` is missing or cannot be measured. |
| `geometry.ts` | `snap`, `buildPaths(W, H)`, `svgMarkup(paths)` (character for character the legacy markup, ids `nqg`/`nqf`), `pathLength`, `pointAt`, and the pulse state machine `initialPulse`/`stepPulse` (first pulse after 1200 ms of rAF time, 0.16 px/ms, step capped at 50 ms, 60 px tail, next pulse 6000 ms after the end, round robin over traces). |

Behavior kept: grid 48, resize debounce 150 ms, `localStorage["nq-bg-paused"]` read once and written only on click (all in try/catch), label/`aria-pressed` text, frames skipped (canvas untouched) while off-screen, `document.hidden` or paused, observer only reads `entries[0]`, no observer/button/loop under reduced motion or Save-Data (the resize rebuild is still registered).


Run: `bun test src/lib/behaviors/bg`. The e2e scenario for this area already exists in `scripts/e2e/scenarios/bg.ts`.
