// scripts/env-check.ts: run before the containers are (re)started: every setting is present where needed and plausible. Bun reads .env itself. `--quiet` prints only problems. Values are never printed.
import { checkConfig } from "../src/lib/config";
import { pricingProblems } from "../src/prices/env";

const quiet = process.argv.includes("--quiet");
const { config, problems: configProblems } = checkConfig(process.env);
const problems = [...configProblems, ...pricingProblems(process.env)];
if (!config || problems.length > 0) {
    for (const p of problems) console.error(`PROBLEM ${p}`);
    process.exit(1);
}
if (!quiet) {
    const on = (name: string) => (process.env[name] ?? "").trim() !== "";
    console.log(`ok  ALLOWED_ORIGINS (${config.allowedOrigins.length} origin${config.allowedOrigins.length === 1 ? "" : "s"})`);
    console.log(`ok  SITE_ORIGIN ${config.siteOrigin}`);
    console.log(`ok  leads go to: ${[config.leadFile && "file", config.leadForwardUrl && "webhook"].filter(Boolean).join(" and ")}`);
    console.log(`ok  rate limit: ${config.rateLimitMax} per ${config.rateLimitWindowMs / 1000} s per client address`);
    console.log(`ok  prices: webhook ${on("PRICING_WEBHOOK_SECRET") ? "on" : "off (no PRICING_WEBHOOK_SECRET)"}, poll ${on("PRICING_API_URL") ? "on" : "off (no PRICING_API_URL)"}`);
    console.log(`ok  the worker delivers to ${config.webInternalUrl}`);
    console.log("environment is complete");
}
