// lead/validate.test.ts: what a lead may contain.
import { describe, expect, test } from "bun:test";
import { honeypotFilled, parseForm, validateLead } from "./validate";

const ok = { name: "Ada", email: "ada@example.com" };
const err = (input: Record<string, unknown>) => { const r = validateLead(input); return r.ok ? null : r.error; };

describe("required fields", () => {
    test("name and email are required, whitespace does not count", () => {
        expect(err({})).toBe("missing_name");
        expect(err({ name: "   ", email: "a@b.co" })).toBe("missing_name");
        expect(err({ name: "Ada" })).toBe("missing_email");
        expect(err({ name: "Ada", email: " " })).toBe("missing_email");
    });
    test("the rest default to empty and zero", () => {
        expect(validateLead(ok)).toEqual({ ok: true, value: { name: "Ada", email: "ada@example.com", company: "", macs: 0, ios: 0, message: "", term: "", source: "" } });
    });
    test("values are trimmed", () => {
        const r = validateLead({ name: "  Ada  ", email: " ada@example.com " });
        expect(r).toMatchObject({ ok: true, value: { name: "Ada", email: "ada@example.com" } });
    });
});

describe("email", () => {
    test.each(["plain", "a@b", "@b.co", "a@.co", "a b@c.co", "a@b..co", "a@b.co>", "<a@b.co>", "a@-b.co", "a@b.co\nBcc: x@y.z", "a,b@c.co", "a@b@c.co"])("%j is refused", (e) => {
        expect(err({ ...ok, email: e })).toBe("invalid_email");
    });
    test("a long local part is refused, a normal address with a plus tag is fine", () => {
        expect(err({ ...ok, email: `${"a".repeat(65)}@example.com` })).toBe("invalid_email");
        expect(validateLead({ ...ok, email: "ada+fleet@mail.example.co.uk" }).ok).toBe(true);
    });
    test("254 characters pass and 255 do not", () => {
        const at = (n: number) => `${"a".repeat(60)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.${"e".repeat(n - 253)}`;
        expect(at(254).length).toBe(254);
        expect(validateLead({ ...ok, email: at(254) }).ok).toBe(true);
        expect(err({ ...ok, email: at(255) })).toBe("invalid_email");
    });
});

describe("lengths", () => {
    test("exactly the limit passes, one more is refused (never cut)", () => {
        expect(validateLead({ ...ok, name: "n".repeat(100), company: "c".repeat(120), message: "m".repeat(2000) }).ok).toBe(true);
        expect(err({ ...ok, name: "n".repeat(101) })).toBe("invalid_name");
        expect(err({ ...ok, company: "c".repeat(121) })).toBe("invalid_company");
        expect(err({ ...ok, message: "m".repeat(2001) })).toBe("invalid_message");
    });
    test("control characters are refused, a message may have line breaks", () => {
        expect(err({ ...ok, name: "Ada\nLovelace" })).toBe("invalid_name");
        expect(err({ ...ok, company: "A\u0000B" })).toBe("invalid_company");
        expect(err({ ...ok, message: "a\u0007b" })).toBe("invalid_message");
        expect(validateLead({ ...ok, message: "line one\r\nline two\tend" }).ok).toBe(true);
    });
});

describe("counts", () => {
    test("whole numbers 0..100000, as numbers or digit strings", () => {
        expect(validateLead({ ...ok, macs: 0, ios: 100000 })).toMatchObject({ ok: true, value: { macs: 0, ios: 100000 } });
        expect(validateLead({ ...ok, macs: "42", ios: " 7 " })).toMatchObject({ ok: true, value: { macs: 42, ios: 7 } });
        expect(validateLead({ ...ok, macs: "" })).toMatchObject({ ok: true, value: { macs: 0 } });
    });
    test.each([[1.5], [-1], [100001], ["1.5"], ["-3"], ["1e3"], ["12abc"], ["0x10"], [NaN], [Infinity], [true], [[]], [{}], ["1000000"]])("%p is refused", (v) => {
        expect(err({ ...ok, macs: v })).toBe("invalid_macs");
        expect(err({ ...ok, ios: v })).toBe("invalid_ios");
    });
});

