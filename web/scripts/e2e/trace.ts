// trace.ts: a compact, readable dump of a trace (bun run e2e <scenario> --trace), used to read what a script actually did. Pure.
import type { Trace } from "./diff";
import type { Observed, ObservedEl } from "./observe";

const elLine = (sel: string, i: number, e: ObservedEl): string => {
    const attrs = Object.entries(e.attrs).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ");
    const comp = Object.entries(e.computed).map(([k, v]) => `${k}:${v}`).join(" ");
    const box = e.box ? `@${e.box.x},${e.box.y} ${e.box.w}x${e.box.h}` : "no-box";
    const text = e.text ? ` "${e.text.slice(0, 50)}"` : "";
    return `    ${sel}[${i}] <${e.tag}>${e.classes.length ? " ." + e.classes.join(".") : ""}${attrs ? " " + attrs : ""}${comp ? " {" + comp + "}" : ""} ${box}${e.visible ? "" : " hidden"}${text}`;
};

export const formatObserved = (o: Observed): string[] => {
    const lines = [`    scroll ${o.scroll.x},${o.scroll.y}  focus ${o.focus}`];
    for (const [sel, g] of Object.entries(o.elements)) {
        if (g.count === 0) lines.push(`    ${sel}: none`);
        g.items.forEach((e, i) => lines.push(elLine(sel, i, e)));
        if (g.count > g.items.length) lines.push(`    ${sel}: ${g.count} in all, ${g.items.length} shown`);
    }
    if (o.storage) lines.push(`    storage ${JSON.stringify(o.storage)}`);
    if (o.evals) lines.push(`    evals ${JSON.stringify(o.evals)}`);
    if (o.requests) lines.push(`    requests ${o.requests.join(" ")}`);
    if (o.console) lines.push(`    console ${JSON.stringify(o.console)}`);
    return lines;
};

export const formatTrace = (t: Trace): string =>
    t.map((s, i) => [`  ${i}. ${s.name}${s.ms !== undefined ? `  (${s.ms} ms)` : ""}${s.error ? `  ERROR ${s.error}` : ""}`, ...(s.observed ? formatObserved(s.observed) : [])].join("\n")).join("\n");
