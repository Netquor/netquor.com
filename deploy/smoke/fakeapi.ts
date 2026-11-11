// A tiny stand-in for the Netquor pricing API, for deploy/smoke.sh only. GET /prices returns a snapshot (version 3, Fleet Mac
// at $6.40) with an ETag and answers 304 to a matching If-None-Match, like the real one. GET /__stats says how many times it
// was asked and how many of those were answered 304 (proof that the worker sends If-None-Match).
import { readFileSync } from "node:fs";

const seed = JSON.parse(readFileSync(process.env.PRICES_SEED_FILE ?? "/app/server/data/prices.seed.json", "utf8"));
const snapshot = { ...seed, version: 3, updatedAt: new Date().toISOString(), source: "api", prices: { ...seed.prices, "fleet.mac.month": { ...seed.prices["fleet.mac.month"], amountCents: 640 } } };
const etag = '"smoke-v3"';
let total = 0, notModified = 0, withBearer = 0;

Bun.serve({
    port: 9100,
    hostname: "0.0.0.0",
    fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/__stats") return Response.json({ total, notModified, withBearer });
        if (url.pathname !== "/prices") return new Response("not found", { status: 404 });
        total++;
        if (req.headers.get("authorization") === "Bearer smoke-api-token") withBearer++;
        if (req.headers.get("if-none-match") === etag) { notModified++; return new Response(null, { status: 304, headers: { etag } }); }
        return new Response(JSON.stringify(snapshot), { headers: { "content-type": "application/json", etag } });
    },
});
console.log("fakeapi listening on 9100");
