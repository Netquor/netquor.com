// cssBlocks.ts: test helper. Splits a stylesheet into its top-level blocks (a rule, an @media or @keyframes block with everything inside it, or an @import statement), comments removed and whitespace collapsed, so two stylesheets can be compared block by block no matter how they are laid out or commented.

/** The stylesheet without its comments. Strings are not parsed: the site's CSS has no comment markers inside strings. */
export const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** One block as text with every run of whitespace collapsed and the spaces around { } ; : , trimmed, so `a{b:c}` and `a { b: c; }` are equal. */
export const normalizeBlock = (b: string): string =>
    b.replace(/\s+/g, " ").replace(/\s*([{};:,])\s*/g, "$1").replace(/;}/g, "}").trim();

/** The top-level blocks of a stylesheet, in order, normalized. */
export const cssBlocks = (css: string): string[] => {
    const text = stripComments(css);
    const out: string[] = [];
    let depth = 0, start = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === "{") depth++;
        else if (c === "}") {
            depth--;
            if (depth === 0) { out.push(normalizeBlock(text.slice(start, i + 1))); start = i + 1; }
        } else if (c === ";" && depth === 0) { out.push(normalizeBlock(text.slice(start, i + 1))); start = i + 1; }
    }
    const rest = normalizeBlock(text.slice(start));
    if (rest) out.push(rest);
    return out.filter(Boolean);
};

/** The @import targets of a stylesheet, in order (`@import "./a.css";` gives "./a.css"). */
export const cssImports = (css: string): string[] => [...stripComments(css).matchAll(/@import\s+(?:url\()?["']([^"']+)["']\)?\s*;/g)].map((m) => m[1]);
