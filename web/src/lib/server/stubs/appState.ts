// Test stand-in for SvelteKit's $app/state: page.data is set by svelteHarness.
export const page = (globalThis as unknown as { __nqPageStub: { data: Record<string, unknown> } }).__nqPageStub;
