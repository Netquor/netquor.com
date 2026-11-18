// calculator.ts: the pure part of fleet/site.js's calculator: how a quote becomes the three plan cards, the verdict and the breakdown (the strings are copied from the legacy script), the money format, the device-count rule and the slider and number box link.
import { PACK, type Comparison, type LifetimePrice, type Term } from "./pricing";

export const TERMS: readonly Term[] = ["annual", "monthly", "lifetime"];
/** The slider's end: `max` on #calc-mac-r and #calc-ios-r. A number box may go past it. */
export const SLIDER_MAX = 500;
/** The refresh after typing or dragging waits this long (ms); the checkbox refreshes at once. */
export const DEBOUNCE_MS = 120;
export const ERROR_TEXT = "Couldn't work out a price right now. Please try again.";
export const EMPTY_VERDICT = "Enter your devices to compare the plans.";
export const EMPTY_SUB = "enter your devices";
/** What the cards show before the first calculation (the server-rendered markup). */
export const DASH = "\u2014";
export const NBSP = "\u00a0";

/** "$1,962.00": en-US, always two decimals (site.js's money, which is not pricing.js's). */
export const money = (cents: number): string => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** A box's device count: floored, 0 to 100000, anything else 0. */
export const countOf = (value: unknown): number => Math.min(Math.max(Math.floor(Number(value)) || 0, 0), 100000);

/** The slider position that follows a number box: the count, held at the slider's end (as a string, like an input's value). */
export const sliderFor = (numberValue: unknown, max: number = SLIDER_MAX): string => String(Math.min(countOf(numberValue), max));

const pct = (bps: number): string => `${bps / 100}%`;
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export interface CardView { main: string; sub: string; tag: string }
export interface CalcView {
    annual: CardView;
    monthly: CardView;
    lifetime: CardView;
    verdict: string;
    breakdown: string[];
    error: string;
}

/** The view before any calculation (what the server renders). */
export const initialView = (): CalcView => ({
    annual: { main: DASH, sub: NBSP, tag: "" },
    monthly: { main: DASH, sub: NBSP, tag: "" },
    lifetime: { main: DASH, sub: NBSP, tag: "" },
    verdict: "",
    breakdown: [],
    error: "",
});

const planCard = (p: { total_year_one_cents: number; total_per_month_year_one_cents: number }, tag: string): CardView => ({
    main: money(p.total_year_one_cents),
    sub: p.total_year_one_cents === 0 ? EMPTY_SUB : `a year, about ${money(p.total_per_month_year_one_cents)} a month`,
    tag,
});

const lifetimeCard = (l: LifetimePrice, tag: string): CardView => ({
    main: money(l.total_year_one_cents),
    sub: l.total_year_one_cents === 0 ? EMPTY_SUB : "paid once, nothing to renew",
    tag,
});

const packsLine = (mac: number, ios: number): string[] => {
    const parts: string[] = [];
    if (mac) parts.push(plural(mac, "Mac pack", "Mac packs"));
    if (ios) parts.push(plural(ios, "iPhone & iPad pack", "iPhone & iPad packs"));
    return parts;
};

const lifetimeLines = (L: LifetimePrice): string[] => {
    const y = L.year_one;
    const lines: string[] = [];
    const parts = packsLine(y.packs_mac, y.packs_ios);
    if (parts.length) lines.push(`${parts.join(" + ")} (${(y.packs_mac + y.packs_ios) * PACK} licenses), bought once${y.volume_bps ? `, with ${pct(y.volume_bps)} off` : ""}.`);
    const spare = y.spare_mac + y.spare_ios;
    if (spare) lines.push(`${plural(spare, "license", "licenses")} beyond your devices ${spare === 1 ? "is" : "are"} yours to keep: lifetime licenses never expire, so they cover the devices you add later.`);
    if (L.next_tier) lines.push(`Buy ${plural(L.next_tier.packs_more, "more pack", "more packs")} (${L.next_tier.devices_more} licenses) to reach ${pct(L.next_tier.discount_bps)} off.`);
    lines.push(`A lifetime license costs ${L.years_of_annual} years of the annual price. Nothing renews, and it moves to a replacement device when one leaves.`);
    if (L.dedicated.included) lines.push(`Dedicated instance: ${money(L.dedicated.setup_cents)} one-time setup + ${money(L.dedicated.hosting_year_cents)} a year of hosting, on your own URL.`);
    if (L.total_renewal_cents) lines.push(`Every year after: ${money(L.total_renewal_cents)} for the dedicated instance. Nothing else.`);
    lines.push(`Over five years: ${money(L.five_year_cents)}, against ${money(L.five_year_annual_cents)} on annual.`);
    return lines;
};

