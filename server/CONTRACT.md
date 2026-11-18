# Contract with the Netquor API: leads

What this service (netquor.com web) sends to `POST /v1/leads/site` of the Netquor API (`netquor-api`, `src/leads/`). The API's README section "Leads from netquor.com", `src/leads/types.ts` and `src/leads/validate.ts` are the source of truth. `src/lead/contract.test.ts` holds an independent re-implementation of the API's rules and fails if this service sends something the API would refuse. Change the API, this file and that test together.

## Transport

- `POST` to `LEAD_FORWARD_URL`, `content-type: application/json`, body at most 32 KB (ours is at most about 9 KB).
- Header `X-Netquor-Signature: t=<unix seconds>,v1=<lowercase hex HMAC-SHA256>`. The MAC is made with `LEAD_FORWARD_SECRET` over the text `<t>.` followed by the exact raw body bytes. No spaces, lower-case hex. The API accepts a `t` within 300 seconds either side, and checks the current secret and, while rotating, `LEADS_WEBHOOK_SECRET_NEXT`.
- The API answers a bare `401` for any signature problem (including a body over 32 KB), `422 {"ok":false,"error":"invalid_<field>"}` for a bad field, `200 {"ok":true,"id"}` when stored, `200 {...,"duplicate":true}` when that id was stored before, `503` when it could not write.
- This service retries once, after 250 ms, on a network error, a timeout (5 s), 408, 429 or 5xx. Any other answer is final. Redirects are refused.

## Body (schema 1, flat)

```json
{
  "schema": 1,
  "id": "ld_<uuid>",
  "receivedAt": "2026-11-10T12:00:00.000Z",
  "source": "fleet",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "company": "Analytical Engines",
  "message": "Hello",
  "macs": 12,
  "ios": 3,
  "term": "annual",
  "page": "/fleet.html",
  "utm": { "source": "news", "medium": "email", "campaign": "fall" },
  "ipHash": "0123456789abcdef0123456789abcdef"
}
```

| Field | Rule here | Rule at the API |
| --- | --- | --- |
| `schema` | always `1` | must be `1` |
| `id` | `ld_` and a UUID, made by this service; the idempotency key | 8 to 64 of `A-Za-z0-9_-` |
| `receivedAt` | ISO 8601 UTC, when this service accepted the form | ISO 8601 |
| `source` | the form that sent it (`/api/lead` field `source`), `site` when none | 1 to 60 of `A-Za-z0-9_./:-` |
| `name` | required, at most 100, leading `= + - @` stripped | required, at most 100 |
| `email` | required, valid, at most 254, local part at most 64, **local part may not start with `= + - @`** | valid, same limits |
| `company`, `message` | at most 120 and 2000; company has leading `= + - @` stripped | same limits |
| `macs`, `ios` | whole numbers 0 to 100000, omitted when 0 | same |
| `term` | at most 20, `A-Za-z0-9_-` | at most 40 |
| `page` | a path only (no host, query or fragment), at most 200; a bad value is dropped | at most 200 |
| `utm` | each of `source`, `medium`, `campaign` at most 100; omitted when none | same |
| `ipHash` | first 32 hex characters of `HMAC-SHA256(key = LEAD_FORWARD_SECRET, data = client IP)`; omitted when there is no address | at most 64 |

Optional fields that are empty are omitted, never sent as `""` or `0`. Fields outside the schema are never sent (the API drops them). The raw client address is never sent, never logged and never written to the lead file.

## Browser side: `POST /api/lead`

JSON or form-encoded. Accepts `name`, `email`, `company`, `message`, `macs`, `ios`, `term`, `source`, `page`, and `utm` (nested object, or flat `utm_source`, `utm_medium`, `utm_campaign`). The honeypot field `website` must be empty. Answers `202 {"ok":true,"id"}` once a sink holds the lead; `422` with a stable code for a bad field; `429`, `413`, `415`, `403`; `503` when no sink took it. See README.md for the 503 caveat.
