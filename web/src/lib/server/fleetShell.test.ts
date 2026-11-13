import { describe, expect, test } from "bun:test";
import { fleetShell, FLEET_VIEWPORT, isFleetRoute } from "./fleetShell";

const SHELL = '<!doctype html>\n<html lang="en-US" data-bs-theme="dark">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>x</title>';

describe("fleetShell", () => {
    test("swaps the viewport and drops the Bootstrap theme from <html>", () => {
        const out = fleetShell(SHELL);
        expect(out).toContain(FLEET_VIEWPORT);
        expect(out).toContain("viewport-fit=cover");
        expect(out).toContain('<html lang="en-US">');
        expect(out).not.toContain("data-bs-theme");
        expect(out).not.toContain("initial-scale=1.0");
        expect(out).toContain("<title>x</title>");
    });
    test("a later chunk without the shell values comes back unchanged", () => {
        const chunk = '<div style="display: contents" data-sveltekit-reload><p>PAGE</p></div></body></html>';
        expect(fleetShell(chunk)).toBe(chunk);
    });
    test("only routes of the (fleet) group are matched", () => {
        expect(isFleetRoute("/(fleet)/fleet.html")).toBe(true);
        expect(isFleetRoute("/(site)/subnet-calculator.html")).toBe(false);
        expect(isFleetRoute("/(site)")).toBe(false);
        expect(isFleetRoute(null)).toBe(false);
        expect(isFleetRoute(undefined)).toBe(false);
    });
});
