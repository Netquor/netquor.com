// svelteHarness.ts: renders a .svelte component under `bun test` without Vite. A Bun plugin compiles .svelte files for the server and replaces SvelteKit's virtual modules ($app/state) with the file in ./stubs, whose page data the test sets.
import { plugin } from "bun";
import { readFileSync } from "node:fs";
import { compile } from "svelte/compiler";

export const pageStub: { data: Record<string, unknown>; url: URL } = { data: {}, url: new URL("http://localhost/") };
(globalThis as Record<string, unknown>).__nqPageStub = pageStub;

const stubs = new URL("./stubs/", import.meta.url).pathname;
let installed = false;
const install = () => {
    if (installed) return;
    installed = true;
    plugin({
        name: "svelte-harness",
        setup(build) {
            build.onLoad({ filter: /\.svelte$/ }, (a) => {
                const out = compile(readFileSync(a.path, "utf8"), { filename: a.path, generate: "server", dev: false });
                // Bun resolves bare specifiers before plugins see them, so the virtual module is pointed at its stub in the compiled code.
                const code = out.js.code.replaceAll('"$app/state"', JSON.stringify(stubs + "appState.ts"));
                return { loader: "js", contents: code };
            });
        },
    });
};

/** Server-renders a component (file name inside src/lib/components) with the given props and page data; returns its HTML. */
export const renderComponent = async (file: string, props: Record<string, unknown>, data: Record<string, unknown>): Promise<string> => {
    install();
    pageStub.data = data;
    const { render } = await import("svelte/server");
    const mod = await import(new URL(`../components/${file}`, import.meta.url).pathname);
    return render(mod.default, { props }).body;
};

export interface RenderedFile { body: string; head: string }

/** Server-renders any .svelte file under src (path relative to src, "routes/(site)/+layout.svelte"). `data` is page.data, `url` page.url; `inner` is the HTML the layout's `children` snippet renders. The head is returned apart from the body. */
export const renderSvelte = async (rel: string, props: Record<string, unknown>, data: Record<string, unknown>, url = "http://localhost/", inner = ""): Promise<RenderedFile> => {
    install();
    pageStub.data = data;
    pageStub.url = new URL(url);
    const { render } = await import("svelte/server");
    const { createRawSnippet } = await import("svelte");
    const mod = await import(new URL(`../../${rel}`, import.meta.url).pathname);
    const children = createRawSnippet(() => ({ render: () => `<div data-test-children>${inner}</div>` }));
    const out = render(mod.default, { props: { ...props, children } });
    return { body: out.body, head: out.head };
};
