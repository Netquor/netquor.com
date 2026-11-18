import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCatalogMap, type CatalogMap } from "./catalog";
import { serverRoot } from "./env";
import { validateSnapshot } from "./snapshot";
import type { Snapshot } from "./types";
// catalog.testkit.ts: the real captured price books, the real map and seed, and builders for books with other prices.

const fixture = (name: string) => JSON.parse(readFileSync(join(serverRoot, "src/prices/fixtures", `pricebook-${name}.json`), "utf8"));
export const realFleet = () => fixture("netquor-fleet");
export const realPhone = () => fixture("netquor-phone");
export const realMap = (): CatalogMap => parseCatalogMap(JSON.parse(readFileSync(join(serverRoot, "data/catalog-map.json"), "utf8")));
export const seedSnapshot = (): Snapshot => { const v = validateSnapshot(JSON.parse(readFileSync(join(serverRoot, "data/prices.seed.json"), "utf8"))); if (!v.ok) throw new Error("seed invalid"); return v.snapshot; };
/** A fleet book with other prices: monthly cents per kind. */
export const fleetWith = (mac: number, ios: number, version = 2) => {
    const b = realFleet();
    b.version = version; b.checksum = `fleet-${version}`;
    const cfg = b.entries[0].structure.config;
    cfg.kinds[0].monthlyCents = mac; cfg.kinds[1].monthlyCents = ios;
    return b;
};
export const phoneWith = (micros: number | null, version = 2) => {
    const b = realPhone();
    b.version = version; b.checksum = `phone-${version}`;
    if (micros === null) b.entries = b.entries.filter((e: { sku: string }) => e.sku !== "phone.starter.monthly");
    else b.entries.find((e: { sku: string }) => e.sku === "phone.starter.monthly").structure.amountMicros = micros;
    return b;
};

