import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-node";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig, type Plugin } from "vite";

// The server package is written for Bun and locates itself with import.meta.dir / import.meta.url and tests import.meta.main. Once Vite has bundled it those no longer name the server's folder, so they are replaced with what they mean in that source file: its folder, its file URL, and "not the entry point". (The image keeps server/ at the same path in the build and the run stage, so the baked-in seed is found.)
const bunMeta = (): Plugin => ({
    name: "bun-import-meta",
    enforce: "pre",
    transform(code, id) {
        const file = id.split("?")[0];
        if (!file.includes("/server/src/") || file.includes("/node_modules/")) return null;
        if (!/import\.meta\.(dir|url|main)\b/.test(code)) return null;
        return { code: code.replaceAll("import.meta.dir", JSON.stringify(dirname(file))).replaceAll("import.meta.url", JSON.stringify(pathToFileURL(file).href)).replaceAll("import.meta.main", "false"), map: null };
    },
});

// SvelteKit 3 keeps its config here (svelte.config.js is no longer read).
export default defineConfig({
    define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
    plugins: [
        bunMeta(),
        sveltekit({
            adapter: adapter({ out: "build", precompress: false }),
            // Pages are server-rendered per request from the price cache: nothing is prerendered, and the prices must never be baked into a build.
            csrf: { trustedOrigins: ["https://netquor.com", "https://www.netquor.com"] },
            // Absolute /_app URLs: the same markup whatever the page path.
            paths: { relative: false },
        }),
    ],
    server: { fs: { allow: [".."] } },
});
