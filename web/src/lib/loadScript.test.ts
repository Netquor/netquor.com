import { beforeEach, describe, expect, test } from "bun:test";
import { loadScript, resetLoadedScripts, type ScriptDoc } from "./loadScript";

type Fake = { src: string; async: boolean; onload: (() => void) | null; onerror: (() => void) | null };
const fakeDoc = () => {
    const added: Fake[] = [];
    const doc: ScriptDoc = {
        createElement: () => ({ src: "", async: true, onload: null, onerror: null }),
        head: { appendChild: (n) => added.push(n as Fake) },
    };
    return { doc, added };
};

beforeEach(() => resetLoadedScripts());

describe("loadScript", () => {
    test("adds one script tag with the URL, in order (not async), and resolves when it loads", async () => {
        const { doc, added } = fakeDoc();
        const p = loadScript("/fx.js?v=1", doc);
        expect(added.length).toBe(1);
        expect(added[0].src).toBe("/fx.js?v=1");
        expect(added[0].async).toBe(false);
        added[0].onload?.();
        await p;
    });
    test("the same script is loaded once, whatever its ?v=", async () => {
        const { doc, added } = fakeDoc();
        const a = loadScript("/fx.js?v=1", doc), b = loadScript("/fx.js?v=2", doc);
        expect(added.length).toBe(1);
        expect(a).toBe(b);
        added[0].onload?.();
        await a;
    });
    test("a failed load rejects and may be tried again", async () => {
        const { doc, added } = fakeDoc();
        const p = loadScript("/bg.js", doc);
        added[0].onerror?.();
        await expect(p).rejects.toThrow(/could not load/);
        loadScript("/bg.js", doc);
        expect(added.length).toBe(2);
    });
    test("outside a browser it rejects instead of throwing synchronously", async () => {
        await expect(loadScript("/fx.js")).rejects.toThrow(/browser only/);
    });
});
