# Bootstrap JavaScript on netquor.com

Every use of `bootstrap.bundle.min.js` (5.3.3, jsdelivr) found in the legacy pages, the Svelte pages and the data files, and what replaces it.

## Result

The only Bootstrap JavaScript feature the site uses is **Collapse** (`data-bs-toggle="collapse"`, with `data-bs-target` and `data-bs-parent`). Nothing uses Dropdown, Modal, Tooltip, Popover, Offcanvas, Carousel, Alert, ScrollSpy, Tab, Toast, the Navbar toggler, `data-bs-dismiss`, `data-bs-ride`, `data-bs-spy`, or the `bootstrap.*` JavaScript API (`new bootstrap.X`). The site nav (`nav.js`) is its own script and does not use Bootstrap. `data-bs-theme="dark"` on `<html>` is a CSS hook only (Bootstrap CSS), not JavaScript, and stays.

Replacement: `src/lib/behaviors/accordion/` (the `collapse` action, `Accordion.svelte`; see its README). The CSS (`bootstrap.min.css` 5.3.3 and `nq.css`) is unchanged.

## Pages that use Collapse (accordions, `#faq`)

| Page | Toggles | Panel ids | Where in the Svelte app |
| --- | --- | --- | --- |
| `vpn.html` | 6 | `v0`..`v5` | `src/routes/(site)/vpn.html/+page.svelte` (inline markup, `data-bs-target={`#v${i}`}`), data in `$lib/pages/vpn` |
| `network.html` | 6 | `q0`..`q5` | `src/routes/(site)/network.html/+page.svelte` |
| `sdn.html` | 8 | `f0`..`f7` | `src/routes/(site)/sdn.html/+page.svelte` |
| `homeassistant.html` | 7 | `h0`..`h6` | `src/lib/pages/homeassistant/Questions.svelte` (data in `./data`) |

All four share the markup `div#faq.accordion > .accordion-item > h3.accordion-header > button.accordion-button.collapsed[type=button][data-bs-toggle=collapse][data-bs-target=#id]` then `div#id.accordion-collapse.collapse[data-bs-parent=#faq] > .accordion-body.text-muted.small`. None carries `aria-expanded` or `aria-controls` (Bootstrap adds `aria-expanded` on first use only).

## Pages that load the bundle without using it

These load `bootstrap.bundle.min.js` and have no `data-bs-toggle` (or any other Bootstrap JS hook) in the page markup or data. After the WIRE stage drops the `<script src>` they need nothing.

| Page | Svelte place that emits the script tag |
| --- | --- |
| `index.html` | `src/routes/(site)/+page.svelte` line with `bootstrap.bundle.min.js` (the only `data-bs-` on the legacy page is `data-bs-theme`) |
| `digitalaccess.html` | `src/routes/(site)/digitalaccess.html/+page.svelte` |
| `privacy.html`, `terms.html` | `src/lib/pages/legal/LegalPage.svelte` (`BOOTSTRAP_JS`, a raw script tag at the end of the card) |

Pages that do not load it: `central`, `compare`, `partners`, `readiness`, `referrals`, `startups`, `subnet-calculator` (Bootstrap CSS only) and `fleet` (neither; its own CSS and the Bootstrap Icons font).

## What the WIRE stage has to change

1. Remove the five `<script src=".../bootstrap.bundle.min.js">` tags above (the home, digitalaccess, vpn, network, sdn and homeassistant route files, and `BOOTSTRAP_JS` in `LegalPage.svelte`); keep the Bootstrap CSS link in `(site)/+layout.svelte`.
2. On the four accordion pages replace the inline accordion markup with `<Accordion id="faq" items={...} />` (or keep the markup and add `use:collapse` to the `#faq` element). Item shape `{ id, q, a }`; ids and text stay as they are.
3. Tests that count `data-bs-toggle="collapse"` (`src/lib/pages/products1.test.ts`: 8 and 6) keep passing: the markup still has them.
4. Scenarios: `collapse-*` already accept both sides (see `scripts/e2e/scenarios/collapse.ts`); no scenario observes the bundle request, so no allowlist entry is needed.

## How the data files were checked

`grep -rn "data-bs-" web/src ../*.html ../fleet ../tools` and `grep -rn "bootstrap" ...` over `.svelte`, `.ts`, `.html` and `.js` (legacy and Svelte); the non-collapse `data-bs-*` hits are `data-bs-theme` in `src/app.html`, `src/lib/server/fleetShell.ts` (`SHELL_THEME`) and the legacy `<html>` tags. No page script, `nq.css` rule, or data file calls `bootstrap.`.
