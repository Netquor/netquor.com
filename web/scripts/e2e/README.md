# e2e: a real-browser behavior harness

Compares what the legacy pages DO with what the SvelteKit pages do, in a real headless Chrome, with the same steps on both. It exists so that when `nav.js`, `fx.js`, `bg.js`, `nudge.js`, `analytics.js`, `readiness.js`, the Bootstrap collapse and the Fleet scripts are ported, "the behavior is the same" is checked by a program, not by eye. `parity` compares markup and `visual` compares pixels; this compares behavior: clicks, keys, scrolling, timers, storage, requests, ARIA state.

```
bun run e2e <scenario>...        # a name, or a prefix: "nav" runs nav-desktop, nav-focus, nav-focus-order, nav-mobile
bun run e2e --all                # every scenario
bun run e2e nav --no-build       # reuse web/build (otherwise it runs `bun run build` first)
bun run e2e --list               # scenarios, their legacy path and what they cover
bun run e2e nudge-vpn --trace    # also print the legacy trace: every step's snapshot, with timings
bun run e2e fx --json            # machine-readable result at the end
CHROME=/path/to/chrome bun run e2e ...   # default: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
bun test scripts/e2e             # the harness's own tests; no browser needed
```

Exit code 1 when any scenario fails. Nothing outside temp folders is written, no remote host is contacted except the CDNs the pages themselves load (jsdelivr, Google Fonts); Google Analytics requests are never sent (see below).


## The baseline

"Legacy" in this harness means the baseline: the old hand-written site as it was at the annotated tag `legacy-baseline-2026-11`, extracted by `scripts/baseline/dir.ts` into `<repo>/.baseline/<short-sha>` (git-ignored). It does not need the old files in the working tree. `bun run baseline` prints the folder; every run of `bun run e2e` prints `baseline: <dir>`. `NQ_BASELINE_DIR` points the harness at another folder instead.

`bun run parity --all`, `bun run visual` and `bun run e2e --all` compare the current app with this baseline (HTML facts, pixels and behavior). To refresh it, create a new tag and change `TAG` in `scripts/baseline/dir.ts`; see `migration/README.md`, "The baseline".

## How a scenario runs

1. `servers.ts` starts two servers: the **legacy** site (the baseline: the repository at the `legacy-baseline-2026-11` tag, extracted under `.baseline/` by `scripts/baseline/dir.ts`, behind `serveBaseline` on a loopback port: no price stamping, nothing outside the public files, never `server/`, `web/`, `tools/` or dotfiles) and the **built SvelteKit server** started exactly as `scripts/parity/run.ts` does (seed prices, temp data folder, throwaway secret).
2. `browser.ts` launches one headless Chrome (free `--remote-debugging-port`, a `mkdtemp` profile) and gives each side a fresh page in its own browser context (own storage and cache).
3. Each side loads its page, runs `ready`, waits for the layout to stop changing, then takes a snapshot ("load"), runs step 1, snapshots, runs step 2, snapshots, and so on.
4. `diff.ts` compares the two traces step by step, applies the scenario's allowlist and prints a readable diff (`- legacy`, `+ svelte`). `expect` functions on steps assert the absolute behavior on each side separately (so a scenario also documents the behavior, and still means something after the legacy file is gone).

The Chrome profile directory is deleted on `close()`, and only after checking that it is a direct child of the OS temp dir named `nq-e2e-*` (`removeProfile`). Chrome is asked to quit, then killed after 2 s if it lingers.

## The API (`browser.ts`, `observe.ts`, `scenario.ts`)

```ts
import { launchBrowser } from "./browser";
const browser = await launchBrowser({ width: 1280, height: 900, reducedMotion: false, touch: false });
const page = browser.page;                  // the first page; browser.newPage(opts) opens another in a fresh context
await page.goto("http://127.0.0.1:4000/vpn.html");
await browser.close();
```

`launchBrowser(opts)` and `browser.newPage(opts)` take: `width`, `height` (default 1280x900), `reducedMotion` (emulates `prefers-reduced-motion: reduce`), `touch` (touch emulation, a mobile device: `(pointer: coarse)`), `allowAnalytics` (default false), `timers` (see below), `initScripts` (JavaScript run before any page script in every document), `chrome` (binary path; launch only).

Page methods:

