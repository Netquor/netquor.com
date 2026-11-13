// baselineFiles.ts: TEST-ONLY access to the legacy hand-written site, the regression oracle. The files are not in the working tree: they are the git tag legacy-baseline-2026-11, extracted once into .baseline/<sha> by scripts/baseline/dir.ts. When git or the tag is missing the helper throws with the fix (git fetch --tags), so a test that needs the oracle fails loudly instead of skipping. Never import this from application code.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { baselineDirSync } from "../../scripts/baseline/dir";

let dir: string | undefined;
/** Absolute path of the extracted legacy site. Throws when the tag cannot be materialized. */
export const baselineRoot = (): string => (dir ??= baselineDirSync());
/** A legacy file's path, e.g. baselinePath("fleet/pricing.js"). */
export const baselinePath = (rel: string): string => join(baselineRoot(), rel);
/** A legacy file's text, e.g. baselineText("nq.css"). */
export const baselineText = (rel: string): string => readFileSync(baselinePath(rel), "utf8");
