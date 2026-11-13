// browser.ts: launches a headless Chrome and drives it over the DevTools Protocol. No dependencies beyond Bun. See README.md for the API.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve, sep } from "node:path";
import { join } from "node:path";
import { Cdp, type CdpEvent } from "./cdp";
import { isExternal, normaliseRequestUrl } from "./observe";

export const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PROFILE_PREFIX = "nq-e2e-";

export interface ViewportOptions { width?: number; height?: number; reducedMotion?: boolean; touch?: boolean }
/** Per-page settings; launchBrowser takes them as defaults and Browser.newPage can override each. */
export interface PageOptions extends ViewportOptions {
    /** Let requests to Google Analytics reach the network. Default false: they are recorded and answered with an empty 200, so a test run never sends a hit. */
    allowAnalytics?: boolean;
    /** Record setTimeout/setInterval delays of 100 ms or more in window.__e2e.timers, and run the ones of `min` ms or more (default 10000) `scale` times as long (0.02 turns a 25 s timer into 500 ms; shorter timers, such as a 250 ms removal, keep their real length). Default: untouched. */
    timers?: { scale: number; min?: number } | false;
    /** Keep the pages' CSS smooth scrolling (default false: the harness turns it off, see prelude). */
    smoothScroll?: boolean;
    /** Scripts to run in every document before its own scripts. */
    initScripts?: string[];
}
export interface LaunchOptions extends PageOptions {
    /** Path of the Chrome binary (default: $CHROME, else the macOS Google Chrome). */
    chrome?: string;
}
export interface RequestRecord { url: string; method: string; type: string; status?: number; failed?: string; stubbed?: boolean }
export interface ConsoleRecord { type: "error" | "warning"; text: string; source: "console" | "exception" | "log" }

// The web chat widget (our PBX host) also never reaches the network in the comparisons: its server only allows the real site origin, and the page path it reports differs between the two servers.
const ANALYTICS_PATTERNS = ["*pbx-iad-c-01.netquor.net*", "*googletagmanager.com*", "*google-analytics.com*", "*analytics.google.com*", "*doubleclick.net*", "*googleadservices.com*"];

const KEYS: Record<string, { key: string; code: string; vk: number; text?: string }> = {
    Enter: { key: "Enter", code: "Enter", vk: 13, text: "\r" },
    Tab: { key: "Tab", code: "Tab", vk: 9 },
    Escape: { key: "Escape", code: "Escape", vk: 27 },
    Space: { key: " ", code: "Space", vk: 32, text: " " },
    Backspace: { key: "Backspace", code: "Backspace", vk: 8 },
    ArrowUp: { key: "ArrowUp", code: "ArrowUp", vk: 38 },
    ArrowDown: { key: "ArrowDown", code: "ArrowDown", vk: 40 },
    ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", vk: 37 },
    ArrowRight: { key: "ArrowRight", code: "ArrowRight", vk: 39 },
    Home: { key: "Home", code: "Home", vk: 36 },
    End: { key: "End", code: "End", vk: 35 },
    PageUp: { key: "PageUp", code: "PageUp", vk: 33 },
    PageDown: { key: "PageDown", code: "PageDown", vk: 34 },
};
/** Windows virtual-key codes of the punctuation keys on a US layout (so "." is not read as the Delete key, code 46). */
const PUNCT_VK: Record<string, number> = { ".": 190, ",": 188, "/": 191, "-": 189, "=": 187, ";": 186, "'": 222, "[": 219, "]": 221, "\\": 220, "`": 192, ":": 186, "@": 50, "#": 51, "_": 189 };
const MODIFIERS: Record<string, number> = { alt: 1, control: 2, ctrl: 2, meta: 4, cmd: 4, shift: 8 };

