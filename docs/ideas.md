# Ideas (not scheduled)

Things we have looked at and might use. Nothing here is required or planned. Each entry says what it is, why it is parked, and what would change that.

## ShieldFont (anti-scraping text encoding), looked at 2026-11-12

- **What:** open-source project (https://shieldfont.org/, AGPL-3.0 code) that swaps content words in the HTML for other real words and draws the original words with a custom font, so a scraper reading the HTML gets plausible but wrong text. Meant to poison AI training data and make copy-paste into AI tools less useful.
- **Why parked:** it hurts the things we want. Search engines and AI answers would index the substituted words (wrong facts, and it resembles cloaking); carrier and Telnyx reviewers reading the raw HTML of Terms, Privacy and `/sms.html` would see the wrong text; screen readers get nothing by default and the unlock needs JavaScript (the authors' NVDA test shows it is not announced); the project calls itself "not a client-grade security product", its static-site path "not for production", it targets React and Next.js (we are SvelteKit with server-rendered pages and live prices), and it is English only. The font is the codebook, so it can be reverse-engineered, and OCR defeats it.
- **Already covered:** Cloudflare's managed `robots.txt` blocks the AI training crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot, Applebot-Extended, Meta's and Amazon's) and declares `Content-Signal: search=yes, ai-train=no, use=reference`, while search and retrieval bots can still cite us.
- **What would change it:** a page of content with no search, AI-citation, accessibility or compliance value that we still want kept out of training, plus evidence that scrapers ignoring `robots.txt` are a real problem (check Cloudflare bot analytics first). Then pilot it on that one page only, after a license read for AGPL-3.0.
- **Alternatives first:** Cloudflare bot rules and rate limits for scrapers that ignore `robots.txt`; `noindex` or a login for anything that must not be public.
