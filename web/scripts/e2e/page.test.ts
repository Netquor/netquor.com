// page.test.ts: the Page's event handling (recorded requests, console, analytics stub, dialogs, navigations) against a fake DevTools socket. No browser.
import { afterEach, describe, expect, test } from "bun:test";
import { Cdp } from "./cdp";
import { Page } from "./browser";

let server: ReturnType<typeof Bun.serve> | undefined;
let cdp: Cdp | undefined;
afterEach(() => { cdp?.close(); server?.stop(true); cdp = undefined; server = undefined; });

interface Fake { page: Page; sent: { method: string; params: any; sessionId?: string }[]; push(method: string, params: object): void }

const fake = async (opts: ConstructorParameters<typeof Page>[4] = {}): Promise<Fake> => {
    const sent: Fake["sent"] = [];
    let sock: { send(s: string): void } | undefined;
    server = Bun.serve({
        port: 0,
        hostname: "127.0.0.1",
        fetch(req, s) { return s.upgrade(req, { data: null }) ? undefined : new Response("no"); },
        websocket: {
            open(ws) { sock = ws; },
            message(ws, m) {
                const msg = JSON.parse(String(m));
                sent.push({ method: msg.method, params: msg.params, sessionId: msg.sessionId });
                ws.send(JSON.stringify({ id: msg.id, result: msg.method === "Runtime.evaluate" ? { result: { value: true } } : {} }));
            },
        },
    });
    cdp = await Cdp.connect(`ws://127.0.0.1:${server.port}`);
    const page = new Page(cdp, "S1", "T1", undefined, opts, { width: 1280, height: 900, reducedMotion: false, touch: false });
    await page.init();
    return { page, sent, push: (method, params) => sock!.send(JSON.stringify({ method, params, sessionId: "S1" })) };
};
const tick = () => new Promise((r) => setTimeout(r, 30));

describe("Page setup", () => {
    test("enables the domains, sets the viewport and the motion preference, and stubs analytics by default", async () => {
        const { sent } = await fake();
        const methods = sent.map((s) => s.method);
        for (const m of ["Page.enable", "Runtime.enable", "Network.enable", "Log.enable", "Emulation.setDeviceMetricsOverride", "Emulation.setTouchEmulationEnabled", "Emulation.setEmulatedMedia", "Fetch.enable"]) expect(methods).toContain(m);
        expect(sent.filter((s) => s.method !== "Target.activateTarget").every((s) => s.sessionId === "S1")).toBe(true);
        expect(methods).toContain("Emulation.setFocusEmulationEnabled");
        expect(sent.find((s) => s.method === "Target.activateTarget")?.params).toEqual({ targetId: "T1" });
        expect(sent.find((s) => s.method === "Emulation.setDeviceMetricsOverride")?.params).toMatchObject({ width: 1280, height: 900, mobile: false });
        expect(sent.find((s) => s.method === "Emulation.setEmulatedMedia")?.params.features[0]).toEqual({ name: "prefers-reduced-motion", value: "no-preference" });
        expect(sent.find((s) => s.method === "Fetch.enable")?.params.patterns.map((p: any) => p.urlPattern)).toContain("*googletagmanager.com*");
    });
    test("allowAnalytics leaves the network alone", async () => {
        const { sent } = await fake({ allowAnalytics: true });
        expect(sent.map((s) => s.method)).not.toContain("Fetch.enable");
    });
    test("smoothScroll: true keeps the page's own scrolling", async () => {
        const { sent } = await fake({ smoothScroll: true });
        expect(sent.find((s) => s.method === "Page.addScriptToEvaluateOnNewDocument")?.params.source).not.toContain("scroll-behavior");
    });
    test("touch and reduced motion are emulated when asked for", async () => {
        const sent: any[] = [];
        server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch(req, s) { return s.upgrade(req, { data: null }) ? undefined : new Response("no"); }, websocket: { message(ws, m) { const x = JSON.parse(String(m)); sent.push(x); ws.send(JSON.stringify({ id: x.id, result: {} })); } } });
        cdp = await Cdp.connect(`ws://127.0.0.1:${server.port}`);
        await new Page(cdp, "S", "T", undefined, {}, { width: 390, height: 844, reducedMotion: true, touch: true }).init();
        expect(sent.find((s) => s.method === "Emulation.setTouchEmulationEnabled").params).toEqual({ enabled: true, maxTouchPoints: 5 });
        expect(sent.find((s) => s.method === "Emulation.setDeviceMetricsOverride").params.mobile).toBe(true);
        expect(sent.find((s) => s.method === "Emulation.setEmulatedMedia").params.features[0].value).toBe("reduce");
    });
    test("timers and init scripts are installed before any page script", async () => {
        const { sent } = await fake({ timers: { scale: 0.02 }, initScripts: ["window.x = 1;"] });
        const sources = sent.filter((s) => s.method === "Page.addScriptToEvaluateOnNewDocument").map((s) => s.params.source as string);
        expect(sources).toHaveLength(3);
        expect(sources[0]).toContain("window.print");
        expect(sources[0]).toContain("scroll-behavior: auto");
        expect(sources[1]).toContain("e2e.timers = []");
        expect(sources[1]).toContain("d >= 10000 ? d * 0.02 : d");
        expect(sources[2]).toBe("window.x = 1;");
    });
});

