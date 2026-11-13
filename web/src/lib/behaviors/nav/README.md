# behaviors/nav

Port of `nav.js` (mega menu, Products dropdown, burger menu). Behavior reference: `web/migration/behaviors.md`, section "nav.js". Scenarios: `nav-desktop`, `nav-focus`, `nav-focus-order`, `nav-mobile`.

## Exports (`index.ts`)

| Export | What it is |
| --- | --- |
| `navMenu(node)` | Svelte action. `<nav class="nq-nav" use:navMenu>`. Wires the nav, returns `{ destroy }`. |
| `initNav(nav: Element): () => void` | The same without Svelte. Returns the cleanup that removes every listener. |
| `NQ_JS_SNIPPET` | `document.documentElement.classList.add('nq-js');`. Legacy adds `nq-js` while the script runs in `<head>`, so it is present at first paint (below 992 px the CSS hides `.nq-menu` only with it). An action runs after hydration, so the layout should also emit this in `<head>` (inline script, or keep it in `app.html`); `initNav` adds it again (idempotent) for pages without it. |
| `markJs(doc)` | Adds `nq-js` to `<html>`. |
| `reduceNav(state, event, desktop)` | Pure state machine: `{ dd, menu }` x event -> `{ dd, menu }`. Events: `burger-click`, `dd-click`, `dd-enter`, `dd-leave`, `doc-click {insideDd}`, `escape`, `nav-click {onLink}`. |
| `touches(event)` | Which of `dd` / `menu` the legacy handler writes to the DOM for that event. |
| `DESKTOP_QUERY` | `(min-width: 992px)`. |

## Behavior (identical to nav.js)

- Hooks inside the node: `.nq-burger` (+ `.nq-menu`), the first `.nq-dd` with its `.nq-dd-btn`. Missing parts are skipped (legacy throws without a burger or menu).
- State lives in the DOM only: `.nq-dd.open` + `aria-expanded` on `.nq-dd-btn`; `.nq-menu.open` + `aria-expanded` on `.nq-burger`. Both written as the strings `"true"` / `"false"`, via `classList.toggle(name, bool)`.
- Burger `click` toggles the menu. Products `click` calls `stopPropagation`; desktop always opens, mobile toggles. `.nq-dd` `mouseenter` / `mouseleave` (not pointer events) open / close on desktop only. Document `click` outside `.nq-dd` closes Products (never the menu). Document `keydown` `Escape` closes both; focus is not moved. A `click` inside the nav on or inside an `a` closes both.
- Desktop = `matchMedia("(min-width: 992px)")`, created once, `.matches` read at each event; a resize closes nothing.
- All listeners are added without options (none passive), on the same targets as legacy (burger, button, `.nq-dd`, nav, document). No focus trap, arrow keys or focus return. The hover and `:focus-within` display rules are CSS (`nav.css`), not script.
- Cleanup removes all listeners. `nq-js` is never removed (as in legacy).

## Notes for Nav.svelte

- Keep the classes of `.nq-dd` and `.nq-menu` static (a dynamic `class={...}` that re-renders would overwrite `open`). The Products button's dynamic `is-current` class is fine: the script never touches it.
- Server-rendered markup is complete without JS: the menu is always shown (no `nq-js`), Products opens on hover and focus-within via CSS.

Tests: `navState.test.ts` (pure), `nav.test.ts` (DOM wiring with `../accordion/fakeDom.ts`).
