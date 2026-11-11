// fakeDom.ts: a minimal hand-written DOM for the behavior tests (no browser, no dependency). Elements have a class list, attributes, a tree, bubbling listeners, `closest`, `contains` and querySelector(All) for compound selectors (tag, .class, #id, [attr], [attr="v"], comma lists; no combinators). Real-browser behavior is covered by the e2e scenarios.

type Listener = (e: any) => void;

const compound = /^(?:[a-zA-Z][\w-]*)?(?:\.[\w-]+|#[\w-]+|\[[\w-]+(?:="[^"]*")?\])*$/;

const matchCompound = (el: FakeEl, sel: string): boolean => {
    if (!compound.test(sel)) throw new Error(`fakeDom: unsupported selector ${sel}`);
    const tag = /^[a-zA-Z][\w-]*/.exec(sel)?.[0];
    if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    for (const m of sel.matchAll(/\.([\w-]+)|#([\w-]+)|\[([\w-]+)(?:="([^"]*)")?\]/g)) {
        if (m[1] && !el.classList.contains(m[1])) return false;
        if (m[2] && el.getAttribute("id") !== m[2]) return false;
        if (m[3]) {
            const v = el.getAttribute(m[3]);
            if (v === null) return false;
            if (m[4] !== undefined && v !== m[4]) return false;
        }
    }
    return true;
};

export const matches = (el: FakeEl, selector: string): boolean => selector.split(",").some((s) => matchCompound(el, s.trim()));

export class FakeClassList {
    private set = new Set<string>();
    constructor(private owner: FakeEl) {}
    add(...c: string[]) { c.forEach((x) => this.set.add(x)); this.owner.attrs.set("class", [...this.set].join(" ")); }
    remove(...c: string[]) { c.forEach((x) => this.set.delete(x)); this.owner.attrs.set("class", [...this.set].join(" ")); }
    contains(c: string) { return this.set.has(c); }
    toggle(c: string, force?: boolean) {
        const on = force === undefined ? !this.set.has(c) : force;
        if (on) this.add(c); else this.remove(c);
        return on;
    }
    setFrom(s: string) { this.set = new Set(s.split(/\s+/).filter(Boolean)); }
    toString() { return [...this.set].join(" "); }
}

export interface FakeEvent { type: string; target: FakeEl; defaultPrevented: boolean; propagationStopped: boolean; key?: string; preventDefault(): void; stopPropagation(): void }

export class FakeEl {
    nodeType = 1;
    attrs = new Map<string, string>();
    children: FakeEl[] = [];
    parentElement: FakeEl | null = null;
    classList = new FakeClassList(this);
    style: Record<string, string> = { height: "" };
    listeners: { type: string; fn: Listener; options?: unknown }[] = [];
    // Layout numbers a test sets.
    scrollHeight = 0;
    rectHeight = 0;
    offsetHeightReads = 0;
    tagName: string;
    constructor(tagName: string, public ownerDocument: FakeDoc | null = null) { this.tagName = tagName.startsWith("#") ? tagName : tagName.toUpperCase(); }
    get offsetHeight() { this.offsetHeightReads++; return this.rectHeight; }
    get id() { return this.getAttribute("id") ?? ""; }
    getAttribute(n: string) { return this.attrs.has(n) ? this.attrs.get(n)! : null; }
    setAttribute(n: string, v: unknown) { this.attrs.set(n, String(v)); if (n === "class") this.classList.setFrom(String(v)); }
    hasAttribute(n: string) { return this.attrs.has(n); }
    getBoundingClientRect() { return { height: this.rectHeight }; }
    append(...c: FakeEl[]) { for (const x of c) { x.parentElement = this; x.ownerDocument = this.ownerDocument; this.children.push(x); } return this; }
    addEventListener(type: string, fn: Listener, options?: unknown) { this.listeners.push({ type, fn, options }); }
    removeEventListener(type: string, fn: Listener) { this.listeners = this.listeners.filter((l) => !(l.type === type && l.fn === fn)); }
    listenerCount(type?: string) { return this.listeners.filter((l) => !type || l.type === type).length; }
    contains(n: FakeEl | null): boolean { for (let x: FakeEl | null = n; x; x = x.parentElement) if (x === this) return true; return false; }
    closest(sel: string): FakeEl | null { for (let x: FakeEl | null = this; x; x = x.parentElement) if (x.nodeType === 1 && matches(x, sel)) return x; return null; }
    descendants(): FakeEl[] { return this.children.flatMap((c) => [c, ...c.descendants()]); }
    querySelectorAll<T = FakeEl>(sel: string): T[] { return this.descendants().filter((e) => matches(e, sel)) as unknown as T[]; }
    querySelector<T = FakeEl>(sel: string): T | null { return this.querySelectorAll<T>(sel)[0] ?? null; }
    /** Dispatches a DOM-like event from this element: target phase, then up the parents, then the document (bubbling), honoring stopPropagation. */
    dispatchEvent(ev: any): boolean {
        const e = ev as FakeEvent;
        if (!e.target) { try { (e as any).target = this; } catch { /* a real Event has a read-only target */ } }
        const path: (FakeEl | FakeDoc)[] = [];
        for (let x: FakeEl | null = this; x; x = x.parentElement) path.push(x);
        if (this.ownerDocument) path.push(this.ownerDocument);
        for (const node of path) {
            for (const l of [...node.listeners]) if (l.type === ev.type) l.fn(ev);
            if ((ev as FakeEvent).propagationStopped) break;
        }
        return !ev.defaultPrevented;
    }
    /** A plain event object a test fires. */
    fire(type: string, init: Partial<FakeEvent> = {}): FakeEvent {
        const ev: FakeEvent = { type, target: init.target ?? this, defaultPrevented: false, propagationStopped: false, key: init.key, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.propagationStopped = true; } };
        this.dispatchEvent(ev);
        return ev;
    }
}

export class FakeDoc extends FakeEl {
    nodeType = 9;
    documentElement: FakeEl;
    defaultView: { matchMedia(q: string): { matches: boolean; media: string }; getComputedStyle: (e: FakeEl) => any };
    desktop = true;
    mediaQueries: string[] = [];
    constructor() {
        super("#document");
        this.ownerDocument = null;
        this.documentElement = new FakeEl("html", this);
        const self = this;
        this.defaultView = {
            matchMedia(q: string) { self.mediaQueries.push(q); return { get matches() { return self.desktop; }, media: q }; },
            getComputedStyle: () => ({ transitionDuration: "0s", transitionDelay: "0s" }),
        };
    }
    override contains(n: FakeEl | null): boolean { return !!n; }
    override dispatchEvent(ev: any) { for (const l of [...this.listeners]) if (l.type === ev.type) l.fn(ev); return true; }
    override querySelectorAll<T = FakeEl>(sel: string): T[] { return this.documentElement.querySelectorAll<T>(sel); }
}

/** Builds an element: `h(doc, "button", { class: "a b", id: "x", "data-bs-target": "#p" }, children)`. */
export const h = (doc: FakeDoc, tag: string, attrs: Record<string, string> = {}, children: FakeEl[] = []): FakeEl => {
    const e = new FakeEl(tag, doc);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    e.append(...children);
    return e;
};

/** A manual timer queue for the transitions. */
export const manualTimers = () => {
    let now = 0;
    let next = 1;
    const tasks = new Map<number, { at: number; fn: () => void }>();
    return {
        setTimeout(fn: () => void, ms: number) { const id = next++; tasks.set(id, { at: now + ms, fn }); return id; },
        clearTimeout(id: unknown) { tasks.delete(id as number); },
        advance(ms: number) {
            const end = now + ms;
            for (;;) {
                const due = [...tasks.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
                if (!due) break;
                tasks.delete(due[0]);
                now = due[1].at;
                due[1].fn();
            }
            now = end;
        },
        get pending() { return tasks.size; },
    };
};
