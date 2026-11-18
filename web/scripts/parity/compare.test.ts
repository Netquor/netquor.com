import { describe, expect, test } from "bun:test";
import { compareFacts, diffBag, diffSeq, entryMatches, formatReport } from "./compare";
import { loadAllow } from "./allow";
import { join } from "node:path";
import { extractFacts } from "./extract";

const page = (o: { body?: string; head?: string } = {}) => `<!doctype html><html><head><title>T</title>${o.head ?? ""}</head><body>${o.body ?? ""}</body></html>`;
const facts = (o?: { body?: string; head?: string }) => extractFacts(page(o), "/p.html");
const cmp = (a: ReturnType<typeof facts>, b: ReturnType<typeof facts>, extra: Partial<Parameters<typeof compareFacts>[0]> = {}) => compareFacts({ legacy: a, svelte: b, ...extra });
const cat = (r: ReturnType<typeof compareFacts>, c: string) => r.results.find((x) => x.category === c)!;

describe("diffs", () => {
    test("diffSeq finds insertions, deletions and keeps order", () => {
        expect(diffSeq(["a", "b", "c"], ["a", "c", "d"])).toEqual([{ op: "-", item: "b" }, { op: "+", item: "d" }]);
        expect(diffSeq(["a"], ["a"])).toEqual([]);
        expect(diffSeq([], ["x"])).toEqual([{ op: "+", item: "x" }]);
        expect(diffSeq(["a", "b"], ["b", "a"]).length).toBe(2);
    });
    test("diffBag ignores order but counts repeats", () => {
        expect(diffBag(["a", "b"], ["b", "a"])).toEqual([]);
        expect(diffBag(["a", "a"], ["a"])).toEqual([{ op: "-", item: "a" }]);
    });
});

describe("compareFacts", () => {
    const same = { body: `<h1>Hi</h1><p>x <a href="/y">y</a></p><div id="calc"></div>`, head: `<meta name="description" content="d"><link rel="canonical" href="https://e.test/p.html"><script type="application/ld+json">{"a":1}</script><link rel="stylesheet" href="/nq.css?v=1"><script src="/nav.js"></script>` };
    test("identical pages pass in every category; ?v= differences are ignored", () => {
        const r = cmp(facts(same), facts({ ...same, head: same.head.replace("v=1", "v=2") }));
        expect(r.ok).toBe(true);
    });
    test("different text is reported as a readable diff", () => {
        const r = cmp(facts(same), facts({ ...same, body: same.body.replace("<h1>Hi</h1>", "<h1>Hello</h1>") }));
        expect(r.ok).toBe(false);
        expect(cat(r, "text").diffs).toEqual([{ op: "-", item: "Hi" }, { op: "+", item: "Hello" }]);
        expect(formatReport("p.html", r)).toContain("- Hi");
        expect(formatReport("p.html", r)).toContain("+ Hello");
    });
    test("link order and image sources matter", () => {
        const a = facts({ body: `<a href="/a">a</a><a href="/b">b</a><img src="/i.png">` });
        const b = facts({ body: `<a href="/b">b</a><a href="/a">a</a><img src="/j.png">` });
        expect(cat(cmp(a, b), "links").diffs.length).toBeGreaterThanOrEqual(3);
    });
    test("meta: a changed description, a missing canonical and a missing title are all found", () => {
        const r = cmp(facts(same), extractFacts(`<html><head><meta name="description" content="other"></head><body></body></html>`, "/p.html"));
        const items = cat(r, "meta").diffs.map((d) => `${d.op} ${d.item}`);
        expect(items).toContain("- name:description = d");
        expect(items).toContain("+ name:description = other");
        expect(items).toContain("- canonical = https://e.test/p.html");
        expect(items).toContain("- title = T");
    });
    test("JSON-LD is compared as parsed values: key order and spacing do not matter, a changed value does", () => {
        const a = facts({ head: `<script type="application/ld+json">{"a":1,"b":{"c":[1,2]}}</script>` });
        expect(cat(cmp(a, facts({ head: `<script type="application/ld+json">{ "b": {"c": [1, 2]}, "a": 1 }</script>` })), "jsonld").diffs).toEqual([]);
        const r = cmp(a, facts({ head: `<script type="application/ld+json">{"a":1,"b":{"c":[1,3]}}</script>` }));
        expect(cat(r, "jsonld").diffs.map((d) => d.item)).toEqual(["jsonld[0] /b/c/1: 2", "jsonld[0] /b/c/1: 3"]);
        expect(cat(cmp(a, facts()), "jsonld").diffs[0].item).toContain("block count");
    });
    test("assets: a missing script or stylesheet is reported", () => {
        const r = cmp(facts(same), facts({ ...same, head: same.head.replace('<script src="/nav.js"></script>', "") }));
        expect(cat(r, "assets").diffs).toEqual([{ op: "-", item: "script:/nav.js" }]);
    });
    test("ids: an id the legacy scripts look up must exist in the Svelte page; ids the legacy page lacks are not required", () => {
        const legacy = facts({ body: `<div id="calc"></div><script>document.getElementById("calc"); document.getElementById("ghost");</script>` });
        const missing = cmp(legacy, facts({ body: `<div></div>` }));
        expect(cat(missing, "ids").diffs.map((d) => d.item)).toEqual(["#calc (used by scripts) is missing from the Svelte page"]);
        expect(cat(cmp(legacy, facts({ body: `<div id="calc"></div>` })), "ids").diffs).toEqual([]);
    });
    test("ids found in the legacy page's external scripts count too", () => {
        const legacy = facts({ body: `<div id="out"></div>` });
        const r = cmp(legacy, facts({ body: "" }), { legacyScriptTexts: [`document.querySelector("#out")`] });
        expect(cat(r, "ids").diffs.length).toBe(1);
    });
    test("whitespace-only differences are flagged as such in the report", () => {
        const r = cmp(facts({ body: `<p>a <a href="/x">b</a> <a href="/y">c</a></p>` }), facts({ body: `<p>a <a href="/x">b</a><a href="/y">c</a></p>` }));
        expect(formatReport("p.html", r)).toContain("only in whitespace");
    });
});

