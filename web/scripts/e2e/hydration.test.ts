import { describe, expect, test } from "bun:test";
import { isNoise, isSvelteWarning } from "./hydration";

describe("hydration filters", () => {
    test("Svelte hydration, a11y and state warnings count", () => {
        expect(isSvelteWarning("[svelte] hydration_mismatch\nHydration failed because the initial UI does not match")).toBe(true);
        expect(isSvelteWarning("https://svelte.dev/e/node_invalid_placement")).toBe(true);
        expect(isSvelteWarning("a11y_click_events_have_key_events")).toBe(true);
        expect(isSvelteWarning("state_referenced_locally")).toBe(true);
    });
    test("ordinary messages and offline third-party failures do not", () => {
        expect(isSvelteWarning("Failed to load resource: the server responded with a status of 404")).toBe(false);
        expect(isNoise("Failed to load resource: net::ERR_INTERNET_DISCONNECTED https://cdn.jsdelivr.net/x.css")).toBe(true);
        expect(isNoise("Uncaught TypeError: x is not a function")).toBe(false);
    });
});
