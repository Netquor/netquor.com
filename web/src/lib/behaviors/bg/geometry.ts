// geometry.ts: the pure parts of bg.js: grid snapping, the four circuit traces, the SVG markup, the pulse state machine.
export const G = 48;
export type Pt = readonly [number, number];
export type Path = readonly Pt[];

export const snap = (v: number): number => Math.round(v / G) * G;

type Seed = readonly [number, (base: number) => number, readonly Pt[]];
const SEEDS: readonly Seed[] = [
    [0.04, (b) => b, [[0, 0], [2, 0], [2, -1], [5, -1]]],
    [0.3, (b) => b + G, [[0, 0], [4, 0], [4, -1], [8, -1]]],
    [0.62, (b) => b, [[0, 0], [3, 0], [3, 1], [7, 1]]],
    [0.86, (b) => b, [[0, 0], [2, 0], [2, -1], [4, -1]]],
];

/** The traces for a hero of W x H: origin snapped to the grid, points beyond the right or bottom edge or on or above the top edge dropped, a trace with fewer than two points skipped. */
export const buildPaths = (W: number, H: number): Path[] => {
    const base = snap(H - 32);
    const out: Path[] = [];
    for (const [fx, oyOf, steps] of SEEDS) {
        const ox = snap(W * fx), oy = oyOf(base);
        const P = steps.map((p): Pt => [ox + p[0] * G, oy + p[1] * G]).filter((p) => p[0] <= W && p[1] <= H && p[1] > 0);
        if (P.length >= 2) out.push(P);
    }
    return out;
};

/** The svg's inner markup (grid pattern #nqg, fade #nqf, traces and end nodes), character for character what bg.js writes. */
export const svgMarkup = (paths: readonly Path[]): string => {
    let out = "";
    for (const P of paths) {
        out += '<polyline points="' + P.map((p) => p.join(",")).join(" ") + '" fill="none" stroke="#2f8fe0" stroke-opacity=".3" stroke-width="1.5" stroke-linejoin="round"/>';
        const e = P[P.length - 1];
        out += '<circle cx="' + e[0] + '" cy="' + e[1] + '" r="3.5" fill="#12161c" stroke="#5eaaf0" stroke-opacity=".6" stroke-width="1.5"/>';
    }
    return '<defs><pattern id="nqg" width="' + G + '" height="' + G + '" patternUnits="userSpaceOnUse"><path d="M' + G + " 0H0V" + G + '" fill="none" stroke="#eaf1f8" stroke-opacity=".05"/></pattern>' +
        '<linearGradient id="nqf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12161c" stop-opacity="1"/><stop offset=".35" stop-color="#12161c" stop-opacity=".2"/><stop offset=".8" stop-color="#12161c" stop-opacity=".1"/><stop offset="1" stop-color="#12161c" stop-opacity="1"/></linearGradient></defs>' +
        '<rect width="100%" height="100%" fill="url(#nqg)"/>' + out + '<rect width="100%" height="100%" fill="url(#nqf)"/>';
};

export const pathLength = (P: Path): number => {
    let L = 0;
    for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    return L;
};

/** The point d pixels along the path (the end point when d is past it). */
export const pointAt = (P: Path, d: number): Pt => {
    for (let i = 1; i < P.length; i++) {
        const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
        if (d <= l) {
            const t = d / l;
            return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * t, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * t];
        }
        d -= l;
    }
    return P[P.length - 1];
};

export const FIRST_PULSE_AT = 1200;
export const PULSE_GAP = 6000;
export const PULSE_SPEED = 0.16;
export const MAX_STEP = 50;
export const TAIL = 60;

export interface PulseState {
    pulse: { P: Path; L: number; d: number } | null;
    nextAt: number;
    last: number;
    idx: number;
}
export const initialPulse = (): PulseState => ({ pulse: null, nextAt: FIRST_PULSE_AT, last: 0, idx: 0 });

/** One painted square: x, y, size and the fill colour string bg.js builds. */
export interface Dot { x: number; y: number; size: 3; fill: string }

export interface Frame { dots: Dot[]; /** The pulse just ended: clear the canvas again after painting, as bg.js does. */ clearAfter: boolean }

/** Advances the pulse for rAF timestamp t, mutating `s`. Returns null when the frame is skipped (inactive: the canvas is not touched), else what to do: clear the canvas, paint the dots, clear again when the pulse ended. */
export const stepPulse = (s: PulseState, t: number, paths: readonly Path[], active: boolean): Frame | null => {
    if (!active) { s.last = t; return null; }
    const dots: Dot[] = [];
    let clearAfter = false;
    if (!s.pulse && t > s.nextAt && paths.length) {
        const P = paths[s.idx++ % paths.length];
        s.pulse = { P, L: pathLength(P), d: 0 };
    }
    if (s.pulse) {
        s.pulse.d += Math.min(t - s.last, MAX_STEP) * PULSE_SPEED;
        for (let k = 0; k < TAIL; k += 3) {
            const d = s.pulse.d - k;
            if (d < 0 || d > s.pulse.L) continue;
            const q = pointAt(s.pulse.P, d);
            dots.push({ x: q[0] - 1.5, y: q[1] - 1.5, size: 3, fill: "rgba(94,170,240," + ((1 - k / TAIL) * 0.85) + ")" });
        }
        if (s.pulse.d > s.pulse.L + TAIL) { s.pulse = null; s.nextAt = t + PULSE_GAP; clearAfter = true; }
    }
    s.last = t;
    return { dots, clearAfter };
};
