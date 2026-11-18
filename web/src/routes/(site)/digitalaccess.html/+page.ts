// The legacy page draws its own footer (below the main content), so the layout draws none.
export const load = () => ({ chrome: { footer: "none" as const } });
