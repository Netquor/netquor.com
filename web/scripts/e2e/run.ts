// run.ts: `bun run e2e <scenario>...`, `bun run e2e --all`. Builds web first unless --no-build. See README.md.
import { compareScenario, openWorld } from "./scenario";
import { SCENARIOS, selectScenarios } from "./scenarios";
import { formatTrace } from "./trace";

const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const names = args.filter((a) => !a.startsWith("--"));

if (flag("--list")) {
    for (const s of SCENARIOS) console.log(`${s.name.padEnd(24)} ${s.legacyPath.padEnd(26)} ${s.description ?? ""}`);
    process.exit(0);
}
if (!flag("--all") && names.length === 0) {
    console.error("usage: bun run e2e <scenario>... | --all   [--no-build] [--list] [--json] [--trace]\nscenarios: " + SCENARIOS.map((s) => s.name).join(", "));
    process.exit(2);
}
const chosen = flag("--all") ? SCENARIOS : selectScenarios(names);
if (chosen.length === 0) { console.error(`no scenario matches ${names.join(", ")} (try --list)`); process.exit(2); }

const world = await openWorld({ build: !flag("--no-build"), log: (s) => console.log(s) });
let failed = 0;
const json: unknown[] = [];
try {
    for (const s of chosen) {
        const r = await compareScenario(s, world);
        if (!r.ok) failed++;
        console.log(`${r.text}${r.ok ? `  [${r.ms} ms]` : ""}`);
        if (flag("--trace")) console.log(`  legacy trace:\n${formatTrace(r.legacy)}`);
        json.push({ name: s.name, ok: r.ok, report: r.report });
    }
} finally {
    await world.close();
}
if (flag("--json")) console.log(JSON.stringify(json, null, 2));
console.log(`\n${chosen.length - failed}/${chosen.length} scenarios passed`);
process.exit(failed ? 1 : 0);