/** "Shift+Tab" to the key definition and the modifier bitmask (pure; tested). */
export const parseKey = (spec: string): { key: string; code: string; vk: number; text?: string; modifiers: number } => {
    const parts = spec.split("+");
    const name = parts.pop() as string;
    let modifiers = 0;
    for (const m of parts) {
        const bit = MODIFIERS[m.toLowerCase()];
        if (!bit) throw new Error(`unknown modifier "${m}" in key "${spec}"`);
        modifiers |= bit;
    }
    const alnum = /^[a-z0-9]$/i.test(name);
    const def = KEYS[name] ?? (name.length === 1 ? { key: name, code: /[a-z]/i.test(name) ? `Key${name.toUpperCase()}` : /[0-9]/.test(name) ? `Digit${name}` : "", vk: alnum ? name.toUpperCase().charCodeAt(0) : PUNCT_VK[name] ?? 0, text: name } : undefined);
    if (!def) throw new Error(`unknown key "${name}" (known: ${Object.keys(KEYS).join(", ")} or one character)`);
    return { ...def, modifiers };
};

/** The profile directory may only be removed when it is exactly a directory this module created: non-empty, absolute, a direct child of the OS temp dir and named with our prefix. */
export const isOwnProfileDir = (dir: string, tmp = tmpdir()): boolean => {
    if (!dir || typeof dir !== "string") return false;
    const abs = resolve(dir), base = resolve(tmp);
    return abs === dir && dirname(abs) === base && basename(abs).startsWith(PROFILE_PREFIX) && abs.startsWith(base + sep) && abs !== base;
};

const freePort = (): number => {
    const probe = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response("") });
    const port = probe.port as number;
    probe.stop(true);
    return port;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const timerScript = (scale: number, min: number) => `(() => {
  const e2e = (window.__e2e = window.__e2e || {}); e2e.timers = []; e2e.scale = ${scale};
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
  window.setTimeout = function (fn, ms, ...rest) { const d = Number(ms) || 0; if (d >= 100) e2e.timers.push({ kind: "timeout", ms: d }); return st(fn, d >= ${min} ? d * ${scale} : d, ...rest); };
  window.setInterval = function (fn, ms, ...rest) { const d = Number(ms) || 0; if (d >= 100) e2e.timers.push({ kind: "interval", ms: d }); return si(fn, d >= ${min} ? d * ${scale} : d, ...rest); };
})();`;

