import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { EMAIL, LOCAL, MAIN, PHONES, TELEPHONES, TOLL_FREE, labeled } from "./contact";

const SRC = join(import.meta.dir, "..");
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : /\.(svelte|ts)$/.test(f) && !/\.test\.ts$/.test(f) ? [p] : []; });
const all = files(SRC).map((p) => ({ p: p.replace(SRC, "src"), s: readFileSync(p, "utf8") }));

describe("contact.ts is the single source of Netquor's numbers", () => {
    test("no other source file spells a phone number or a tel: link", () => {
        const bad: string[] = [];
        for (const { p, s } of all) {
            if (p === "src/lib/contact.ts") continue;
            for (const m of s.matchAll(/717-1701|960-1701|tel:\+1\d{10}/g)) bad.push(`${p}: ${m[0]}`);
        }
        expect(bad).toEqual([]);
    });
    test("the numbers and their labels", () => {
        expect(TOLL_FREE).toEqual({ label: "Toll-free", display: "+1 (888) 717-1701", href: "tel:+18887171701", schema: "+1-888-717-1701" });
        expect(LOCAL).toEqual({ label: "Local", display: "+1 (701) 960-1701", href: "tel:+17019601701", schema: "+1-701-960-1701" });
        expect(PHONES.map((p) => p.label)).toEqual(["Toll-free", "Local"]);
        expect(labeled(TOLL_FREE)).toBe("Toll-free +1 (888) 717-1701");
        expect(TELEPHONES).toEqual(["+1-888-717-1701", "+1-701-960-1701"]);
        expect(EMAIL).toBe("hello@netquor.com");
    });
    test("every display number matches its tel link and schema form", () => {
        for (const p of PHONES) {
            const digits = p.display.replace(/\D/g, "");
            expect(p.href).toBe(`tel:+${digits}`);
            expect(p.schema).toBe(`+${digits[0]}-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`);
        }
    });
    test("the footer lists both labeled numbers; contact blocks and call buttons show only the toll-free one, unlabeled", () => {
        const uses = (rel: string) => all.find((f) => f.p === rel)!.s;
        expect(MAIN).toBe(TOLL_FREE);
        expect(uses("src/lib/components/Footer.svelte")).toContain("PHONES");
        for (const rel of ["src/lib/pages/index/Contact.svelte", "src/lib/pages/programs/ProgramPage.svelte", "src/lib/components/CallButtons.svelte"]) { expect(uses(rel)).toContain("MAIN"); expect(uses(rel)).not.toContain("PHONES"); }
        for (const rel of ["src/lib/pages/homeassistant/Contact.svelte", "src/lib/pages/central/Contact.svelte", "src/routes/(site)/vpn.html/+page.svelte", "src/routes/(site)/sdn.html/+page.svelte", "src/routes/(site)/network.html/+page.svelte"]) expect(uses(rel)).toContain("<CallButtons");
        for (const rel of ["src/lib/pages/index/data.ts", "src/lib/pages/sdn/data.ts", "src/lib/pages/fleet/seo.ts"]) expect(uses(rel)).toContain("TELEPHONES");
    });
    test("the texts that live outside the app mention both numbers", () => {
        const root = join(SRC, "..", "..");
        const llms = readFileSync(join(root, "llms.template.txt"), "utf8");
        expect(llms).toContain(`toll-free ${TOLL_FREE.display}`);
        expect(llms).toContain(`local ${LOCAL.display}`);
        const holding = readFileSync(join(root, "deploy", "edge", "holding", "index.html"), "utf8");
        expect(holding).toContain(`Toll-free ${TOLL_FREE.display}`);
        expect(holding).toContain(`Local ${LOCAL.display}`);
    });
});
