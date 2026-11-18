import { describe, expect, test } from "bun:test";
import { mailtoUrl, statusClass, submitLead, validateLead, type LeadValues, type Status } from "./form";

const ok: LeadValues = { name: "  Ada Lovelace ", email: " ada@example.com ", company: "Analytical Engines", macs: "25", ios: "10", term: "annual", dedicated: "0", message: " Hello " };

describe("lead form", () => {
    test("validation order and messages", () => {
        expect(validateLead({ name: " ", email: "x" })).toEqual({ text: "Please tell us your name.", kind: "bad" });
        expect(validateLead({ name: "a", email: "ada@example" })?.text).toBe("Please enter a valid email address.");
        expect(validateLead({ name: "a", email: "a b@example.com" })?.kind).toBe("bad");
        expect(validateLead({ name: "a", email: "ada@example.c" })?.kind).toBe("bad");
        expect(validateLead({ name: "a", email: "ada@example.co" })).toBeNull();
    });
    test("the mailto: URL", () => {
        const url = mailtoUrl(ok);
        expect(url.startsWith("mailto:hello@netquor.com?subject=Netquor%20Fleet%20free%20trial&body=")).toBe(true);
        expect(decodeURIComponent(url.split("&body=")[1])).toBe("Name: Ada Lovelace\nEmail: ada@example.com\nCompany: Analytical Engines\nMacs: 25\niPhones and iPads: 10\nPlan looked at: annual\n\nHello");
        expect(decodeURIComponent(mailtoUrl({ ...ok, term: "lifetime", dedicated: "1" }).split("&body=")[1])).toContain("Plan looked at: lifetime + dedicated instance");
    });
    test("status class keeps the legacy trailing space", () => {
        expect([statusClass("bad"), statusClass("ok"), statusClass("")]).toEqual(["status bad", "status ok", "status "]);
    });
    test("submit sequence: invalid stops before the button", () => {
        const log: string[] = [];
        const r = submitLead({ ...ok, name: "" }, { say: (s) => log.push(`say ${s.text}`), busy: (b) => log.push(`busy ${b}`), navigate: (u) => log.push(`nav ${u}`) });
        expect(r).toBe("invalid");
        expect(log).toEqual(["say Please tell us your name."]);
    });
    test("submit sequence: busy, Sending, navigate, ok, enabled", () => {
        const log: string[] = [];
        const r = submitLead(ok, { say: (s: Status) => log.push(`say ${s.text}|${s.kind}`), busy: (b) => log.push(`busy ${b}`), navigate: (u) => log.push(`nav ${u.slice(0, 7)}`) });
        expect(r).toBe("sent");
        expect(log).toEqual(["busy true", "say Sending…|", "nav mailto:", "say Opening your email app. If nothing opens, write to hello@netquor.com.|ok", "busy false"]);
    });
    test("a navigation that throws becomes a bad status and the button is enabled again", () => {
        const log: string[] = [];
        const r = submitLead(ok, { say: (s) => log.push(`say ${s.text}|${s.kind}`), busy: (b) => log.push(`busy ${b}`), navigate: () => { throw new Error("blocked"); } });
        expect(r).toBe("failed");
        expect(log.slice(-2)).toEqual(["say blocked|bad", "busy false"]);
    });
});
