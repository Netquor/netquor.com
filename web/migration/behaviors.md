# Behaviors the ports must reproduce

What each legacy script does today, precisely enough to port it without reading the original again. Everything here was derived two ways: by reading the script, and by running it in a real headless Chrome with `bun run e2e` (`web/scripts/e2e/`, see its README). Each section names the scenarios that pin the behavior; a port is done when those scenarios still pass against the ported page (the legacy side of the comparison keeps running from the repository root until the legacy files are deleted, and `expect` functions in the scenarios assert the absolute behavior, so they keep working after that).

How to read the lists: **Hooks** are the DOM selectors and attributes the script depends on (markup the port must keep or generate), **Behavior** is what happens on which input, **A11y** is the ARIA and focus state, **Timing**, **Storage** and **Requests** are what they say. "Observed" marks a fact seen in the browser that the code alone does not say. "Quirk" marks behavior that is probably accidental; a port may fix a quirk, but only on purpose and with the scenario and this file updated in the same change.

The pages that load each script today:

| Script | Pages |
| --- | --- |
| `nav.js` | every page (head, synchronous) |
| `analytics.js` | every page (`defer` on the Svelte side) |
| `fx.js` | `index`, `compare`, `partners`, `readiness`, `referrals`, `startups` |
| `bg.js` | `index` only (needs `.hero-section`) |
| `nudge.js` | `central`, `digitalaccess`, `fleet`, `homeassistant`, `network`, `sdn`, `vpn` |
| `readiness.js` | `readiness` |
| Bootstrap bundle 5.3.3 (CDN) | `index`, `digitalaccess`, `homeassistant`, `network`, `privacy`, `sdn`, `terms`, `vpn`; the collapse widgets exist on `homeassistant`, `network`, `sdn`, `vpn` |
| `subnet-calc.js` + inline script | `subnet-calculator` |
| `cost-calc.js`, `bundle-calc.js` | `index` (calculators island; not covered by a scenario yet, see "Not covered") |
| `fleet/site.js` (module), `fleet/pricing.js` | `fleet` |

Third-party requests the legacy pages make (`observe: { requests: "external" }`): `cdn.jsdelivr.net` (Bootstrap CSS 5.3.3, Bootstrap Icons 1.11.3 CSS and its woff2, Bootstrap JS bundle on the pages above, `devices.css` on `index`), `fonts.googleapis.com/css2` and `fonts.gstatic.com` (IBM Plex; Geist on `fleet`, which also loads only the Bootstrap Icons CSS from jsdelivr, no Bootstrap), `www.googletagmanager.com/gtag/js` (analytics). The scenarios currently expect these on both sides. A port that removes a CDN dependency must say so in the scenario's `allow` list, with the reason, in the same change.

---

## nav.js (scenarios `nav-desktop`, `nav-focus`, `nav-focus-order`, `nav-mobile`)

**Hooks.** `.nq-nav` (the first one; no nav means no wiring), inside it `.nq-burger` (a `button`, `aria-controls="nq-menu"`, `aria-expanded="false"`, `aria-label="Menu"`), `.nq-menu` (`id="nq-menu"`), the first `.nq-dd` (a `li`) with `.nq-dd-btn` (a `button`, `aria-haspopup="true"`, `aria-expanded="false"`) and the panel `.nq-dd-menu.nq-mega`. Links inside the nav are plain `a` elements. The script reads none of the link classes; `.is-current` and `aria-current="page"` on the page's own entry come from the markup.

**Load.** `document.documentElement.classList.add("nq-js")` runs immediately when the script executes in `<head>` (CSS relies on it: below 992 px `.nq-js .nq-burger` is shown and `.nq-js .nq-menu` is hidden until `.open`; without the class the menu is always shown). Everything else is wired on `DOMContentLoaded`. Observed: `html.nq-js` is present at first paint.

**State.** Two booleans, kept only as DOM state: `.nq-dd.open` with `aria-expanded` on `.nq-dd-btn`, and `.nq-menu.open` with `aria-expanded` on `.nq-burger`. Both attributes are written as the strings `"true"` and `"false"` on every change.

**Desktop is `matchMedia("(min-width: 992px)")`, queried at each event, not listened to.** A resize across 992 px changes behavior from the next event on and does not close anything.

**Behavior.**
- Burger click: toggles `.nq-menu.open` (the new state is the opposite of whether it has the class).
- Products button click: `stopPropagation`, then on desktop always opens (a second click keeps it open), on mobile toggles.
- `mouseenter` on `.nq-dd`: opens on desktop only. `mouseleave`: closes on desktop only. Nothing on mobile.
- Click anywhere on the document: if the target is not inside `.nq-dd`, closes the Products panel. It never closes the burger menu (observed: a click on the page body with the phone menu open leaves the menu open and closes Products).
- `Escape` keydown anywhere (document level, any focused element): closes the Products panel and the burger menu. Focus does not move (observed: it stays on the Products button).
- Click on anything inside the nav whose target is, or is inside, an `a`: closes both. It runs before the browser follows the link.
- No focus trap, no focus return, no arrow-key handling, no `Home`/`End`. `Enter` and `Space` on the buttons work because they are buttons (a native click).

