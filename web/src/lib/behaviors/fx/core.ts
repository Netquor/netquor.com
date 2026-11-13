// Pure parts of the fx.js port: constants, selectors and the small computations (progress scale, label to trace mapping, stagger, tap rect, spotlight offsets). No DOM access here, so every decision is unit tested without a browser.

/** The media query fx.js reads once at load. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** fx.js: `matchMedia && matchMedia(query).matches`, read once, never re-evaluated. */
export const prefersReducedMotion = (win: { matchMedia?: (q: string) => { matches: boolean } } | undefined): boolean =>
    !!(win && win.matchMedia && win.matchMedia(REDUCED_MOTION_QUERY).matches);

/** Fraction scrolled, 0..1. `h = scrollHeight - innerHeight`; no scrollable height gives 0. Legacy does not clamp below 0 (a rubber-band overscroll can report a negative scrollY). */
export const progressScale = (scrollHeight: number, innerHeight: number, scrollY: number): number => {
    const h = scrollHeight - innerHeight;
    return h > 0 ? Math.min(1, scrollY / h) : 0;
};

/** The inline `transform` value the progress line carries. */
export const progressTransform = (v: number): string => `scaleX(${v})`;

/** Label index to trace index. The centre label (Netquor Central) is authored first and its trace last. */
export const LABEL_TRACE_ORDER: readonly number[] = [8, 0, 1, 2, 3, 4, 5, 6, 7];
export const traceIndexForLabel = (labelIndex: number): number | undefined => LABEL_TRACE_ORDER[labelIndex];

/** `pathLength` written on every trace and every pulse clone, so the CSS dash pattern (5 95) is a percentage of the line. */
export const PATH_LENGTH = "100";

/** Pulse `i` starts 0.55 s after pulse `i - 1`. Rounded to two decimals, which is what the browser reports for the legacy float (`3 * 0.55` is 1.6500000000000001). */
export const pulseDelay = (i: number): string => `${Number((i * 0.55).toFixed(2))}s`;

export interface Box { x: number; y: number; width: number; height: number }
/** The invisible tap area behind a label: 14 px each side, 22 px top and bottom. */
export const tapRect = (b: Box): Box => ({ x: b.x - 14, y: b.y - 22, width: b.width + 28, height: b.height + 44 });

/** Reveal targets in document order (one selector list, as fx.js queries it). */
export const REVEAL_SELECTOR = ".nq-section-head, .nq-who, .nq-app, .nq-calc, .nq-start, .nq-bundle, .nq-prices, .nq-cmp-list details, .nq-facts li, .nq-together li, .nq-check";
export const REVEAL_OPTIONS = { threshold: 0.12, rootMargin: "0px 0px -6% 0px" } as const;
/** Three-step stagger over the document-order index. */
export const revealDelay = (i: number): string => `${(i % 3) * 70}ms`;

/** Cards the spotlight follows the pointer on. */
export const SPOTLIGHT_SELECTOR = ".nq-app, .nq-who, .nq-calc, .nq-check, .nq-prices-row";
export const spotlightOffset = (clientX: number, clientY: number, rect: { left: number; top: number }): { mx: string; my: string } => ({ mx: `${clientX - rect.left}px`, my: `${clientY - rect.top}px` });

/** Class names the port toggles (the CSS in nq.css depends on exactly these). */
export const CLASSES = { progress: "nq-progress", pulse: "nq-pulse", hot: "hot", revealOn: "nq-reveal-on", reveal: "nq-r", shown: "nq-shown" } as const;
