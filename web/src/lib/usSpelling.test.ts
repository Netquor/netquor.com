// usSpelling.test.ts: the site's own words and code use US spelling (color, behavior, organization, center, canceled, license, catalog, math, ZIP code, while). This fails when a UK spelling comes back into what we own: the app, the server, the scripts, the docs and llms.txt. It does not scan the legacy baseline folder, and a line that must quote UK text on purpose (a baseline patch, a third-party quote) carries the marker us-spelling:allow with a reason. It lists the file and line so the fix is one edit.
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..", "..", "..");
const SCAN = ["web/src", "web/scripts", "web/migration", "server/src", "deploy", "tools", "docs", "llms.template.txt"];
const EXT = /\.(ts|svelte|css|md|txt|html|json|sh|yml|js)$/;
const SKIP_DIR = new Set(["node_modules", ".git", "build", ".svelte-kit", ".baseline", ".agents", "dist"]);
// UK-only forms. A word that is the same in both spellings (supervised, licenses as a verb) is not listed.
const UK = /\b(colour\w*|behaviour\w*|organis\w*|authoris\w*|centre\w*|cheque\w*|licences?|catalogue\w*|cancell(ed|ing)|postcode\w*|whilst|amongst|favour\w*|neighbour\w*|programmes?|analys(e|ed|es|ing)|optimis\w*|customis\w*|minimis\w*|recognis\w*|realis(e|ed|es|ing|ation)|initialis\w*|summaris\w*|personalis\w*|standardis\w*|utilis\w*|finalis\w*|prioritis\w*|synchronis\w*|metres?|litres?|fibre\w*|theatre\w*|defence|offence|labell(ed|ing)|modell(ed|ing)|travell(ed|ing|er)|enrolment|fulfil|instalments?|judgement|ageing|artefact\w*|learnt|spelt|per cent|sceptic\w*|maths|grey|honour\w*|labour|flavour\w*|apologis\w*)\b/i;
const SELF = "web/src/lib/usSpelling.test.ts";

const walk = (p: string): string[] => {
    const s = statSync(p);
    if (s.isFile()) return EXT.test(p) ? [p] : [];
    return readdirSync(p).flatMap((n) => (SKIP_DIR.has(n) ? [] : walk(join(p, n))));
};

describe("US spelling", () => {
    test("no UK spelling in the app, server, scripts, docs or llms.txt", () => {
        const hits: string[] = [];
        for (const rel of SCAN) {
            const abs = join(ROOT, rel);
            for (const file of walk(abs)) {
                const name = relative(ROOT, file);
                if (name === SELF) continue;
                readFileSync(file, "utf8").split("\n").forEach((line, i) => {
                    if (line.includes("us-spelling:allow")) return; // a line that quotes the legacy baseline on purpose
                    const m = UK.exec(line);
                    if (m) hits.push(`${name}:${i + 1}: ${m[0]}`);
                });
            }
        }
        expect(hits).toEqual([]);
    });
    test("the pattern catches the usual UK forms and leaves the US ones alone", () => {
        for (const w of ["colour", "behaviour", "organisation", "authorised", "centre", "cheque", "licence", "catalogue", "cancelled", "postcode", "whilst"]) expect(UK.test(w), w).toBe(true);
        for (const w of ["color", "behavior", "organization", "authorized", "center", "check", "license", "catalog", "canceled", "ZIP code", "while", "supervised", "centered"]) expect(UK.test(w), w).toBe(false);
    });
});