/** Run in every document before its own scripts: the counters and, unless a page asks for smooth scrolling, a style rule that turns CSS smooth scrolling off. Anchor jumps and focus scrolling then land at once, so a snapshot never catches a scroll in flight (smooth scrolling is cosmetic; no script depends on it). */
const prelude = (smoothScroll: boolean) => `(() => {
  const e2e = (window.__e2e = window.__e2e || {}); e2e.prints = 0; window.print = () => { e2e.prints++; };
  ${smoothScroll ? "" : `const off = () => { const s = document.createElement("style"); s.setAttribute("data-e2e", ""); s.textContent = "html, body { scroll-behavior: auto !important; }"; (document.head || document.documentElement).appendChild(s); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", off, { once: true }); else off();`}
})();`;

export class Page {
    private reqs = new Map<string, RequestRecord>();
    private order: string[] = [];
    private consoleLog: ConsoleRecord[] = [];
    private origins = new Set<string>();
    private inflight = new Set<string>();
    private waiters: ((e: CdpEvent) => boolean)[] = [];
    private mouse = { x: 0, y: 0 };
    dialogs: string[] = [];
    private navs: { url: string; reason: string }[] = [];

    /** @internal use Browser.newPage */
    constructor(private cdp: Cdp, readonly sessionId: string, private targetId: string, private contextId: string | undefined, private opts: PageOptions, private vp: Required<ViewportOptions>) {
        cdp.on((e) => this.onEvent(e));
    }

    /** @internal */
    async init(): Promise<void> {
        const s = (m: string, p: object = {}) => this.cdp.send(m, p, this.sessionId);
        await Promise.all([s("Page.enable"), s("Runtime.enable"), s("Network.enable"), s("Log.enable")]);
        await this.applyViewport(this.vp);
        // A page in a background context can stop acknowledging input and animation frames; keep it focused and visible.
        await s("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => {});
        await this.cdp.send("Target.activateTarget", { targetId: this.targetId }).catch(() => {});
        await s("Page.addScriptToEvaluateOnNewDocument", { source: prelude(!!this.opts.smoothScroll) });
        if (this.opts.timers) await s("Page.addScriptToEvaluateOnNewDocument", { source: timerScript(this.opts.timers.scale, this.opts.timers.min ?? 10000) });
        for (const src of this.opts.initScripts ?? []) await s("Page.addScriptToEvaluateOnNewDocument", { source: src });
        if (!this.opts.allowAnalytics) await s("Fetch.enable", { patterns: ANALYTICS_PATTERNS.map((urlPattern) => ({ urlPattern, requestStage: "Request" })) });
    }

    private async applyViewport(v: Required<ViewportOptions>): Promise<void> {
        const s = (m: string, p: object = {}) => this.cdp.send(m, p, this.sessionId);
        await s("Emulation.setDeviceMetricsOverride", { width: v.width, height: v.height, deviceScaleFactor: 1, mobile: v.touch });
        await s("Emulation.setTouchEmulationEnabled", { enabled: v.touch, ...(v.touch ? { maxTouchPoints: 5 } : {}) });
        await s("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: v.reducedMotion ? "reduce" : "no-preference" }] });
    }

    async setViewport(v: ViewportOptions): Promise<void> {
        this.vp = { ...this.vp, ...v } as Required<ViewportOptions>;
        await this.applyViewport(this.vp);
    }

    private onEvent(e: CdpEvent): void {
        if (e.sessionId !== this.sessionId) return;
        const p = e.params;
        switch (e.method) {
            case "Network.requestWillBeSent": {
                const id = p.requestId as string;
                if (p.redirectResponse) { const prev = this.reqs.get(id); if (prev) prev.status = p.redirectResponse.status; }
                const key = p.redirectResponse ? `${id}#${this.order.length}` : id;
                this.reqs.set(key, { url: p.request.url, method: p.request.method, type: String(p.type ?? "Other") });
                this.order.push(key);
                this.reqs.set(`live:${id}`, this.reqs.get(key) as RequestRecord);
                this.inflight.add(id);
                break;
            }
            case "Network.responseReceived": { const r = this.reqs.get(`live:${p.requestId}`); if (r) r.status = p.response.status; break; }
            case "Network.loadingFinished": this.inflight.delete(p.requestId); break;
            case "Network.loadingFailed": { const r = this.reqs.get(`live:${p.requestId}`); if (r && !r.status) r.failed = p.errorText; this.inflight.delete(p.requestId); break; }
            case "Fetch.requestPaused": {
                // Analytics hosts: record, never forward. The script "loads" as an empty file.
                const known = this.order.some((k) => this.reqs.get(k)?.url === p.request.url);
                if (!known) { this.reqs.set(`f:${p.requestId}`, { url: p.request.url, method: p.request.method, type: String(p.resourceType ?? "Other"), stubbed: true }); this.order.push(`f:${p.requestId}`); }
                for (const k of this.order) { const r = this.reqs.get(k); if (r && r.url === p.request.url) r.stubbed = true; }
                void this.cdp.send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "text/javascript" }, { name: "Access-Control-Allow-Origin", value: "*" }], body: "" }, this.sessionId).catch(() => {});
                break;
            }
            case "Runtime.consoleAPICalled":
                if (p.type === "error" || p.type === "warning") this.consoleLog.push({ type: p.type, source: "console", text: (p.args ?? []).map((a: any) => a.value ?? a.description ?? "").join(" ") });
                break;
            case "Runtime.exceptionThrown": this.consoleLog.push({ type: "error", source: "exception", text: p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception" }); break;
            case "Log.entryAdded": if (p.entry.level === "error" || p.entry.level === "warning") this.consoleLog.push({ type: p.entry.level, source: "log", text: `${p.entry.text}${p.entry.url ? ` ${p.entry.url}` : ""}` }); break;
            case "Page.frameRequestedNavigation": this.navs.push({ url: p.url, reason: String(p.reason) }); break;
            case "Page.javascriptDialogOpening":
                this.dialogs.push(`${p.type}: ${p.message}`);
                void this.cdp.send("Page.handleJavaScriptDialog", { accept: true }, this.sessionId).catch(() => {});
                break;
        }
        this.waiters = this.waiters.filter((w) => !w(e));
    }

    private waitEvent(match: (e: CdpEvent) => boolean, ms: number, what: string): Promise<void> {
        return new Promise((res, rej) => {
            const t = setTimeout(() => { this.waiters = this.waiters.filter((w) => w !== h); rej(new Error(`timed out after ${ms} ms waiting for ${what}`)); }, ms);
            const h = (e: CdpEvent): boolean => { if (e.sessionId === this.sessionId && match(e)) { clearTimeout(t); res(); return true; } return false; };
            this.waiters.push(h);
        });
    }

    // ---- navigation ----

    /** Navigates and waits for the load event (or, with waitUntil "networkidle", for 500 ms without requests in flight). */
    async goto(url: string, o: { waitUntil?: "load" | "networkidle"; timeoutMs?: number } = {}): Promise<void> {
        this.origins.add(new URL(url).origin);
        const ms = o.timeoutMs ?? 30000;
        const loaded = this.waitEvent((e) => e.method === "Page.loadEventFired" || e.method === "Page.navigatedWithinDocument", ms, `load of ${url}`);
        loaded.catch(() => {});
        const r = await this.cdp.send("Page.navigate", { url }, this.sessionId);
        if (r.errorText) throw new Error(`could not open ${url}: ${r.errorText}`);
        await loaded;
        if (o.waitUntil === "networkidle") await this.idle(500, ms);
        await this.fontsReady();
    }

    /** Web fonts change text widths, so a snapshot taken while one is still loading differs from one taken after. goto waits for them (at most 8 s). */
    async fontsReady(): Promise<void> {
        await this.eval(`Promise.race([document.fonts ? document.fonts.ready.then(() => true) : true, new Promise((r) => setTimeout(() => r(false), 8000))])`).catch(() => {});
    }

    async reload(): Promise<void> {
        const loaded = this.waitEvent((e) => e.method === "Page.loadEventFired", 30000, "reload");
        loaded.catch(() => {});
        await this.cdp.send("Page.reload", {}, this.sessionId);
        await loaded;
        await this.fontsReady();
    }

    private async idle(quietMs: number, maxMs: number): Promise<void> {
        const end = Date.now() + maxMs;
        let quietSince = Date.now();
        while (Date.now() < end) {
            if (this.inflight.size > 0) quietSince = Date.now();
            else if (Date.now() - quietSince >= quietMs) return;
            await sleep(50);
        }
    }

    url(): Promise<string> { return this.eval<string>("location.href"); }
    ownOrigins(): string[] { return [...this.origins]; }

    // ---- evaluation and waiting ----

    /** Evaluates an expression (or a function, called with no arguments) in the page and returns its JSON value; promises are awaited. */
    async eval<T = unknown>(expr: string | (() => T | Promise<T>)): Promise<T> {
        const expression = typeof expr === "function" ? `(${expr.toString()})()` : expr;
        const r = await this.cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, this.sessionId);
        if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
        return r.result.value as T;
    }

    /** Waits until a selector matches an element, or a function/expression returns truthy. Polls every 50 ms. */
    async waitFor(what: string | (() => unknown), timeoutMs = 10000): Promise<void> {
        const expr = typeof what === "string" ? `!!document.querySelector(${JSON.stringify(what)})` : `!!(${what.toString()})()`;
        const end = Date.now() + timeoutMs;
        let last: unknown;
        while (Date.now() < end) {
            try { if (await this.eval(expr)) return; } catch (e) { last = e; }
            await sleep(50);
        }
        throw new Error(`timed out after ${timeoutMs} ms waiting for ${typeof what === "string" ? what : what.toString().slice(0, 120)}${last ? ` (${(last as Error).message})` : ""}`);
    }

    wait(ms: number): Promise<void> { return sleep(ms); }

    /** Waits until the document height has not changed for `quietMs` (default 400), so a page that finishes rendering after load (islands, late scripts) is measured in its settled state. Gives up quietly after `timeoutMs` (default 8000). */
    async waitForStableLayout(quietMs = 400, timeoutMs = 8000): Promise<void> {
        const end = Date.now() + timeoutMs;
        let last = -1, since = Date.now();
        while (Date.now() < end) {
            const h = await this.eval<number>("document.documentElement.scrollHeight");
            if (h !== last) { last = h; since = Date.now(); } else if (Date.now() - since >= quietMs) return;
            await sleep(80);
        }
    }

    /** Two animation frames so style changes made by the last input have been applied, then until the scroll position has not moved for 120 ms (the pages use smooth scrolling for anchors and focus, which is still travelling when the input call returns; at most 1.5 s). */
    async settle(): Promise<void> {
        await this.eval(`new Promise((res) => {
            let done = false; const finish = () => { if (!done) { done = true; res(true); } };
            setTimeout(finish, 1500);
            requestAnimationFrame(() => requestAnimationFrame(() => {
                let last = scrollY, since = performance.now();
                const poll = () => { if (scrollY !== last) { last = scrollY; since = performance.now(); } if (performance.now() - since >= 120) return finish(); setTimeout(poll, 30); };
                poll();
            }));
        })`);
    }

    // ---- input ----

    private async locate(selector: string, o: { scroll?: boolean; force?: boolean } = {}): Promise<{ x: number; y: number }> {
        const r = await this.eval<{ x?: number; y?: number; error?: string }>(`(() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return { error: "no element matches" };
            ${o.scroll === false ? "" : `el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });`}
            const r = el.getBoundingClientRect();
            if (!(r.width > 0 && r.height > 0)) return { error: "the element has no size (hidden?)" };
            const x = r.x + r.width / 2, y = r.y + r.height / 2;
            if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return { error: "the element is outside the viewport" };
            const hit = document.elementFromPoint(x, y);
            if (!hit || !(hit === el || el.contains(hit))) {
                ${o.force ? "" : `const d = hit ? hit.tagName.toLowerCase() + (hit.id ? "#" + hit.id : "") + (hit.className && typeof hit.className === "string" ? "." + hit.className.split(" ")[0] : "") : "nothing";
                return { error: "the element is covered by " + d };`}
            }
            return { x, y };
        })()`);
        if (r.error) throw new Error(`${selector}: ${r.error}`);
        return { x: r.x as number, y: r.y as number };
    }

    private async mouseEvent(type: "mouseMoved" | "mousePressed" | "mouseReleased", x: number, y: number, extra: object = {}): Promise<void> {
        await this.cdp.send("Input.dispatchMouseEvent", { type, x, y, ...extra }, this.sessionId);
        this.mouse = { x, y };
    }

    /** Moves the pointer to the element (scrolling it into view) and clicks it with the left button. */
    async click(selector: string, o: { scroll?: boolean; force?: boolean } = {}): Promise<void> {
        const { x, y } = await this.locate(selector, o);
        await this.mouseEvent("mouseMoved", x, y);
        await this.mouseEvent("mousePressed", x, y, { button: "left", buttons: 1, clickCount: 1 });
        await this.mouseEvent("mouseReleased", x, y, { button: "left", buttons: 0, clickCount: 1 });
        await this.settle();
    }

    /** Clicks at viewport coordinates (an "outside click"). */
    async clickAt(x: number, y: number): Promise<void> {
        await this.mouseEvent("mouseMoved", x, y);
        await this.mouseEvent("mousePressed", x, y, { button: "left", buttons: 1, clickCount: 1 });
        await this.mouseEvent("mouseReleased", x, y, { button: "left", buttons: 0, clickCount: 1 });
        await this.settle();
    }

    /** A viewport point that is safe to click: not inside a link, button or form control, and not inside `avoid`. Scans from the bottom of the viewport up. */
    async inertPoint(avoid?: string): Promise<{ x: number; y: number }> {
        const r = await this.eval<{ x: number; y: number } | null>(`(() => {
            const avoid = ${JSON.stringify(avoid ?? "")} ? document.querySelector(${JSON.stringify(avoid ?? "")}) : null;
            for (let y = innerHeight - 20; y > 90; y -= 37) for (let x = 20; x < innerWidth - 20; x += 41) {
                const el = document.elementFromPoint(x, y);
                if (el && !el.closest("a, button, input, select, textarea, label, summary, [tabindex], [role=button]") && !(avoid && avoid.contains(el))) return { x, y };
            }
            return null;
        })()`);
        if (!r) throw new Error("no inert point found in the viewport");
        return r;
    }

    /** Clicks somewhere that is not a control and not inside `avoid` (an "outside click"). */
    async clickOutside(avoid?: string): Promise<void> {
        const { x, y } = await this.inertPoint(avoid);
        await this.clickAt(x, y);
    }

    /** A touch tap at the element's centre (the page should be launched with touch: true). */
    async tap(selector: string, o: { scroll?: boolean; force?: boolean } = {}): Promise<void> {
        const { x, y } = await this.locate(selector, o);
        await this.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }, this.sessionId);
        await this.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }, this.sessionId);
        await this.settle();
    }

    /** Moves the pointer onto the element. */
    async hover(selector: string, o: { scroll?: boolean; force?: boolean } = {}): Promise<void> {
        const { x, y } = await this.locate(selector, o);
        await this.mouseEvent("mouseMoved", x, y);
        await this.settle();
    }

    /** Moves the pointer to viewport coordinates (to leave an element). */
    async moveMouse(x: number, y: number): Promise<void> {
        await this.mouseEvent("mouseMoved", x, y);
        await this.settle();
    }

    mousePosition(): { x: number; y: number } { return { ...this.mouse }; }

    /** Presses and releases a key: "Escape", "Tab", "Shift+Tab", "Enter", "ArrowDown", "a". */
    async press(spec: string): Promise<void> {
        const k = parseKey(spec);
        const base = { key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk, modifiers: k.modifiers };
        await this.cdp.send("Input.dispatchKeyEvent", { type: k.text && !(k.modifiers & ~8) ? "keyDown" : "rawKeyDown", ...base, ...(k.text && !(k.modifiers & ~8) ? { text: k.text, unmodifiedText: k.text } : {}) }, this.sessionId);
        await this.cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...base }, this.sessionId);
        await this.settle();
    }

    /** Types text into the focused element, one key at a time (keydown, input, keyup). */
    async type(text: string): Promise<void> {
        for (const ch of text) {
            const k = ch === "\n" ? parseKey("Enter") : ch === " " ? parseKey("Space") : parseKey(ch);
            await this.cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, text: k.text ?? ch, unmodifiedText: k.text ?? ch }, this.sessionId);
            await this.cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: k.key, code: k.code, windowsVirtualKeyCode: k.vk }, this.sessionId);
        }
        await this.settle();
    }

    /** Clicks the field, selects its content and types `text` over it. */
    async fill(selector: string, text: string): Promise<void> {
        await this.click(selector);
        await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); try { el.select(); } catch (e) { el.value = ""; } })()`);
        if (text === "") await this.press("Backspace");
        else await this.type(text);
    }

    /** Sets a value programmatically (range sliders, selects) and fires input and change, as a user's gesture would. */
    async setValue(selector: string, value: string): Promise<void> {
        await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw new Error("no element matches ${selector.replace(/"/g, '\\"')}"); el.focus(); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); })()`);
        await this.settle();
    }

    /** Scrolls the window to y (CSS px) and waits for the scroll handlers to run. */
    async scrollTo(y: number): Promise<void> {
        await this.eval(`window.scrollTo({ top: ${Number(y)}, left: 0, behavior: "instant" })`);
        await this.settle();
    }

    /** PNG bytes of the viewport. */
    async screenshot(): Promise<Uint8Array> {
        const r = await this.cdp.send("Page.captureScreenshot", { format: "png" }, this.sessionId);
        return Uint8Array.from(Buffer.from(r.data as string, "base64"));
    }

    // ---- recorded traffic ----

    /** Every network request made since the page was opened (or clearRequests), in order. Analytics requests carry stubbed: true. */
    requests(): RequestRecord[] { return this.order.map((k) => this.reqs.get(k) as RequestRecord); }
    clearRequests(): void { this.reqs.clear(); this.order = []; }
    /** Requests to an origin other than the page's own. */
    externalRequests(): RequestRecord[] { const own = this.ownOrigins(); return this.requests().filter((r) => isExternal(r.url, own)); }
    normalisedRequestUrls(): string[] { const own = this.ownOrigins(); return [...new Set(this.requests().map((r) => normaliseRequestUrl(r.url, own)))].sort(); }
    /** Navigations the page asked for (links, location changes, mailto: and other external schemes), in order. */
    requestedNavigations(): { url: string; reason: string }[] { return [...this.navs]; }
    clearNavigations(): void { this.navs = []; }
    /** Console errors and warnings, uncaught exceptions and failed resource loads since the page was opened. */
    consoleMessages(): ConsoleRecord[] { return [...this.consoleLog]; }
    clearConsole(): void { this.consoleLog = []; }

    async close(): Promise<void> {
        await this.cdp.send("Target.closeTarget", { targetId: this.targetId }).catch(() => {});
        if (this.contextId) await this.cdp.send("Target.disposeBrowserContext", { browserContextId: this.contextId }).catch(() => {});
    }
}

