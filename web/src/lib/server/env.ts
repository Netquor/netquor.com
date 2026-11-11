// env.ts: the web process's own settings. The adapter reads PORT, HOST, ORIGIN, ADDRESS_HEADER and BODY_SIZE_LIMIT itself; the API's settings are read by the server's loadConfig.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_SITE_ORIGIN } from "../site";
import { normalizeOrigin } from "./files";

export interface WebEnv {
    siteOrigin: string;
    legacyDir: string;
}

type Source = Record<string, string | undefined>;

/** SITE_ORIGIN (default https://www.netquor.com) and LEGACY_DIR. LEGACY_DIR defaults to /app/legacy when that exists (the image), otherwise the repository root one level above web/ (development). */
export const readWebEnv = (source: Source = process.env, cwd: string = process.cwd(), exists: (p: string) => boolean = existsSync): WebEnv => {
    const given = (source.LEGACY_DIR ?? "").trim();
    const legacyDir = given ? resolve(cwd, given) : exists("/app/legacy") ? "/app/legacy" : resolve(cwd, "..");
    return { siteOrigin: normalizeOrigin(source.SITE_ORIGIN, DEFAULT_SITE_ORIGIN), legacyDir };
};