| Method | What it does |
| --- | --- |
| `goto(url, {waitUntil?, timeoutMs?})` | Navigate and wait for `load` (or `"networkidle"`: 500 ms without requests), then for web fonts, because a font that loads late changes text widths and so every box. |
| `reload()` | Reload and wait for `load` and fonts. |
| `eval(exprOrFn)` | Evaluate in the page, await promises, return the JSON value. A function is called with no arguments (it is serialised, so it cannot close over test variables). |
| `click(selector, {scroll?, force?})` | Scroll the element to the centre, check it is really under the pointer (not covered), move, press, release. Fails with the reason when the element is missing, has no size, or is covered. |
| `clickAt(x, y)`, `clickOutside(avoidSelector?)` | Click a viewport point; or a point that is not a link, button or control and not inside `avoidSelector`. |
| `tap(selector)` | A touch tap. |
| `hover(selector)`, `moveMouse(x, y)` | Move the pointer onto an element, or to a point (to leave one). |
| `press("Escape" / "Shift+Tab" / "Enter" / "ArrowDown" / "a")` | One key, down and up, with modifiers. |
| `type(text)` | One keydown/keyup per character into the focused element. |
| `fill(selector, text)` | Click the field, select its content, type over it (`""` presses Backspace). |
| `setValue(selector, value)` | Set a value programmatically and fire `input` and `change` (range sliders, selects, which have no typing). |
| `scrollTo(y)` | Instant scroll of the window. |
| `waitFor(selector or fn, timeoutMs = 10000)` | Poll every 50 ms until the selector matches or the function is truthy. |
| `wait(ms)`, `settle()`, `waitForStableLayout()` | Sleep; two frames and until scrolling stops (every input method does this itself); until the document height stops changing. |
| `screenshot()` | PNG bytes of the viewport. |
| `consoleMessages()` | Errors and warnings from load on: `console.error/warn`, uncaught exceptions, failed resource loads (`{type, text, source}`). |
| `requests()` | Every network request made since load (`{url, method, type, status?, failed?, stubbed?}`), redirects as separate records. Also `externalRequests()` (other origins), `normalisedRequestUrls()`, `clearRequests()`. |
| `requestedNavigations()` | Navigations the page asked for, including `mailto:`. |
| `setViewport({...})`, `url()`, `close()` | |

To assert that nothing is fetched from a CDN (what the ports must achieve): `expect(page.externalRequests()).toEqual([])`, or `observe: { requests: "external" }` in a scenario, whose snapshot then lists the external URLs.

**Analytics is stubbed.** Requests to `googletagmanager.com`, `google-analytics.com`, `analytics.google.com`, `doubleclick.net` and `googleadservices.com` are recorded (`stubbed: true`) and answered with an empty 200 by a DevTools `Fetch` interception, so running the harness never sends a hit to the real property. Pass `allowAnalytics: true` only if you mean it.

**Timers.** `timers: { scale: 0.02, min: 10000 }` wraps `setTimeout`/`setInterval`: every delay of 100 ms or more is recorded in `window.__e2e.timers` (`{kind, ms}`), and delays of `min` ms or more (default 10 s) run `scale` times as long. `nudge.js` waits 25 s; the nudge scenarios run it in 500 ms and still assert that a 25000 ms timer was set. Shorter timers (the 250 ms removal) keep their real length.

**Prelude.** Every document gets `window.__e2e = { prints }`, `window.print` replaced by a counter (so "Print this result" can be asserted without a print dialog), and a style rule `html, body { scroll-behavior: auto !important }`: the pages use CSS smooth scrolling, which is still travelling when a snapshot is taken (`smoothScroll: true` keeps it).

### `observe(page, spec)`: the snapshot

```ts
const o = await observe(page, {
  selectors: [".nq-dd", ".nq-dd-btn"],     // querySelectorAll each, at most `limit` (30) kept, the real count is recorded
  attrs: ["aria-*", "id"],                 // attributes to record (trailing * is a prefix)
  classes: ["open", "nq-*"],               // true (all), false (none) or a list; svelte-xxxx hash classes are always dropped
  computed: ["display", "opacity"],        // computed style properties
  text: true, textMax: 120, box: true,     // visible text, bounding box in viewport px (rounded)
  storage: { local: ["nq-bg-paused"], session: ["nq-nudge"] },
  evals: { open: "document.querySelectorAll('.show').length" },   // named page expressions, awaited
  requests: "external",                    // "all" | "external": normalised, deduplicated, sorted URLs
  console: true,                           // error and warning messages
});
```

The result is `{ scroll, focus, elements: { [selector]: { count, items: [{tag, attrs, classes, box, computed, text, visible}] } }, storage?, evals?, requests?, console? }`. `focus` is the focused element as `tag#id.firstclass`. Normalisation (`observe.ts`, pure, tested): whitespace collapsed, boxes rounded, floats in CSS values rounded to 2 decimals, `?v=` removed from `href`/`src`, `svelte-*` classes and `data-svelte*` attributes dropped, request URLs reduced to path (own origin) or origin and path (others), font subsets from `fonts.gstatic.com` collapsed to one entry.

### A scenario (`scenarios/*.ts`)

