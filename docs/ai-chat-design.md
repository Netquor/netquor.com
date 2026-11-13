# Netquor Website AI Chat: Design Brief

Date: 2026-11-12. Audience: Jay. Facts carry a source and a date. The list in section 8 is what I could not verify.

## 1. Recommendation

Build the bot yourselves on the existing Bun/Elysia server. Call the Anthropic API directly with `@anthropic-ai/sdk` (Apache-2.0, v1.8.0 on npm, 2026-11-12). Use Claude Sonnet 5.5 as the default model and keep the model id in config.

- **Tools:** write a thin tool loop of your own with a small tool set. Those tools are KB search, create/update a Frappe ticket, request a human, and later callback and scheduling.
- **Widget:** a Svelte 5 custom element, `<netquor-chat>`, matching the looking-glass pattern.
- **Streaming and storage:** SSE for replies and SQLite (`bun:sqlite`, WAL) for sessions.
- **Human handoff:** a small Telnyx SMS bridge in the same process. Reps text from their own phones and the visitor sees the reply in the chat. Reps are the only people who text; the visitor never needs a phone number.
- **Buy:** Cal.com cloud, only when you reach scheduling. Use it for slots and bookings.
- **Skip:**
  - Chatwoot, Intercom Fin and the other SaaS suites.
  - Flowise (archived 2026-08-13), Typebot, Dify and Open WebUI (licence conditions).
  - The Vercel AI SDK, React chat libraries and a vector DB.

Why not the platforms:
- Chatwoot has no native Telnyx SMS channel (its docs list Twilio and Bandwidth).
- Chatwoot adds Rails, Postgres and Redis to your single host and duplicates Frappe.
- The SaaS suites want to be the helpdesk and the vendor brand shows.

Ship in four phases, about 24 engineer-days in total. The smallest slice worth shipping is Phase 0: an AI FAQ bot that opens a Frappe ticket, about 6 days.

Expected model cost is roughly $30 to $45 per 1,000 six-turn conversations on Sonnet 5.5 with caching. That is about $111 uncached. It rests on my assumptions of a 6,000-token cached prefix and about 250 output tokens per reply. Measure it after two weeks of live traffic. Pricing source: https://platform.claude.com/docs/en/about-claude/pricing (2026-11-12).

## 2. Architecture

```
Visitor browser
  <netquor-chat> (Svelte 5 custom element, shadow DOM, lazy chunk, same origin)
  POST  /api/chat/sessions            -> token + AI disclosure
  POST  /api/chat/sessions/:id/messages  -> 202
  GET   /api/chat/sessions/:id/stream    -> SSE (Last-Event-ID replay)
        |
   Cloudflare (Turnstile, 125 s proxy read timeout)
        |
   Edge Caddy (own @chat handle: no encode, flush -1, X-Real-IP kept)
        |
   netquor-web container (SvelteKit adapter-node on Bun)
     handle.ts routes /api/* and /hooks/* to Elysia
     server/src/chat plugin:
       routes, agent (tool loop), guard, hub (SSE fan-out),
       store (bun:sqlite on /data), handoff, telnyx, frappe, calendar, pbx
        |             |               |                |
     Anthropic API   Frappe REST    Telnyx           Cal.com (P3)
     (server key)    (token auth)   (SMS, Call Ctl)
        ^             ^               ^
        |             |               +-- POST /hooks/telnyx/messaging (Ed25519)
        |             +-- POST /hooks/frappe/ticket (HMAC)
        +-- reps' phones <-> Telnyx number (SMS)
```

**Data flow**
1. The visitor opens the widget and passes Turnstile. The server creates a session, returns a random token and shows the AI disclosure.
2. The visitor message is POSTed and the server returns 202 fast. The model reply, rep messages and system events all stream through the one SSE channel. Each event has a sequence id, so reconnect replays from SQLite via Last-Event-ID.
3. Tool calls run in server code. The model only proposes typed, schema-validated calls. Ticket ids, recipients, phone numbers and times are never taken from model output.

