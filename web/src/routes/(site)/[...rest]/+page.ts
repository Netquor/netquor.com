// The catch-all of the (site) group: an address no page matches is a 404, drawn by (site)/+error.svelte inside the site layout (nav, footer, styles). Routes with a name always win over a rest route, so this only sees what nothing else claims.
import { error } from "@sveltejs/kit";

export const load = () => { error(404, "Not found"); };
