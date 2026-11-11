# Local SEO for Fargo-Moorhead and the Midwest

What is built into the site, and what only the owner can do. Written 2026-11-11.

## On the site (done)

- `/fargo-moorhead.html`: visible local page. What Netquor does here, what it does not do (it does not sell a last-mile connection), a dated, sourced list of the business internet providers that publish Fargo-Moorhead service, questions to ask any provider, and a FAQ with FAQPage and WebPage structured data tied to the home page's LocalBusiness (`#local`).
- Linked from the footer on every page and from the home page's local section; in the sitemap and in `llms.txt`.
- Existing: LocalBusiness `areaServed` for Fargo, West Fargo, Moorhead, ND, MN, SD and the Midwest; both phone numbers in `telephone`; one source for contact data (`web/src/lib/contact.ts`).
- The provider facts live in `web/src/lib/pages/local/data.ts` with a `CHECKED` date. Re-read each provider's page and update the date every quarter, or when someone writes in.

## Deliberately not done

- No hidden text, no keyword lists in hidden fields, no competitor names stuffed anywhere. Search engines treat that as spam and demote the site, and it is not honest. The same words, written as useful visible content, are what the local page is for.
- No one-page-per-suburb doorway pages. Add a city page only when there is something true and specific to say about it (a real customer story with permission, a real install, a real event).
- No claims of rankings, awards, customer counts or reviews that do not exist.

## Owner tasks (these need your accounts)

1. **Google Business Profile.** Create or claim it for Netquor Technologies LLC. Choose the category that matches (for example "Computer network service" or "IT services and computer repair", whichever Google offers). Decide first whether a street address is shown or the business is a service-area business with the address hidden (no public storefront means hide it). Add service areas: Fargo, West Fargo, Moorhead, Dilworth, Horace. Add the real phone numbers, hours, the website and photos you own.
2. **Same name, address and phone everywhere.** Use exactly: "Netquor Technologies LLC", toll-free +1 (888) 717-1701, local +1 (701) 960-1701, hello@netquor.com. Match it on Bing Places, Apple Business Connect, LinkedIn, Facebook, GitHub and any directory.
3. **Bing Places and Apple Business Connect.** Both are free and feed Bing, Copilot, Siri and Apple Maps, which also feed several AI assistants.
4. **Search Console and Bing Webmaster Tools.** Verify `www.netquor.com`, submit `https://www.netquor.com/sitemap.xml`, and look at the queries after two to four weeks. That data says which phrases to write for next.
5. **Reviews.** Ask real customers to review on Google, with a plain request and no incentive. Reply to each one. Do not post reviews yourself.
6. **Local links that are earned.** Fargo-Moorhead Chamber, Emerging Prairie, Prairie Business, NDSU and MSUM tech groups, and the local IT and homelab communities are places where a real mention is possible. Sponsor, speak, or contribute something, and ask for a link to the Fargo-Moorhead page. Do not buy links.
7. **Cloudflare.** Set Browser Cache TTL to "Respect Existing Headers" so page updates reach visitors promptly.

## What to measure

Search Console: impressions and clicks for queries containing "Fargo", "Moorhead", "North Dakota", "UniFi", "MDM". Google Business Profile: calls and direction requests. Ask every new customer how they found us and write the answer down.
