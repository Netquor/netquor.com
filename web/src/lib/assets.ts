// assets.ts: the legacy files Svelte pages load by URL: only the three pure calculation scripts. The stylesheets (nq.css, nav.css, fleet/site.css) are ported to src/lib/styles and bundled by Vite, the fonts and icons come from npm, and the behavior scripts (nav.js, fx.js, bg.js, nudge.js, analytics.js, readiness.js, the Fleet scripts) are ported to src/lib/behaviors; none of those is loaded from the legacy folder any more. This file holds the files that are, and their ?v= cache-busting values. +layout.server.ts fingerprints each file (the same md5 scheme tools/build-nav.py writes into the legacy pages) and hands the result to every page as data.assets. To load another legacy file, add it here.
export const ASSET_FILES = {
    subnet: "subnet-calc.js",
    costCalc: "cost-calc.js",
    bundleCalc: "bundle-calc.js",
} as const;

export type AssetKey = keyof typeof ASSET_FILES;
export type AssetVersions = Record<AssetKey, string>;

/** "/cost-calc.js?v=25e7ba41" for a key; the same URL shape the legacy pages use, but absolute. */
export const assetUrl = (versions: Partial<Record<AssetKey, string>>, key: AssetKey): string => `/${ASSET_FILES[key]}?v=${versions[key] ?? "0"}`;

export const assetVersions = (version: (file: string) => string): AssetVersions =>
    Object.fromEntries(Object.entries(ASSET_FILES).map(([k, file]) => [k, version(file)])) as AssetVersions;
