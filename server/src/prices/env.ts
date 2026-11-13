// env.ts: settings for the pricing pipeline, read when asked for so a test can pass its own. Bun loads .env by itself. Relative paths are relative to the server folder. Every function takes the environment as an argument (default process.env).
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseProducts } from "./catalog";
import { validateServiceUrl } from "./url";

export type Env = Record<string, string | undefined>;

/** The setting, trimmed; an empty value counts as unset (a compose file that passes an empty variable gets the default). */
export const env = (name: string, fallback = "", e: Env = process.env): string => (e[name] ?? "").trim() || fallback;

/** The server/ folder. */
export const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The data folder setting: PRICES_DIR when set, else DATA_DIR, else "data" (relative to the server folder). */
export const dataDirSetting = (e: Env = process.env): string => env("PRICES_DIR", "", e) || env("DATA_DIR", "", e) || "data";
/** Where prices.json, prices.prev.json and baseline.json live (PRICES_DIR, else DATA_DIR, default server/data; in the container, the `data` volume). */
export const pricesDir = (e: Env = process.env): string => resolve(serverRoot, dataDirSetting(e));
/** The seed baked into the image (PRICES_SEED_FILE, default server/data/prices.seed.json). Kept apart from PRICES_DIR so a volume mounted over the data folder cannot hide it. */
export const seedFile = (e: Env = process.env): string => resolve(serverRoot, env("PRICES_SEED_FILE", "data/prices.seed.json", e));

export const MIN_SECRET_LENGTH = 16;

/** The webhook secrets in force: the current one and, during a rotation, the next. A secret shorter than 16 characters is ignored with one warning each; without a valid current secret the list is empty, which keeps the route off. */
export const webhookSecrets = (e: Env = process.env, warn: (line: string) => void = () => {}): string[] => {
    const main = env("PRICING_WEBHOOK_SECRET", "", e), next = env("PRICING_WEBHOOK_SECRET_NEXT", "", e);
    const out: string[] = [];
    if (main && main.length < MIN_SECRET_LENGTH) warn(`prices: PRICING_WEBHOOK_SECRET is shorter than ${MIN_SECRET_LENGTH} characters and is ignored; the pricing webhook stays off`);
    else if (main) out.push(main);
    if (next && next.length < MIN_SECRET_LENGTH) warn(`prices: PRICING_WEBHOOK_SECRET_NEXT is shorter than ${MIN_SECRET_LENGTH} characters and is ignored`);
    else if (next && !out.length) warn("prices: PRICING_WEBHOOK_SECRET_NEXT is set without a valid PRICING_WEBHOOK_SECRET and is ignored");
    else if (next) out.push(next);
    return out;
};

export const apiUrl = (e: Env = process.env): string => env("PRICING_API_URL", "", e);
export const apiToken = (e: Env = process.env): string => env("PRICING_API_TOKEN", "", e);
/** Catalog mode: prices come from the Netquor API price catalog (https://api.netquor.com). Wins over PRICING_API_URL when both are set. */
export const catalogUrl = (e: Env = process.env): string => env("NETQUOR_CATALOG_URL", "", e);
export const catalogProducts = (e: Env = process.env) => parseProducts(env("NETQUOR_CATALOG_PRODUCTS", "", e));
/** The catalog map file (default server/data/catalog-map.json). */
export const catalogMapFile = (e: Env = process.env): string => resolve(serverRoot, env("CATALOG_MAP_FILE", "data/catalog-map.json", e));
/** Where the worker and the operator tool reach the web process. */
export const webInternalUrl = (e: Env = process.env, fallback = "http://netquor-web:3000"): string => env("WEB_INTERNAL_URL", fallback, e);

/** Problems with the pricing settings, as plain sentences (never a value). All of the settings are optional: the pipeline is off when PRICING_WEBHOOK_SECRET is unset. */
export const pricingProblems = (e: Env): string[] => {
    const get = (k: string) => (e[k] ?? "").trim();
    const problems: string[] = [];
    for (const k of ["PRICING_WEBHOOK_SECRET", "PRICING_WEBHOOK_SECRET_NEXT"]) {
        if (get(k) && get(k).length < MIN_SECRET_LENGTH) problems.push(`${k} must be at least ${MIN_SECRET_LENGTH} characters`);
    }
    if (get("PRICING_WEBHOOK_SECRET_NEXT") && !get("PRICING_WEBHOOK_SECRET")) problems.push("PRICING_WEBHOOK_SECRET_NEXT is set but PRICING_WEBHOOK_SECRET is not");
    const url = get("PRICING_API_URL");
    if (url) { const c = validateServiceUrl(url); if (!c.ok) problems.push(`PRICING_API_URL ${c.reason}`); }
    const internal = get("WEB_INTERNAL_URL");
    if (internal) { const c = validateServiceUrl(internal, { plainHttp: "any" }); if (!c.ok) problems.push(`WEB_INTERNAL_URL ${c.reason}`); }
    const cat = get("NETQUOR_CATALOG_URL");
    if (cat) { const c = validateServiceUrl(cat); if (!c.ok) problems.push(`NETQUOR_CATALOG_URL ${c.reason}`); }
    for (const bad of catalogProducts(e).invalid) problems.push(`NETQUOR_CATALOG_PRODUCTS has an invalid product id "${bad.slice(0, 40)}"`);
    if (get("PRICING_API_TOKEN") && !url) problems.push("PRICING_API_TOKEN is set but PRICING_API_URL is not");
    const poll = get("PRICING_POLL_SECONDS");
    if (poll && !(Number.isFinite(Number(poll)) && Number(poll) >= 60)) problems.push("PRICING_POLL_SECONDS must be a number, 60 or more");
    return problems;
};
