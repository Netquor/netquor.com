// loadScript.ts: loads a legacy vanilla script after hydration, from a page's onMount. For scripts that change the DOM they find (fx.js adds classes to sections, bg.js inserts into .hero-section, readiness.js fills result boxes): run before hydration they would break it, so they must wait. Pure scripts that only define window globals (subnet-calc.js, cost-calc.js, bundle-calc.js) can stay a <script src> in <svelte:head> as the pilot does.
//   onMount(() => { void loadScript(assetUrl(data.assets, "fx")); });
// One load per URL (ignoring ?v=) however many times it is called; the promise resolves when the script has run and rejects when it fails to load.
export interface ScriptDoc {
    createElement(tag: "script"): { src: string; async: boolean; onload: (() => void) | null; onerror: (() => void) | null };
    head: { appendChild(node: unknown): unknown };
}

const loads = new Map<string, Promise<void>>();

const keyOf = (url: string): string => url.split("?")[0];

export const loadScript = (url: string, doc: ScriptDoc | undefined = typeof document === "undefined" ? undefined : (document as unknown as ScriptDoc)): Promise<void> => {
    if (!doc) return Promise.reject(new Error("loadScript runs in the browser only (call it from onMount)"));
    const key = keyOf(url);
    const hit = loads.get(key);
    if (hit) return hit;
    const p = new Promise<void>((resolve, reject) => {
        const s = doc.createElement("script");
        s.src = url;
        s.async = false;
        s.onload = () => resolve();
        s.onerror = () => { loads.delete(key); reject(new Error(`could not load ${url}`)); };
        doc.head.appendChild(s);
    });
    loads.set(key, p);
    return p;
};

/** Test seam. */
export const resetLoadedScripts = (): void => loads.clear();