describe("allowlist", () => {
    const a = facts({ body: `<h1>Old</h1>` }), b = facts({ body: `<h1>New</h1>` });
    test("an allowed difference passes and is counted; the reason travels with the entry", () => {
        const r = cmp(a, b, { allow: { text: [{ match: "Old", reason: "reworded" }, { match: "New", reason: "reworded" }] } });
        expect(r.ok).toBe(true);
        expect(cat(r, "text").allowed.length).toBe(2);
        expect(formatReport("p.html", r)).toContain("(2 allowed)");
    });
    test("an entry that does not match anything is reported as stale and does not hide other differences", () => {
        const r = cmp(a, b, { allow: { text: [{ match: "Old", reason: "reworded" }, { match: "Gone", reason: "was needed once" }] } });
        expect(r.ok).toBe(false);
        expect(r.staleAllow).toEqual([{ category: "text", match: "Gone" }]);
    });
    test("match * allows the whole category", () => {
        expect(cmp(a, b, { allow: { text: [{ match: "*", reason: "page rewritten" }] } }).ok).toBe(true);
    });
});

describe("allowlist globs", () => {
    const e = { match: "script:{/nav.js,/fx.js,https://cdn.example.com/b.min.js}", reason: "replaced by a bundled component", op: "-" as const };
    test("a brace set matches exactly its members, on the legacy side only", () => {
        expect(entryMatches(e, { op: "-", item: "script:/nav.js" })).toBe(true);
        expect(entryMatches(e, { op: "-", item: "script:https://cdn.example.com/b.min.js" })).toBe(true);
        expect(entryMatches(e, { op: "-", item: "script:/new.js" })).toBe(false);
        expect(entryMatches(e, { op: "-", item: "script:/nav.jsx" })).toBe(false);
        expect(entryMatches(e, { op: "+", item: "script:/nav.js" })).toBe(false);
    });
    test("* inside a pattern matches a run; no glob characters means exact text", () => {
        expect(entryMatches({ match: "stylesheet:/fleet/*.css", reason: "r" }, { op: "+", item: "stylesheet:/fleet/site.css" })).toBe(true);
        expect(entryMatches({ match: "script:/a.js", reason: "r" }, { op: "-", item: "script:/aXjs" })).toBe(false);
    });
    test("the assets check still fails on a new unexplained script and passes when only the replaced ones are gone", () => {
        const head = (scripts: string[]) => scripts.map((x) => `<script src="${x}"></script>`).join("");
        const legacy = facts({ head: head(["/nav.js", "/fx.js", "/other.js"]) });
        const allow = { assets: [e] };
        const ok = cmp(legacy, facts({ head: head(["/other.js"]) }), { allow });
        expect(cat(ok, "assets").diffs).toEqual([]);
        expect(cat(ok, "assets").allowed).toHaveLength(2);
        const bad = cmp(legacy, facts({ head: head(["/other.js", "/surprise.js"]) }), { allow });
        expect(cat(bad, "assets").diffs).toEqual([{ op: "+", item: "script:/surprise.js" }]);
        const lost = cmp(legacy, facts({ head: head([]) }), { allow });
        expect(cat(lost, "assets").diffs).toEqual([{ op: "-", item: "script:/other.js" }]);
    });
    test("parity-allow.json gives every migrated legacy page the replaced-script entry, with the reason", () => {
        const allow = loadAllow(join(import.meta.dir, "../../migration/parity-allow.json"));
        const pages = ["index", "compare", "central", "digitalaccess", "fleet", "homeassistant", "network", "partners", "privacy", "readiness", "referrals", "sdn", "startups", "subnet-calculator", "terms", "vpn"].map((n) => `${n}.html`);
        for (const pg of pages) {
            const entry = allow.pages[pg]?.assets?.find((x) => x.match.startsWith("script:{"));
            expect(entry?.reason).toBe("the legacy page loads a script that the Svelte page replaces with a bundled component");
            expect(entry?.op).toBe("-");
            for (const gone of ["nav.js", "fx.js", "bg.js", "nudge.js", "analytics.js", "readiness.js", "bootstrap.bundle.min.js"]) expect(entry?.match).toContain(gone);
            expect(entryMatches(entry!, { op: "-", item: "script:/nav.js" })).toBe(true);
            expect(entryMatches(entry!, { op: "-", item: "script:/cost-calc.js" })).toBe(false);
        }
    });
    test("parity-allow.json gives every migrated legacy page the bundled-stylesheet entry, which allows the legacy CSS and fonts to be gone but nothing new", () => {
        const allow = loadAllow(join(import.meta.dir, "../../migration/parity-allow.json"));
        const pages = ["index", "compare", "central", "digitalaccess", "fleet", "homeassistant", "network", "partners", "privacy", "readiness", "referrals", "sdn", "startups", "subnet-calculator", "terms", "vpn"].map((n) => `${n}.html`);
        for (const pg of pages) {
            const entry = allow.pages[pg]?.assets?.find((x) => x.match.startsWith("stylesheet:{"));
            expect(entry?.reason).toContain("bundles with Vite");
            expect(entry?.op).toBe("-");
            for (const gone of ["bootstrap.min.css", "bootstrap-icons.min.css", "devices.min.css", "/nav.css", "/nq.css", "/fleet/site.css", "family=IBM+Plex+Sans", "family=Geist"]) expect(entry?.match).toContain(gone);
            expect(entryMatches(entry!, { op: "-", item: "stylesheet:/nq.css" })).toBe(true);
            // a stylesheet the Svelte page adds, or a legacy one nobody listed, is still a difference
            expect(entryMatches(entry!, { op: "+", item: "stylesheet:/nq.css" })).toBe(false);
            expect(entryMatches(entry!, { op: "-", item: "stylesheet:https://cdn.example.com/other.css" })).toBe(false);
        }
    });
});
