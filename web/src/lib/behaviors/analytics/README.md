# analytics

Part of the small-script ports (bg, nudge, analytics, readiness): Svelte 5 ports with no legacy script loaded; pure logic is unit tested, DOM wiring runs against a fake DOM, and the legacy script is run in a vm for differential tests. Routes, layouts, Nav and Footer are untouched; the WIRE stage places these.

##  Google Analytics 4

| Export | What |
| --- | --- |
| `Analytics.svelte` (no props) | Renders nothing; after hydration runs `startAnalytics()`. Put it once in each layout (`(site)` and `(fleet)`) in place of `<script src="/analytics.js" defer>`. |
| `analytics.ts` | `MEASUREMENT_ID` (`G-DDM7J28WFG`), `analyticsOff(win)` (id shape, GPC, DNT on navigator or window, `ga-disable-<id>`, in the legacy order), `startAnalytics(win, doc)`. |

Identical network behavior: one async script `https://www.googletagmanager.com/gtag/js?id=G-DDM7J28WFG` appended to `<head>`, `dataLayer` holds exactly `["js", Date]` and `["config", id, {anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false}]` as `arguments` objects (as gtag.js requires). No consent banner exists in the legacy script, and none is added. Timing difference to know: the legacy script ran as a `defer` script (before DOMContentLoaded); the component runs in `onMount` (after hydration). Same request, a little later. If exact timing matters, keep the `defer` script tag in the layout head and do not use the component.


Run: `bun test src/lib/behaviors/analytics`. The e2e scenario for this area already exists in `scripts/e2e/scenarios/analytics.ts`.
