import { describe, expect, test } from "bun:test";
import { renderSvelte } from "../../server/svelteHarness";
import { NUDGES, nudgeFor, pageOf, readyToShow, scrollRatio } from "./gates";
import { buildCard, startNudge, type NodeLike, type NudgeDoc, type NudgeWin } from "./nudge";

describe("gates", () => {
    test("the table: seven pages, link keys and copy as in nudge.js", () => {
        expect(Object.keys(NUDGES)).toEqual(["fleet.html", "vpn.html", "network.html", "sdn.html", "homeassistant.html", "digitalaccess.html", "central.html"]);
        expect(NUDGES["fleet.html"]).toEqual({ key: "devices", title: "Looking at Netquor Fleet?", body: "See the Apple device readiness checklist. Seven questions, about two minutes." });
        expect(NUDGES["sdn.html"].body).toBe("See the network readiness checklist. Seven questions, about two minutes.");
        expect(NUDGES["vpn.html"].body).toBe("See the network and remote access checklist. Seven questions, about two minutes.");
        expect(NUDGES["central.html"].key).toBe("people");
    });
    test("pageOf and nudgeFor", () => {
        expect(pageOf("/vpn.html")).toBe("vpn.html");
        expect(pageOf("/")).toBe("index.html");
        expect(pageOf("")).toBe("index.html");
        expect(nudgeFor("/network.html")?.title).toBe("Looking at routable IPs?");
        expect(nudgeFor("vpn.html")?.key).toBe("network");
        expect(nudgeFor("index.html")).toBeNull();
        expect(nudgeFor("/")).toBeNull();
        expect(nudgeFor("constructor")).toBeNull();
        expect(nudgeFor("toString")).toBeNull();
    });
    test("readyToShow needs the timer and the scroll, and no Tab, and shows once", () => {
        const base = { keyboard: false, ready: true, scrolled: true, shown: false };
        expect(readyToShow(base)).toBe(true);
        expect(readyToShow({ ...base, ready: false })).toBe(false);
        expect(readyToShow({ ...base, scrolled: false })).toBe(false);
        expect(readyToShow({ ...base, keyboard: true })).toBe(false);
        expect(readyToShow({ ...base, shown: true })).toBe(false);
    });
    test("scrollRatio", () => {
        expect(scrollRatio(0, 400, 1000)).toBe(0.4);
        expect(scrollRatio(100, 400, 1000)).toBe(0.5);
    });
});

class FakeNode implements NodeLike {
    className = ""; textContent: string | null = null; href?: string; type?: string;
    attrs: Record<string, string> = {}; children: FakeNode[] = []; classes = new Set<string>(); handlers: Record<string, () => void> = {}; removed = false;
    constructor(public tag: string) {}
    classList = { add: (c: string) => { this.classes.add(c); }, remove: (c: string) => { this.classes.delete(c); } };
    setAttribute(k: string, v: string) { this.attrs[k] = v; }
    appendChild(c: FakeNode) { this.children.push(c); }
    addEventListener(t: string, fn: () => void) { this.handlers[t] = fn; }
    remove() { this.removed = true; }
}