describe("recorded requests", () => {
    test("requests, their status and failures", async () => {
        const { page, push } = await fake();
        push("Network.requestWillBeSent", { requestId: "1", request: { url: "https://cdn.jsdelivr.net/a.js", method: "GET" }, type: "Script" });
        push("Network.responseReceived", { requestId: "1", response: { status: 200 } });
        push("Network.loadingFinished", { requestId: "1" });
        push("Network.requestWillBeSent", { requestId: "2", request: { url: "http://x.test/b.css", method: "GET" }, type: "Stylesheet" });
        push("Network.loadingFailed", { requestId: "2", errorText: "net::ERR_FAILED" });
        await tick();
        expect(page.requests()).toEqual([
            { url: "https://cdn.jsdelivr.net/a.js", method: "GET", type: "Script", status: 200 },
            { url: "http://x.test/b.css", method: "GET", type: "Stylesheet", failed: "net::ERR_FAILED" },
        ]);
    });
    test("a redirect is two records", async () => {
        const { page, push } = await fake();
        push("Network.requestWillBeSent", { requestId: "1", request: { url: "http://x.test/index.html", method: "GET" }, type: "Document" });
        push("Network.requestWillBeSent", { requestId: "1", request: { url: "http://x.test/", method: "GET" }, type: "Document", redirectResponse: { status: 301 } });
        push("Network.responseReceived", { requestId: "1", response: { status: 200 } });
        await tick();
        expect(page.requests().map((r) => [r.url, r.status])).toEqual([["http://x.test/index.html", 301], ["http://x.test/", 200]]);
    });
    test("externalRequests and normalisedRequestUrls use the origins that were navigated to", async () => {
        const { page, push } = await fake();
        (page as any).origins.add("http://127.0.0.1:4000");
        push("Network.requestWillBeSent", { requestId: "1", request: { url: "http://127.0.0.1:4000/nq.css?v=1", method: "GET" }, type: "Stylesheet" });
        push("Network.requestWillBeSent", { requestId: "2", request: { url: "https://cdn.jsdelivr.net/x.js?y=1", method: "GET" }, type: "Script" });
        await tick();
        expect(page.externalRequests().map((r) => r.url)).toEqual(["https://cdn.jsdelivr.net/x.js?y=1"]);
        expect(page.normalisedRequestUrls()).toEqual(["/nq.css", "https://cdn.jsdelivr.net/x.js"]);
    });
    test("clearRequests empties the list", async () => {
        const { page, push } = await fake();
        push("Network.requestWillBeSent", { requestId: "1", request: { url: "http://x.test/", method: "GET" }, type: "Document" });
        await tick();
        page.clearRequests();
        expect(page.requests()).toEqual([]);
    });
    test("an analytics request is answered with an empty 200 and marked as stubbed", async () => {
        const { page, sent, push } = await fake();
        push("Network.requestWillBeSent", { requestId: "9", request: { url: "https://www.googletagmanager.com/gtag/js?id=G-1", method: "GET" }, type: "Script" });
        push("Fetch.requestPaused", { requestId: "F1", request: { url: "https://www.googletagmanager.com/gtag/js?id=G-1", method: "GET" }, resourceType: "Script" });
        await tick();
        const fulfil = sent.find((s) => s.method === "Fetch.fulfillRequest");
        expect(fulfil?.params).toMatchObject({ requestId: "F1", responseCode: 200, body: "" });
        expect(sent.map((s) => s.method)).not.toContain("Fetch.continueRequest");
        expect(page.requests()).toHaveLength(1);
        expect(page.requests()[0].stubbed).toBe(true);
    });
    test("a paused request seen only by Fetch is still recorded", async () => {
        const { page, push } = await fake();
        push("Fetch.requestPaused", { requestId: "F2", request: { url: "https://www.google-analytics.com/g/collect", method: "POST" }, resourceType: "XHR" });
        await tick();
        expect(page.requests().map((r) => [r.url, r.method, r.stubbed])).toEqual([["https://www.google-analytics.com/g/collect", "POST", true]]);
    });
});