export class Browser {
    page!: Page;
    private closed = false;

    constructor(private cdp: Cdp, private proc: { kill(signal?: number | NodeJS.Signals): void; exited: Promise<number> }, private profile: string, private opts: LaunchOptions) {}

    /** A page in its own incognito-style context: its own storage, cookies and cache. */
    async newPage(o: PageOptions = {}): Promise<Page> {
        const merged: PageOptions = { ...this.opts, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) };
        const vp: Required<ViewportOptions> = { width: merged.width ?? 1280, height: merged.height ?? 900, reducedMotion: merged.reducedMotion ?? false, touch: merged.touch ?? false };
        const { browserContextId } = await this.cdp.send("Target.createBrowserContext", { disposeOnDetach: true });
        const { targetId } = await this.cdp.send("Target.createTarget", { url: "about:blank", browserContextId, width: vp.width, height: vp.height });
        const { sessionId } = await this.cdp.send("Target.attachToTarget", { targetId, flatten: true });
        const page = new Page(this.cdp, sessionId, targetId, browserContextId, merged, vp);
        await page.init();
        return page;
    }

    /** Closes Chrome and removes the temp profile directory this launch created, and nothing else. */
    async close(): Promise<void> {
        if (this.closed) return;
        this.closed = true;
        try { await this.cdp.send("Browser.close", {}, undefined, 3000); } catch { /* the socket drops as Chrome exits */ }
        this.cdp.close();
        // Chrome normally exits by itself after Browser.close; if it has not within 2 s, end it for good so it can neither linger nor write into the profile we are about to remove.
        const gone = await Promise.race([this.proc.exited.then(() => true), sleep(2000).then(() => false)]);
        if (!gone) {
            this.proc.kill("SIGKILL");
            await Promise.race([this.proc.exited, sleep(3000)]);
        }
        removeProfile(this.profile);
    }
}

