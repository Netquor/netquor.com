# readiness

Part of the small-script ports (bg, nudge, analytics, readiness): Svelte 5 ports with no legacy script loaded; pure logic is unit tested, DOM wiring runs against a fake DOM, and the legacy script is run in a vm for differential tests. Routes, layouts, Nav and Footer are untouched; the WIRE stage places these.

##  the checklist scoring

| Export | What |
| --- | --- |
| `action.ts` `readiness` | Svelte action: `<main use:readiness>` on the element containing the `.nq-check` sections (optionally pass a data object shaped like `SCORING`). Destroy removes the listeners. |
| `readiness.ts` | `attachReadiness(root, doc?, lists?, print?)` (the wiring, one `change` listener per form, sections without data are skipped), `renderView` (result box DOM, children in the legacy order). |
| `score.ts` | `band`, `viewFor(list, answers)`, `mailtoHref`. Pure. |
| `data.ts` | `SCORING`: the DATA object of `readiness.js` verbatim. |

The existing `pages/readiness/Checklist.svelte` markup already has the hooks (`section.nq-check[data-key]`, `form` with `<key>-<i>` radios valued `1`/`0`, `.nq-check-result[aria-live=polite][hidden]`), so the page only needs `use:readiness` on `<main>` (and `fx` for the reveal, handled by the fx agent). Answers are not stored or sent; all text via `textContent`.

### Should the data be imported from `readiness-data.json` at build time?

Not yet. The markup (question text) is already built from `readiness-data.json`, but the scoring strings (gap titles, gap texts, links) in the legacy `readiness.js` have drifted from the JSON: `calls` entries 3, 4, 5, 6 differ (the JSON dropped "It is in early access", renamed "Callbacks" to "A call log" and reworded question 5). The legacy script is the baseline, so `data.ts` is a verbatim copy and a test pins both facts: it equals the legacy `DATA`, and its difference from the JSON is exactly those six strings. If the owner wants the JSON copy to win, replace `SCORING` with a build-time `import raw from "readiness-data.json"` (the shape `{title, qs, cta, calc}` already matches), update the pinned drift test, and accept that the call-handling result text changes visibly versus legacy.


Run: `bun test src/lib/behaviors/readiness`. The e2e scenario for this area already exists in `scripts/e2e/scenarios/readiness.ts`.
