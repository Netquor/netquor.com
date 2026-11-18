# tools

Small developer tools that are not part of the web app or the server.

- `build-agent-facts.ts`: writes `.agents/agent/facts.json` (private, git-ignored) for the website AI agent from the sources that ship: the home page data (`web/src/lib/pages/index/data.ts`), the seed prices (`server/data/prices.seed.json`) and the social accounts (`web/src/lib/data/social.json`). Run `bun tools/build-agent-facts.ts` after changing a product card, a price row or a seed price. It never writes outside `.agents/agent/`.
- `ui-audit.js`: a DOM audit you run inside a browser on any page (overflow, uneven cards in a row, wrapped labels, small tap targets, contrast under 4.5:1, unlabeled controls). Paste the file's contents into the browser console (the app does not serve `/tools`), then call the exported function. It reads only the page it runs on.

Gone on purpose: the scripts that stamped or generated the legacy HTML (nav, program pages, product rename, social links). The nav and footer are Svelte components now, the social accounts are `web/src/lib/data/social.json`, and the legacy site survives only as the `legacy-baseline-2026-11` git tag that the regression tools materialize (`bun run baseline` in `web/`).