const env = (opts: { reduce?: boolean; fine?: boolean; stored?: string | null; throwStorage?: boolean } = {}) => {
    const { reduce = false, fine = true } = opts;
    const timers: { fn: () => void; ms: number; id: number; live: boolean }[] = [];
    const winL: Record<string, { fn: (e: { key: string }) => void; opts?: { passive: boolean } }[]> = {};
    const docL: Record<string, ((e: { key: string }) => void)[]> = {};
    const frames: (() => void)[] = [];
    const store: Record<string, string> = opts.stored ? { "nq-nudge": opts.stored } : {};
    const appended: FakeNode[] = [];
    const docEl = { scrollTop: 0, scrollHeight: 2000 };
    const doc: NudgeDoc = {
        createElement: (t) => new FakeNode(t),
        body: { appendChild: (n) => appended.push(n as FakeNode), contains: (n) => appended.includes(n as FakeNode) && !(n as FakeNode).removed },
        documentElement: docEl,
        addEventListener: (t, fn) => { (docL[t] ||= []).push(fn); },
        removeEventListener: (t, fn) => { docL[t] = (docL[t] || []).filter((f) => f !== fn); },
    };
    const win: NudgeWin = {
        innerHeight: 800,
        addEventListener: (t, fn, o) => { (winL[t] ||= []).push({ fn, opts: o }); },
        removeEventListener: (t, fn) => { winL[t] = (winL[t] || []).filter((l) => l.fn !== fn); },
        matchMedia: (q) => ({ matches: q.includes("reduced-motion") ? reduce : q.includes("fine") ? fine : false }),
        requestAnimationFrame: (cb) => frames.push(cb),
        cancelAnimationFrame: () => {},
        setTimeout: (fn, ms) => { const t = { fn, ms, id: timers.length + 1, live: true }; timers.push(t); return t.id; },
        clearTimeout: (id) => { const t = timers.find((x) => x.id === id); if (t) t.live = false; },
        sessionStorage: {
            getItem: (k) => { if (opts.throwStorage) throw new Error("blocked"); return store[k] ?? null; },
            setItem: (k, v) => { if (opts.throwStorage) throw new Error("blocked"); store[k] = v; },
        },
    };
    const fire = (ms: number) => timers.filter((t) => t.live && t.ms === ms).forEach((t) => { t.live = false; t.fn(); });
    const scrollTo = (top: number) => { docEl.scrollTop = top; (winL.scroll || []).forEach((l) => l.fn({ key: "" })); };
    return { doc, win, timers, winL, docL, frames, store, appended, fire, scrollTo };
};

describe("buildCard", () => {
    test("structure, attributes and text as in nudge.js", () => {
        const e = env();
        const { box, dismissers } = buildCard(e.doc, NUDGES["vpn.html"]) as { box: FakeNode; dismissers: FakeNode[] };
        expect([box.tag, box.className, box.attrs.role, box.attrs["aria-label"]]).toEqual(["aside", "nq-nudge", "complementary", "Suggested checklist"]);
        expect(box.children.map((c) => c.tag)).toEqual(["button", "b", "p", "div"]);
        const [x, t, p, row] = box.children;
        expect([x.className, x.type, x.attrs["aria-label"], x.textContent]).toEqual(["nq-nudge-x", "button", "Close", "×"]);
        expect(t.textContent).toBe("Looking at remote access?");
        expect(p.textContent).toBe("See the network and remote access checklist. Seven questions, about two minutes.");
        expect(row.className).toBe("nq-nudge-row");
        const [go, no] = row.children;
        expect([go.tag, go.className, go.href, go.textContent]).toEqual(["a", "nq-nudge-go", "readiness.html#network", "Open the checklist"]);
        expect([no.className, no.type, no.textContent]).toEqual(["nq-nudge-no", "button", "Not now"]);
        expect(dismissers).toEqual([no, x]);
    });
});

