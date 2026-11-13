// crash.child.ts: a process the store and ingest tests start. It ingests one snapshot against a real folder and kills itself (SIGKILL) at the moment named by CHILD_KILL_AT:
//   "temp"     after the new prices.json temp file is complete, before any rename
//   "prev"     after prices.prev.json was replaced, before prices.json is
//   "rename"   right after prices.json was replaced (so before the cache would have been updated)
//   "none"     never
import { createPriceCache } from "./cache";
import { createIngest } from "./ingest";
import { fileStore } from "./store";
import { snap } from "./testkit";

const dir = process.env.CHILD_DIR as string, seed = process.env.CHILD_SEED as string, killAt = process.env.CHILD_KILL_AT as string;
const kill = () => process.kill(process.pid, "SIGKILL");
const store = fileStore(dir, {
    seedFile: seed,
    hooks: { beforeRename: (_temp, target) => {
        if (killAt === "temp" && target.endsWith("prices.prev.json")) kill();
        if (killAt === "prev" && target.endsWith("prices.json")) kill();
    } },
});
const cache = createPriceCache({ store, clock: Date.now });
const { ingestSnapshot } = createIngest({ cache, store, clock: Date.now });
cache.subscribe(() => { if (killAt === "rename") kill(); });
const next = snap(cache.get().version + 1, { "a.one": 110, "b.two": 200, "c.three": 300, "d.four": 400 });
// "rename" kills inside replace(), i.e. after the file is on disk and before the cache finished.
await ingestSnapshot(next, { source: "webhook" });
console.log("done");
