// score.ts: the pure scoring of readiness.js: from the answers to what the result box shows.
import type { GapQuestion, ScoredList } from "./data.ts";

/** One radio group's state: "1" Yes, "0" Not yet, null unanswered. */
export type Answer = "1" | "0" | null;

/** yes <= 2 is Mostly manual, fewer than total - 1 is Partly in place, else In good shape. */
export const band = (n: number, total: number): string => (n <= 2 ? "Mostly manual today" : n < total - 1 ? "Partly in place" : "In good shape");

export type ResultView =
    | { kind: "empty" }
    | { kind: "progress"; text: string }
    | { kind: "result"; yes: number; total: number; score: string; band: string; gaps: GapQuestion[]; allIn: boolean; cta: readonly [string, string]; calc: readonly [string, string]; mailto: string };

/** The mailto link of the "Send us this result" line. The body is not encoded further: the %0D%0A are literal, as in the legacy script. */
export const mailtoHref = (title: string, yes: number, total: number, gaps: readonly GapQuestion[]): string => {
    const body = title + ": " + yes + " of " + total + " in place.%0D%0A" + (gaps.length ? "Not yet: " + gaps.map((g) => g[1]).join(", ") + ".%0D%0A" : "") + "%0D%0AMy business: ";
    return "mailto:hello@netquor.com?subject=" + encodeURIComponent("Readiness result: " + title) + "&body=" + body;
};

/** What the box should show for the current answers (one per question, in order). */
export const viewFor = (list: ScoredList, answers: readonly Answer[]): ResultView => {
    const total = list.qs.length;
    let answered = 0, yes = 0;
    const gaps: GapQuestion[] = [];
    list.qs.forEach((q, i) => {
        const v = answers[i];
        if (v) { answered++; if (v === "1") yes++; else gaps.push(q); }
    });
    if (answered === 0) return { kind: "empty" };
    if (answered < total) return { kind: "progress", text: answered + " of " + total + " answered" };
    return { kind: "result", yes, total, score: yes + " of " + total, band: band(yes, total), gaps, allIn: gaps.length === 0, cta: list.cta, calc: list.calc, mailto: mailtoHref(list.title, yes, total, gaps) };
};
