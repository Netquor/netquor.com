// The two cost calculators of the home page (device setup, missed calls), ported from the inline script of the legacy page. The maths is cost-calc.js (window.NQCost, loaded unchanged by the route); this file turns its result into the nodes the legacy page drew, in two steps so the wording is testable without a DOM: devView / missView return plain node descriptions, and initCostCalcs draws them into #dev-out and #miss-out.
export interface CostApi {
    deviceTime(i: Record<string, string>): CostDevice;
    missedCalls(i: Record<string, string>): CostMissed;
}
export interface CostDevice { error?: string; empty?: boolean; hours: number; dollars: number; weeks: number; setupHours: number; changeHours: number; signinHours: number; fleetYear: number; rate: number }
export interface CostMissed { error?: string; empty?: boolean; monthly: number; yearly: number; jobsToPayForStarter: number; starterMonthly: number }

/** A node of an output box: a paragraph with a class, or a "big number" block (value above label). */
export type OutNode = { kind: "p"; text: string; cls: string } | { kind: "big"; label: string; value: string };

export const usd = (n: number): string => "$" + Math.round(n).toLocaleString("en-US");
export const hrs = (n: number): string => (Math.round(n * 10) / 10).toLocaleString("en-US") + " hours";

export const devView = (C: CostApi, v: Record<"new" | "hrs" | "chg" | "chgm" | "sig" | "sigm" | "rate" | "macs" | "devs", string>): OutNode[] => {
    const r = C.deviceTime({ newPerYear: v.new, setupHours: v.hrs, changesPerWeek: v.chg, changeMinutes: v.chgm, signinsPerWeek: v.sig, signinMinutes: v.sigm, hourly: v.rate, macs: v.macs, devices: v.devs });
    if (r.error) return [{ kind: "p", text: r.error, cls: "nq-err" }];
    if (r.empty) return [{ kind: "p", text: "Enter your numbers to see the cost.", cls: "nq-empty" }];
    const rows: OutNode[] = [
        { kind: "big", label: "of your time a year", value: hrs(r.hours) },
        { kind: "big", label: "a year at your rate", value: usd(r.dollars) },
        { kind: "p", cls: "nq-note", text: "That is about " + r.weeks + " full working weeks. Setup " + hrs(r.setupHours) + ", app and setting requests " + hrs(r.changeHours) + ", sign-ins and passwords " + hrs(r.signinHours) + "." },
    ];
    if (r.fleetYear > 0 && r.rate > 0) {
        const h = Math.round((r.fleetYear / r.rate) * 10) / 10;
        rows.push({ kind: "p", cls: "nq-note", text: "Netquor Fleet for your devices lists at " + usd(r.fleetYear) + " a year. At " + usd(r.rate) + " an hour, that is the cost of " + h.toLocaleString("en-US") + " hours of your time." });
    }
    rows.push({ kind: "p", cls: "nq-fine", text: "Every figure comes from the numbers you entered, and a full working week is counted as 40 hours. We make no claim about how much time any product saves." });
    return rows;
};

export const missView = (C: CostApi, v: Record<"val" | "miss" | "jobs", string>): OutNode[] => {
    const r = C.missedCalls({ value: v.val, missed: v.miss, jobs: v.jobs });
    if (r.error) return [{ kind: "p", text: r.error, cls: "nq-err" }];
    if (r.empty) return [{ kind: "p", text: "Enter your three numbers to see the cost.", cls: "nq-empty" }];
    const rows: OutNode[] = [
        { kind: "big", label: "a month in jobs you did not get", value: usd(r.monthly) },
        { kind: "big", label: "a year", value: usd(r.yearly) },
    ];
    if (r.jobsToPayForStarter) rows.push({ kind: "p", cls: "nq-note", text: "Netquor Phone Starter has a planned launch price of $" + r.starterMonthly + " a month. " + (r.jobsToPayForStarter === 1 ? "One job" : r.jobsToPayForStarter + " jobs") + " a month would pay for it. Phone is in early access and not billed yet." });
    rows.push({ kind: "p", cls: "nq-fine", text: "Every figure comes from the numbers you entered. We make no claim about how many missed calls turn into jobs." });
    return rows;
};

/** The "Use example numbers" values, keyed by input id. */
export const EXAMPLES: Record<"dev" | "miss", Record<string, number>> = {
    dev: { "d-new": 6, "d-hrs": 2, "d-chg": 4, "d-chgm": 15, "d-sig": 10, "d-sigm": 5, "d-rate": 60, "d-macs": 4, "d-devs": 4 },
    miss: { "m-val": 400, "m-miss": 5, "m-jobs": 2 },
};

const draw = (doc: Document, out: HTMLElement, nodes: OutNode[]): void => {
    out.textContent = "";
    for (const n of nodes) {
        const el = (tag: string, text: string, cls?: string) => { const e = doc.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; };
        if (n.kind === "p") out.appendChild(el("p", n.text, n.cls));
        else { const d = el("div", "", "nq-big"); d.appendChild(el("b", n.value)); d.appendChild(el("span", n.label)); out.appendChild(d); }
    }
};

/** Wires the two forms and draws both outputs once. A no-op when cost-calc.js did not load (the outputs stay empty, as without JavaScript). */
export const initCostCalcs = (doc: Document): void => {
    const C = (window as unknown as { NQCost?: CostApi }).NQCost;
    if (!C) return;
    const $ = (id: string) => doc.getElementById(id) as HTMLInputElement;
    const dev = () => draw(doc, $("dev-out"), devView(C, { new: $("d-new").value, hrs: $("d-hrs").value, chg: $("d-chg").value, chgm: $("d-chgm").value, sig: $("d-sig").value, sigm: $("d-sigm").value, rate: $("d-rate").value, macs: $("d-macs").value, devs: $("d-devs").value }));
    const miss = () => draw(doc, $("miss-out"), missView(C, { val: $("m-val").value, miss: $("m-miss").value, jobs: $("m-jobs").value }));
    doc.querySelectorAll("[data-example]").forEach((b) => {
        b.addEventListener("click", () => {
            const k = b.getAttribute("data-example") as "dev" | "miss";
            Object.keys(EXAMPLES[k]).forEach((id) => { $(id).value = String(EXAMPLES[k][id]); });
            (k === "dev" ? dev : miss)();
        });
    });
    $("dev-calc").addEventListener("input", dev);
    $("miss-calc").addEventListener("input", miss);
    dev();
    miss();
};
