// cli.ts: `bun run baseline` prints the baseline directory (extracting it from the tag on first use).
import { baselineDirSync } from "./dir";

console.log(baselineDirSync());