**Session store.** `bun:sqlite` on the `/data` volume (WAL, `synchronous=NORMAL`). Tables are `sessions`, `messages(seq)`, `handoffs`, `reps_state` and `webhook_events(event_id unique)`.
- The in-process hub holds only live subscribers. The database is the source of truth, so a deploy loses only open streams and clients reconnect.
- This works only while there is one web replica, which is today's topology. Past that, move to Redis pub/sub or a separate chat service.
- Back up with SQLite's backup API or `VACUUM INTO`, not a plain file copy, because of the `-wal` and `-shm` files. Source: https://bun.sh/docs/api/sqlite.

**Streaming path (all verified unless noted)**
- Bun's default `idleTimeout` is 10 s (max 255). Call `server.timeout(req, 0)` on the SSE route. Source: https://bun.com/docs/runtime/http/server.
- Send an SSE comment heartbeat every 8 to 15 s. Cloudflare's 524 proxy read timeout is 125 s, and only Enterprise can raise it. Source: https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/.
- Caddy flushes `text/event-stream` immediately and ignores `flush_interval` for it. Source: https://caddyserver.com/docs/caddyfile/directives/reverse_proxy.
- Your edge Caddyfile has a site-wide `encode zstd gzip`. Give `/api/chat/*` its own handle without `encode`, and send `Cache-Control: no-store, no-transform` and `X-Accel-Buffering: no`. This is cheap insurance, because whether encode buffers SSE is unverified. Also add a Cloudflare cache bypass rule for the path.
- Fix one existing line in `web/src/lib/server/handle.ts`. `withClientIp()` rebuilds the Request without `signal`, so handlers cannot see a visitor disconnect and abandoned model streams keep burning tokens.
- Deploys and Caddy reloads cut SSE. Emit a `reconnect` event on SIGTERM; the compose `stop_grace_period` is 20 s.
- Before launch, test the full Cloudflare, Caddy, Bun chain with `curl -N`. Extend `deploy/smoke.sh` to assert the first event arrives before the stream ends.

**Secrets.** All live server-side in `/opt/netquor-web/.env` (mode 0600), following `LEAD_FORWARD_SECRET`. That covers the Anthropic key, Frappe key and secret, webhook secrets, the Telnyx key and public key, and the rep roster. The browser holds only an opaque session token, kept in `sessionStorage` and sent as a Bearer header. No cookies, consistent with `lib/cors.ts`. `CHAT_ENABLED` defaults to false.

## 3. Decision table

