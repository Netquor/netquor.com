// lead/validate.ts: pure checks of what a visitor sent. Anything not listed is ignored (never stored, never echoed). Too long is refused, not cut.
import type { LeadInput } from "./types";

export const LIMITS = { name: 100, email: 254, company: 120, message: 2000, term: 20, source: 60, count: 100000, page: 200, utm: 100 } as const;

export type Parsed = { ok: true; value: LeadInput } | { ok: false; error: string };

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const CONTROL_OR_BREAK = /[\u0000-\u001F\u007F]/;
// Zero-width, bidi override and BOM characters: removed, as the Netquor API does, so what is checked here is what it will check.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
// A spreadsheet reads a cell that starts with one of these as a formula.
const FORMULA_LEAD = /^[=+@-]+/;
const EMAIL = /^[^\s@<>(),;:"\\[\]]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

type Field<T> = { ok: true; value: T } | { ok: false };

/** A text field: absent counts as empty; a non-string, a control character or a too-long value is refused. */
function text(v: unknown, max: number, multiline = false, noFormula = false): Field<string> {
    if (v === undefined || v === null) return { ok: true, value: "" };
    if (typeof v !== "string") return { ok: false };
    let s = v.normalize("NFC").replace(INVISIBLE, "").trim();
    if (noFormula) s = s.replace(FORMULA_LEAD, "").trim();
    if (s.length > max || (multiline ? CONTROL : CONTROL_OR_BREAK).test(s)) return { ok: false };
    return { ok: true, value: s };
}

/** A whole number 0..100000, as a number or as digits in a string (a form sends strings); empty means 0. */
function count(v: unknown): Field<number> {
    if (v === undefined || v === null) return { ok: true, value: 0 };
    if (typeof v === "string") {
        const s = v.trim();
        if (s === "") return { ok: true, value: 0 };
        if (!/^\d{1,6}$/.test(s)) return { ok: false };
        v = Number(s);
    }
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > LIMITS.count) return { ok: false };
    return { ok: true, value: v };
}

/** The path of a page address (no host, query or fragment), at most 200 characters of a safe set; undefined when it is not one. */
function pagePath(v: unknown): string | undefined {
    if (typeof v !== "string") return undefined;
    let s = v.trim();
    if (/^https?:\/\//i.test(s)) { try { s = new URL(s).pathname; } catch { return undefined; } }
    s = s.split(/[?#]/)[0];
    return s.length >= 1 && s.length <= LIMITS.page && /^\/[A-Za-z0-9_\-./~%]*$/.test(s) ? s : undefined;
}

/** utm tags from a nested {utm:{source,medium,campaign}} (JSON) or flat utm_source, utm_medium, utm_campaign (a form). */
function utmTags(input: Record<string, unknown>): LeadInput["utm"] {
    const nested = typeof input.utm === "object" && input.utm !== null && !Array.isArray(input.utm) ? (input.utm as Record<string, unknown>) : {};
    const out: NonNullable<LeadInput["utm"]> = {};
    for (const k of ["source", "medium", "campaign"] as const) {
        const raw = input[`utm_${k}`] ?? nested[k];
        if (typeof raw !== "string") continue;
        const t = text(raw, LIMITS.utm);
        if (t.ok && t.value) out[k] = t.value;
    }
    return Object.keys(out).length ? out : undefined;
}

export function validateLead(input: Record<string, unknown>): Parsed {
    const name = text(input.name, LIMITS.name, false, true);
    if (!name.ok) return { ok: false, error: "invalid_name" };
    if (!name.value) return { ok: false, error: "missing_name" };

    const email = text(input.email, LIMITS.email);
    if (!email.ok) return { ok: false, error: "invalid_email" };
    if (!email.value) return { ok: false, error: "missing_email" };
    if (/^[=+@-]/.test(email.value)) return { ok: false, error: "invalid_email" }; // would be a formula in a spreadsheet
    if (!EMAIL.test(email.value) || email.value.split("@")[0].length > 64) return { ok: false, error: "invalid_email" };

    const company = text(input.company, LIMITS.company, false, true);
    if (!company.ok) return { ok: false, error: "invalid_company" };
    const macs = count(input.macs);
    if (!macs.ok) return { ok: false, error: "invalid_macs" };
    const ios = count(input.ios);
    if (!ios.ok) return { ok: false, error: "invalid_ios" };
    const message = text(input.message, LIMITS.message, true);
    if (!message.ok) return { ok: false, error: "invalid_message" };
    const term = text(input.term, LIMITS.term);
    if (!term.ok || !/^[A-Za-z0-9_-]*$/.test(term.value)) return { ok: false, error: "invalid_term" };
    const source = text(input.source, LIMITS.source);
    if (!source.ok || !/^[A-Za-z0-9_./:-]*$/.test(source.value)) return { ok: false, error: "invalid_source" };

    const value: LeadInput = { name: name.value, email: email.value, company: company.value, macs: macs.value, ios: ios.value, message: message.value, term: term.value, source: source.value };
    // Where the form was and the campaign tags: optional and never a reason to lose a lead, so a bad value is dropped, not refused.
    const page = pagePath(input.page);
    if (page) value.page = page;
    const utm = utmTags(input);
    if (utm) value.utm = utm;
    return { ok: true, value };
}

/** The hidden field only a bot fills in. Any value but empty or blank counts. */
export const honeypotFilled = (v: unknown): boolean => !(v === undefined || v === null || (typeof v === "string" && v.trim() === ""));

/** Reads a form-encoded body into a plain map (the first value of a repeated key wins). */
export function parseForm(text: string): Record<string, string> {
    const out: Record<string, string> = Object.create(null);
    for (const [k, v] of new URLSearchParams(text)) if (!(k in out)) out[k] = v;
    return out;
}
