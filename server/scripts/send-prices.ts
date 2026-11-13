// scripts/send-prices.ts: push a snapshot to the local web process as an operator. See src/prices/operator.ts and src/prices/README.md.
//   bun server/scripts/send-prices.ts <snapshot.json> --reason "<text>" [--allow-large] [--rebase-version]
// Reads PRICING_WEBHOOK_SECRET from the environment and WEB_INTERNAL_URL (default http://127.0.0.1:3000). In the container: docker exec <web> bun server/scripts/send-prices.ts /tmp/snapshot.json --reason "..."
import { runOperator } from "../src/prices/operator";

process.exit(await runOperator({ argv: process.argv.slice(2), env: process.env, fetch: (u, i) => fetch(u, i), now: Date.now, out: console.log, err: console.error }));
