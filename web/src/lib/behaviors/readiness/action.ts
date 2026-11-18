// action.ts: Svelte action for the readiness checklist markup. Put it on the element that contains the .nq-check sections (the page's <main>): <main use:readiness>. Optional parameter: a data object keyed like SCORING.
import { SCORING, type ScoredList } from "./data.ts";
import { attachReadiness, type RDoc, type RRoot } from "./readiness.ts";

export const readiness = (node: HTMLElement, lists: Readonly<Record<string, ScoredList>> = SCORING): { destroy(): void } => {
    const off = attachReadiness(node as unknown as RRoot, document as unknown as RDoc, lists);
    return { destroy: off };
};
