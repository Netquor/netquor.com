// navState.ts: the decisions of nav.js as a pure function. No DOM here; nav.ts reads the DOM into a NavState, calls reduceNav and writes the result back.

/** Whether the Products panel (`.nq-dd.open`) and the burger menu (`.nq-menu.open`) are open. */
export interface NavState {
    dd: boolean;
    menu: boolean;
}

/** Every input nav.js reacts to. `insideDd`: the click target is inside `.nq-dd`. `onLink`: the click target is, or is inside, an `a`. */
export type NavEvent =
    | { type: "burger-click" }
    | { type: "dd-click" }
    | { type: "dd-enter" }
    | { type: "dd-leave" }
    | { type: "doc-click"; insideDd: boolean }
    | { type: "escape" }
    | { type: "nav-click"; onLink: boolean };

/** The query nav.js runs at each event (it is not listened to). */
export const DESKTOP_QUERY = "(min-width: 992px)";

/** The next state. `desktop` is the value of `matchMedia(DESKTOP_QUERY).matches` at the moment of the event. */
export const reduceNav = (s: NavState, e: NavEvent, desktop: boolean): NavState => {
    switch (e.type) {
        case "burger-click":
            return { ...s, menu: !s.menu };
        case "dd-click":
            return { ...s, dd: desktop ? true : !s.dd };
        case "dd-enter":
            return desktop ? { ...s, dd: true } : s;
        case "dd-leave":
            return desktop ? { ...s, dd: false } : s;
        case "doc-click":
            return e.insideDd ? s : { ...s, dd: false };
        case "escape":
            return { dd: false, menu: false };
        case "nav-click":
            return e.onLink ? { dd: false, menu: false } : s;
    }
};

/** Which parts of the DOM the legacy handler for this event writes (class and aria-expanded are written as a pair, every time, even when the value is unchanged). */
export const touches = (e: NavEvent): { dd: boolean; menu: boolean } => {
    switch (e.type) {
        case "burger-click":
            return { dd: false, menu: true };
        case "dd-click":
        case "dd-enter":
        case "dd-leave":
        case "doc-click":
            return { dd: true, menu: false };
        case "escape":
            return { dd: true, menu: true };
        case "nav-click":
            return e.onLink ? { dd: true, menu: true } : { dd: false, menu: false };
    }
};
