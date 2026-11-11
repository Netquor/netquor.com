# Price inventory

`price-inventory.json` lists every dollar amount the legacy pages at the repo root show, so the page migration can render each one with `<Price key=.../>` from the price cache. It has 258 entries across 16 pages (101 derived, 24 jsonld, 120 price, 13 range-part).

Regenerate it with `bun web/migration/scan-prices.ts` (the script fails and names the line when a page gains an amount it does not classify). `web/src/lib/priceInventory.test.ts` re-runs the scan, so a new price on a page fails `bun test` until it is classified.

## Shape

`{ pages: { "<file>.html": [ { text, key, kind, note, line, amount } ] } }`

- `text`: the visible text around the amount with tags removed (for a meta or title attribute, the attribute value; for JSON-LD, `"price": "x"` and the offer name; for the Network page's JS table, `<name>: price <n>`).
- `key`: the seed key that supplies the amount, or `null`.
- `kind`: `price` is a plain published price with a key. `range-part` is one end of a range or list ("$5 to $30", "$5 · $10 · $20 · $30"). `jsonld` is a `price` inside JSON-LD. `derived` is anything without a key: example arithmetic, rounded volume or half-price figures, referral credits, the liability cap, exchange rates, and third-party competitor prices on compare.html (editorial facts about other vendors, not Netquor prices).
- `note`: why, and for `derived` the expression it comes from.
- `line`, `amount`: where it is and the amount as written.

Percentages and non-price numbers (devices, Mbps, AS numbers) are never listed. A derived figure is not a key; when its inputs change it must be recomputed, not fetched.

## Key naming

`<product>.<plan>.<term>` in lowercase. Terms: `month`, `year`, `lifetime`, `setup`, and `once` for a one-time hardware or service price. Underscores are allowed after the first segment (`network.addon_ipv6_48.month`, `digitalaccess.tenant_addon.month`). `from` and `to` name a starting or top price (`vpn.from.month`); when the starting price is also a named plan the two keys carry the same amount on purpose (`vpn.lite.month` and `vpn.from.month`, `network.homelab.month` and `network.from.month`, `homeassistant.resilient.month` and `homeassistant.from.month`). Use the plan key where the page names the plan, the `from` key where it says "from". Phone stays `phone.planned_launch.month` (early access, not billed); no other Phone key exists.

`bundle-calc.js` and `cost-calc.js` hold the Fleet amounts as numbers; they are existing keys and are not pages, so they are not in the inventory.

## Rules followed

- Every existing seed key and value is unchanged. The seed `version` went from 1 to 2 because its content changed; a volume's live snapshot still wins over the seed.
- Values come from the pages. Where pages disagree no key was added (see below).
- `web/src/lib/priceFallbacks.ts` holds a generated copy of the seed (`bun web/scripts/gen-price-fallbacks.ts`, `--check` to verify); a test fails when it is stale.

## Unresolved

Network Business plan: the plan card and the JS table say $129.49 ("from"), the FAQ says "Business starts at $99". No `network.business.month` key was added; the three entries are `derived` with a CONFLICT note. Decide which is right, then add the key and update the other text.

## New keys (22) with first source

| Key | Amount | Source | Text |
| --- | --- | --- | --- |
| `digitalaccess.tenant_addon.month` | $2.00 | digitalaccess.html:306 | $2 / tenant / month |
| `homeassistant.extra_bridge.month` | $6.00 | homeassistant.html:212 | Extra bridge for a second home: about $6 / month |
| `homeassistant.home.month` | $14.00 | homeassistant.html:29 | "price": "14" (Home) |
| `homeassistant.plus.month` | $24.00 | homeassistant.html:29 | "price": "24" (Home Plus) |
| `homeassistant.pro.month` | $39.00 | homeassistant.html:29 | "price": "39" (Home Pro) |
| `homeassistant.resilient.month` | $12.00 | homeassistant.html:29 | "price": "12" (Resilient) |
| `homeassistant.setup_session.once` | $79.00 | homeassistant.html:215 | ession or migration from your current setup: $79 one-time (about an ho |
| `homeassistant.zigbee_radio.once` | $49.00 | homeassistant.html:213 | Zigbee or Z-Wave USB radio: $49 one-time each |
| `network.addon_anycast.month` | $12.00 | network.html:195 | $9, tunnel $4, volume $2/TB, anycast address $12, IPv6 /48 $3, bring y |
| `network.addon_byo_prefix.month` | $15.00 | network.html:195 | ress $12, IPv6 /48 $3, bring your own prefix $15, dedicated transit ga |
| `network.addon_gateway.month` | $10.00 | network.html:195 | ur own prefix $15, dedicated transit gateway $10 per location, all per |
| `network.addon_ipv4.month` | $3.50 | network.html:195 | Add-ons: extra IPv4 $3.50, location $9, tunnel $4, volume $2/TB, anyca |
| `network.addon_ipv6_48.month` | $3.00 | network.html:195 | volume $2/TB, anycast address $12, IPv6 /48 $3, bring your own prefix  |
| `network.addon_location.month` | $9.00 | network.html:195 | Add-ons: extra IPv4 $3.50, location $9, tunnel $4, volume $2/TB, anyca |
| `network.addon_tunnel.month` | $4.00 | network.html:195 | d-ons: extra IPv4 $3.50, location $9, tunnel $4, volume $2/TB, anycast |
| `network.addon_volume_tb.month` | $2.00 | network.html:195 | a IPv4 $3.50, location $9, tunnel $4, volume $2/TB, anycast address $1 |
| `network.homelab.month` | $6.49 | network.html:218 | Homelab: price 6.49 |
| `network.startup.month` | $37.49 | network.html:219 | Startup: price 37.49 |
| `vpn.fast.month` | $20.00 | vpn.html:29 | "price": "20" (Fast: 500 Mbps, 5 devices) |
| `vpn.gigabit.month` | $30.00 | vpn.html:29 | "price": "30" (Gigabit: up to 1 Gbps, 10 devices) |
| `vpn.lite.month` | $5.00 | vpn.html:29 | "price": "5" (Lite: 25/25 Mbps, 3 devices) |
| `vpn.plus.month` | $10.00 | vpn.html:29 | "price": "10" (Plus: 100 Mbps, 3 devices) |
