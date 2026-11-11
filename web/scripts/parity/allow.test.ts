import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadAllow, parseAllow } from "./allow";

describe("parity-allow.json", () => {
    test("a valid file parses", () => {
        const f = parseAllow(JSON.stringify({ pages: { "x.html": { meta: [{ match: "title = A", reason: "intended rewording" }] } } }));
        expect(f.pages["x.html"].meta?.[0].match).toBe("title = A");
    });
    test("every problem is reported: missing reason, unknown category, empty match, bad shape", () => {
        const bad = JSON.stringify({ pages: { "x.html": { meta: [{ match: "a", reason: "" }, { match: "", reason: "long enough" }], nonsense: [] }, "y.html": [] } });
        expect(() => parseAllow(bad)).toThrow(/reason.*required[\s\S]*non-empty[\s\S]*unknown category "nonsense"[\s\S]*y\.html/);
    });
    test("invalid JSON and a missing pages object are errors", () => {
        expect(() => parseAllow("{")).toThrow(/not valid JSON/);
        expect(() => parseAllow("{}")).toThrow(/pages/);
    });
    test("a missing file means no allowances", () => {
        expect(loadAllow("/nonexistent/parity-allow.json")).toEqual({ pages: {} });
        const d = mkdtempSync(join(tmpdir(), "nq-allow-"));
        try { writeFileSync(join(d, "a.json"), '{"pages":{}}'); expect(loadAllow(join(d, "a.json"))).toEqual({ pages: {} }); } finally { rmSync(d, { recursive: true, force: true }); }
    });
});