**CSS fallbacks the port must keep (they are visible behavior):** at 992 px and up `.nq-dd:hover > .nq-dd-menu` and `.nq-dd:focus-within > .nq-dd-menu` are `display: block`. So the panel is visible while the pointer is over `.nq-dd` or focus is inside it, with or without `.open`. Quirk, observed: Tabbing onto Products shows the panel while `aria-expanded` is still `"false"` and `.open` is absent; after `Escape` the panel stays visible for as long as focus is inside it, though `aria-expanded` is `"false"`. Below 992 px `.nq-dd:hover > .nq-dd-menu` is hidden and only `.open` shows it.

**Geometry (observed, 1280 px):** panel 920 x 483 at (64, 72). **390 px:** burger 40 x 40 at (326, 12); open menu 390 x 231 at (0, 64) floating over the page; Products list 366 x 694 at (12, 117).

**Keyboard order (observed, desktop, from a fresh load).** Tab 1: brand link ("Netquor Technologies, home"). Tab 2: Products button (the burger is `display: none`, so skipped). With focus on Products the panel is visible, so the next stops are the nine product links in order (Netquor Phone, Fleet, SDN, Central, Network Solutions, VPN, All Source Hosting, Hosted Home Assistant, Digital Access), the nine shortcuts (Engineering and field services, Free subnet calculator, For startups, Referrals, Partners and jobs, Readiness checklists, All prices, How we compare, Bundles), then Homelab, Pricing and the rest of the page. Shift+Tab from Pricing: Homelab, Products (the panel's links are skipped when focus is outside it), brand, then out of the document, then the last links of the page.

**Storage, requests, timers:** none.

---

## fx.js (scenarios `fx-desktop`, `fx-reduced`; and indirectly `readiness-*`)

An IIFE; everything is optional, with reduced motion the page is complete and static.

**1. Progress line (always, also under reduced motion).**
- Appends `div.nq-progress[aria-hidden="true"]` to `<body>`. CSS: fixed at the top, 2 px, `z-index: 1100`, `transform-origin: 0 50%`, `pointer-events: none`; `display: none` under reduced motion and in print.
- `style.transform = "scaleX(v)"` with `v = h > 0 ? min(1, scrollY / h) : 0`, `h = documentElement.scrollHeight - innerHeight`. Updated on every `scroll` (passive listener) and once at start. Not on resize. Observed: computed `matrix(0, 0, 0, 1, 0, 0)` at the top, `matrix(1, 0, 0, 1, 0, 0)` at the bottom, `scaleX(0.0553978)` at 800 px on the 15,341 px home page at 1280 x 900.

**2. Hero map (only when `.nq-map` exists; also under reduced motion).**
- `lines` = `.nq-map-lines path` (9 on the home page), `labels` = `.nq-map-labels > a` (9). Label `i` maps to trace `order[i]` with `order = [8, 0, 1, 2, 3, 4, 5, 6, 7]` (the centre label, Netquor Central, is authored first, its trace last).
- Each trace gets `pathLength="100"`. For each trace `i` a clone is appended to the same parent: `cloneNode()` (attributes kept, so `pathLength="100"`), `class` replaced by `nq-pulse`, `style.animationDelay = (i * 0.55) + "s"` (observed as `0s`, `0.55s`, ... `4.4s`). CSS animates `.nq-pulse` (`nq-flow`, 4.2 s linear infinite, dash `5 95`; hidden under reduced motion).
- Tap area: for each label a transparent `rect` is inserted as the label's first child, `x = bbox.x - 14`, `y = bbox.y - 22`, `width = bbox.width + 28`, `height = bbox.height + 44`, `fill="transparent"`; failures of `getBBox` are swallowed. (Observed: the rects carry fractional values straight from `getBBox`, e.g. `x="229.94863891601562"`.)
- Hover and focus: `mouseenter` and `focus` on a label add class `hot` to its trace and its pulse clone; `mouseleave` and `blur` remove it. Observed: hovering label 2 gives hot paths `[0, 9]` (trace 0 and clone 9), label 1 gives `[8, 17]`. `.hot` styling: trace `stroke: #8cc4f7; opacity: 1`, clone `animation-duration: 1.6s`.

**3. Reveal (not under reduced motion, and only with `IntersectionObserver`).**
- `html.nq-reveal-on` is added. Targets are `document.querySelectorAll(".nq-section-head, .nq-who, .nq-app, .nq-calc, .nq-start, .nq-bundle, .nq-prices, .nq-cmp-list details, .nq-facts li, .nq-together li, .nq-check")`, in document order, not selector order (observed: 34 on the home page). Each gets class `nq-r` and inline `transition-delay` of `(index % 3) * 70` ms (observed `0ms`, `70ms`, `140ms`, `0ms`, ...).
- One `IntersectionObserver` with `threshold: 0.12`, `rootMargin: "0px 0px -6% 0px"`. When a target intersects it gets `nq-shown` and is unobserved. Classes are never removed (scrolling back up does not hide anything).
- CSS: `.nq-reveal-on .nq-r` is `opacity: 0; translateY(14px)` with a 0.6 s transition; `.nq-shown` is `opacity: 1; transform: none`. Under reduced motion none of this is set up (observed: no `nq-reveal-on`, no `nq-r`) and the CSS also forces them visible.
- Observed: a jump scroll marks only what intersects at that moment (a jump to the page end after 3000 px leaves the sections in between un-shown until they intersect).

**4. Card spotlight (not under reduced motion).** A passive `pointermove` listener on `document`: the target's `closest(".nq-app, .nq-who, .nq-calc, .nq-check, .nq-prices-row")`; on a hit it sets `--mx` and `--my` on that card to `(clientX - rect.left)px` and `(clientY - rect.top)px`. CSS reads them in a radial gradient; the defaults are `--mx: 50%; --my: 0`.

**Pages.** `compare`, `partners`, `referrals`, `startups` and `readiness` have no `.nq-map`, so they get the progress line and the reveal only. `readiness` relies on `.nq-check` being a reveal target.

**Hydration note (Svelte).** fx.js adds classes and nodes to markup the framework owns, so it must run after hydration; the pages do `loadScript` in `onMount`. The observable difference is only timing: the scenarios `waitFor` the progress line and the pulse clones.

---

## bg.js (scenarios `bg-play`, `bg-reduced`, `bg-savedata`)

An IIFE for the home page's `.hero-section`. Without `.hero-section` it does nothing.

**Hooks.** `.hero-section` (the script inserts into it and measures `clientWidth` and `clientHeight`).

**Build (always, also under reduced motion and Save-Data).**
- Inserts `div.nq-bg[aria-hidden="true"]` as the first child of `.hero-section`, containing an `svg` then a `canvas` (CSS: absolutely positioned, `pointer-events: none`, `overflow: hidden`, svg and canvas fill it).
- `svg viewBox="0 0 W H"` with `W = hero.clientWidth`, `H = hero.clientHeight`. The canvas bitmap is `W * dpr` by `H * dpr` (`dpr = devicePixelRatio || 1`), with the context scaled by `dpr`.
- Grid size `G = 48`. Up to four traces, seeds `[x fraction, y, steps]`: `[0.04, base, [[0,0],[2,0],[2,-1],[5,-1]]]`, `[0.30, base+G, [[0,0],[4,0],[4,-1],[8,-1]]]`, `[0.62, base, [[0,0],[3,0],[3,1],[7,1]]]`, `[0.86, base, [[0,0],[2,0],[2,-1],[4,-1]]]`, with `base = snap(H - 32)` and `snap(v) = round(v / G) * G`. Origin x is `snap(W * fraction)`; points are `origin + step * G`; points with `x > W`, `y > H` or `y <= 0` are dropped; a trace with fewer than two points is skipped. Each kept trace is a `polyline` (`stroke #2f8fe0`, opacity .3, width 1.5) and its end gets a `circle` (`r=3.5`, fill `#12161c`, stroke `#5eaaf0`).
- The svg also holds a `pattern#nqg` (grid) and `linearGradient#nqf` (vertical fade) and two full-size `rect`s using them. `id`s `nqg` and `nqf` are fixed.
- Observed at 1280 x 900: hero 1280 x 800, `viewBox="0 0 1280 800"`, four polylines.
- Rebuilt on `resize`, debounced 150 ms (`clearTimeout`/`setTimeout`).

**Reduced motion or Save-Data (`navigator.connection.saveData`).** Returns after the build: no pause button, no animation, no observer. Observed: no `.nq-bg-pause`, the canvas never has a painted pixel.

**Animation and control (otherwise).**
- `IntersectionObserver` on the hero sets `visible`; frames are skipped (the canvas is not cleared or drawn) while not `visible`, while `document.hidden`, or while paused.
- `requestAnimationFrame` loop. The first pulse starts when the rAF timestamp exceeds 1200 ms (timestamps count from navigation start, so a late-loaded script starts at once); a pulse picks the next trace round-robin (`idx++ % paths.length`), moves `0.16 px/ms` (a frame step is capped at 50 ms), draws a 60 px tail as 3 x 3 squares every 3 px with alpha `(1 - k/60) * 0.85`, and when it has passed its end by 60 px clears the canvas and schedules the next one 6000 ms later.
- A `button.nq-bg-pause` (`type="button"`) is appended to the hero (CSS: absolute, bottom right, 44 px minimum height). Its text is `Pause background motion` when playing and `Play background motion` when paused; `aria-pressed` is `"false"` / `"true"`. Click: flips, relabels, writes storage, then `stop()` (cancels the frame, clears the canvas, drops the pulse) or `start()`.
- **Storage:** `localStorage["nq-bg-paused"]` is `"1"` or `"0"`, written only on a click (observed: `null` until the control is used). Read once at load; any other value means playing. All storage access is in `try/catch` (works with storage blocked).
- **Persistence (observed):** pause, reload: the button comes back as `Play background motion` with `aria-pressed="true"` and the canvas stays blank.
- **Not covered by a scenario (read from code):** the off-screen and hidden-tab pause.

---

## nudge.js (scenarios `nudge-vpn`, `nudge-fleet`, `nudge-network`, `nudge-sdn`, `nudge-homeassistant`, `nudge-digitalaccess`, `nudge-central`, `nudge-keyboard`, `nudge-reduced`, `nudge-touch`)

A corner card suggesting a readiness checklist.

**Which page.** `location.pathname.split("/").pop() || "index.html"` looked up in a table; no entry means nothing happens. The table (key, title, text; the link is `readiness.html#<key>`, the body is always `See the ... checklist. Seven questions, about two minutes.`):

| Page | Key | Title | Body |
| --- | --- | --- | --- |
| `fleet.html` | `devices` | Looking at Netquor Fleet? | See the Apple device readiness checklist. |
| `vpn.html` | `network` | Looking at remote access? | See the network and remote access checklist. |
| `network.html` | `network` | Looking at routable IPs? | See the network and remote access checklist. |
| `sdn.html` | `network` | Looking at managed networking? | See the network readiness checklist. |
| `homeassistant.html` | `people` | Looking at a smarter building? | See the people and access checklist. |
| `digitalaccess.html` | `people` | Looking at building access? | See the people and access checklist. |
| `central.html` | `people` | Looking at Netquor Central? | See the people and access checklist. |

**Gates (all must hold; each is evaluated at the moment it matters).**
1. Not already dismissed this session: `sessionStorage["nq-nudge"] !== "1"`. The flag is written only on dismissal. Observed: a card that was shown and not dismissed appears again after a reload (once the other gates pass again).
2. Not reduced motion (`prefers-reduced-motion: reduce`) and a fine pointer (`(pointer: fine)`). Touch emulation (`(pointer: coarse)`) never shows it. Both are decided once at load.
3. No keyboard use: any `keydown` with `key === "Tab"` anywhere sets a flag for the rest of the page view; the card never appears after that.
4. Time: a `setTimeout` of exactly 25000 ms from script execution sets `ready`.
5. Scroll: on every `scroll` (passive), `(scrollTop + innerHeight) / scrollHeight >= 0.4` sets `scrolled` (and it stays set).
Whenever `ready` or `scrolled` is set the check runs; the card is shown once per page view (`shown`). Observed: after the timer fired, scrolling to 10% shows nothing, scrolling to 40% shows the card within a frame.

**The card.** `aside.nq-nudge[role="complementary"][aria-label="Suggested checklist"]` appended to `<body>`, children in this order: `button.nq-nudge-x[type="button"][aria-label="Close"]` (content `&times;`, the multiplication sign), `b` (title), `p` (body), `div.nq-nudge-row` containing `a.nq-nudge-go` (text `Open the checklist`, `href="readiness.html#<key>"`, a relative link as authored) and `button.nq-nudge-no[type="button"]` (text `Not now`). The class `in` is added on the next animation frame (CSS fades and slides it in, `opacity` 0 to 1 over .25 s; fixed bottom-left, 24 px, width `min(340px, 100vw - 48px)`, `z-index: 1040`). Focus is not moved to the card. Observed: computed `position: fixed`, `opacity: 1` once shown.

**Dismissal.** The close button, `Not now` and `Escape` (a `keydown` listener on `document`, only while the card is in the document) all do: `sessionStorage["nq-nudge"] = "1"` (in `try/catch`), remove `in`, and remove the element after 250 ms. Following the link does not dismiss it.

**Quirk, observed on `fleet.html`.** The Fleet page loads `nudge.js` but not `nq.css`, so the card is unstyled there (computed `position: static`) and is appended at the end of the page. The Svelte page matches. A port may style it; that would be a visible change, so decide and record it.

**Testing note.** The scenarios run with `timers: { scale: 0.02 }` (the 25 s timer runs in 500 ms) and assert that a 25000 ms timer was set. A port that changes the delay must change the assertion.

---

## analytics.js (scenarios `analytics-home`, `-vpn`, `-fleet`, `-subnet-calculator`, `-readiness`, `analytics-dnt`, `-gpc`, `-optout`)

Google Analytics 4, measurement id `G-DDM7J28WFG` (a constant at the top of the file; it must match `^G-[A-Z0-9]{6,}$` or nothing is loaded).

**Opt-outs, checked in this order, each returns before anything is created:** `navigator.globalPrivacyControl === true`; `navigator.doNotTrack === "1"` or `window.doNotTrack === "1"`; `window["ga-disable-G-DDM7J28WFG"]` truthy.

**Otherwise:** `window.dataLayer = window.dataLayer || []`; `window.gtag = function () { dataLayer.push(arguments); }`; then `gtag("js", new Date())` and `gtag("config", "G-DDM7J28WFG", { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false })`; then appends `<script async src="https://www.googletagmanager.com/gtag/js?id=G-DDM7J28WFG">` to `<head>`.

**Requests.** Exactly one request to a Google host: `GET https://www.googletagmanager.com/gtag/js?id=G-DDM7J28WFG` (the real gtag.js would then talk to `google-analytics.com`; the harness answers the first request with an empty file so nothing further happens and nothing is sent). Observed: `dataLayer` holds exactly two entries, `["js", Date]` and `["config", id, {...}]`. With any opt-out: no request, no `window.gtag`, no `dataLayer` (`[]` is what the scenarios read), no script element.

**Timing.** Runs when the script executes (`defer` on the Svelte pages, so after parsing). No storage.

---

## readiness.js (scenarios `readiness-devices`, `-calls`, `-network`, `-people`, `readiness-independent`)

Scores four checklists on `readiness.html`. Answers never leave the browser and are not stored.

**Hooks.** Each `section.nq-check[data-key]` (keys `devices`, `calls`, `network`, `people`) holds a `form` whose radios are `input[type=radio][name="<key>-<i>"]` with `value="1"` (Yes) or `value="0"` (Not yet), `i` from 0 to 6, and a `div.nq-check-result[aria-live="polite"][hidden]`. The question and answer copy is in the script's `DATA` object (title, seven `[question, gap title, gap text, link]`, `cta`, `calc`); the page markup has the same questions.

**Behavior.** A single `change` listener on each form re-renders its result box (other forms are untouched; observed).
- Nothing answered (a radio can only be unselected by a reset): the box is `hidden`.
- 1 to 6 answered: the box is shown (`hidden` removed) and contains only `<p class="nq-check-prog">N of 7 answered</p>`.
- All 7 answered: the box is cleared and rebuilt, in this order:
  1. `div.nq-check-score` with `b` `"<yes> of 7"` and `span` `"<band> (a simple count of your answers)"`. Band: yes <= 2 `Mostly manual today`; yes < 6 `Partly in place`; otherwise `In good shape` (so 3 to 5 is Partly, 6 and 7 are In good shape; observed at 2 and 3).
  2. If no gaps: `p.nq-note` `Every practice is in place. Revisit this when your team or setup changes.` Else `p.nq-note` `What to look at next:` and `ul.nq-gaps`, one `li` per "Not yet" answer in question order: `b` (gap title) and `span` (gap text plus a trailing space) and `a` `Read more` (the gap's link, relative as in the data).
  3. `div.nq-check-actions` with `a.btn.btn-primary-cyber` (`"<cta text> "`, trailing space, href from `cta`), `a.btn.btn-outline-info` (`calc` text and href) and `button.nq-linkbtn[type="button"]` `Print this result` (calls `window.print()`; observed once per click).
  4. `a.nq-who-cta` `Send us this result and we will reply with a plan`, `href="mailto:hello@netquor.com?subject=" + encodeURIComponent("Readiness result: " + title) + "&body=" + body` where `body` is `"<title>: <yes> of 7 in place.%0D%0A"` then, if there are gaps, `"Not yet: <gap titles joined by ', '>.%0D%0A"`, then `"%0D%0AMy business: "` (the body is *not* encoded further; the `%0D%0A` are written literally).
- Changing an answer re-renders from the current state. All text is set with `textContent`; no HTML is injected.
- Tabs (`nav.nq-check-tabs a[href="#key"]`) are plain anchors; the script does nothing with them (observed: the hash changes, nothing else).

**Reveal.** `fx.js` also runs on this page and treats `.nq-check` as a reveal target, so each section starts as `.nq-r` until scrolled to.

**Storage, requests, timers:** none.

---

## Bootstrap collapse accordions (scenarios `collapse-vpn`, `collapse-network`, `collapse-sdn`, `collapse-homeassistant`)

Not a Netquor script: `bootstrap.bundle.min.js` 5.3.3 from jsdelivr drives `data-bs-toggle="collapse"`. A port has to reproduce this without that file (and the page's `<script src>` to the CDN).

**Hooks.** Markup is `div#faq.accordion > .accordion-item > h3.accordion-header > button.accordion-button.collapsed[type="button"][data-bs-toggle="collapse"][data-bs-target="#<id>"]` followed by `div#<id>.accordion-collapse.collapse[data-bs-parent="#faq"] > .accordion-body`. Ids: `vpn` `v0`..`v5`, `network` `q0`..`q5`, `sdn` `f0`..`f7`, `homeassistant` `h0`..`h6`. The buttons carry no `aria-expanded` and no `aria-controls` in the markup.

**Behavior (observed).**
- Initially every panel is `display: none`, every button has `.collapsed`, and no button has `aria-expanded` (the attribute is added by Bootstrap on the first interaction).
- Click (or `Enter`, or `Space`, a native button click) on a closed panel's button: the panel gets `.collapsing` (`display: block`, height animating, 350 ms) with the button's `.collapsed` removed and `aria-expanded="true"` set immediately; at the end the panel is `.collapse.show` and `.collapsing` is gone.
- Opening a panel closes the open one in the same `#faq` (because of `data-bs-parent`): at most one panel has `.show` after the transitions; the closing button gets `.collapsed` and `aria-expanded="false"`.
- Clicking the open panel's button closes it (`.collapsed` back, `aria-expanded="false"`, `display: none` after the transition).
- Clicking every button in order leaves the last one open.
- Focus stays on the clicked button. No hash change.
- Quirk: `aria-controls` is never set, and `aria-expanded` is missing until the first use. A port should set both from the start (`aria-expanded="false"`, `aria-controls="<id>"`); it must keep the `collapsed` class semantics only if CSS still depends on it (`.accordion-button.collapsed` styles the closed arrow).
- Timing: the scenarios wait 450 to 700 ms after each click so the 350 ms transition has finished.

**Other pages that load the bundle** (`index`, `digitalaccess`, `privacy`, `terms`) have no `data-bs-toggle` elements today; the bundle is loaded for nothing there (`index` may use it for another component; confirm before dropping it).

---

## Subnet calculator: subnet-calc.js and the inline script (scenarios `subnet-v4`, `subnet-v6`)

`subnet-calc.js` is pure (also loaded by Node for tests) and sets `window.NQSubnet = { parseV4, fmtV4, calcV4, splitV4, calcV6 }`. Its maths is kept as is by the island; the inline script on the page is what a port re-implements.

**Hooks (ids).** `v4` (text input, starts as `192.168.1.0/24`, `aria-describedby="v4err"`), `v4go` (button `Calculate`), `v4err` (`aria-live="polite"`), `v4out` (`dl`, `hidden` until a result), `v4note`, `splitcard` (`hidden` when there is nothing to split), `splitto` (`select`), `splitcount`, `splitrows` (`tbody`), `splitmore`, `v6` (text input, starts as `56`, `aria-describedby="v6out"`), `v6out` (`aria-live="polite"`).

**IPv4.**
- `calc()` runs on page load, on every `input` event of `#v4`, on `Enter` keydown in `#v4`, and on click of `#v4go`. So the result updates on every keystroke.
- It clears `v4err`, `v4note` and `v4out`. On error: `v4err` gets the message, `v4out` is `hidden`, `splitcard` is `hidden`, and it returns. Otherwise `v4out` is shown and gets nine rows, each `div > dt + dd`: Network (`<network>/<prefix>`), Netmask, Wildcard, Broadcast, First host, Last host, Usable hosts (`toLocaleString("en-US")`), Total addresses (same), Type.
- Notes: `/31` gives `/31 networks have no network or broadcast address and are used for point-to-point links (RFC 3021).`, `/32` gives `A /32 is a single host address.`
- `#splitto` is emptied and refilled with options for prefixes `prefix + 1` up to `min(prefix + 8, 32)` (value `q`, text `/q`); the first option is selected (observed: editing the field resets the selection to the first option). `splitcard` is `hidden` when `prefix >= 32`. Then `split()` runs.
- `split()` (also on `change` of `#splitto`): rows of `splitV4` (at most 64), each `tr` of four `td`s `cidr`, first host, last host, usable (`en-US` grouping); `splitcount` is `"<count> subnets of <usable of first row> usable hosts each"` (count and usable grouped); `splitmore` is `Showing the first 64 of <count> subnets.` when `count > 64`, else empty.
- Messages (from `calcV4`): `That IPv4 address is not valid.` (also for octets with a leading zero, `010.0.0.0/8`), `That netmask is not valid.`, `The netmask must be contiguous, like 255.255.255.0.`, `The prefix must be a whole number from 0 to 32.` (empty or non-numeric prefix, `10.0.0.0/`), `The prefix must be between 0 and 32.` (`/33`), `Enter an address with a prefix, like 192.168.1.0/24.` (anything else, including empty).
- Accepted forms: `a.b.c.d/p`, and an address, whitespace and a dotted netmask (`10.0.0.5 255.255.255.0`). An address, a space and a plain number (`10.0.0.5 24`) is read as a netmask and fails with `That netmask is not valid.` Host bits are masked (`172.16.5.77/26` gives `172.16.5.64/26`). `Type` is one of Private (RFC 1918), Shared address space (CGNAT, RFC 6598), Link-local, Loopback, Reserved, Multicast, Public. `0.0.0.0/0` is Reserved.
- Stale text (quirk): on an error, or at `/32`, the legacy script leaves the previous split table, count and options in the *hidden* `splitcard`. Nothing visible depends on it; the scenario reads the split card only while it is visible.

**IPv6.** `v6()` runs on load and on every `input` of `#v6`: `calcV6` accepts a whole number 1 to 128 without leading zeros; `v6out` is `A /<p> holds <lans> separate /64 networks, one per LAN or VLAN.` with `lans` as an exact BigInt count with en-US grouping (`/1` gives `9,223,372,036,854,775,808`), or `A /<p> is smaller than one standard /64 LAN.` for `p > 64`, or `The IPv6 prefix must be a whole number between 1 and 128.` Quirk: `/64` reads `A /64 holds 1 separate /64 networks, one per LAN or VLAN.` (no singular form).

**Focus.** Nothing moves focus. After `Enter` in `#v4` it stays there; after the button click it is on the button (observed).

**Storage, requests, timers:** none. The addresses entered are not sent anywhere.

---

## fleet/pricing.js and fleet/site.js (scenarios `fleet-calc`, `fleet-form`)

`fleet/site.js` is an ES module (`import { compare } from "./pricing.js"`); the calculator's numbers are computed in the browser by `pricing.js` (a bundled build of `lib/pricing.ts`: despite the comment in `site.js`, nothing is fetched from a server; observed: no request other than static assets). Hooks are ids; the whole calculator exists only if `#calc` does and the form only if `#lead-form` does.

**Pricing model (the constants a port must carry).** Per device a month: Mac 595 cents, iPhone or iPad 395. Packs of 10 licenses. Annual pays 10 months for 12 (`ANNUAL_MONTHS_PAID = 10`). Volume discount on pack purchases by total packs: 1 pack 5 %, 2 packs 10 %, 5 packs 15 %, 10 packs 20 %, 25 packs 25 %. Annual and lifetime are packs only; monthly bills whole packs at list price with no discount. Lifetime is 3 times the annual license price (`LIFETIME.annual_multiple = 3`). Dedicated instance: 30000 cents setup (also charged on monthly), 30000 a year or 3000 a month hosting. Counts are floored and clamped to 0 to 100000. Rounding: `off(cents, bps)` is round-half-up on integer cents (BigInt). `compare(input)` returns annual, monthly and lifetime quotes plus `cheaper_first_year`, `annual_extra_year_one_cents`, `annual_spare_licenses`, `annual_spare_value_cents`.

**Calculator (`site.js`).**
- Inputs: `#calc-mac` and `#calc-ios` (number boxes, defaults 25 and 10), their sliders `#calc-mac-r` and `#calc-ios-r` (range 0 to 500), `#calc-dedicated` (checkbox), term buttons `#term-annual`, `#term-monthly`, `#term-lifetime` (`aria-pressed`, class `on`; annual starts selected).
- `count(el)` = `min(max(floor(Number(value)) || 0, 0), 100000)`.
- A slider `input` copies its value to the number box and schedules a refresh; a number box `input` sets the slider to `min(count, slider max)` (the number may stay above 500, observed: 800 leaves the slider at 500) and schedules a refresh. The refresh is debounced 120 ms (`clearTimeout` and `setTimeout`). The checkbox `change` refreshes immediately. A `[data-add-dedicated]` link click ticks the checkbox and refreshes (the link's own `href="#calc"` then scrolls; observed hash `#calc`).
- `refresh()` (a sequence number discards stale results): reads counts and the checkbox; unless the lead form was touched, writes the counts into the lead form's `macs` and `ios` fields; writes the term and `dedicated` (`"1"`/`"0"`) into the form's hidden fields; computes `compare({macs, ios, dedicated})` and renders. If the computation throws: `#calc-error` gets `Couldn't work out a price right now. Please try again.` .
- Term button click: sets the term, toggles `.on` and `aria-pressed` (`"true"`/`"false"`) on all three buttons, writes the term into the form, re-renders from the last quote (or refreshes when none).
- Cards (`#annual-*`, `#monthly-*`, `#lifetime-*`: `-main`, `-sub`, `-tag`): main is `money(total_year_one_cents)` (`$1,962.00` style, en-US, always two decimals); sub is `a year, about $X a month` (annual and monthly) or `paid once, nothing to renew` (lifetime), or `enter your devices` when the total is 0; the tag (`hidden` when empty) is `Lower first-year cost` on the cheaper of annual and monthly, and `Lowest over 5 years` on lifetime when its five-year cost beats annual's.
- With zero devices: all cards show `$0.00` and `enter your devices`, no tags, `#verdict` is `Enter your devices to compare the plans.`, and `#breakdown` is empty.
- `#verdict`: `Annual saves you $X in the first year.` or `Monthly costs $X less in the first year. N license(s) in your packs aren't in use yet (worth $Y); they roll over and cover the devices you add next.`, then (when lifetime wins) `Over five years, lifetime costs $A against $B on annual and $C month to month.` joined by one space.
- `#breakdown` (`ul`, `aria-live="polite"`): lines depend on the selected term (annual: packs, `Annual means 10 months' price for 12...`, spare licenses, next volume tier; monthly: the no-commitment line; both: savings against list, dedicated instance line (`+ $X a year` or `a month, on your own URL.`), year-two line; lifetime: packs, spare licenses that never expire, next tier, the 3-years line, dedicated, `Every year after`, `Over five years`). The exact strings are in `site.js` and in `fleet-calc`'s `expect`s; a port should copy them and keep the scenario.
- The two `aria-live="polite"` regions are `#verdict` and `#breakdown`; `#calc-error` has `role="status"`.

**Demo form (`#lead-form`, `novalidate`).**
- Typing in the form's `macs` or `ios` field sets `form.dataset.touched = "1"`; after that the calculator no longer mirrors into them (observed: 7 stays 7).
- `submit`: `preventDefault`; empty trimmed `name` gives `Please tell us your name.` (status class `status bad`); an email not matching `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$` gives `Please enter a valid email address.`; otherwise the submit button is disabled, `Sending...` shown (a real ellipsis character), and `window.location.href` is set to `mailto:hello@netquor.com?subject=Netquor%20Fleet%20free%20trial&body=<encoded>` where the body lines are `Name: `, `Email: `, `Company: `, `Macs: `, `iPhones and iPads: `, `Plan looked at: <term>[ + dedicated instance]`, an empty line, then the message, joined by `\n` and encoded with `encodeURIComponent`. Then `Opening your email app. If nothing opens, write to hello@netquor.com.` with class `status ok`, and the button is enabled again. Nothing is posted to `/api/lead` (despite the form's look); the honeypot field `website` is not read by this script.
- Status line: `#lead-status` (`role="status"`, `aria-live="polite"`), its class is `"status " + kind` with kind `bad`, `ok` or empty.
- Observed: exactly one navigation request, to the `mailto:` URL (`Page.frameRequestedNavigation`).

**Load order.** `site.js` is a module (deferred); `pricing.js` is imported by it. On the Svelte page `site.js` is imported from `onMount`, so the calculator is empty until hydration finishes; the scenario waits for `#annual-main` to change from its dash.

---

## Not covered by a scenario yet

- `cost-calc.js`, `bundle-calc.js` (the home page calculators and bundle estimator). They are pure modules with the islands `Calculators` and `Bundles`; their unit tests live next to them. Add a `calculators` scenario before porting them.
- The home page's other inline behavior (anything in `index.html` outside the scripts above).
- bg.js: off-screen and hidden-tab pausing; `devicePixelRatio` other than 1.
- nav.js at exactly 992 px and the effect of resizing while open.
- `nudge.js` on a page with `?` or `#` in the URL, or served from `/path/` (the lookup uses the last path segment).

## Known differences found by the harness (current Svelte pages against legacy)

| Where | Difference | Status |
| --- | --- | --- |
| `subnet-v4`, step "edit the field: the split resets to the first option" | After the user edits `#v4` (or presses Calculate) the Svelte island keeps the previously chosen split prefix; legacy rebuilds the option list and selects the first prefix. Visible: the split table keeps splitting into `/27` instead of `/<prefix + 1>`. | Allowed in the scenario with a reason. A bug in the pilot island; fix it and delete the `allow` entry (the harness prints an unused-entry note when it is fixed). |

The scenarios not listed here pass with no allowlist: `nav`, `fx`, `bg`, `nudge`, `analytics`, `readiness`, `collapse`, `fleet`, `subnet-v6`.

## Differences between the harness and a visitor

- The harness turns off CSS smooth scrolling (`html { scroll-behavior: auto !important }`) so snapshots never catch a scroll in flight. Smooth scrolling is cosmetic.
- It answers Google Analytics requests with an empty 200 and replaces `window.print` with a counter.
- Web fonts are awaited before the first snapshot; fonts are not behavior but they change box sizes.
- The legacy side is the baseline (the `legacy-baseline-2026-11` tag, extracted under `.baseline/`), served by a plain static server (`scripts/baseline/server.ts`): no price stamping, no caching headers, no `/index.html` redirect. The Svelte side is the real built server.
