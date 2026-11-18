// analytics.ts: Google Analytics 4, a port of analytics.js. Same measurement id, same config, same opt-outs, same single request.
export const MEASUREMENT_ID = "G-DDM7J28WFG";
export const GTAG_SRC = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
export const GTAG_CONFIG = { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false } as const;

export type AnalyticsOff = "bad-id" | "gpc" | "dnt" | "optout";

/** The window facts the decision reads. */
export interface PrivacyEnv {
    navigator?: { globalPrivacyControl?: unknown; doNotTrack?: unknown };
    doNotTrack?: unknown;
    [key: string]: unknown;
}

/** Why nothing is loaded, or null when analytics should run. Checked in the legacy order: id shape, Global Privacy Control, Do Not Track (navigator or window), Google's own ga-disable switch. */
export const analyticsOff = (win: PrivacyEnv, id: string = MEASUREMENT_ID): AnalyticsOff | null => {
    if (!/^G-[A-Z0-9]{6,}$/.test(id)) return "bad-id";
    const nav = win.navigator || {};
    if (nav.globalPrivacyControl === true || nav.doNotTrack === "1" || win.doNotTrack === "1") return nav.globalPrivacyControl === true ? "gpc" : "dnt";
    if (win["ga-disable-" + id]) return "optout";
    return null;
};

export interface AnalyticsWin extends PrivacyEnv {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
}
export interface AnalyticsDoc {
    createElement(tag: "script"): { async: boolean; src: string };
    head: { appendChild(node: unknown): unknown };
}

/** Starts analytics unless a privacy signal says no. Returns what happened. Pushes `arguments` objects, as gtag.js requires. */
export const startAnalytics = (win: AnalyticsWin = window as unknown as AnalyticsWin, doc: AnalyticsDoc = document as unknown as AnalyticsDoc): { started: boolean; off: AnalyticsOff | null } => {
    const off = analyticsOff(win);
    if (off) return { started: false, off };
    win.dataLayer = win.dataLayer || [];
    const layer = win.dataLayer;
    function gtag(..._args: unknown[]) {
        // eslint-disable-next-line prefer-rest-params
        layer.push(arguments);
    }
    win.gtag = gtag;
    gtag("js", new Date());
    gtag("config", MEASUREMENT_ID, { ...GTAG_CONFIG });
    const s = doc.createElement("script");
    s.async = true;
    s.src = GTAG_SRC;
    doc.head.appendChild(s);
    return { started: true, off: null };
};
