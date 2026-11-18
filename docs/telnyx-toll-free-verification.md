# Telnyx toll-free verification: what the site has and what to enter

Written 2026-11-11 from Telnyx's own guides (support.telnyx.com "Toll-Free Verification Request Guide", developers.telnyx.com "Toll-free verification troubleshooting"). Telnyx changes these rules, so read the form in the portal as you fill it in. Nobody can promise an approval; this lists what reviewers check and what the site now says.

## On the site (done)

| Reviewers look for | Where it is |
|---|---|
| Public HTTPS site with company name, contact info, what you sell, Terms and Privacy | www.netquor.com; footer links Terms and Privacy; contact in the footer |
| Privacy policy says mobile information is not sold or shared with third parties for promotional or marketing purposes | https://www.netquor.com/privacy.html, section 4 (existing sentence, unchanged) and new section 11 "Text Messaging (SMS)" |
| Terms with the program: name, what is sent, how you agree, frequency, rates, STOP and HELP, carrier disclaimer, consent not a condition of purchase | https://www.netquor.com/terms.html section 13, and the same text on its own page: https://www.netquor.com/sms.html |
| Same program language everywhere | one source file, `web/src/lib/pages/legal/sms.ts`, feeds all three pages |

The language describes a **service and support** program with **no marketing messages**. If you plan promotional texts, change `sms.ts` and the registration together; marketing needs its own consent checkbox and a "Marketing" or "Mixed" use case.

## Not on the site (you must supply)

1. **Opt-in proof.** Telnyx accepts digital, paper, verbal, or inbound-message opt-in. The site has no web form that collects a phone number and consent (the lead API has no phone or consent fields), so do not pick "digital" unless one is built. The simplest honest choice is **inbound message**: the customer texts the toll-free number first.
   - Opt-in workflow text to paste (edit to match what you really do): "Customers who want text updates from Netquor Technologies send a text to our toll-free number. We tell customers about the number on our website (netquor.com footer and sms.html), in quotes and in support replies. Our first reply to an inbound text includes the program disclosures below. We keep the inbound message with its date and time as the consent record. Opt-in is single opt-in. Opt-out words STOP, CANCEL, END, QUIT and UNSUBSCRIBE are honored immediately."
   - Opt-in URL: https://www.netquor.com/sms.html
   - **Set up the auto-reply** in Telnyx so the first reply to an inbound text carries the required disclosures (below). Do not describe it in the form until it exists.
2. **Required disclosures** (before or in the first message): brand name and use case, STOP and HELP instructions, "message and data rates may apply", frequency, links to Terms and Privacy. Example first reply: "Netquor Technologies: you are subscribed to account and support messages. Msg frequency varies. Msg&data rates may apply. Reply STOP to opt out, HELP for help. Terms: netquor.com/terms.html Privacy: netquor.com/privacy.html". Check the length and that the links are on your own domain (Telnyx rejects public URL shorteners).
3. **Sample messages** (one per use case, realistic, each with opt-out wording). Use only types you really send. Examples for a conversational/support use case:
   - "Netquor Technologies: we received your support request and will reply by email shortly. Reply STOP to opt out, HELP for help. Msg&data rates may apply."
   - "Netquor Technologies: your quote is ready, we emailed it to you. Reply here with questions. Reply STOP to opt out."
4. **Use case**: pick the category that matches (for example Conversational, or Mixed if you send both alerts and conversations) and describe each real use case; keep the use case consistent between the registration and the opt-in explanation.
5. **Business details**: the exact legal name "Netquor Technologies LLC" (not a DBA), the EIN or state registration number, entity type, a valid business address, the website, and a business email on the website's domain (not Gmail). The contact **person** must be a named individual, and the contact phone must **not** be the toll-free number being verified (use the local number).
6. **Volume**: an honest monthly estimate; start low.
7. **Numbers**: one number for one business. More than five numbers needs a justification.

## Common rejection reasons to avoid

- Opt-in "shares data with third parties": the privacy and opt-in wording must not say mobile data goes to third parties for marketing. The new text says it does not, and that the messaging platform and carriers handle it on our behalf.
- Vague opt-in ("users sign up on our website"): say where, what they see, single or double, and how consent is recorded.
- Sample messages that do not match the use case, or lack STOP wording.
- Website under construction, redirecting, or not matching the business name.

## What I did not verify

I have not seen your earlier 10DLC registration or which wording it used, and I have not checked your Telnyx account or number status. If the earlier pair was on phone.netquor.com or another domain, point this registration at netquor.com's pages only if the brand and use case are the same.

If you want a web opt-in form (name, mobile number, an unchecked SMS consent box separate from the privacy box, consent stored with date and time), that needs a phone and consent field added to the lead API and its forward target. Say so and I will build it.