describe("console, dialogs and navigations", () => {
    test("errors and warnings are kept, other levels are not", async () => {
        const { page, push } = await fake();
        push("Runtime.consoleAPICalled", { type: "log", args: [{ value: "hi" }] });
        push("Runtime.consoleAPICalled", { type: "error", args: [{ value: "bad" }, { description: "thing" }] });
        push("Runtime.consoleAPICalled", { type: "warning", args: [{ value: "careful" }] });
        push("Runtime.exceptionThrown", { exceptionDetails: { exception: { description: "TypeError: x" } } });
        push("Log.entryAdded", { entry: { level: "error", text: "Failed to load resource", url: "http://x.test/a.png" } });
        push("Log.entryAdded", { entry: { level: "info", text: "ignored" } });
        await tick();
        expect(page.consoleMessages()).toEqual([
            { type: "error", source: "console", text: "bad thing" },
            { type: "warning", source: "console", text: "careful" },
            { type: "error", source: "exception", text: "TypeError: x" },
            { type: "error", source: "log", text: "Failed to load resource http://x.test/a.png" },
        ]);
        page.clearConsole();
        expect(page.consoleMessages()).toEqual([]);
    });
    test("events for another session are ignored", async () => {
        const { page } = await fake();
        (cdp as any).listeners.forEach((l: (e: unknown) => void) => l({ method: "Runtime.consoleAPICalled", params: { type: "error", args: [{ value: "x" }] }, sessionId: "OTHER" }));
        expect(page.consoleMessages()).toEqual([]);
    });
    test("a javascript dialog is accepted and remembered", async () => {
        const { page, sent, push } = await fake();
        push("Page.javascriptDialogOpening", { type: "alert", message: "hello" });
        await tick();
        expect(page.dialogs).toEqual(["alert: hello"]);
        expect(sent.find((s) => s.method === "Page.handleJavaScriptDialog")?.params).toEqual({ accept: true });
    });
    test("requested navigations (mailto:) are recorded", async () => {
        const { page, push } = await fake();
        push("Page.frameRequestedNavigation", { url: "mailto:a@b.c?subject=x", reason: "scriptInitiated" });
        await tick();
        expect(page.requestedNavigations()).toEqual([{ url: "mailto:a@b.c?subject=x", reason: "scriptInitiated" }]);
        page.clearNavigations();
        expect(page.requestedNavigations()).toEqual([]);
    });
});

describe("input", () => {
    test("press sends keydown and keyup with the modifiers", async () => {
        const { page, sent } = await fake();
        sent.length = 0;
        await page.press("Shift+Tab");
        const keys = sent.filter((s) => s.method === "Input.dispatchKeyEvent");
        expect(keys.map((k) => k.params.type)).toEqual(["rawKeyDown", "keyUp"]);
        expect(keys[0].params).toMatchObject({ key: "Tab", windowsVirtualKeyCode: 9, modifiers: 8 });
    });
    test("press of Enter carries its text so the browser clicks a focused button", async () => {
        const { page, sent } = await fake();
        sent.length = 0;
        await page.press("Enter");
        expect(sent.find((s) => s.method === "Input.dispatchKeyEvent")?.params).toMatchObject({ type: "keyDown", text: "\r" });
    });
    test("type sends one keydown and one keyup per character", async () => {
        const { page, sent } = await fake();
        sent.length = 0;
        await page.type("a.1");
        const keys = sent.filter((s) => s.method === "Input.dispatchKeyEvent");
        expect(keys.map((k) => `${k.params.type}:${k.params.text ?? ""}`)).toEqual(["keyDown:a", "keyUp:", "keyDown:.", "keyUp:", "keyDown:1", "keyUp:"]);
        expect(keys[2].params.windowsVirtualKeyCode).toBe(190);
    });
    test("clickAt moves, presses and releases the left button", async () => {
        const { page, sent } = await fake();
        sent.length = 0;
        await page.clickAt(10, 20);
        const m = sent.filter((s) => s.method === "Input.dispatchMouseEvent").map((s) => [s.params.type, s.params.x, s.params.y, s.params.button]);
        expect(m).toEqual([["mouseMoved", 10, 20, undefined], ["mousePressed", 10, 20, "left"], ["mouseReleased", 10, 20, "left"]]);
        expect(page.mousePosition()).toEqual({ x: 10, y: 20 });
    });
    test("scrollTo is an instant scroll (the pages use smooth scrolling)", async () => {
        const { page, sent } = await fake();
        sent.length = 0;
        await page.scrollTo(500);
        expect(sent.find((s) => s.method === "Runtime.evaluate")?.params.expression).toContain('behavior: "instant"');
    });
});
