# behaviors/accordion

Replaces `bootstrap.bundle.min.js` 5.3.3 (jsdelivr), which the site uses only for Collapse accordions (full list: `web/migration/bootstrap-js-usage.md`). The markup, classes and CSS stay Bootstrap's; only the script goes away. Scenarios: `collapse-vpn`, `collapse-network`, `collapse-sdn`, `collapse-homeassistant`.

## Exports (`index.ts`)

| Export | What it is |
| --- | --- |
| `collapse(node)` | Svelte action. `<div class="accordion" use:collapse>` (or on a common ancestor, or `<svelte:document use:collapse>`). Calls `initCollapse`, returns `{ destroy }`. |
| `initCollapse(root, env?)` | Wires a root (element or document). First sets, for each `[data-bs-toggle="collapse"]` toggle with a target: the `collapsed` class and `aria-expanded` from the target's real state, and `aria-controls` (target id) when absent. Then adds one delegated `click` listener (no options). Click on (or inside) a toggle: `preventDefault` if the toggle or the click target is an `a`, then `toggle()` on every target. Cleanup: removes the listener and completes transitions in flight. |
| `Collapse` | Port of Bootstrap's Collapse for one panel: `Collapse.get(el, env)`, `.toggle() .show() .hide()`, `.isShown`, `.isTransitioning`, `.finish()`, `Collapse.peek(el)`. Fires `show.bs.collapse`, `shown.bs.collapse`, `hide.bs.collapse`, `hidden.bs.collapse` (bubbling; `show`/`hide` cancelable) like Bootstrap. |
| `Accordion` (`Accordion.svelte`) | Component with the full accordion markup (see below). |
| `viewItems`, `openIds`, `AccordionItem` | Pure model of the server-rendered state. |
| `selectorFor`, `targetsOf`, `transitionMs`, `TOGGLE`, `ACTIVES`, `TRANSITION_PADDING_MS`, `browserEnv`, `CollapseEnv` | Building blocks (Bootstrap's `getSelectorFromElement`, `getTransitionDurationFromElement`, constants, and the injectable window functions). |

## Accordion.svelte props

`id` (required; the `.accordion` id and the `data-bs-parent` target), `items` (`{ id, q, a, open? }[]`; `q` is text, `a` is HTML), `exclusive` (default `true`: `data-bs-parent="#id"`, one open at a time), `bodyClass` (default `text-muted small`), `headingLevel` (2 to 6, default 3), `showWithoutJs` (default `false`; when `true` a `<noscript>` rule in `<head>` shows every panel with scripts off, which the legacy pages do not do). The markup is computed once from the props (the open state belongs to the DOM after load), so do not feed it changing props.

Markup, server-rendered, identical to the legacy pages plus `aria-expanded` and `aria-controls`:

```html
<div class="accordion" id="faq">
  <div class="accordion-item"><h3 class="accordion-header"><button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#q0" aria-expanded="false" aria-controls="q0">Question</button></h3><div id="q0" class="accordion-collapse collapse" data-bs-parent="#faq"><div class="accordion-body text-muted small">Answer</div></div></div>
</div>
```

An item with `open: true` renders `accordion-button` without `collapsed`, `aria-expanded="true"` and the panel with `collapse show`. Existing hand-written markup (no aria) works as is with `use:collapse`; the action adds the aria attributes on mount.

## Behavior (Bootstrap 5.3.3, read from its source and CSS)

- CSS (unchanged): `.collapse:not(.show) { display: none }`; `.collapsing { height: 0; overflow: hidden; transition: height .35s ease }`, `transition: none` under `prefers-reduced-motion`.
- Open: `collapse` -> `collapsing`, `style.height = "0"`, toggle gets `aria-expanded="true"` and loses `collapsed` at once, then `style.height = scrollHeight px`; on the end: `collapsing` -> `collapse show`, `style.height = ""`.
- Close: `style.height = <measured>px`, reflow, `collapsing` added and `collapse show` removed, toggle gets `collapsed` and `aria-expanded="false"`; at the end `collapsing` -> `collapse`, height cleared.
- End of transition: the panel's own `transitionend` (children's are ignored), or after computed `transition-duration + transition-delay` + 5 ms. With reduced motion (duration 0) that is 5 ms.
- A click while that panel is transitioning is ignored. With `data-bs-parent`, opening hides the `.collapse.show` siblings under the parent (not ones nested in another `.collapse`); if the first such sibling is transitioning the open is refused. Quirk kept: a sibling that is mid-open or mid-close has no `.collapse` class, so it is not found (a fast second click can leave two open).
- Focus stays on the button; no hash change; `Enter` and `Space` are native button clicks.
- Differences from Bootstrap on purpose: `aria-expanded` and `aria-controls` exist from the start (behaviors.md asks for this); only Collapse is implemented; no `toggle` config option or jQuery interface.

## Without JavaScript

Same as the legacy pages: server markup is complete, open items are rendered open, closed answers are `display: none` (set `showWithoutJs` to show them). A toggle that is an `a` with `href="#id"` is a working anchor to the panel.

Tests: `collapse.test.ts` (behavior with the fake DOM in `fakeDom.ts`, timers are a manual queue), `accordion.test.ts` (model, the component rendered on the server, the action).
