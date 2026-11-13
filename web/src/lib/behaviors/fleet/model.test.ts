import { describe, expect, test } from "bun:test";
import { get } from "svelte/store";
import { createFleetModel, type Timers } from "./model";
import { fleetPricesFrom } from "./prices";

const fake = () => {
    const pending = new Map<number, { fn: () => void; ms: number }>();
    let id = 0;
    const timers: Timers = { setTimeout: (fn, ms) => { pending.set(++id, { fn, ms }); return id; }, clearTimeout: (h) => { pending.delete(h as number); } };
    return { timers, pending, run: () => { for (const [k, t] of [...pending]) { pending.delete(k); t.fn(); } } };
};
const seed = fleetPricesFrom(undefined);

describe("fleet model", () => {
    test("before mount nothing is computed or hidden; mount computes at once and fills the form", () => {
        const t = fake();
        const m = createFleetModel({ prices: seed, timers: t.timers });
        expect(get(m.calc).live).toBe(false);
        expect(get(m.calc).view.annual.main).toBe("\u2014");
        expect(get(m.form)).toEqual({ macs: "0", ios: "0", term: "annual", dedicated: "0", touched: false });
        const stop = m.mount();
        expect(get(m.calc).live).toBe(true);
        expect(get(m.calc).view.annual.main).toMatch(/^\$/);
        expect(get(m.form).macs).toBe("25");
        expect(get(m.form).ios).toBe("10");
        stop();
    });
    test("typing is debounced by 120 ms and replaces the pending refresh", () => {
        const t = fake();
        const m = createFleetModel({ prices: seed, timers: t.timers });
        m.mount();
        const before = get(m.calc).view.annual.main;
        m.numberInput("mac", "40");
        m.numberInput("mac", "41");
        expect(t.pending.size).toBe(1);
        expect([...t.pending.values()][0].ms).toBe(120);
        expect(get(m.calc).view.annual.main).toBe(before);
        expect(get(m.calc).macR).toBe("41");
        t.run();
        expect(get(m.calc).view.annual.main).not.toBe(before);
        expect(get(m.form).macs).toBe("41");
    });
    test("a slider copies to its number box; a number past the end leaves the slider at 500", () => {
        const t = fake();
        const m = createFleetModel({ prices: seed, timers: t.timers });
        m.mount();
        m.rangeInput("ios", "60");
        expect(get(m.calc).iosN).toBe("60");
        m.numberInput("mac", "800");
        expect([get(m.calc).macN, get(m.calc).macR]).toEqual(["800", "500"]);
    });
    test("the checkbox and Add it to my estimate refresh at once", () => {
        const t = fake();
        const m = createFleetModel({ prices: seed, timers: t.timers });
        m.mount();
        m.setDedicated(true);
        expect(t.pending.size).toBe(0);
        expect(get(m.form).dedicated).toBe("1");
        expect(get(m.calc).view.breakdown.some((l) => l.startsWith("Dedicated instance: "))).toBe(true);
        m.setDedicated(false);
        expect(get(m.form).dedicated).toBe("0");
        m.addDedicated();
        expect(get(m.calc).dedicated).toBe(true);
        expect(get(m.form).dedicated).toBe("1");
    });
    test("choosing a plan re-renders from the last quote and writes the form; an unknown plan is ignored", () => {
        const t = fake();
        const m = createFleetModel({ prices: seed, timers: t.timers });
        m.mount();
        m.selectTerm("lifetime");
        expect(get(m.calc).term).toBe("lifetime");
        expect(get(m.form).term).toBe("lifetime");
        expect(get(m.calc).view.breakdown.some((l) => l.startsWith("A lifetime license costs"))).toBe(true);
        m.selectTerm("weekly" as "annual");
        expect(get(m.calc).term).toBe("lifetime");
    });
    test("choosing a plan before the first quote computes one", () => {
        const t = fake();
        const m = createFleetModel({ prices: seed, timers: t.timers });
        m.selectTerm("monthly");
        expect(get(m.calc).view.monthly.main).toMatch(/^\$/);
    });
    test("once the visitor edits a count the calculator stops mirroring into it", () => {
        const t = fake();
        const m = createFleetModel({ prices: seed, timers: t.timers });
        m.mount();
        m.formInput("macs", "7");
        m.formInput("message", "ignored");
        expect(get(m.form)).toMatchObject({ macs: "7", touched: true });
        m.numberInput("mac", "33");
        t.run();
        expect(get(m.form).macs).toBe("7");
        expect(get(m.form).ios).toBe("10");
    });
    test("a computation that throws shows the error and keeps the last cards; the next good one clears it", () => {
        const t = fake();
        const m = createFleetModel({ prices: seed, timers: t.timers });
        m.mount();
        const cards = get(m.calc).view.annual.main;
        m.setPrices({ ...seed, macYear: Number.NaN });
        expect(get(m.calc).view.error).toBe("Couldn't work out a price right now. Please try again.");
        expect(get(m.calc).view.annual.main).toBe(cards);
        m.setPrices(seed);
        expect(get(m.calc).view.error).toBe("");
    });
    test("a live price change recomputes; the same prices do not", () => {
        const t = fake();
        const m = createFleetModel({ prices: seed, timers: t.timers });
        m.mount();
        const before = get(m.calc).view.monthly.main;
        m.setPrices({ ...seed });
        m.setPrices({ ...seed, macMonth: 700 });
        expect(get(m.calc).view.monthly.main).not.toBe(before);
    });
    test("cleanup cancels a pending refresh and a result in flight is dropped", () => {
        const t = fake();
        const m = createFleetModel({ prices: seed, timers: t.timers });
        const stop = m.mount();
        m.numberInput("mac", "99");
        expect(t.pending.size).toBe(1);
        stop();
        expect(t.pending.size).toBe(0);
        m.setPrices({ ...seed, macMonth: 800 });
        expect(get(m.calc).view.monthly.main).not.toBe("");
    });
    test("submit reports through the status store and the injected navigation", () => {
        const t = fake();
        const urls: string[] = [];
        const m = createFleetModel({ prices: seed, timers: t.timers, navigate: (u) => urls.push(u) });
        const base = { name: "", email: "", company: "", macs: "1", ios: "2", term: "annual", dedicated: "0", message: "" };
        expect(m.submit(base, () => {})).toBe("invalid");
        expect(get(m.status)).toEqual({ text: "Please tell us your name.", kind: "bad" });
        expect(m.submit({ ...base, name: "A", email: "a@b.co" }, () => {})).toBe("sent");
        expect(get(m.status).kind).toBe("ok");
        expect(urls.length).toBe(1);
    });
});