```ts
const s: Scenario = {
  name: "nav-desktop",
  legacyPath: "/index.html", sveltePath: "/",        // sveltePath defaults to legacyPath
  viewport: { width: 1280, height: 900, reducedMotion: false, touch: false, timers: {scale: 0.02}, initScripts: [] },
  ready: (page, side) => page.waitFor(...),           // after load, before the first snapshot: wait for scripts that run after hydration
  observe: { selectors: [...], attrs: [...], ... },   // what every snapshot records
  steps: [
    { name: "click opens", run: (page, side) => page.click(".nq-dd-btn"),
      observe: { selectors: [".extra"] },             // merged over the scenario's for this step
      expect: (observed, side, page) => { /* throw to fail; runs on BOTH sides */ } },
  ],
  allow: [{ path: "click opens :: .nq-dd-btn[0].box.w", reason: "why this difference is intended" }],
  tolerance: 1, scrollTolerance: 2,                   // px of slack for boxes and for scroll
};
```

`compareScenario(scenario, world?)` runs it (`openWorld({build})` makes the servers and browser; pass one world to several scenarios to share them). Step names are unique, `load` is reserved for the first snapshot, scenario names are lower-case words joined by hyphens (`nav-desktop`), and a name selects itself and every scenario that starts with `name-`.

### Reading a diff

```
nav-desktop: FAIL (9 steps, 0 allowed differences)
  errors:
    svelte, step "click opens": expectation failed: .nq-dd should have the open class
  1 difference (- legacy, + svelte):
  click opens :: .nq-dd-btn[0].attrs.aria-expanded
    - legacy: "true"
    + svelte: "false"
```

A path is `<step> :: <selector>[<index>].<field>`: `attrs.<name>`, `classes`, `box.x|y|w|h`, `computed.<prop>`, `text`, `visible`, plus `scroll.x|y`, `focus`, `evals.<name>`, `storage.local.<key>`, `requests`, `console`, `.<selector>.count`, `<step> :: error` and `<step> :: step`. Array values also print `only legacy:` and `only svelte:`.

### The allowlist

`allow` entries are `{ path, reason }`. `path` is matched against the diff path as printed; `*` matches any run of characters (`"edit the field* :: evals.*"`, `"* :: .nq-dd-btn[0].box.w"`). A reason of at least a short sentence is required (an entry without one throws before any browser starts). An entry that matched nothing is printed as a note so the list does not collect dead entries: remove it when the difference is fixed. Allow only differences you understood and intend; an unexplained difference is a bug.

Differences found by the harness in the current Svelte pages, and allowed with a reason, are listed in `migration/behaviors.md` ("Known differences").

## Writing a scenario that is not flaky

- **Wait for the script, not for time.** A script loaded after hydration (`loadScript` in `onMount`) is not there at `load`. Put a `waitFor` on something the script creates in `ready` (`.nq-progress`, `.nq-bg-pause`, `window.bootstrap`).
- **Take the step, then let it finish.** Input methods settle for two frames and until scrolling stops. For CSS transitions (Bootstrap collapse 350 ms) add `p.wait(...)` in the step.
- **Do not observe what is not behavior.** Hidden elements can hold stale text in one implementation and none in the other (`subnet.ts` reads the split card only while it is visible). Page height and boxes depend on fonts: `goto` waits for them.
- **Scrolling is instant** (smooth scrolling is switched off, see Prelude); `settle` still waits until the scroll position stops moving.
- **Reload keeps the scroll position.** `scrollTo(0)` before `reload()` when the next step depends on scroll.
- **Do not click where a link might be.** `clickOutside(avoid)` finds a safe point.
- Test the scenario in both directions: a `expect` that passes on legacy and fails on a deliberately broken port is worth more than a diff that is empty because nothing was observed. `--trace` shows what each snapshot saw.

## Files

| File | |
| --- | --- |
| `cdp.ts` | DevTools Protocol client on Bun's WebSocket. |
| `browser.ts` | `launchBrowser`, `Browser`, `Page`: Chrome process, profile cleanup, input, waiting, requests, console, analytics stub. |
| `observe.ts` | The snapshot: in-page collector and pure normalisers. |
| `diff.ts` | Trace diff, allowlist, report formatting. Pure. |
| `scenario.ts` | Scenario types, `runSide`, `compareScenario`, `openWorld`. |
| `servers.ts` | The static baseline server (`../baseline/server.ts`) and the built-server starter. |
| `trace.ts` | `--trace` formatting. |
| `run.ts` | The CLI behind `bun run e2e`. |
| `scenarios/` | `nav`, `fx`, `bg`, `nudge`, `analytics`, `readiness`, `collapse`, `subnet`, `fleet`; `index.ts` is the registry. |
| `*.test.ts` | Tests of all of the above that need no browser (a fake DevTools socket stands in for Chrome). |

## Request audit and hydration check

```
bun run e2e:audit [--no-build]   # every page on both servers: no Bootstrap JS and no replaced script requested by a Svelte page; Google requests equal the legacy page's
bun run e2e:hydration            # Vite dev server + headless Chrome: Svelte hydration, a11y and state warnings and console errors per page
```
