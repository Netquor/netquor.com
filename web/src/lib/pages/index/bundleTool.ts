// The bundle price tool of the home page, ported from the inline script of the legacy page. The maths is bundle-calc.js (window.NQBundle, loaded unchanged by the route). bundleView turns a calc result into rows and notes (testable without a DOM); initBundleTool reads the form, draws the rows and handles the preset buttons.
export interface BundleLine { key?: string; label: string; cents: number }
export interface BundleTotals { lines: BundleLine[]; products: number; percent: number; listCents: number; discountCents: number; totalCents: number }
export interface BundleResult {
    empty?: boolean;
    today: BundleTotals;
    launch?: BundleTotals;
    annual?: { annualCheaper: boolean; yearCents: number; monthlyYearCents: number };
}
export interface BundleApi {
    calc(i: { macs: string; devices: string; phone: string; people: string; vpn: string }): BundleResult;
    usd(cents: number): string;
    PRESETS: Record<string, { macs: number; devices: number; phone: string; people: number; vpn: string }>;
}
export interface BundleRow { label: string; value: string; cls?: string }
export interface BundleView { rows: BundleRow[]; save: string; note: string; peopleHidden: boolean }

const discountLabel = (t: BundleTotals, count: number): string => {
    if (t.percent > 0) return t.percent + "% off, " + count + " products";
    return count === 1 ? "Add a second product to take 10% off" : "The bundle discount needs two products";
};

export const bundleView = (B: BundleApi, v: { macs: string; devices: string; phone: string; people: string; vpn: string }): BundleView => {
    const r = B.calc(v);
    const peopleHidden = v.phone !== "business";
    if (r.empty) return { rows: [{ label: "Choose a product to see a price", value: "$0.00", cls: "nq-bundle-sub" }], save: "", note: "", peopleHidden };
    const rows: BundleRow[] = [];
    const t = r.today;
    t.lines.forEach((l) => rows.push({ label: l.label, value: B.usd(l.cents) }));
    if (t.lines.length && t.lines.length > 0) {
        rows.push({ label: "List price", value: B.usd(t.listCents), cls: "nq-bundle-sub" });
        rows.push({ label: discountLabel(t, t.products), value: t.discountCents ? "−" + B.usd(t.discountCents) : "$0.00", cls: "nq-bundle-sub" });
        rows.push({ label: "Per month today", value: B.usd(t.totalCents), cls: "nq-bundle-total" });
    }
    if (r.launch) {
        const l = r.launch;
        const phone = l.lines.filter((x) => x.key === "phone")[0];
        rows.push({ label: "Planned, not billed yet", value: "", cls: "nq-bundle-planned" });
        rows.push({ label: phone.label, value: B.usd(phone.cents), cls: "nq-bundle-sub" });
        if (l.percent > 0) rows.push({ label: l.percent + "% off at Phone launch, " + l.products + " products", value: "−" + B.usd(l.discountCents), cls: "nq-bundle-sub" });
        rows.push({ label: "Per month at Phone launch", value: B.usd(l.totalCents), cls: "nq-bundle-total nq-bundle-launch" });
    }
    let save = "";
    if (t.discountCents) save = "The bundle discount is " + B.usd(t.discountCents * 12) + " a year today" + (r.launch && r.launch.discountCents > t.discountCents ? ", and " + B.usd(r.launch.discountCents * 12) + " a year at Phone launch." : ".");
    const note: string[] = [];
    if (r.annual) {
        const an = r.annual;
        if (an.annualCheaper) note.push("Annual Fleet costs " + B.usd(an.yearCents) + " a year before volume pricing, less than month to month. Annual pricing does not combine with the bundle discount, so annual is the better price for this fleet.");
        else note.push("Annual Fleet licenses are sold in packs of 10, so by our estimate month to month costs less for this fleet: " + B.usd(an.monthlyYearCents) + " a year with the bundle discount, against " + B.usd(an.yearCents) + " a year annual before volume pricing. The Fleet page has the pack rules.");
    }
    return { rows, save, note: note.join(" "), peopleHidden };
};

/** Wires the form, the preset buttons and the output, and starts on the "office" preset. A no-op when bundle-calc.js did not load. */
export const initBundleTool = (doc: Document): void => {
    const B = (window as unknown as { NQBundle?: BundleApi }).NQBundle;
    if (!B) return;
    const $ = (id: string) => doc.getElementById(id) as HTMLInputElement;
    const els = { macs: $("b-macs"), devs: $("b-devs"), phone: $("b-phone"), people: $("b-people"), vpn: $("b-vpn") };
    const buttons = () => Array.from(doc.querySelectorAll(".nq-presets button"));
    const row = (parent: HTMLElement, label: string, value: string, cls?: string) => {
        const d = doc.createElement("div"); d.setAttribute("role", "row"); if (cls) d.className = cls;
        const a = doc.createElement("span"), b = doc.createElement("span");
        a.setAttribute("role", "cell"); b.setAttribute("role", "cell");
        a.textContent = label; b.textContent = value; d.appendChild(a); d.appendChild(b); parent.appendChild(d);
    };
    const render = () => {
        const view = bundleView(B, { macs: els.macs.value, devices: els.devs.value, phone: els.phone.value, people: els.people.value, vpn: els.vpn.value });
        $("b-people-wrap").hidden = view.peopleHidden;
        const out = $("b-rows"); out.textContent = "";
        view.rows.forEach((r) => row(out, r.label, r.value, r.cls));
        $("b-save").textContent = view.save;
        $("b-note").textContent = view.note;
    };
    const preset = (k: string) => {
        const p = B.PRESETS[k]; if (!p) return;
        els.macs.value = String(p.macs); els.devs.value = String(p.devices); els.phone.value = p.phone; els.people.value = String(p.people); els.vpn.value = p.vpn;
        buttons().forEach((b) => b.setAttribute("aria-pressed", String(b.getAttribute("data-preset") === k)));
        render();
    };
    buttons().forEach((b) => b.addEventListener("click", () => preset(b.getAttribute("data-preset") ?? "")));
    (Object.keys(els) as (keyof typeof els)[]).forEach((k) => els[k].addEventListener("input", () => { buttons().forEach((b) => b.setAttribute("aria-pressed", "false")); render(); }));
    preset("office");
};
