// model.ts: the state of the Fleet calculator and the demo form, which share one set of values (the calculator mirrors its numbers, the plan and the dedicated choice into the form). It is the state machine of fleet/site.js without the DOM: the components bind inputs to these stores and call the actions. Timing (the 120 ms debounce, a sequence number that discards stale results) and cleanup live here so they can be tested with fake timers.
import { get, writable, type Readable } from "svelte/store";
import { countOf, DEBOUNCE_MS, ERROR_TEXT, initialView, renderQuote, sliderFor, TERMS, type CalcView } from "./calculator";
import { submitLead, type LeadValues, type Status, type StatusKind } from "./form";
import { createPricing, type Comparison, type FleetPrices, type Term } from "./pricing";
import { samePrices } from "./prices";

export interface Timers {
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
}

export interface CalcState {
    /** The number boxes' and sliders' values, as strings (an input's value). */
    macN: string;
    macR: string;
    iosN: string;
    iosR: string;
    dedicated: boolean;
    term: Term;
    /** False until mount(): the server markup is complete and static, and nothing is hidden or computed. */
    live: boolean;
    view: CalcView;
}

/** The values the calculator writes into #lead-form (the visitor can still edit the two counts). */
export interface FormState {
    macs: string;
    ios: string;
    term: string;
    dedicated: string;
    /** form.dataset.touched = "1" once the visitor typed in the macs or ios field. */
    touched: boolean;
}

export interface FleetModelOptions {
    prices: FleetPrices;
    timers?: Timers;
    /** window.location.href = url; injected so a test can see it. */
    navigate?: (url: string) => void;
}

export interface FleetModel {
    calc: Readable<CalcState>;
    form: Readable<FormState>;
    status: Readable<Status>;
    /** Starts the calculator (the first refresh, as site.js does on load). Returns the cleanup that cancels a pending refresh. */
    mount(): () => void;
    /** A price change from the live cache: recomputes when running. */
    setPrices(prices: FleetPrices): void;
    /** A number box input: moves the slider (held at its end) and refreshes soon. */
    numberInput(kind: "mac" | "ios", value: string): void;
    /** A slider input: copies to the number box and refreshes soon. */
    rangeInput(kind: "mac" | "ios", value: string): void;
    /** The checkbox change: refreshes at once. */
    setDedicated(checked: boolean): void;
    /** "Add it to my estimate": ticks the box and refreshes at once. */
    addDedicated(): void;
    selectTerm(term: Term): void;
    /** An input event in the form's macs or ios field (other fields are ignored): keeps the value and marks the form touched, so the calculator stops mirroring into it. */
    formInput(name: string, value: string): void;
    submit(values: LeadValues, busy: (disabled: boolean) => void): "invalid" | "sent" | "failed";
}

const realTimers: Timers = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };

export const createFleetModel = (opts: FleetModelOptions): FleetModel => {
    const timers = opts.timers ?? realTimers;
    const navigate = opts.navigate ?? ((url: string) => { window.location.href = url; });
    let pricing = createPricing(opts.prices);
    let prices = opts.prices;

    const calc = writable<CalcState>({ macN: "25", macR: "25", iosN: "10", iosR: "10", dedicated: false, term: "annual", live: false, view: initialView() });
    const form = writable<FormState>({ macs: "0", ios: "0", term: "annual", dedicated: "0", touched: false });
    const status = writable<Status>({ text: "", kind: "" });

    let seq = 0;
    let timer: unknown;
    let lastQuote: Comparison | null = null;
    let mounted = false;

    const patch = (p: Partial<CalcState>): void => calc.update((s) => ({ ...s, ...p }));

    const refresh = (): void => {
        const mine = ++seq;
        const s = get(calc);
        const macs = countOf(s.macN);
        const ios = countOf(s.iosN);
        form.update((f) => ({ ...f, ...(f.touched ? {} : { macs: String(macs), ios: String(ios) }), term: s.term, dedicated: s.dedicated ? "1" : "0" }));
        try {
            const c = pricing.compare({ macs, ios, dedicated: s.dedicated ? 1 : 0 });
            if (mine === seq) {
                lastQuote = c;
                patch({ view: renderQuote(c, get(calc).term) });
            }
        } catch {
            if (mine === seq) calc.update((st) => ({ ...st, view: { ...st.view, error: ERROR_TEXT } }));
        }
    };

    const soon = (): void => {
        timers.clearTimeout(timer);
        timer = timers.setTimeout(refresh, DEBOUNCE_MS);
    };

    return {
        calc,
        form,
        status,
        mount() {
            mounted = true;
            patch({ live: true });
            refresh();
            return () => {
                mounted = false;
                timers.clearTimeout(timer);
                seq++;
            };
        },
        setPrices(next) {
            if (samePrices(prices, next)) return;
            prices = next;
            pricing = createPricing(next);
            lastQuote = null;
            if (mounted) refresh();
        },
        numberInput(kind, value) {
            patch(kind === "mac" ? { macN: value, macR: sliderFor(value) } : { iosN: value, iosR: sliderFor(value) });
            soon();
        },
        rangeInput(kind, value) {
            patch(kind === "mac" ? { macR: value, macN: value } : { iosR: value, iosN: value });
            soon();
        },
        setDedicated(checked) {
            patch({ dedicated: checked });
            refresh();
        },
        addDedicated() {
            patch({ dedicated: true });
            refresh();
        },
        selectTerm(term) {
            if (!TERMS.includes(term)) return;
            patch({ term });
            form.update((f) => ({ ...f, term }));
            if (lastQuote) patch({ view: renderQuote(lastQuote, term) });
            else refresh();
        },
        formInput(name, value) {
            if (name === "macs" || name === "ios") form.update((f) => ({ ...f, [name]: value, touched: true }));
        },
        submit(values, busy) {
            return submitLead(values, {
                busy,
                navigate,
                say: (st) => status.set({ text: st.text, kind: st.kind as StatusKind }),
            });
        },
    };
};
