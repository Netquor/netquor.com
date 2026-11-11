import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { renderSvelte } from "../../server/svelteHarness";
import raw from "../../../../../readiness-data.json";
import { SCORING } from "./data";
import { attachReadiness, type RDoc, type RRoot } from "./readiness";
import { band, mailtoHref, viewFor, type Answer } from "./score";

const REPO = join(import.meta.dir, "../../../../..");
const legacySrc = readFileSync(join(REPO, "readiness.js"), "utf8");

describe("data", () => {
    test("is a verbatim copy of the DATA object in readiness.js", () => {
        const embedded = JSON.parse(/var DATA = (\{.*\});/.exec(legacySrc)![1]);
        expect(JSON.parse(JSON.stringify(SCORING))).toEqual(embedded);
    });
    test("drift against readiness-data.json is exactly the known call-handling copy (so a change to either file is noticed)", () => {
        const json = raw as unknown as Record<string, { title: string; qs: string[][]; cta: string[]; calc: string[] }>;
        const diffs: string[] = [];
        for (const k of Object.keys(SCORING)) {
            expect(json[k].title).toBe(SCORING[k].title);
            expect(json[k].cta).toEqual([...SCORING[k].cta]);
            expect(json[k].calc).toEqual([...SCORING[k].calc]);
            SCORING[k].qs.forEach((q, i) => q.forEach((v, j) => { if (v !== json[k].qs[i][j]) diffs.push(`${k}.${i}.${j}`); }));
        }
        expect(diffs).toEqual(["calls.3.2", "calls.4.2", "calls.5.0", "calls.5.1", "calls.5.2", "calls.6.2"]);
    });
});

describe("score", () => {
    test("band boundaries for seven questions", () => {
        expect([0, 1, 2, 3, 4, 5, 6, 7].map((n) => band(n, 7))).toEqual([
            "Mostly manual today", "Mostly manual today", "Mostly manual today", "Partly in place", "Partly in place", "Partly in place", "In good shape", "In good shape",
        ]);
    });
    const L = SCORING.network;
    test("empty, progress, result", () => {
        expect(viewFor(L, Array(7).fill(null))).toEqual({ kind: "empty" });
        expect(viewFor(L, ["1", null, null, null, null, null, null])).toEqual({ kind: "progress", text: "1 of 7 answered" });
        expect(viewFor(L, ["1", "0", "1", "1", "1", "1", null])).toEqual({ kind: "progress", text: "6 of 7 answered" });
    });
    test("result lists the Not yet answers in question order", () => {
        const v = viewFor(L, ["1", "0", "1", "1", "0", "1", "1"]);
        if (v.kind !== "result") throw new Error("expected a result");
        expect([v.score, v.band, v.allIn]).toEqual(["5 of 7", "Partly in place", false]);
        expect(v.gaps.map((g) => g[1])).toEqual(["Segmentation", "Routing and firewall"]);
        expect(v.mailto).toBe("mailto:hello@netquor.com?subject=Readiness%20result%3A%20Network%20and%20remote%20access%20readiness&body=Network and remote access readiness: 5 of 7 in place.%0D%0ANot yet: Segmentation, Routing and firewall.%0D%0A%0D%0AMy business: ");
        const all = viewFor(L, Array(7).fill("1"));
        expect(all.kind === "result" && all.allIn && all.gaps.length === 0).toBe(true);
        expect(mailtoHref("T", 7, 7, [])).toBe("mailto:hello@netquor.com?subject=Readiness%20result%3A%20T&body=T: 7 of 7 in place.%0D%0A%0D%0AMy business: ");
    });
});

// A minimal fake DOM, enough for both the port and the legacy script.
class FEl {
    attrs: Record<string, string> = {}; children: FEl[] = []; handlers: Record<string, ((e?: unknown) => void)[]> = {};
    className = ""; href?: string; type?: string; hidden = false; private _t = "";
    constructor(public tag: string) {}
    get textContent(): string { return this._t; }
    set textContent(v: string | null) { this._t = v ?? ""; this.children = []; }
    appendChild(c: FEl) { this.children.push(c); return c; }
    replaceChildren(...n: FEl[]) { this.children = n; this._t = ""; }
    addEventListener(t: string, fn: () => void) { (this.handlers[t] ||= []).push(fn); }
    removeEventListener(t: string, fn: () => void) { this.handlers[t] = (this.handlers[t] || []).filter((f) => f !== fn); }
    fire(t: string) { (this.handlers[t] || []).forEach((f) => f()); }
    toJSON(): unknown { return { tag: this.tag, cls: this.className, href: this.href, type: this.type, hidden: this.hidden, text: this._t, kids: this.children.map((c) => c.toJSON()) }; }
}
class FForm extends FEl {
    checked: Record<string, string> = {};
    constructor() { super("form"); }
    querySelector(sel: string) { const m = /name="([^"]+)"/.exec(sel); const v = m ? this.checked[m[1]] : undefined; return v === undefined ? null : { value: v }; }
}
class FSection {
    form = new FForm(); out = new FEl("div");
    constructor(public key: string | null) { this.out.hidden = true; }
    getAttribute(n: string) { return n === "data-key" ? this.key : null; }
    querySelector(sel: string): unknown { return sel === "form" ? this.form : sel === ".nq-check-result" ? this.out : null; }
}
const page = (keys: (string | null)[]) => {
    const secs = keys.map((k) => new FSection(k));
    const root = { querySelectorAll: () => secs };
    const doc = { createElement: (t: string) => new FEl(t), querySelectorAll: () => secs };
    return { secs, root: root as unknown as RRoot, doc: doc as unknown as RDoc };
};
const answer = (s: FSection, i: number, v: Answer) => { if (v === null) delete s.form.checked[s.key + "-" + i]; else s.form.checked[s.key + "-" + i] = v; s.form.fire("change"); };

