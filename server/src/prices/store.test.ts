// store.test.ts: the file store: load order, atomic writes, prices.prev.json, baseline.json, and a process killed at each worst moment.
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPriceCache } from "./cache";
import { serializeSnapshot } from "./snapshot";
import { StoreError, fileStore } from "./store";
import { snap, tempDir } from "./testkit";

const cleanups: (() => void)[] = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); });
const dir = () => { const t = tempDir(); cleanups.push(t.cleanup); return t.dir; };
const put = (d: string, name: string, s: unknown) => writeFileSync(join(d, name), typeof s === "string" ? s : serializeSnapshot(s as never));
const read = (d: string, name: string) => JSON.parse(readFileSync(join(d, name), "utf8"));

const setup = () => {
    const d = dir(), seed = join(d, "seed.json");
    put(d, "seed.json", snap(1, undefined, { source: "seed" }));
    const data = join(d, "data");
    mkdirSync(data);
    return { data, seed };
};

describe("load", () => {
    test("with no live file it loads the seed", () => {
        const { data, seed } = setup();
        const l = fileStore(data, { seedFile: seed }).load();
        expect(l).toMatchObject({ from: "seed", problems: [] });
        expect(l.snapshot.version).toBe(1);
    });

    test("prices.json wins over the seed, even when the seed has a higher version", () => {
        const { data, seed } = setup();
        put(data, "prices.json", snap(3));
        writeFileSync(seed, serializeSnapshot(snap(9)));
        expect(fileStore(data, { seedFile: seed }).load()).toMatchObject({ from: "current" });
        expect(fileStore(data, { seedFile: seed }).load().snapshot.version).toBe(3);
    });

    test("a damaged prices.json falls back to prices.prev.json, then to the seed, and says so", () => {
        const { data, seed } = setup();
        put(data, "prices.json", "{ nope");
        put(data, "prices.prev.json", snap(2));
        const l = fileStore(data, { seedFile: seed }).load();
        expect(l).toMatchObject({ from: "prev" });
        expect(l.snapshot.version).toBe(2);
        expect(l.problems[0]).toContain("prices.json is not JSON");
        put(data, "prices.prev.json", "{\"schema\": 1}");
        expect(fileStore(data, { seedFile: seed }).load()).toMatchObject({ from: "seed" });
    });

    test("nothing valid anywhere is an error naming the problem", () => {
        const { data, seed } = setup();
        writeFileSync(seed, "garbage");
        expect(() => fileStore(data, { seedFile: seed }).load()).toThrow(StoreError);
        expect(() => fileStore(data, { seedFile: join(data, "missing.json") }).load()).toThrow("missing");
    });
});

describe("write", () => {
    test("keeps the previous file as prices.prev.json, stores canonical bytes, leaves no temp file", () => {
        const { data, seed } = setup();
        const store = fileStore(data, { seedFile: seed });
        store.write(snap(2));
        expect(existsSync(join(data, "prices.prev.json"))).toBe(false); // nothing to keep the first time
        store.write(snap(3));
        expect(read(data, "prices.json").version).toBe(3);
        expect(read(data, "prices.prev.json").version).toBe(2);
        expect(readFileSync(join(data, "prices.json"), "utf8")).toBe(serializeSnapshot(snap(3)));
        expect(readdirSync(data).sort()).toEqual(["prices.json", "prices.prev.json"]);
    });

    test("a failed write leaves prices.json and prices.prev.json exactly as they were", () => {
        const { data, seed } = setup();
        const good = fileStore(data, { seedFile: seed });
        good.write(snap(2)); good.write(snap(3));
        const before = { cur: readFileSync(join(data, "prices.json"), "utf8"), prev: readFileSync(join(data, "prices.prev.json"), "utf8") };
        for (const failOn of ["prices.json", "prices.prev.json"]) {
            const bad = fileStore(data, { seedFile: seed, hooks: { beforeRename: (_t, target) => { if (target.endsWith(failOn)) throw new Error("disk full"); } } });
            expect(() => bad.write(snap(4))).toThrow("disk full");
            expect(readFileSync(join(data, "prices.json"), "utf8")).toBe(before.cur);
            expect(readFileSync(join(data, "prices.prev.json"), "utf8")).toBe(before.prev);
            expect(readdirSync(data).filter((n) => n.endsWith(".tmp"))).toEqual([]);
        }
    });

    test("a failed first write leaves no prices.prev.json behind", () => {
        const { data, seed } = setup();
        const store = fileStore(data, { seedFile: seed });
        store.write(snap(2));
        const bad = fileStore(data, { seedFile: seed, hooks: { beforeRename: (_t, target) => { if (target.endsWith("prices.json")) throw new Error("boom"); } } });
        expect(() => bad.write(snap(3))).toThrow("boom");
        expect(existsSync(join(data, "prices.prev.json"))).toBe(false);
    });

    test("a damaged current file never overwrites a good prices.prev.json", () => {
        const { data, seed } = setup();
        put(data, "prices.prev.json", snap(2));
        put(data, "prices.json", "{ nope");
        fileStore(data, { seedFile: seed }).write(snap(5));
        expect(read(data, "prices.prev.json").version).toBe(2);
        expect(read(data, "prices.json").version).toBe(5);
    });
});