/** Removes the profile directory, but only when it is verifiably the one launchBrowser made. */
export const removeProfile = (dir: string): void => {
    if (!isOwnProfileDir(dir)) throw new Error(`refusing to remove "${dir}": not a ${PROFILE_PREFIX}* directory directly under the OS temp dir`);
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
};

/** Starts headless Chrome with a remote-debugging port on a free port and a fresh temp profile, and opens the first page (browser.page). */
export const launchBrowser = async (opts: LaunchOptions = {}): Promise<Browser> => {
    const chrome = opts.chrome ?? process.env.CHROME ?? DEFAULT_CHROME;
    const profile = mkdtempSync(join(tmpdir(), PROFILE_PREFIX));
    if (!isOwnProfileDir(profile)) throw new Error(`unexpected profile directory ${profile}`);
    const port = freePort();
    const proc = Bun.spawn([chrome, "--headless=new", `--remote-debugging-port=${port}`, "--remote-debugging-address=127.0.0.1", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars", "--mute-audio", "--disable-extensions", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--force-color-profile=srgb", "--font-render-hinting=none", "--disable-features=Translate,MediaRouter", "about:blank"], { stdout: "ignore", stderr: "ignore" });
    const onExit = () => { try { proc.kill(); } catch { /* gone */ } };
    process.once("exit", onExit);
    try {
        let wsUrl = "";
        for (let i = 0; i < 200 && !wsUrl; i++) {
            try { wsUrl = ((await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()) as { webSocketDebuggerUrl: string }).webSocketDebuggerUrl; } catch { await sleep(100); }
        }
        if (!wsUrl) throw new Error(`Chrome did not start (${chrome}); set CHROME to its path`);
        const cdp = await Cdp.connect(wsUrl);
        const browser = new Browser(cdp, proc, profile, opts);
        browser.page = await browser.newPage();
        return browser;
    } catch (e) {
        onExit();
        await Promise.race([proc.exited, sleep(3000)]);
        removeProfile(profile);
        throw e;
    }
};
