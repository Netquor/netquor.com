// fleetShell.ts: the <html> and viewport of the (fleet) route group. src/app.html is shared and is written for the site pages (dark Bootstrap theme, a plain viewport); fleet.html has its own design: no data-bs-theme on <html>, and a viewport with viewport-fit=cover (so the page can use the safe-area insets on a notch). hooks.server.ts applies this with transformPageChunk to pages of the (fleet) group only.
export const SHELL_VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
export const FLEET_VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';
export const SHELL_THEME = ' data-bs-theme="dark"';

/** True for a route id inside the (fleet) group ("/(fleet)/fleet.html"). */
export const isFleetRoute = (routeId: string | null | undefined): boolean => !!routeId && routeId.startsWith("/(fleet)/");

/** A chunk of the page's HTML with the shell's site-wide values swapped for the Fleet page's. A chunk without them is returned as it is. */
export const fleetShell = (html: string): string => html.replace(SHELL_VIEWPORT, FLEET_VIEWPORT).replace(`<html lang="en-US"${SHELL_THEME}>`, '<html lang="en-US">');