describe("types and unknown fields", () => {
    test("a text field that is not text is refused", () => {
        expect(err({ ...ok, name: 5 })).toBe("invalid_name");
        expect(err({ ...ok, email: ["a@b.co"] })).toBe("invalid_email");
        expect(err({ ...ok, company: { x: 1 } })).toBe("invalid_company");
    });
    test("unknown fields are ignored and never part of the result", () => {
        const r = validateLead({ ...ok, dedicated: "0", admin: true, __proto__: { x: 1 }, constructor: "x" });
        expect(r.ok && Object.keys(r.value).sort()).toEqual(["company", "email", "ios", "macs", "message", "name", "source", "term"]);
    });
    test("term and source are short and plain", () => {
        expect(err({ ...ok, term: "annual plan" })).toBe("invalid_term");
        expect(err({ ...ok, term: "a".repeat(21) })).toBe("invalid_term");
        expect(err({ ...ok, source: "<script>" })).toBe("invalid_source");
        expect(validateLead({ ...ok, term: "annual", source: "home-hero" })).toMatchObject({ ok: true, value: { term: "annual", source: "home-hero" } });
    });
});

describe("helpers", () => {
    test("honeypot: only empty or blank is clean", () => {
        for (const v of [undefined, null, "", "  "]) expect(honeypotFilled(v)).toBe(false);
        for (const v of ["x", "http://spam", 0, false, [], {}]) expect(honeypotFilled(v)).toBe(true);
    });
    test("parseForm keeps the first of a repeated key and has no prototype", () => {
        const f = parseForm("a=1&a=2&b=%20x&__proto__=y");
        expect(f.a).toBe("1");
        expect(f.b).toBe(" x");
        expect(Object.getPrototypeOf(f)).toBe(null);
    });
});

describe("formula injection hygiene", () => {
    test.each(["=cmd@example.com", "+1@example.com", "-a@example.com", "@a@example.com", "=a@example.com"])("an email starting with a formula character (%j) is refused", (e) => {
        expect(err({ ...ok, email: e })).toBe("invalid_email");
    });
    test("an email with such a character after the first is fine", () => {
        expect(validateLead({ ...ok, email: "a=b+c-d@example.com" }).ok).toBe(true);
    });
    test("leading = + - @ are stripped from name and company, also after spaces and repeated", () => {
        expect(validateLead({ name: "=+@-Ada", email: ok.email, company: " @=HYPERLINK(1)" })).toMatchObject({ ok: true, value: { name: "Ada", company: "HYPERLINK(1)" } });
        expect(validateLead({ name: "Ada-Marie", email: ok.email, company: "A+B @ C" })).toMatchObject({ ok: true, value: { name: "Ada-Marie", company: "A+B @ C" } });
    });
    test("a name that is only formula characters is a missing name", () => {
        expect(err({ name: "=-+@", email: ok.email })).toBe("missing_name");
    });
});

describe("page and utm", () => {
    test("page is a path only: a full address loses host, query and fragment; junk or over 200 is dropped, not refused", () => {
        expect(validateLead({ ...ok, page: "/fleet.html?x=1#top" })).toMatchObject({ ok: true, value: { page: "/fleet.html" } });
        expect(validateLead({ ...ok, page: "https://www.netquor.com/central.html?a=b" })).toMatchObject({ ok: true, value: { page: "/central.html" } });
        for (const p of ["no-slash", "/a b", "/<script>", "/" + "a".repeat(200), 5, "//evil.example/x".replace("//", "x")]) expect(validateLead({ ...ok, page: p })).not.toHaveProperty("value.page");
        expect(validateLead({ ...ok, page: "/" + "a".repeat(199) })).toMatchObject({ value: { page: "/" + "a".repeat(199) } });
    });
    test("utm from a nested object or flat utm_ fields; each at most 100, otherwise dropped", () => {
        expect(validateLead({ ...ok, utm: { source: "news", medium: "email" } })).toMatchObject({ value: { utm: { source: "news", medium: "email" } } });
        expect(validateLead({ ...ok, utm_source: "a", utm_campaign: "c" })).toMatchObject({ value: { utm: { source: "a", campaign: "c" } } });
        expect(validateLead({ ...ok, utm_source: "s".repeat(101), utm_medium: "m" })).toMatchObject({ value: { utm: { medium: "m" } } });
        expect(validateLead({ ...ok, utm: "x" })).not.toHaveProperty("value.utm");
        expect(validateLead({ ...ok, utm_source: "" })).not.toHaveProperty("value.utm");
    });
});
