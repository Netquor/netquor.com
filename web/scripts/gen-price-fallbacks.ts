// gen-price-fallbacks.ts: regenerates the PRICE_FALLBACKS block in src/lib/priceFallbacks.ts from server/data/prices.seed.json. Run `bun scripts/gen-price-fallbacks.ts` after the seed changes; `--check` exits 1 when the file is stale. Only the text between the two marker lines is written.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const BEGIN = "// BEGIN GENERATED PRICE_FALLBACKS (bun scripts/gen-price-fallbacks.ts)";
export const END = "// END GENERATED PRICE_FALLBACKS";

interface SeedEntry { amountCents: number; currency: string; unit?: string }

/** The generated block for a seed's prices, keys sorted. */
export const renderBlock = (prices: Record<string, SeedEntry>): string => {
    const rows = Object.keys(prices).sort().map((k) => {
        const e = prices[k];
        const unit = e.unit === undefined ? "" : `, unit: ${JSON.stringify(e.unit)}`;
        return `    ${JSON.stringify(k)}: { amountCents: ${e.amountCents}, currency: ${JSON.stringify(e.currency)}${unit} },`;
    });
    return `${BEGIN}\nexport const PRICE_FALLBACKS: Readonly<Record<string, PriceEntry>> = {\n${rows.join("\n")}\n};\n${END}`;
};

/** Replace the marked block in a file's text. Throws when the markers are missing. */
export const applyBlock = (source: string, block: string): string => {
    const a = source.indexOf(BEGIN), b = source.indexOf(END);
    if (a < 0 || b < a) throw new Error("priceFallbacks.ts is missing the generated-block markers");
    return source.slice(0, a) + block + source.slice(b + END.length);
};

export const seedPath = resolve(import.meta.dir, "../../server/data/prices.seed.json");
export const targetPath = resolve(import.meta.dir, "../src/lib/priceFallbacks.ts");

export const generate = (): { current: string; next: string } => {
    const seed = JSON.parse(readFileSync(seedPath, "utf8")) as { prices: Record<string, SeedEntry> };
    const current = readFileSync(targetPath, "utf8");
    return { current, next: applyBlock(current, renderBlock(seed.prices)) };
};

if (import.meta.main) {
    const { current, next } = generate();
    if (process.argv.includes("--check")) { if (current !== next) { console.error("priceFallbacks.ts is stale: run bun scripts/gen-price-fallbacks.ts"); process.exit(1); } }
    else if (current !== next) { writeFileSync(targetPath, next); console.log("priceFallbacks.ts updated"); } else console.log("priceFallbacks.ts is up to date");
}
