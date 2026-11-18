// The legacy terms page draws the nav and nothing below the card: no footer.
export const load = () => ({ chrome: { footer: "none" as const } });
