// context.ts: how the Fleet page's sections find the one model they share (the calculator, the form and the "Add it to my estimate" link sit in different components).
import { getContext, setContext } from "svelte";
import { createFleetModel, type FleetModel } from "./model";
import { fleetPricesFrom } from "./prices";

const KEY = Symbol("netquor.fleet.model");

/** Called once by the page component: makes the model available to the sections below it. */
export const provideFleetModel = (model: FleetModel): FleetModel => setContext(KEY, model);

/** The page's model; a section rendered on its own (a test) gets a private one built from the last-known prices. */
export const useFleetModel = (): FleetModel => getContext<FleetModel | undefined>(KEY) ?? createFleetModel({ prices: fleetPricesFrom(undefined) });