/** What the calculator shows for a quote when the visitor has the given plan selected. The error is always cleared (a successful render does that). */
export const renderQuote = (c: Comparison, term: Term): CalcView => {
    const a = c.annual;
    const m = c.monthly;
    if (c.macs + c.ios === 0) {
        return { annual: planCard(a, ""), monthly: planCard(m, ""), lifetime: lifetimeCard(c.lifetime, ""), verdict: EMPTY_VERDICT, breakdown: [], error: "" };
    }
    const diff = Math.abs(c.annual_extra_year_one_cents);
    const L = c.lifetime;
    const lifeWins = L.five_year_cents < L.five_year_annual_cents;

    let verdict = "";
    if (c.cheaper_first_year === "annual") {
        verdict = `Annual saves you ${money(diff)} in the first year.`;
    } else if (c.cheaper_first_year === "monthly") {
        verdict = `Monthly costs ${money(diff)} less in the first year. ${plural(c.annual_spare_licenses, "license", "licenses")} in your packs aren't in use yet (worth ${money(c.annual_spare_value_cents)}); they roll over and cover the devices you add next.`;
    }
    if (lifeWins) verdict += `${verdict ? " " : ""}Over five years, lifetime costs ${money(L.five_year_cents)} against ${money(L.five_year_annual_cents)} on annual and ${money(L.five_year_monthly_cents)} month to month.`;

    const view: CalcView = {
        annual: planCard(a, c.cheaper_first_year === "annual" ? "Lower first-year cost" : ""),
        monthly: planCard(m, c.cheaper_first_year === "monthly" ? "Lower first-year cost" : ""),
        lifetime: lifetimeCard(L, lifeWins ? "Lowest over 5 years" : ""),
        verdict,
        breakdown: [],
        error: "",
    };
    if (term === "lifetime") {
        view.breakdown = lifetimeLines(L);
        return view;
    }

    const lines: string[] = [];
    const p = term === "annual" ? a : m;
    const py = p.year_one;
    if (term === "annual") {
        const parts = packsLine(py.packs_mac, py.packs_ios);
        if (parts.length) lines.push(`${parts.join(" + ")} (${py.packs_total * PACK} licenses).`);
        lines.push(`Annual means ${py.months_paid} months' price for 12${py.volume_bps ? `, plus ${pct(py.volume_bps)} off for the packs` : ""}.`);
        const spare = py.spare_mac + py.spare_ios;
        if (spare) lines.push(`${plural(spare, "license", "licenses")} not in use yet roll over to your next term.`);
        if (p.next_tier) lines.push(`Buy ${plural(p.next_tier.packs_more, "more pack", "more packs")} (${p.next_tier.devices_more} licenses) to reach ${pct(p.next_tier.discount_bps)} off.`);
    }
    if (term === "monthly") lines.push("Month to month at list price, no commitment. Pay for a year at once and two months are free.");
    if (p.savings_year_one_cents > 0) lines.push(`${money(p.savings_year_one_cents)} (${p.savings_year_one_pct}%) less than list price for the first year.`);
    if (p.dedicated.included) {
        const d = p.dedicated;
        lines.push(term === "annual"
            ? `Dedicated instance: ${money(d.setup_cents)} one-time setup + ${money(d.hosting_year_cents)} a year, on your own URL.`
            : `Dedicated instance: ${money(d.setup_cents)} one-time setup + ${money(d.hosting_year_cents / 12)} a month, on your own URL.`);
    }
    if (p.total_renewal_cents) lines.push(`Year two with the same devices${p.dedicated.included ? " and instance" : ""}: ${money(p.total_renewal_cents)}${term === "monthly" ? ` (${money(Math.round(p.total_renewal_cents / 12))} a month)` : ""}.`);
    view.breakdown = lines;
    return view;
};