describe("baseline.json", () => {
    test("missing reads as null; a round trip keeps the sorted keys; junk reads as null", () => {
        const { data, seed } = setup();
        const store = fileStore(data, { seedFile: seed });
        expect(store.readBaseline()).toBeNull();
        store.writeBaseline({ keys: ["b.x", "a.x"], version: 4, acceptedAt: "2026-11-10T00:00:00.000Z", reason: "ok" });
        expect(read(data, "baseline.json").keys).toEqual(["a.x", "b.x"]);
        expect(store.readBaseline()).toEqual({ keys: ["a.x", "b.x"], version: 4, acceptedAt: "2026-11-10T00:00:00.000Z", reason: "ok" });
        put(data, "baseline.json", '{"keys": [1]}');
        expect(store.readBaseline()).toBeNull();
        put(data, "baseline.json", "nope");
        expect(store.readBaseline()).toBeNull();
    });
});

describe("a process killed in the middle of an ingest", () => {
    const run = async (killAt: string) => {
        const { data, seed } = setup();
        put(data, "prices.json", snap(5)); // version 5 is live; the child tries to ingest version 6
        const child = Bun.spawn(["bun", join(import.meta.dir, "crash.child.ts")], { env: { ...process.env, CHILD_DIR: data, CHILD_SEED: seed, CHILD_KILL_AT: killAt }, stdout: "pipe", stderr: "ignore" });
        await child.exited;
        const restarted = createPriceCache({ store: fileStore(data, { seedFile: seed }), clock: Date.now });
        return { child, data, restarted };
    };

    test("before anything is renamed: the old snapshot is live after a restart, files whole", async () => {
        const r = await run("temp");
        expect(r.child.signalCode).toBe("SIGKILL");
        expect(r.restarted.get().version).toBe(5);
        expect(read(r.data, "prices.json").version).toBe(5);
    });

    test("after prices.prev.json is replaced and before prices.json is: still the old snapshot, prev is a valid file", async () => {
        const r = await run("prev");
        expect(r.child.signalCode).toBe("SIGKILL");
        expect(r.restarted.get().version).toBe(5);
        expect(read(r.data, "prices.prev.json").version).toBe(5);
    });

    test("after prices.json is replaced and before the cache is updated: the restart loads the new snapshot", async () => {
        const r = await run("rename");
        expect(r.child.signalCode).toBe("SIGKILL");
        expect(r.restarted.get().version).toBe(6);
        expect(r.restarted.get().prices["a.one"].amountCents).toBe(110);
        expect(read(r.data, "prices.prev.json").version).toBe(5);
    });

    test("and with no kill it simply applies (the control)", async () => {
        const r = await run("none");
        expect(r.child.exitCode).toBe(0);
        expect(r.restarted.get().version).toBe(6);
    });

    test("a torn prices.json (as a crashed non-atomic writer would leave) loads the previous snapshot", async () => {
        const { data, seed } = setup();
        put(data, "prices.prev.json", snap(5));
        put(data, "prices.json", serializeSnapshot(snap(6)).slice(0, 40));
        expect(createPriceCache({ store: fileStore(data, { seedFile: seed }), clock: Date.now }).get().version).toBe(5);
    });
});
