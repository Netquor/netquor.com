# Netquor Website Chat: Follow-up Brief on Cheaper and Self-Hosted Options

Date: 2026-11-13. Audience: Jay. This follows `docs/ai-chat-design.md` (2026-11-12). Every price is as of 2026-11-13 unless it says otherwise. "Estimate" means my arithmetic or judgment, not a measurement. Section 7 lists what I could not verify.

## 1. The answer

Build a three-tier chat, cheapest first. **Tier 0** is a no-LLM router and FAQ retriever. It uses SQLite FTS5 over 40 to 120 staff-written answers, plus rules, guided flows, a Frappe ticket and the SMS rep handoff. It runs in the existing Bun/Elysia process and costs $0 in tokens. **Tier 1** is added later and only for the unmatched residue. It is a pay-per-token model, with Claude Haiku 5.5 as the default (about $0.55 per 1,000 conversations at 25% of turns reaching it). **Tier 2** is Sonnet 5.5, only for intents where Haiku fails your eval set. I do not recommend running a generative model yourselves at this volume. A CPU box is too slow and a rented GPU costs hundreds of dollars a month. I also do not recommend adopting Vultr or Chatwoot now. The token-cost gap between all the options is cents to tens of dollars a month at 100 to 1,000 conversations. The real reasons to start with Tier 0 are honesty (every answer is human-written, so it cannot invent a price), privacy (no visitor text goes to a model vendor) and a smaller attack surface. Build order: Tier 0 plus ticket, then Frappe two-way, then SMS handoff, then the Tier 1 LLM, only after logs justify it.

## 2. Tier table

Cost per 1,000 six-turn conversations. Assumptions: 6 turns; an LLM turn uses about 2,400 input tokens (500 system, 1,500 retrieved snippets, 400 history) and 250 output tokens; 25% of turns reach the LLM, which is 1.5 turns per conversation (my assumption). Monthly cost is per-1,000 cost × N/1,000.