| Choice | Chosen | Runner-up | Why, cost, licence |
|---|---|---|---|
| Model and SDK | `@anthropic-ai/sdk` direct, Sonnet 5.5 ($2 in / $10 out per MTok; cache read $0.10, 5m write $2.50). Haiku 5.5 as budget fallback ($0.10 / $0.50). | Vercel AI SDK 7 (Apache-2.0) | One vendor, so provider neutrality buys little. A wrapper lags features you need (cache breakpoints, `search_result` citations, refusal fallbacks). Not verified: whether AI SDK 7 passes these through. SDK licence is Apache-2.0, not MIT. |
| Retrieval and grounding | Cached system prompt: `llms.txt` (rendered with live prices) plus a hand-written `facts.md`. Prices via a `get_price` tool. Citations on. | SQLite FTS5 over the Frappe KB, added only when the KB outgrows the prompt | A corpus of tens of pages needs no vector DB. The prompt must be at least 512 tokens to cache. |
| Chat UI | Hand-rolled Svelte 5 custom element, about 300 lines | assistant-ui (MIT, React only) | React would add a second toolchain. The custom element keeps the host page framework-free, as with looking-glass. Not suited to SSR, so lazy-load it. |
| Transport | SSE out, POST in | WebSocket | Plain HTTP, native reconnect, and the same stream carries bot and rep messages. |
| Frappe mode | Generic REST with token auth from Elysia, plus a Frappe Webhook back, no custom Frappe app in P0-P1 | Thin custom Frappe gateway app (atomic, idempotent upsert, least privilege) | A pure HTTP/JSON fit that matches `/api/lead`. Move to the gateway app if you decide the bot user must not hold the Agent role (section 5). Helpdesk is AGPL-3.0. Calling it over HTTP does not open-source your bot. |
| SMS bridge | Telnyx Messaging, one toll-free number (registration in progress) | 10DLC local number (about $4 brand, $15 campaign, about $2 to $10 per month; fees unconfirmed) | Already your stack. $0.0055 per part toll-free, plus carrier fees, $1.00 per month. Inbound replies are billed too. Source: https://telnyx.com/pricing/messaging. |
| Rep console | SMS from the rep's phone, with Slack or Telegram or email as a heartbeat alert | Chatwoot (MIT core, adds a stack) | If a rep texts STOP, the number is blocked until START. Do not rely on SMS alone. |
| Scheduling | Phase 3a: callback request as a Frappe ticket plus rep SMS, no new vendor. Then Cal.com cloud API v2. | Google Calendar freeBusy plus `events.insert` (build it yourself) | Cal.com Teams is $12 per user per month, Free is one user (https://cal.com/pricing). Pin the `cal-api-version` header. Whether the Free plan's API key works is unconfirmed. Do not self-host: the MIT Cal.diy edition drops teams, SSO and workflows. |
| PBX and callback | Telnyx Call Control, `POST /calls`, rep-first bridge | Asterisk ARI `POST /channels` (private link only); FreePBX via AMI; 3CX (licence-gated) | Assumption: Netquor Phone runs on Telnyx. Put one `originate_callback()` interface in front. Add other adapters only when the PBX is known. |
| Spam and abuse | Cloudflare Turnstile (Free), per-IP and per-session limits, daily token cap | Haiku 5.5 pre-screen | Defer the pre-screen until abuse appears. It adds latency and false refusals on VPN or DDoS questions. |

## 4. Human handoff by SMS

**Message flow**
1. The visitor asks for a person, or the bot calls `request_human`. The server checks availability (office hours in America/Chicago, rep ON/OFF state) and sets the session to `pending`.
2. The visitor sees "Checking whether a team member is free. This can take a minute or two." The server texts the available reps: `Netquor chat #K7: "<first 160 chars, links and control chars stripped>". Reply K7 <text> to answer, K7 /end, K7 /bot. Reply STOP to opt out, HELP for help.`
3. The first rep reply or `/take K7` claims the session with an atomic `UPDATE ... WHERE assigned_rep IS NULL`. Other reps get "claimed by X". The session becomes `human`, the bot goes silent, and the visitor sees "You are now chatting with <first name> from Netquor".
4. Later rep texts become `message` rows and stream to the visitor over SSE. Visitor messages during `human` state are forwarded by SMS to that rep, rate-limited and capped per session.
5. `K7 /bot` returns the chat to the bot. `K7 /end` closes it and files a Frappe ticket with the transcript.

**Thread identification**
- The rep is identified by sender number against the roster in config. Non-roster numbers are ignored.
- The session is identified by the tag.
- If a rep has exactly one open chat, an untagged reply goes to it. With two or more open chats, reject an untagged reply with a "which chat?" list. This fails closed, because a misrouted reply is a privacy incident.

**Presence and timeouts**
- Availability is hours plus the rep's ON/OFF texts.
- No claim in 60 to 90 s: the bot says nobody is available, collects an email and creates a ticket. Try the next rep at 30 to 45 s.
- Rep silent mid-chat for 3 to 5 min: the bot nudges, then offers a ticket.
- Session idle expiry closes and archives the chat.

**Webhook handling (Telnyx)**
- Verify Ed25519 over `{timestamp}|{raw body}`, using raw bytes and not re-serialized JSON. Reject timestamps older than 5 min.
- Return 2xx within 2 s. Insert `data.id` into `webhook_events` and do the work asynchronously.
- Telnyx retries up to 3 times per URL, up to 6 with a failover URL. Dedupe on `data.id`.
- Source: https://developers.telnyx.com/docs/messaging/messages/receiving-webhooks (2026-11-12).
- Send with an `Idempotency-Key`. A key reused with a different body returns 422.

**Failure modes and mitigations**

| Failure | Mitigation |
|---|---|
| Duplicate or out-of-order webhook | `data.id` dedupe, sequence on `occurred_at` |
| Restart mid-session | State in SQLite, client reconnects with Last-Event-ID |
| Rep replies to a closed chat | Reply "chat ended" and offer a ticket |
| Telnyx queue full (40318) or send failure | Backoff, then next rep, then ticket |
| Rep texted STOP | Heartbeat via Slack, Telegram or email; they must text START |
| Visitor closes tab | Mark closed after an SSE-disconnect timeout and stop relaying |
| Abusive text or injection forwarded to a rep | Strip links and control characters, cap length, per-session relay cap |
| SMS cost abuse | Turnstile, per-session and daily alert caps, require a visitor action before paging staff |
| Unicode text multiplies billed parts | Truncate on a count that accounts for UCS-2 (70 characters per part) |

**Compliance (not legal advice)**
- **Registration.** Your current toll-free verification doc describes a support-only program. Rep alert texts are a different use case and recipient set, so amend the registration or use a separate number.
  - Describe the use case honestly as staff notifications for customer-support chats.
  - Telnyx's docs do not address internal or employee traffic. Ask Telnyx support how they classify it.
  - Verification takes about 1 to 2 weeks, and unverified toll-free traffic is limited and may be filtered. Source: https://developers.telnyx.com/docs/messaging/toll-free-verification.
- **Rep opt-in.** Store each rep's written opt-in with a timestamp. Have them text the number first.
- **STOP/HELP.** Include opt-out language in the first message and in the verification samples. Toll-free opt-out is carrier-level and cannot be changed by you. Which keywords count is unconfirmed (see section 8). Assume STOP, UNSUBSCRIBE, CANCEL, END and QUIT may all block a rep.
- **Visitor texting.** Texting visitors (follow-ups, OTP over SMS) needs TCPA-style consent and is not covered by the current registration. The design avoids it until Phase 3, and Phase 3 OTP should use another channel.
- **Fallback.** Until verification completes, develop on a test or long-code number. Production handoff falls back to email or ticket alerts.

## 5. Safety and honesty

**Scoping and grounding**
- The system prompt states scope (Netquor products only) and facts. These live in `facts.md`, in the system prompt or a user turn, never in tool results. Anthropic advises against putting instructions in tool results.
- Hard rules in `facts.md`: Netquor Phone is early access and not billed; Netquor Central is in development. No invented customers, proof or features.
- Prices come only from `get_price`. A deterministic output validator rejects any dollar figure not returned by a tool that turn, any URL not on a netquor.com allow-list, and secret-like strings.
- Use `search_result` blocks and citations. Citations cannot be combined with structured outputs (HTTP 400), so do not constrain the final reply to a JSON schema. Source: https://platform.claude.com/docs/en/build-with-claude/citations.

**Prompt-injection and abuse defenses**
- Follow the OWASP LLM Top 10 2025 (https://genai.owasp.org/llm-top-10/). Assume a successful injection and limit blast radius.
- No secrets in context.
- Read-only tools, plus a small write set (`create_ticket`, `request_human`, `request_callback`) executed by server code with validated arguments. The model never picks recipients, ticket ids or numbers.
- Hard caps on tool calls per session and per day, and a per-session handoff and SMS relay limit.
- Index only staff-authored content. Never index visitor-submitted ticket text. If any tool ever returns such text, screen it.
- **Frappe privilege.** Giving the bot user the Agent role is a large privilege. It can read all tickets and `reply_via_agent` can email arbitrary addresses. Mitigate with a narrow custom role, allow-listed server-side calls only, and fixed `to` taken from the ticket. If that is not enough, use the gateway-app option.
- **Frappe email-loop guard.** A Frappe webhook on `Communication` also fires for communications the bot's own API user creates. Filter by sender or user so bot-originated messages are not echoed back to the visitor or to SMS.
- **Turnstile.** Verify once at session start, then issue your own short-lived signed session token. Cloudflare's single-use enforcement is eventually consistent, so do not rely on it for replay protection. Tokens last 300 s. Source: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/.
- **Cost controls.**
  - Set per-IP and per-session limits reusing the `/api/lead` code, plus `max_tokens` and history caps.
  - Set a daily token budget kill switch and a Console workspace spend limit.
  - Anthropic's tier cap (Start: $500 per month) returns 429 with `error_code: enforced_spend_limit_reached`. A separate `ramp_limit_exceeded` 429 exists for sudden spikes. A self-set limit returns 400.
  - On any of these the bot degrades to "leave a message and we will text or email you". It never shows a raw error.
  - Source: https://platform.claude.com/docs/en/api/rate-limits.
- **Sonnet 5.5 specifics.** Thinking cannot be disabled, so use low effort. Forced `tool_choice` returns 400, so use auto with strict tools. Enable the server-side refusal fallback the Claude docs recommend.
- **Evals.** A golden set of 60 to 100 questions in `bun test` with real model calls, run on prompt, model or corpus changes. Cover:
  - pricing questions;
  - the Phone and Central status wording;
  - off-topic requests;
  - injection planted in a KB fixture;
  - pasted PII;
  - legal and financial asks.

  The build fails if the bot misstates Phone or Central. Review sampled transcripts weekly for the first months.

**Disclosure**
- Show "Netquor's AI assistant" in the widget header and the first message, and answer "are you a human?" truthfully.
- Keep the label after a rep takes over, with messages marked "Netquor team member" versus "AI assistant". Utah's safe harbor needs disclosure at the start and throughout.
- Disclosure is cheap compliance for California's bot law, Utah and EU AI Act Art. 50 (applies from 2 Aug 2026). The legal sources are secondary, so have counsel confirm before launch.

**Privacy and policy changes**
- **Pre-chat notice.** Chats are processed by our AI provider, may be read by staff and may be saved to a ticket, and visitors should not paste secrets. CIPA wiretap suits against chat tools are an active risk, so show the notice before the first message.
- **Redaction.** Redact card-like numbers, keys and SSN patterns before persisting and before sending to the model.
- **Retention.** Default 90 days, 30 days if not linked to a ticket. Delete on request. Never log message text.
- **IP.** Store no IP beyond rate-limit windows, using the existing `hashIp` pattern.
- **`/privacy.html`.** Add the model provider (Anthropic), Telnyx and Frappe as processors, and cover transcripts, staff access, SMS relay and retention.
- **`/terms.html`.** Add the AI assistant, no-reliance wording, and a callback consent clause in Phase 3.
- **Retention promises.** Do not promise Anthropic zero data retention until confirmed. ZDR eligibility depends on the model and arrangement.
- **Approval.** The owner or counsel approves the wording before launch.

**Accessibility (WCAG 2.2 AA)**
- The launcher is a real button. The dialog has a label, `Esc` closes it, and focus is managed and returned to the launcher.
- Messages sit in `role="log"`. Announce completed messages, not token-by-token streaming. Do not use assertive live regions.
- Respect `prefers-reduced-motion`.
- Provide a visible non-chat path (the contact form and `/api/lead`, plus a `<noscript>` link).
- Test with keyboard and VoiceOver.

## 6. Phased build plan (about 24 engineer-days)

| Phase | Days | Scope | Acceptance tests | Risks retired |
|---|---|---|---|---|
| P0: FAQ bot + ticket (**first slice worth shipping**) | 6 | Start/message/stream endpoints, SQLite store, model adapter, grounding on `llms.txt` + `facts.md`, AI disclosure, scope guard, Turnstile, limits, daily cap and kill switch, `create_ticket` to Frappe with a `leads.jsonl` fallback, widget, Caddy and smoke changes, `handle.ts` signal fix, privacy and terms update | Through real Cloudflare and Caddy: a streamed answer that says it is AI and quotes live prices. Phone is "early access" and Central "in development". Off-topic and injection prompts are declined. "Open a ticket" yields an HD Ticket, or a `leads.jsonl` line if Frappe is down. A 3-minute idle chat stays connected. The cost cap trips cleanly. | Abuse and cost, hallucinated claims, proxy-chain streaming |
| P1: Frappe two-way | 5 | Half-day spike on the reply doctype and event. Mirror the transcript into the ticket, webhook receiver, agent replies relayed to open chats or emailed if closed, idempotency, bot-echo filter | An agent reply in Helpdesk shows in the live widget within 5 s. A replayed webhook creates no duplicate. Bot-authored communications are not echoed. | Frappe API shape, signature handling |
| P2: SMS handoff | 6 | Roster, availability, claim, tag routing, `/end` `/bot` `ON` `OFF`, timeouts, Telnyx verification, heartbeat alert channel, registration and SMS terms update | Two reps and two simultaneous chats: each tagged reply reaches only the right visitor. An untagged reply with two open chats is rejected. An unclaimed request becomes a ticket after 90 s. A non-roster number is ignored. A duplicate webhook has no effect. | Human-in-the-loop routing, misrouting privacy risk |
| P3: callback and scheduling | 7 | 3a callback ticket plus rep SMS (2 days). Cal.com slots and booking (3 days). Telnyx Call Control click-to-call or ARI (2 days), as demand justifies. | A visitor books a slot in business hours and it appears on the rep calendar, or a rep taps a callback and both parties are bridged. Consent text is logged. | Telephony, calendar, consent |

**Phase 3 requirements**
- Typed tools `get_slots`, `book_call` and `request_callback`, with an explicit visitor confirmation turn before any booking or call.
- Visitor number verified by OTP (Telnyx Verify is about $0.03 plus channel fee; the pricing page is inconsistent, so get a quote). Use email or voice OTP until SMS registration clears.
- Number Lookup to filter line type.
- US and Canada destinations only, via a Telnyx outbound voice profile with a daily spend limit.
- Per-number, per-IP, per-day and monthly caps, and a kill switch env flag.
- The visitor never supplies the caller ID or the rep number.
- Recording off by default.

**Cross-cutting engineering**
- Test with a `world()` testkit in the style of `lead/testkit.ts`: `FakeModel`, `FakeTelnyx`, `FakeFrappe` and a fake clock.
- Add one structured log line per turn: hashed session id, time to first token, tokens in and out, tool names, outcome, and never message text.
- Surface counters in `/health/detail`: open sessions, pending handoffs, tokens today, and last Frappe and Telnyx success.

## 7. Open questions for the owner, and what would change the plan

1. **Which PBX?** FreePBX, 3CX, Asterisk, or only Telnyx and Netquor Phone. The plan assumes Telnyx. A real PBX changes the Phase 3 adapter, and 3CX may force a relay service because of its licence gate.
2. **Frappe version and hosting.** Which Helpdesk version (v15, v16 or develop), Frappe Cloud or self-hosted, and is ERPNext or Frappe CRM installed? This changes method names and the search backend. Cloud may restrict custom apps and Server Scripts, which affects the gateway-app option.
3. **Hours of coverage.** Office hours only, or on-call? This sets the availability model, the no-claim timeout and the after-hours "ticket" path. With no real-time coverage, ship P0 and P1 only.
4. **Budget ceiling.** Model spend of $30 to $45 per 1,000 chats is far below the $500 tier cap. A hard monthly figure sets the daily token cap.
5. **Calendar.** Google Workspace, Microsoft 365 or Cal.com? Is paying $12 per user per month for Cal.com Teams acceptable? A staff Google Workspace tenant favors building freeBusy yourselves.
6. **Telnyx.** Can the toll-free registration be amended for staff alerts, or should alerts use a separate number? When does it complete? A slow approval means P2 launches on a temporary channel.
7. **Retention.** Who may read transcripts, and for how long? Should transcripts attach to Frappe tickets by default?
8. **Policy approval.** Who approves the privacy, terms and callback-consent wording, and does Netquor serve EU visitors?
9. **Console.** Do reps want an inbox UI instead of SMS? If so, revisit Chatwoot. Otherwise keep SMS plus an alert channel.
10. **Price answers.** May the bot quote live catalog prices? Phone is not billed, so should those questions deflect to the quote form?

## 8. Facts I could not verify

- **Frappe tickets and replies.** Whether the exact REST call shape, required fields and agent-reply path work on your instance, and which doctype and event fires on an agent reply. The Helpdesk fields were read from the develop branch. The README says `main` stopped at 1.32, and v16.1.0 is the latest release (2026-11-04). Run a half-day spike.
- **Frappe built-ins and details.** Whether Helpdesk has any built-in AI or live chat. The exact bytes the webhook signature covers (hash the raw body and test). Whether your version's retries match the framework source: 5 s timeout, `max_retries`, backoff of 5 min, 30 min, 2 h, 5 h and 10 h. Frappe rate-limit defaults and units.
- **SSE through the chain.** Whether Cloudflare (compression, Rocket Loader) or Caddy `encode` buffers SSE in your setup. Cloudflare's docs do not address SSE. Test end to end.
- **Anthropic terms.** Data retention, training and DPA terms, and whether ZDR is available for your chosen model. Also unconfirmed is whether AI SDK 7 passes citations and cache breakpoints through (only relevant if you reconsider it).
- **Telnyx details.**
  - How toll-free verification treats internal staff notifications.
  - Which opt-out keywords toll-free recognizes (Telnyx's own pages conflict).
  - Exact 10DLC fees (support pages differ), per-minute voice rates, and Verify's all-in price.
  - The exact Call Control webhook event names.
  - Whether the voice profile spend limit is off by default and the exact field name.
- **Cal.com.**
  - Whether the Free plan includes an API key.
  - Current enterprise self-host terms. A cited license-key page returned 404 and the 30-user-minimum claim has no source.
  - Whether `Authorization` is strictly required by the schema. It is listed as optional, but a Bearer key is the normal usage.
- **PBX.** 3CX Call Control licence tier (conflicting sources), FreePBX lacking originate in GraphQL (an undated forum claim), and Number Lookup pricing.
- **Chatwoot.** Whether it supports a Telnyx channel through its API channel, and which features are enterprise-only in self-host. The repo may carry a separately licensed `enterprise/` directory, so "core MIT" is the safe wording.
- **Not re-checked in the skeptic pass.**
  - Licences and status: Typebot (FSL), Dify (extra conditions), Botpress (MIT), and Rasa maintenance mode.
  - Pricing and library facts: Intercom Fin $0.99 per outcome, AI SDK 7 version numbers, and Crisp, Tidio and Zendesk pricing.
  - Implementation details: Elysia `sse()` behavior and Svelte custom element details.
- **Legal.** CIPA litigation counts, California SB 1001 and SB 243 scope, Utah's sunset (Davis Polk says July 2027; one source says no end date), EU Omnibus finalization, FTC guidance, TCPA rules, and ND and MN one-party recording consent (a 2020 RCFP guide; read Minn. Stat. 626A.02 and N.D.C.C. 12.1-15-02). Counsel review is needed. One-party consent does not help with visitors in all-party-consent states, so announce recording and keep it off by default.
- **Estimates.** The cost per 1,000 conversations and the engineer-day figures are my estimates, not measurements.

Primary sources behind the main claims:
- https://platform.claude.com/docs/en/about-claude/pricing
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- https://platform.claude.com/docs/en/api/rate-limits
- https://docs.frappe.io/framework/user/en/api/rest
- https://docs.frappe.io/framework/user/en/guides/integration/webhooks
- https://github.com/frappe/helpdesk
- https://developers.telnyx.com/api-reference/call-commands/dial
- https://developers.telnyx.com/api-reference/messages/send-a-message
- https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html

All sources were fetched 2026-11-12.
