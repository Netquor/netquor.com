// A minimal hand-written DOM for the fx tests: just enough surface for the actions (classList, style, attributes, children, events, cloneNode, closest) and a table-driven querySelectorAll (exact selector string to prepared nodes), so no selector engine is faked.
export class FakeClassList {
    set = new Set<string>();
    add(...c: string[]) { c.forEach((x) => this.set.add(x)); }
    remove(...c: string[]) { c.forEach((x) => this.set.delete(x)); }
    toggle(c: string, force?: boolean) { const on = force ?? !this.set.has(c); if (on) this.set.add(c); else this.set.delete(c); return on; }
    contains(c: string) { return this.set.has(c); }
}
export class FakeStyle {
    props: Record<string, string> = {};
    transform = ""; transitionDelay = ""; animationDelay = "";
    setProperty(k: string, v: string) { this.props[k] = v; }
    getPropertyValue(k: string) { return this.props[k] ?? ""; }
}
type Fn = (e?: unknown) => void;
export class FakeEl {
    classList = new FakeClassList();
    style = new FakeStyle();
    attrs: Record<string, string> = {};
    children: FakeEl[] = [];
    parentNode: FakeEl | null = null;
    listeners: Record<string, { fn: Fn; opts?: unknown }[]> = {};
    queries: Record<string, FakeEl[]> = {};
    bbox: { x: number; y: number; width: number; height: number } | null = null;
    rect = { left: 0, top: 0 };
    cardOf: FakeEl | null = null;
    ownerDocument: FakeDoc;
    constructor(public tag: string, doc?: FakeDoc) { this.ownerDocument = doc ?? (this as unknown as FakeDoc); }
    get firstChild() { return this.children[0] ?? null; }
    setAttribute(k: string, v: string) { this.attrs[k] = v; if (k === "class") { this.classList.set = new Set(v.split(/\s+/).filter(Boolean)); } }
    getAttribute(k: string) { return k in this.attrs ? this.attrs[k] : null; }
    removeAttribute(k: string) { delete this.attrs[k]; }
    appendChild(c: FakeEl) { c.parentNode = this; this.children.push(c); return c; }
    insertBefore(c: FakeEl, ref: FakeEl | null) { c.parentNode = this; const i = ref ? this.children.indexOf(ref) : this.children.length; this.children.splice(i, 0, c); return c; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((x) => x !== this); this.parentNode = null; }
    cloneNode() { const c = new FakeEl(this.tag, this.ownerDocument); c.attrs = { ...this.attrs }; c.classList.set = new Set(this.classList.set); return c; }
    getBBox() { if (!this.bbox) throw new Error("not rendered"); return this.bbox; }
    getBoundingClientRect() { return this.rect; }
    closest() { return this.cardOf; }
    querySelectorAll(sel: string) { return this.queries[sel] ?? []; }
    addEventListener(t: string, fn: Fn, opts?: unknown) { (this.listeners[t] ??= []).push({ fn, opts }); }
    removeEventListener(t: string, fn: Fn) { this.listeners[t] = (this.listeners[t] ?? []).filter((l) => l.fn !== fn); }
    fire(t: string, e?: unknown) { for (const l of [...(this.listeners[t] ?? [])]) l.fn(e); }
    count(t: string) { return (this.listeners[t] ?? []).length; }
}
export class FakeDoc extends FakeEl {
    documentElement = new FakeEl("html", this);
    body = new FakeEl("body", this);
    constructor() { super("#document"); this.ownerDocument = this; }
    createElement(tag: string) { return new FakeEl(tag, this); }
    createElementNS(_ns: string, tag: string) { return new FakeEl(tag, this); }
}
export const asAny = <T>(x: unknown) => x as T;
