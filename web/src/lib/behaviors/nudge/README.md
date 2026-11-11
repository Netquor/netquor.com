# nudge

Part of the small-script ports (bg, nudge, analytics, readiness): Svelte 5 ports with no legacy script loaded; pure logic is unit tested, DOM wiring runs against a fake DOM, and the legacy script is run in a vm for differential tests. Routes, layouts, Nav and Footer are untouched; the WIRE stage places these.

##  contextual product prompt

| Export | What |
| --- | --- |
| `Nudge.svelte` prop `page: string` | The file name of the current page, `"vpn.html"` (a leading path is tolerated; `"/"` and unknown pages do nothing). Renders nothing; after hydration it arms the card. Pass the page from the route instead of URL sniffing. |
| `nudge.ts` `startNudge(page, doc, win)` | Wiring; returns the cleanup (timer, listeners, card). `buildCard` builds the card DOM. |
| `gates.ts` | `NUDGES` table, `nudgeFor`, `pageOf`, `readyToShow`, `scrollRatio`. |

Behavior kept: 25000 ms `setTimeout`, passive window `scroll` at ratio >= 0.4, any `Tab` keydown on window disables it for the page view, once per page view, decided once at load: `sessionStorage["nq-nudge"] === "1"`, reduced motion, non-fine pointer. The card is appended to `<body>` (so Fleet, which has no `nq.css`, still shows it unstyled at the end of the page, as the legacy page does), child order close/title/text/row, `in` added on the next animation frame, dismissal by close, Not now or Escape (storage write in try/catch, `in` removed, element removed after 250 ms). One difference by design: the Escape listener is removed on dismissal and on destroy (the legacy one stayed on `document` for the page view but was a no-op once the card was gone).


Run: `bun test src/lib/behaviors/nudge`. The e2e scenario for this area already exists in `scripts/e2e/scenarios/nudge.ts`.
