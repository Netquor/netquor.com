import { describe, expect, test } from "bun:test";
import { buildFacts, plain } from "./build-agent-facts.ts";

describe("build-agent-facts", () => {
  test("plain resolves seed price tokens, strips tags and entities", () => {
    expect(plain("From {{fleet.mac.month}}<i>/Mac/mo</i><br>a &amp; b")).toBe("From $5.95/Mac/mo a & b");
    expect(() => plain("{{no.such.key}}")).toThrow(/no.such.key/);
  });
  test("facts keep the output shape and carry no unresolved token or tag", () => {
    const f = buildFacts();
    expect(Object.keys(f)).toEqual(["generated_from", "company", "social", "products", "price_table_text", "rules"]);
    expect(f.products.length).toBe(9);
    expect(f.products[0]).toEqual({ name: "Netquor Phone", status: "Early access", fixes: expect.any(String), description: expect.any(String), price_note: "Planned launch price from $25/mo. Early access, not billed yet", features: expect.any(Array), url: "https://phone.netquor.com/start/" });
    expect(f.social.map((s) => s.network)).toEqual(["Facebook", "X", "LinkedIn", "GitHub"]);
    expect(JSON.stringify(f)).not.toMatch(/\{\{|<[a-z]/);
  });
});