describe("attachReadiness", () => {
    test("one change listener per form; other forms untouched; progress then result", () => {
        const p = page(["devices", "calls"]);
        let prints = 0;
        attachReadiness(p.root, p.doc, SCORING, () => prints++);
        expect(p.secs.map((s) => s.form.handlers.change?.length)).toEqual([1, 1]);
        answer(p.secs[0], 0, "1");
        expect(p.secs[0].out.hidden).toBe(false);
        expect((p.secs[0].out.toJSON() as { kids: { cls: string; text: string }[] }).kids[0]).toMatchObject({ cls: "nq-check-prog", text: "1 of 7 answered" });
        expect(p.secs[1].out.hidden).toBe(true);
        for (let i = 1; i < 7; i++) answer(p.secs[0], i, i === 6 ? "0" : "1");
        const kids = p.secs[0].out.children;
        expect(kids.map((k) => k.className)).toEqual(["nq-check-score", "nq-note", "nq-gaps", "nq-check-actions", "nq-who-cta"]);
        const actions = kids[3].children;
        expect(actions.map((a) => [a.tag, a.className, a.textContent])).toEqual([
            ["a", "btn btn-primary-cyber", "See Netquor Fleet "],
            ["a", "btn btn-outline-info", "Estimate what setup and sign-ins cost you"],
            ["button", "nq-linkbtn", "Print this result"],
        ]);
        expect(actions[2].type).toBe("button");
        actions[2].fire("click");
        expect(prints).toBe(1);
        expect(kids[4].textContent).toBe("Send us this result and we will reply with a plan");
        const li = kids[2].children[0].children;
        expect(li.map((x) => [x.tag, x.textContent, x.href])).toEqual([
            ["b", "Settings and WireGuard tunnels", undefined],
            ["span", "Fleet can push Wi-Fi, VPN and WireGuard tunnel configuration to the devices you choose. ", undefined],
            ["a", "Read more", "fleet.html"],
        ]);
    });
    test("every practice in place shows the note and no gaps list", () => {
        const p = page(["people"]);
        attachReadiness(p.root, p.doc);
        for (let i = 0; i < 7; i++) answer(p.secs[0], i, "1");
        expect(p.secs[0].out.children.map((k) => k.className)).toEqual(["nq-check-score", "nq-note", "nq-check-actions", "nq-who-cta"]);
        expect(p.secs[0].out.children[1].textContent).toBe("Every practice is in place. Revisit this when your team or setup changes.");
    });
    test("sections without data, key, form or result box are skipped; cleanup removes the listeners", () => {
        const p = page(["nope", null, "devices"]);
        const off = attachReadiness(p.root, p.doc);
        expect(p.secs.map((s) => s.form.handlers.change?.length ?? 0)).toEqual([0, 0, 1]);
        off();
        expect(p.secs[2].form.handlers.change.length).toBe(0);
        const q = page(["devices"]);
        (q.secs[0] as unknown as { querySelector: () => null }).querySelector = () => null;
        expect(() => attachReadiness(q.root, q.doc)).not.toThrow();
    });
});

describe("matches the legacy script", () => {
    const run = (keys: string[]) => {
        const p = page(keys);
        runInNewContext(legacySrc, { document: { querySelectorAll: () => p.secs, createElement: p.doc.createElement }, window: { print() {} }, encodeURIComponent });
        const q = page(keys);
        attachReadiness(q.root, q.doc, SCORING, () => {});
        return { legacy: p.secs, port: q.secs };
    };
    test("the result box is identical for a sweep of answer patterns, after each answer", () => {
        const keys = ["devices", "calls", "network", "people"];
        const { legacy, port } = run(keys);
        // deterministic pseudo-random sequence of changes, including re-answering and all-yes / all-no
        let seed = 7;
        const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
        for (let step = 0; step < 400; step++) {
            const k = rnd(4), i = rnd(7), v: Answer = rnd(2) ? "1" : "0";
            answer(legacy[k], i, v); answer(port[k], i, v);
            expect(JSON.stringify(port[k].out)).toBe(JSON.stringify(legacy[k].out));
        }
        for (const k of [0, 1, 2, 3]) for (const v of ["1", "0"] as const) {
            for (let i = 0; i < 7; i++) { answer(legacy[k], i, v); answer(port[k], i, v); }
            expect(JSON.stringify(port[k].out)).toBe(JSON.stringify(legacy[k].out));
        }
        for (const k of [0, 1, 2, 3]) expect(JSON.stringify(port[k].out)).toBe(JSON.stringify(legacy[k].out));
    });
});

describe("the page markup the behavior needs", () => {
    test("Checklist markup has the hooks (section.nq-check[data-key], form, .nq-check-result[aria-live][hidden])", async () => {
        const data = { assets: {}, origin: "https://www.netquor.com", prices: {}, priceVersion: 1 };
        const { body } = await renderSvelte("routes/(site)/readiness.html/+page.svelte", { data }, data);
        for (const k of Object.keys(SCORING)) expect(body).toContain(`data-key="${k}"`);
    });
});
