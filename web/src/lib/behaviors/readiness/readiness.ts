// readiness.ts: the DOM wiring of readiness.js. Finds every .nq-check section under a root, listens for change on its form and renders the result box. Answers are not stored and never sent; all text is set with textContent.
import { SCORING, type ScoredList } from "./data.ts";
import { viewFor, type Answer, type ResultView } from "./score.ts";

export interface RNode {
    className: string;
    textContent: string | null;
    href?: string;
    type?: string;
    appendChild(child: RNode): unknown;
    addEventListener(type: string, fn: () => void): void;
}
export interface ROut extends RNode {
    hidden: boolean;
    replaceChildren(...nodes: RNode[]): void;
}
export interface RForm {
    addEventListener(type: "change", fn: () => void): void;
    removeEventListener(type: "change", fn: () => void): void;
    querySelector(sel: string): { value: string } | null;
}
export interface RSection {
    getAttribute(name: string): string | null;
    querySelector(sel: "form"): RForm | null;
    querySelector(sel: ".nq-check-result"): ROut | null;
}
export interface RRoot { querySelectorAll(sel: ".nq-check"): ArrayLike<RSection> }
export interface RDoc { createElement(tag: string): RNode }

const el = (doc: RDoc, tag: string, text?: string, cls?: string): RNode => {
    const e = doc.createElement(tag);
    if (text) e.textContent = text;
    if (cls) e.className = cls;
    return e;
};

/** Renders a view into the result box, children in the legacy order. */
export const renderView = (doc: RDoc, out: ROut, v: ResultView, print: () => void): void => {
    if (v.kind === "empty") { out.hidden = true; return; }
    if (v.kind === "progress") { out.hidden = false; out.replaceChildren(el(doc, "p", v.text, "nq-check-prog")); return; }
    out.hidden = false;
    out.replaceChildren();
    const head = el(doc, "div", "", "nq-check-score");
    head.appendChild(el(doc, "b", v.score));
    head.appendChild(el(doc, "span", v.band + " (a simple count of your answers)"));
    out.appendChild(head);
    if (v.allIn) out.appendChild(el(doc, "p", "Every practice is in place. Revisit this when your team or setup changes.", "nq-note"));
    else {
        out.appendChild(el(doc, "p", "What to look at next:", "nq-note"));
        const ul = el(doc, "ul", "", "nq-gaps");
        for (const g of v.gaps) {
            const li = el(doc, "li");
            li.appendChild(el(doc, "b", g[1]));
            li.appendChild(el(doc, "span", g[2] + " "));
            const a = el(doc, "a", "Read more"); a.href = g[3];
            li.appendChild(a);
            ul.appendChild(li);
        }
        out.appendChild(ul);
    }
    const row = el(doc, "div", "", "nq-check-actions");
    const p = el(doc, "a", v.cta[0] + " "); p.href = v.cta[1]; p.className = "btn btn-primary-cyber"; row.appendChild(p);
    const c = el(doc, "a", v.calc[0]); c.href = v.calc[1]; c.className = "btn btn-outline-info"; row.appendChild(c);
    const pr = el(doc, "button", "Print this result"); pr.type = "button"; pr.className = "nq-linkbtn"; pr.addEventListener("click", print); row.appendChild(pr);
    out.appendChild(row);
    const m = el(doc, "a", "Send us this result and we will reply with a plan"); m.className = "nq-who-cta"; m.href = v.mailto; out.appendChild(m);
};

/** Attaches the scoring to every .nq-check[data-key] under root. A section whose key has no data, or that lacks its form or result box, is left alone. Returns the cleanup that removes the listeners. */
export const attachReadiness = (
    root: RRoot,
    doc: RDoc = document as unknown as RDoc,
    lists: Readonly<Record<string, ScoredList>> = SCORING,
    print: () => void = () => window.print(),
): (() => void) => {
    const offs: (() => void)[] = [];
    Array.from(root.querySelectorAll(".nq-check")).forEach((sec) => {
        const key = sec.getAttribute("data-key");
        const d = key === null ? undefined : lists[key];
        const form = sec.querySelector("form");
        const out = sec.querySelector(".nq-check-result");
        if (key === null || !d || !form || !out) return;
        const render = () => {
            const answers: Answer[] = d.qs.map((_q, i) => {
                const v = form.querySelector('input[name="' + key + "-" + i + '"]:checked');
                return v ? (v.value === "1" ? "1" : "0") : null;
            });
            renderView(doc, out, viewFor(d, answers), print);
        };
        form.addEventListener("change", render);
        offs.push(() => form.removeEventListener("change", render));
    });
    return () => offs.forEach((f) => f());
};