| Tier | Handles | $/1,000 conv | $/mo at 100 / 1,000 / 10,000 | Hosting | License | Quality risks |
|---|---|---|---|---|---|---|
| **0: router + FAQ** | Guided buttons, templated live prices, status, Phone and Central fixed wording, FTS5 (later hybrid with embeddings) answers, ticket slot-filling, handoff | $0 tokens | $0 / $0 / $0 | In-process Bun, SQLite. Optional bge-small int8 embedder: 33.8 MB file; 100-250 MB RAM and 10-50 ms are estimates to benchmark | SQLite public domain; bge-small MIT ([model card](https://huggingface.co/BAAI/bge-small-en-v1.5)); our code | Confident wrong article (the main risk); misses typos, multi-part and negated questions; content upkeep is the real cost |
| **1a: Haiku 5.5 on residue** | Free-text long tail over retrieved snippets, read-only tools plus server-executed ticket and handoff | Per turn 2,400×$0.10/M + 250×$0.50/M = $0.000365; ×1.5 turns = **$0.55** | $0.06 / $0.55 / $5.50 | None on host | Proprietary API ([pricing](https://platform.claude.com/docs/en/about-claude/pricing)) | Injection and wrong-claim risk, bounded by the output validator, read-only tools and 4-LLM-turn cap |
| **1b: open model API on residue** | Same job. Vultr Qwen3.8-Flash-Next $0.10/$0.20 per M ([catalog](https://api.vultrinference.com/v1/models)): per turn $0.00029, ×1.5 = **$0.43**. Cloudflare gpt-oss-20b $0.20/$0.30 ([pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)): **$0.83** | $0.43 to $0.83 | $0.04-0.08 / $0.43-0.83 / $4.30-8.30 | None on host | Model licenses vary (Qwen and gpt-oss are Apache-2.0 per their cards; not re-read here) | Reasoning models inflate output tokens; injection robustness unverified; Vultr terms unclear (section 3) |
| **1c: local small LLM** | Router, query rewrite and handoff detection only, never answer writing | $0 tokens, but you own a box (~$40/mo VPS, low confidence) | about $40 flat | 4B Q4 needs 1-3 GB RAM; needs its own host | Qwen3-4B-Instruct-2507 Apache-2.0 ([card](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507)) | Little gain over embeddings plus rules. As an answerer it is poor: [2603.11513](https://arxiv.org/pdf/2603.11513v1) finds small models fail to use retrieved context. Not recommended |
| **2: Sonnet 5.5** | Intents where Haiku fails evals | Residue: 1.5 × (2,400×$2/M + 250×$10/M) = **$10.95**. Full LLM every turn, cold cache: **$42.2** | $1.10 / $10.95 / $109.50 (residue); $4.2 / $42 / $422 (full) | None on host | Proprietary API | Cost grows with prompt size; thinking cannot be disabled (earlier brief) |
| Reference: Haiku 5.5, no router | Everything via LLM | **$2.26** cold, $1.57 warm | $0.23 / $2.3 / $23 | None | Proprietary | No deterministic floor; every price answer depends on the model and validator |

Reading the table:
- Haiku on the residue is $0.55 per 1,000 conversations, which is $5.50 a month at 10,000 conversations. Nothing self-hosted can beat that. An A16 GPU at about $372/mo (aggregator figure, low confidence) breaks even against Haiku at about 165k conversations a month ($372 / $0.00226) and against Sonnet at about 8.8k.
- The Vultr-versus-Haiku gap is about $0.12 per 1,000 conversations. That is immaterial.
- The no-router Haiku row is worth knowing: pure Haiku is only $2.26 per 1,000 conversations. Tier 0 is therefore justified by honesty and safety, not by cost.

## 3. Vultr and similar: verdict

**Don't build around Vultr yet. Do a one-day trial later if you want a second provider.**

- **Price.** Vultr's public catalog (fetched without auth, [api.vultrinference.com/v1/models](https://api.vultrinference.com/v1/models)) lists per million tokens in/out:
  - Qwen3.8-Flash-Next: $0.10 / $0.20
  - GLM-5.3-Flash: $0.10 / $0.35
  - DeepSeek-V4.1-Flash: $0.15 / $0.60
  - Qwen3.8-27B: $0.15 / $1.00
  - GLM-5.3: $0.75 / $3.00
  - It also lists a content-safety model at $0.05 / $0.15, and embedding and rerank models.
- **Conflicting doc.** A Vultr usage doc ([updated 2026-10-26](https://docs.vultr.com/support/products/serverless/how-do-i-monitor-the-usage-and-cost-of-my-vultr-serverless-inference-subscription)) states a flat $0.55 in / $2.75 out. Vultr's April 2026 release notes say billing moved to per-model pricing, so the flat figure is probably stale. The authoritative source is the console price sheet. Treat any "$18 per 1,000 conversations on Vultr" figure as unreliable.
- **No cache discount.** A third-party catalog pull (2026-11-10) shows none, so long prompts cost full price every turn. That is why Tier 1 uses 1.5k tokens of retrieved snippets, not a 6k cached prefix.
- **Tool calling.** Documented as supported, per model (release notes, Oct 2025 and April 2026). Test it on the model you choose.
- **Privacy.** One Vultr page says data is processed in memory and not stored persistently by default ([2026-10-26](https://docs.vultr.com/support/products/serverless/how-secure-is-my-data-using-vultr-serverless-inference)). I could not re-verify it. It says nothing about training use or retention duration. Do not send visitor text to Vultr without a written answer and a DPA.
- **Cloudflare Workers AI** has the stronger written terms: no training on customer content and no retention of inputs or outputs after the request ([data-usage page](https://developers.cloudflare.com/workers-ai/platform/data-usage/)). That excludes AI Gateway logging, R2/KV/Vectorize and async features, and operational metadata is kept. You are already behind Cloudflare. It also has 10,000 free neurons a day and a cheap MoE (`qwen3-30b-a3b-fp8`, $0.051/$0.335).
- **Anthropic** retention, training and ZDR terms are unconfirmed (carried from the earlier brief).

Verdict: any hosted model sends visitor text off-host, so none of Tier 1 is "self-hosted". If that matters, stay at Tier 0 or run the local classifier (1c). Put one OpenAI-compatible adapter plus an Anthropic adapter in Elysia. Make Haiku the default and Cloudflare the failover or privacy-first second backend. Use Vultr only if its terms check out. Pin model ids, because Vultr's catalog churns.

## 4. Live-chat layer: build, don't adopt

**Recommendation: keep our own thin layer in Elysia (SQLite sessions, SSE, Telnyx SMS bridge, Frappe tickets), as in the earlier brief. Skip Chatwoot.**

- Chatwoot Community is MIT (core, with a separate `enterprise/` directory) and has real Agent Bots: a bot is a webhook, conversations start `pending`, and the bot sets `open` to hand off ([docs](https://www.chatwoot.com/hc/user-guide/articles/1677497472-how-to-use-agent-bots)).
- But its SMS channels list only Twilio and Bandwidth ([supported features](https://developers.chatwoot.com/self-hosted/supported-features)). Rep texting would need our own Telnyx-to-API-channel bridge, and Frappe sync is custom too. Chatwoot saves only the rep inbox UI, while the bridge and ticket sync (the hard parts) stay ours.
- It needs 4 GB RAM and 4 cores officially ([requirements](https://developers.chatwoot.com/self-hosted/deployment/requirements)), plus Postgres, Redis and Sidekiq. Our host's size is unknown, so assume a second host at about $20-40/mo (assumption) and Rails patching.
- Branding removal and custom branding are paid features ($19 per agent per month); the free widget can't be rebranded.
- Estimated effort is 10-14 days to adopt versus about 6 days for our P2, because adoption still needs the bridge, Frappe sync and widget work.

Revisit Chatwoot only if one of these becomes true: more than 3 reps, regular concurrent chats beyond 2, a need for email or WhatsApp channels, or reps who insist on a web or mobile inbox.

**Frappe stays the system of record.** The bot creates tickets through its REST API and mirrors the transcript. Use assignment rules to route bot-created tickets and canned responses as rep quick replies. Frappe Helpdesk has a KB (Draft/Published/Archived; customer-portal search needs RediSearch) but no chat widget ([KB docs](https://docs.frappe.io/helpdesk/knowledge-base), [repo](https://github.com/frappe/helpdesk)). Start with the Tier 0 KB as versioned Markdown in the repo, reviewed by pull request. Sync from Frappe's KB later only if reps want to author there; whether the generic REST API exposes HD Article is untested.

**SMS rep handoff is unchanged from the earlier brief:** roster, claim by tag, `/end`, `/bot`, ON/OFF, 60-90 s claim timeout, then a ticket. The compliance notes also stand: Telnyx toll-free registration is still pending and staff alerts need amending or a separate number.

## 5. Routing design

**Per-turn pipeline** (deterministic, in order):
1. Normalize the text, cap it at about 500 characters, redact card-like and key-like strings, and strip control characters.
2. **Hard rules first**, never overridden by a score: explicit request for a person, or outage words (down, outage, not working), go to the handoff or status flow. Billing dispute, refund, legal or security words go to a ticket with a person route, with no bot answer.
3. If a **guided flow** is active, continue it. Always offer `Back`, `Start over` and `Talk to a person`.
4. **Intent** by rules, then (once embeddings exist) nearest-centroid over about 20-50 examples per intent. Intents:
   - plan finder
   - per-product info (Fleet, VPN, Network Solutions, SDN, Hosted Home Assistant, Digital Access)
   - Phone (fixed copy: early access, not billed)
   - Central (fixed copy: in development)
   - pricing (templated from the live price cache, never retrieved text)
   - status
   - billing and account
   - sales or quote
   - technical support
   - human request
   - out of scope
   Billing and outage routes get a one-tap confirmation.
5. **Retrieval** over the KB: FTS5 BM25 first. Add bge-small embeddings fused by Reciprocal Rank Fusion only if the eval shows paraphrase misses. RRF is needed because BM25 and cosine scores are not on the same scale ([source, secondary](https://dev.to/soytuber/building-a-hybrid-rag-in-200-lines-sqlite-fts5-sqlite-vec-rrf-38h1)). Brute-force cosine is fine at this size.
6. **Confidence thresholds.** I do not have real values. Calibrate them on a held-out set of 100-200 real or hand-written questions. Set the high threshold and margin over the runner-up so the wrong-confident rate is at most 2%, a medium band, and a floor.
   - High: answer verbatim, with a link and "Did that help?".
   - Medium: show the top 3 as "Did you mean" buttons plus "None of these".
   - Low: counts as a miss.
7. **Miss and handoff.** Two misses in a row, a thumbs-down, a "None of these", or any explicit request leads to the offer of a person (if one is on) or a ticket. Tier 1, once built, takes the first miss instead.

**Disclosure.** Show "Netquor's automated assistant" in the header and first message, and keep the label after a rep joins.

**How a rep joins:** exactly as the earlier brief's section 4. The visitor sees "Checking whether a team member is free"; the first rep to reply claims the chat by tag; the bot goes silent. Rep presence is hours plus the rep's ON/OFF texts.

**Learning from transcripts.** There is no model training. A weekly report lists misses, thumbs-downs and rep-handled chats, redacted, grouped by cluster. You promote the top clusters into new KB entries or aliases. Track three numbers before every release against the held-out set: top-1 accuracy, correct-decline rate and **wrong-confident rate**. Optimize the last one, not raw coverage. Run two weeks of shadow mode first (bot suggests, a rep decides) to measure real coverage. My earlier guess of 50-70% correct direct answers on in-scope questions is an unmeasured estimate. Logging follows the earlier brief: no IP, hashed session, 90-day retention (30 if not tied to a ticket), pre-chat notice.

## 6. What changes, and the revised plan

**Diff against `docs/ai-chat-design.md`:**
- §1: replace "Sonnet 5.5 default for everything" with the tier model. The default LLM becomes Haiku 5.5 on the residue only. Replace the $30-45 per 1,000 line with the section 2 table. My recompute gives $42.2 cold, $27.8 warm and $96 uncached for Sonnet, so the earlier $30-45 holds and $111 becomes about $96 (token assumptions differ slightly).
- §2: add a `router/` module (rules, FTS5, flows, thresholds) ahead of the agent loop. The agent loop becomes Tier 1 behind a feature flag.
- Widget: add quick-reply buttons, thumbs up/down and a permanent "Talk to a person".
- §3 decision table: model row becomes "Tier 0 router; Haiku 5.5 on the residue; Sonnet by eval". The retrieval row moves from "cached prompt, FTS5 later" to "FTS5 now". Add rows for Cloudflare as second backend and Vultr as trial-only. Chatwoot stays skipped, now with explicit revisit triggers.
- §5: Tier 0 answers are verbatim and need no output validator. The validator, daily kill switch (about $5 a day) and 4-LLM-turn cap apply to Tier 1. Add a rule that unmatched turns are not stored with raw PII.
- §7: question 4 (budget) mostly dissolves. Add the questions in section 7 below.
- §8: Chatwoot's Telnyx point is now confirmed as "not listed in docs". Typebot's docs say self-hosted instances get all features, so drop any "premium needs a paid license" wording. The fp32 bge-small ONNX is 133 MB, not 127.

**Revised phased plan (engineer-days, estimates):**

| Phase | Days | Scope |
|---|---|---|
| **P0: Tier 0 + ticket (smallest slice worth shipping)** | 8 | Widget, sessions, SSE, Turnstile, limits, disclosure, FTS5 over about 40 entries, rules and flows (plan finder, status, templated prices, Phone and Central copy), ticket via `/api/lead` and Frappe, logging, privacy and terms update. Range 7.5-12 depending on content authoring |
| P1: Frappe two-way | 5 | As before |
| P2: SMS handoff | 6 | As before |
| P3: Tier 1 LLM on residue | 2.5 | Adapter, validator, golden eval set, caps, kill switch |
| P3b: embeddings (optional) | 2 | bge-small int8, RRF, centroid intents, benchmark on the real host |
| P4: callback and scheduling (optional) | 7 | As before |

The mandatory path (P0 to P2) is 19 days, versus 17 in the earlier plan. The extra 2 days is content authoring. The full set including every optional phase is about 30.5 days, but each phase is gated. P0 ships with no model vendor, no token spend and no new processor beyond Cloudflare Turnstile and Frappe.

**Rule for adding the LLM tier.** Add Tier 1 when all of these hold:
1. At least 300 conversations are logged.
2. More than 15% of turns fall through to the fallback, and the top miss clusters can't be fixed by about 10 more KB entries.
3. Expected deflection exceeds about 51 extra conversations a month.

The break-even is arithmetic on my assumptions ($600 per engineer-day; 10 minutes of staff time at $50/hour = $8.33 per human-handled conversation). The LLM tier costs 2.5 days ($1,500) plus 0.5 day a month; amortized over 12 months that is about $425 a month, and $425 / $8.33 is about 51 conversations. That is about 5% of conversations at 1,000 a month and about 0.5% at 10,000. At 100 a month it is more than the whole human-handled volume (about 25), so don't build it. If you adjust the labor rates, adjust the threshold.

## 7. Open questions and unverified facts

**Questions for you:**
1. What are the host's CPU, RAM, AVX2 support and GPU (none assumed)? This decides whether the embedder runs in-process or you use the Cloudflare bge-small fallback ($0.02/M tokens). That is about $0.0036 per 1,000 conversations on my assumption of 6,000 queries at about 30 tokens each.
2. Expected monthly chat volume, and the share of questions that are account-specific (no FAQ can answer those).
3. How many reps, and do they accept SMS-only? That decides build versus Chatwoot.
4. Must visitor text stay off third-party processors for any customer or legal reason? If yes, stop at Tier 0 plus the local classifier.
5. Who approves the privacy and terms wording, and when does Telnyx toll-free registration complete?
6. What is a human-handled conversation really worth to you? It drives the LLM-tier rule.

**Could not verify:**
- **Tier 0 quality.** All accuracy and coverage figures (50-70% direct answers, 85-95% intent accuracy, hybrid beating either alone) are estimates. The 10-50 ms query latency and 100-250 MB RAM are unmeasured; no primary bge-small CPU benchmark was found.
- **Runtime fit.** Whether `onnxruntime-node` and transformers.js work under Bun 1.4 in the Docker image (fallback: a small Python sidecar).
- **Vultr.** Per-model prices from the console sheet, rate limits, retention, training terms and DPA. Its GPU and VPS prices come from aggregators only.
- **Anthropic.** Haiku 5.5 tool-use and injection robustness; retention and ZDR terms.
- **Frappe.** Whether the REST API exposes HD Article, whether RediSearch is enabled, and whether your version has any built-in chat or AI. Whether Frappe's own chat app (Raven) is a better rep console is unexplored.
- **Chatwoot.** Release year of v4.19.1, and whether the free widget can be restyled through the Client API (unverified end to end).
- **Small-model figures.** CPU token rates for local models (secondary sources, probably illustrative). The 41.6% misleading-context figure is from a different paper than the one it was first cited with: [arXiv 2608.22228](https://arxiv.org/abs/2608.22228), seen via abstract and snippets only.
- **Legal.** Bot-disclosure and chat-logging rules still need counsel review (earlier brief §5 and §8).