describe("startNudge", () => {
    test("a page without an entry does nothing: no timers, no listeners", () => {
        const e = env();
        startNudge("index.html", e.doc, e.win);
        expect(e.timers.length).toBe(0);
        expect(Object.keys(e.winL).length).toBe(0);
    });
    test("shows after the 25000 ms timer and 40% scroll, then fades in on the next frame, appended to body", () => {
        const e = env();
        startNudge("vpn.html", e.doc, e.win);
        expect(e.timers[0].ms).toBe(25000);
        expect(e.winL.scroll[0].opts).toEqual({ passive: true });
        e.doc.documentElement.scrollHeight = 3000;
        e.scrollTo(399);
        expect(e.appended.length).toBe(0);
        e.fire(25000);
        expect(e.appended.length).toBe(0);
        e.scrollTo(0);
        expect(e.appended.length).toBe(0);
        e.scrollTo(400);
        expect(e.appended.length).toBe(1);
        expect(e.appended[0].classes.has("in")).toBe(false);
        e.frames[0]();
        expect(e.appended[0].classes.has("in")).toBe(true);
        e.scrollTo(1200);
        expect(e.appended.length).toBe(1);
    });
    test("scroll first, timer second works too", () => {
        const e = env();
        startNudge("fleet.html", e.doc, e.win);
        e.scrollTo(1200);
        expect(e.appended.length).toBe(0);
        e.fire(25000);
        expect(e.appended.length).toBe(1);
    });
    test("a Tab key anywhere blocks it for the page view; other keys do not", () => {
        const e = env();
        startNudge("vpn.html", e.doc, e.win);
        e.winL.keydown[0].fn({ key: "a" });
        e.winL.keydown[0].fn({ key: "Tab" });
        e.fire(25000); e.scrollTo(1200);
        expect(e.appended.length).toBe(0);
    });
    test("reduced motion and a coarse pointer never show it", () => {
        for (const o of [{ reduce: true }, { fine: false }]) {
            const e = env(o);
            startNudge("vpn.html", e.doc, e.win);
            expect(e.timers.length).toBe(0);
            expect(Object.keys(e.winL).length).toBe(0);
        }
    });
    test("a dismissal from this session blocks it; a blocked storage does not", () => {
        const a = env({ stored: "1" });
        startNudge("vpn.html", a.doc, a.win);
        expect(a.timers.length).toBe(0);
        const b = env({ stored: "0" });
        startNudge("vpn.html", b.doc, b.win);
        expect(b.timers.length).toBe(1);
        const c = env({ throwStorage: true });
        startNudge("vpn.html", c.doc, c.win);
        expect(c.timers.length).toBe(1);
    });
    const shown = () => { const e = env(); const off = startNudge("sdn.html", e.doc, e.win); e.fire(25000); e.scrollTo(1500); e.frames[0](); return { e, off, card: e.appended[0] }; };
    test("Not now and the close button dismiss: flag stored, in removed, element removed after 250 ms", () => {
        for (const idx of [1, 0]) {
            const { e, card } = shown();
            const target = idx === 1 ? card.children[3].children[1] : card.children[0];
            target.handlers.click();
            expect(e.store["nq-nudge"]).toBe("1");
            expect(card.classes.has("in")).toBe(false);
            expect(card.removed).toBe(false);
            e.fire(250);
            expect(card.removed).toBe(true);
        }
    });
    test("Escape dismisses while the card is in the document, other keys do not, and it never comes back", () => {
        const { e, card } = shown();
        e.docL.keydown[0]({ key: "Enter" });
        expect(e.store["nq-nudge"]).toBeUndefined();
        e.docL.keydown[0]({ key: "Escape" });
        expect(e.store["nq-nudge"]).toBe("1");
        e.fire(250);
        e.docL.keydown[0]({ key: "Escape" });
        expect(e.timers.filter((t) => t.ms === 250).length).toBe(1);
        e.scrollTo(1800);
        expect(e.appended.length).toBe(1);
        expect(card.removed).toBe(true);
    });
    test("dismissal still works when storage is blocked", () => {
        const e = env({ throwStorage: true });
        startNudge("vpn.html", e.doc, e.win);
        e.fire(25000); e.scrollTo(1500);
        e.appended[0].children[0].handlers.click();
        e.fire(250);
        expect(e.appended[0].removed).toBe(true);
    });
    test("cleanup clears the timer, the listeners and the card", () => {
        const { e, off, card } = shown();
        off();
        expect(e.winL.keydown.length + e.winL.scroll.length + e.docL.keydown.length).toBe(0);
        expect(card.removed).toBe(true);
        const f = env();
        const off2 = startNudge("vpn.html", f.doc, f.win);
        off2();
        expect(f.timers[0].live).toBe(false);
    });
});

describe("Nudge.svelte", () => {
    test("renders nothing on the server", async () => {
        const { body } = await renderSvelte("lib/behaviors/nudge/Nudge.svelte", { page: "vpn.html" }, {});
        expect(body.replace(/<!--.*?-->/g, "")).toBe("");
    });
});
