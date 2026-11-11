// assets.ts: the legacy assets Svelte pages and layouts load by URL, and their ?v= cache-busting values. +layout.server.ts fingerprints each file (the same md5 scheme tools/build-nav.py writes into the legacy pages) and hands the result to every page as data.assets. To load another legacy file, add it here.
export const ASSET_FILES = {
    nq: "nq.css",
    nav: "nav.css",
    navJs: "nav.js",
    analytics: "analytics.js",
    subnet: "subnet-calc.js",
    costCalc: "cost-calc.js",
    bundleCalc: "bundle-calc.js",
    fx: "fx.js",
    nudge: "nudge.js",
    bg: "bg.js",
    readiness: "readiness.js",
    fleetCss: "fleet/site.css",
    fleetJs: "fleet/site.js",
    fleetPricing: "fleet/pricing.js",
} as const;

export type AssetKey = keyof typeof ASSET_FILES;
export type AssetVersions = Record<AssetKey, string>;

/** "/cost-calc.js?v=25e7ba41" for a key; the same URL shape the legacy pages use, but absolute. */
export const assetUrl = (versions: Partial<Record<AssetKey, string>>, key: AssetKey): string => `/${ASSET_FILES[key]}?v=${versions[key] ?? "0"}`;

export const assetVersions = (version: (file: string) => string): AssetVersions =>
    Object.fromEntries(Object.entries(ASSET_FILES).map(([k, file]) => [k, version(file)])) as AssetVersions;
