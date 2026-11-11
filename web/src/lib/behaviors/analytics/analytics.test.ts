import { describe, expect, test } from "bun:test";
import { renderSvelte } from "../../server/svelteHarness";
import { analyticsOff, GTAG_SRC, MEASUREMENT_ID, startAnalytics, type AnalyticsWin } from "./analytics";

const doc = () => {
    const appended: { async: boolean; src: string }[] = [];
    return { appended, doc: { createElement: () => ({ async: false, src: "" }), head: { appendChild: (n: unknown) => appended.push(n as { async: boolean; src: string }) } } };
};

describe("analyticsOff", () => {
    test("runs with no signal", () => expect(analyticsOff({ navigator: {} })).toBeNull());
    test("Global Privacy Control, Do Not Track (navigator and window), and the ga-disable switch", () => {
        expect(analyticsOff({ navigator: { globalPrivacyControl: true } })).toBe("gpc");
        expect(analyticsOff({ navigator: { doNotTrack: "1" } })).toBe("dnt");
        expect(analyticsOff({ doNotTrack: "1" })).toBe("dnt");
        expect(analyticsOff({ ["ga-disable-" + MEASUREMENT_ID]: true })).toBe("optout");
    });
    test("only the exact signals count", () => {
        expect(analyticsOff({ navigator: { globalPrivacyControl: "true", doNotTrack: "0" }, doNotTrack: 1 })).toBeNull();
    });
    test("a malformed id loads nothing", () => expect(analyticsOff({}, "G-1")).toBe("bad-id"));
});

describe("startAnalytics", () => {
    test("sets up dataLayer and gtag, pushes js and config as arguments objects, appends one async script", () => {
        const win: AnalyticsWin = { navigator: {} };
        const d = doc();
        expect(startAnalytics(win, d.doc)).toEqual({ started: true, off: null });
        expect(win.dataLayer!.length).toBe(2);
        const [js, config] = win.dataLayer! as unknown as ArrayLike<unknown>[];
        expect(Object.prototype.toString.call(js)).toBe("[object Arguments]");
        expect(js[0]).toBe("js");
        expect(js[1]).toBeInstanceOf(Date);
        expect(Array.from(config as ArrayLike<unknown>)).toEqual(["config", "G-DDM7J28WFG", { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false }]);
        expect(d.appended).toEqual([{ async: true, src: "https://www.googletagmanager.com/gtag/js?id=G-DDM7J28WFG" }]);
        expect(d.appended[0].src).toBe(GTAG_SRC);
        expect(typeof win.gtag).toBe("function");
    });
    test("keeps an existing dataLayer", () => {
        const existing = ["x"];
        const win: AnalyticsWin = { dataLayer: existing };
        startAnalytics(win, doc().doc);
        expect(win.dataLayer).toBe(existing);
        expect(existing.length).toBe(3);
    });
    test("an opt-out creates nothing: no dataLayer, no gtag, no script", () => {
        const win: AnalyticsWin = { navigator: { doNotTrack: "1" } };
        const d = doc();
        expect(startAnalytics(win, d.doc)).toEqual({ started: false, off: "dnt" });
        expect(win.dataLayer).toBeUndefined();
        expect(win.gtag).toBeUndefined();
        expect(d.appended).toEqual([]);
    });
});

describe("Analytics.svelte", () => {
    test("renders nothing on the server", async () => {
        const { body, head } = await renderSvelte("lib/behaviors/analytics/Analytics.svelte", {}, {});
        expect(body.replace(/<!--.*?-->/g, "")).toBe("");
        expect(head.replace(/<!--.*?-->/g, "")).toBe("");
    });
});

describe("matches the legacy script", () => {
    test("same dataLayer entries and same script element for every signal combination", async () => {
        const { readFileSync } = await import("node:fs");
        const { join } = await import("node:path");
        const { runInNewContext } = await import("node:vm");
        const legacy = readFileSync(join(import.meta.dir, "../../../../../analytics.js"), "utf8");
        const cases: Record<string, unknown>[] = [{ navigator: {} }, { navigator: { globalPrivacyControl: true } }, { navigator: { doNotTrack: "1" } }, { navigator: {}, doNotTrack: "1" }, { navigator: {}, "ga-disable-G-DDM7J28WFG": true }, { navigator: { doNotTrack: "0" } }];
        for (const c of cases) {
            const L: { appended: { async: boolean; src: string }[]; win: Record<string, unknown> } = { appended: [], win: { ...c } };
            const win = L.win;
            runInNewContext(legacy, { window: win, navigator: win.navigator, Date, encodeURIComponent, document: { createElement: () => ({}), head: { appendChild: (n: { async: boolean; src: string }) => L.appended.push(n) } } });
            const d = doc();
            const w: AnalyticsWin = { ...c };
            startAnalytics(w, d.doc);
            const norm = (l: unknown) => JSON.parse(JSON.stringify(Array.from((l as unknown[]) ?? []).map((a) => Array.from(a as ArrayLike<unknown>))));
            expect(norm(w.dataLayer)).toEqual(norm(win.dataLayer));
            expect(d.appended).toEqual(L.appended);
            expect(typeof w.gtag).toBe(typeof win.gtag);
        }
    });
});
