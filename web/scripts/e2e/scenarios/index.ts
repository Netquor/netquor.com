// index.ts: the scenario registry. Add a file under scenarios/ and list it here.
import type { Scenario } from "../scenario";
import { validateScenario } from "../scenario";
import analytics from "./analytics";
import bg from "./bg";
import collapse from "./collapse";
import fleet from "./fleet";
import fx from "./fx";
import nav from "./nav";
import nudge from "./nudge";
import readiness from "./readiness";
import subnet from "./subnet";

export const SCENARIOS: Scenario[] = [...nav, ...fx, ...bg, ...nudge, ...analytics, ...readiness, ...collapse, ...subnet, ...fleet];

/** A name selects the scenario with that name, and every scenario whose name starts with it plus a hyphen ("collapse" selects collapse-vpn, collapse-sdn, ...). */
export const selectScenarios = (names: string[], all: Scenario[] = SCENARIOS): Scenario[] =>
    all.filter((s) => names.some((n) => s.name === n || s.name.startsWith(`${n}-`)));

for (const s of SCENARIOS) validateScenario(s);
