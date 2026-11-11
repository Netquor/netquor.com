#!/usr/bin/env python3
"""Writes startups.html and referrals.html. Terms are drafts for the owner to approve: see .agents/programs-decisions.md."""
import html, pathlib
E = html.escape
ROOT = pathlib.Path(__file__).resolve().parent.parent

def page(slug, title, desc, body, extra_head=""):
    return f'''<!DOCTYPE html>
<html lang="en-US" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <meta name="theme-color" content="#12161c">
    <title>{E(title)} | Netquor</title>
    <meta name="description" content="{E(desc)}">
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
    <link rel="canonical" href="https://www.netquor.com/{slug}.html">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://www.netquor.com/{slug}.html">
    <meta property="og:title" content="{E(title)} | Netquor">
    <meta property="og:description" content="{E(desc)}">
    <meta property="og:image" content="https://www.netquor.com/brand/og.png">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <link rel="stylesheet" href="nav.css">
    <script src="nav.js"></script>
    <link rel="stylesheet" href="nq.css">
    <script src="analytics.js" defer></script>
</head>
<body>
    <!-- nq-nav:start -->
    <!-- nq-nav:end -->
{body}
    <footer class="py-5">
        <div class="container text-center">
            <p class="text-muted small mb-0">&copy; 2026 Netquor Technologies LLC. <a href="index.html" class="text-muted">Home</a> &middot; <a href="terms.html" class="text-muted">Terms</a> &middot; <a href="privacy.html" class="text-muted">Privacy</a></p>
        </div>
    </footer>
    <script src="fx.js"></script>
</body>
</html>
'''

def faq(items):
    return '<div class="nq-faq">' + ''.join(f'<details><summary>{E(q)}</summary><p>{a}</p></details>' for q, a in items) + '</div>'

def table(head, rows):
    return '<div class="nq-cmp-wrap"><table class="nq-cmp"><thead><tr>' + ''.join(f'<th>{E(h)}</th>' for h in head) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows) + '</tbody></table></div>'

# ------------------------------------------------------------------ startups
startups_body = f'''
    <header class="hero-section" style="padding-bottom: 32px;">
        <div class="container" style="max-width: 900px;">
            <p class="nq-eyebrow">Netquor for startups</p>
            <h1 class="mb-3">Half price Fleet for 12 months</h1>
            <p class="lead text-muted mb-4">New businesses under two years old with fewer than ten people pay half price for Netquor Fleet for their first 12 paid months, for up to 25 devices. There is no funding requirement, and service businesses are welcome.</p>
            <div class="d-flex flex-wrap align-items-center gap-3">
                <a href="mailto:hello@netquor.com?subject=Netquor%20for%20Startups&amp;body=Company%3A%0D%0AWebsite%20or%20work%20email%20domain%3A%0D%0AYear%20founded%20and%20number%20of%20people%3A%0D%0ADevices%20(Macs%20and%20iPhones%2FiPads)%3A%0D%0AOther%20products%20you%20are%20interested%20in%3A" class="btn btn-primary-cyber">Apply by email <i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a>
                <a href="#rules" class="btn btn-outline-info">Read the rules</a>
            </div>
        </div>
    </header>

    <section class="nq-section" style="padding-top: 24px;">
        <div class="container" style="max-width: 900px;">
            <div class="nq-section-head"><p class="nq-eyebrow">What you get</p><h2>By product</h2></div>
            {table(['Product','Startup terms','Status'],[
              ['<a href="fleet.html">Netquor Fleet</a>','50% off list for 12 months starting at your first paid month, after the free 30-day trial, for up to 25 devices. About $2.98 a Mac and $1.98 an iPhone or iPad a month.','Available'],
              ['<a href="https://phone.netquor.com/">Netquor Phone</a>','Its own startup program applies when billing starts: 50% off the plan fee for the first 6 months. Plan fees only, never usage.','Early access, not billed yet'],
              ['Netquor VPN, Network Solutions, Hosted Home Assistant, Digital Access','No startup discount today. Network Solutions Homelab is already half price for students, and Digital Access is free to start. Ask us if you are building something specific.','Standard pricing'],
              ['Netquor SDN','Quoted per site. Mention that you are a startup and we will take it into account in the quote.','Quoted'],
            ])}
            <p class="text-muted small mt-3">List prices are on the <a href="index.html#pricing">pricing table</a>. Startup pricing applies to Fleet's monthly plans.</p>
        </div>
    </section>

    <div class="nq-rule" role="presentation"></div>

    <section class="nq-section" id="rules">
        <div class="container" style="max-width: 900px;">
            <div class="nq-section-head"><p class="nq-eyebrow">The rules in plain words</p><h2>Who qualifies and how it works</h2></div>
            <div class="nq-safe">
                <div><b>Who qualifies</b><p>A new Netquor customer that is under two years old and has fewer than ten people, with a work email on its own domain. Any kind of business, funded or not.</p></div>
                <div><b>Your own devices</b><p>The discount covers your own team's devices, up to 25. It does not cover devices you manage for clients.</p></div>
                <div><b>The better price, not both</b><p>Startup pricing replaces the bundle, annual and volume discounts while it runs. If one of those would be cheaper for you, you get that one instead.</p></div>
                <div><b>No surprises at the end</b><p>The discount ends on its own after 12 months. We email you 30 days before, and the confirmation states the price you pay afterwards.</p></div>
                <div><b>Free devices</b><p>Fleet's earned free devices do not combine with the startup price. You keep whichever is lower.</p></div>
                <div><b>Terms can change</b><p>We may change or end the program with notice. Enrollments already approved are honored for their term, and we may decline or end one for a false application.</p></div>
            </div>
        </div>
    </section>

    <div class="nq-rule" role="presentation"></div>

    <section class="nq-section">
        <div class="container" style="max-width: 900px;">
            <div class="nq-section-head"><p class="nq-eyebrow">How to apply</p><h2>Three steps</h2></div>
            <ol class="nq-steps nq-steps-row">
                <li><b>Email us.</b> Company, website or work email domain, year founded and headcount, device counts and any other products you are curious about.</li>
                <li><b>We reply in writing.</b> We confirm eligibility and the exact price. There is no application portal, so we answer by email.</li>
                <li><b>Start the free trial.</b> Fleet is free for 30 days. The startup price begins with your first paid month.</li>
            </ol>
        </div>
    </section>

    <section class="nq-section" id="faq">
        <div class="container" style="max-width: 900px;">
            <div class="nq-section-head"><p class="nq-eyebrow">Questions</p><h2>Common questions</h2></div>
            {faq([
              ('Do we need funding or an accelerator?','No. Funding stage and type of business do not matter. Agencies and consultancies can join for their own devices.'),
              ('Can an existing customer join?','Not today. The program is for new customers. If you are already a customer and think you should qualify, write to us.'),
              ('What happens to Netquor Phone?','Netquor Phone is in early access and not billed yet. When billing starts, Phone has its own startup program: 50% off the plan fee for 6 months, with usage never discounted. Its price here is a planned launch price.'),
              ('Can I combine this with a referral credit?','A referral credit applies to plan fees after other discounts, and it cannot take a line below half of its list price. While startup pricing is already at half, a referral credit waits until it ends. See the <a href="referrals.html">referral terms</a>.'),
              ('How long does a reply take?','We reply by email, usually within a few business days. We do not promise a faster time.'),
            ])}
        </div>
    </section>

    <section class="nq-section" style="padding-top: 0;">
        <div class="container" style="max-width: 900px;">
            <div class="nq-start"><div class="nq-start-main"><div><h2>Starting something?</h2><p class="text-muted mb-0">Tell us what you are building and what you need to run it. We will reply with a plan and a price in writing.</p></div><div class="nq-contact"><a href="mailto:hello@netquor.com?subject=Netquor%20for%20Startups" class="btn btn-primary-cyber">Apply by email <i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a><a href="tel:+18887171701" class="nq-contact-link"><i class="bi bi-telephone" aria-hidden="true"></i><span>+1 (888) 717-1701</span></a></div></div></div>
        </div>
    </section>
'''
(ROOT/'startups.html').write_text(page('startups','Netquor for startups: half price Fleet for 12 months','Half price Netquor Fleet for 12 months for new businesses under two years old with fewer than ten people. Up to 25 devices, no funding requirement.',startups_body))

# ------------------------------------------------------------------ referrals
ref_body = f'''
    <header class="hero-section" style="padding-bottom: 32px;">
        <div class="container" style="max-width: 900px;">
            <p class="nq-eyebrow">Referrals</p>
            <h1 class="mb-3">Refer a business, you both get a credit</h1>
            <p class="lead text-muted mb-4">When a business you refer becomes a paying Netquor customer, you each get a $25 account credit. It works on any Netquor product, and it is the same program everywhere.</p>
            <div class="d-flex flex-wrap align-items-center gap-3">
                <a href="mailto:hello@netquor.com?subject=Referral&amp;body=Who%20I%20am%20referring%20(name%2C%20business%2C%20email)%3A%0D%0AProducts%20they%20may%20need%3A" class="btn btn-primary-cyber">Refer a business <i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a>
                <a href="#terms" class="btn btn-outline-info">Read the terms</a>
            </div>
        </div>
    </header>

    <section class="nq-section" style="padding-top: 24px;">
        <div class="container" style="max-width: 900px;">
            <div class="nq-section-head"><p class="nq-eyebrow">How it works</p><h2>Three steps</h2></div>
            <ol class="nq-steps nq-steps-row">
                <li><b>You refer.</b> Email us who you are referring, or ask them to mention your name when they write to us.</li>
                <li><b>They become a customer.</b> They pay for their first month, and 30 days pass without a refund or a chargeback.</li>
                <li><b>You both get $25.</b> Credit goes on both accounts and applies to plan fees on any Netquor product.</li>
            </ol>
        </div>
    </section>

    <div class="nq-rule" role="presentation"></div>

    <section class="nq-section" id="terms">
        <div class="container" style="max-width: 900px;">
            <div class="nq-section-head"><p class="nq-eyebrow">The terms</p><h2>What the credit is, and what it is not</h2></div>
            <div class="nq-safe">
                <div><b>$25 each</b><p>The person who refers and the new customer each get a $25 account credit.</p></div>
                <div><b>Paid referrals only</b><p>The referred business must be new to Netquor and make a real payment. A free plan, such as Digital Access free, does not count.</p></div>
                <div><b>Plan fees only</b><p>Credit pays plan fees on any product. It never pays for usage, and it is not cash or transferable.</p></div>
                <div><b>Never below half price</b><p>Credit applies after other discounts and cannot take a plan-fee line below half of its list price. On a line already at half price, it waits until that discount ends.</p></div>
                <div><b>Up to ten a year</b><p>Each person can earn credit for up to ten referrals a year. Credit expires 12 months after it is issued.</p></div>
                <div><b>Different people</b><p>You cannot refer yourself, someone at your own business, or an account you control.</p></div>
            </div>
            <p class="text-muted small mt-3">Netquor Phone is in early access and not billed yet, so Phone referrals are credited when Phone starts billing. Netquor may withhold or reverse credit for spam, misleading claims or abuse, and may change or pause the program with notice. Credit already earned is honored.</p>
        </div>
    </section>

    <div class="nq-rule" role="presentation"></div>

    <section class="nq-section">
        <div class="container" style="max-width: 900px;">
            <div class="nq-section-head"><p class="nq-eyebrow">If you share a link or a recommendation</p><h2>Say that you get a credit</h2></div>
            <p class="text-muted">If you recommend Netquor and get a credit when someone signs up, say so clearly in the same message or post, near the recommendation. The FTC expects this for any material connection, even a small one. You can use this wording:</p>
            <blockquote class="nq-quote">I get a $25 Netquor credit if you become a paying customer, and you get $25 too.</blockquote>
            <p class="text-muted small">Do not make claims about Netquor that its own pages do not make. Netquor Phone is in early access, so describe it that way.</p>
        </div>
    </section>

    <section class="nq-section" id="faq">
        <div class="container" style="max-width: 900px;">
            <div class="nq-section-head"><p class="nq-eyebrow">Questions</p><h2>Common questions</h2></div>
            {faq([
              ('Which products count?','Any paid Netquor plan: Fleet, VPN, Network Solutions, Hosted Home Assistant, paid Digital Access plans and, when it starts billing, Netquor Phone.'),
              ('When does my credit arrive?','After the business you referred has paid for its first month and 30 days have passed with no refund or chargeback. We confirm by email.'),
              ('Can I get cash instead?','No. Credit is an account credit toward plan fees.'),
              ('Is there a link I can share?','Not yet. Referrals are tracked by email while the program is small. Tell us who you referred, or ask them to mention your name.'),
              ('How does this fit with the startup program?','The <a href="startups.html">startup program</a> and a referral credit can both apply, but the credit cannot take a line below half price, so it waits while startup pricing is running.'),
            ])}
        </div>
    </section>
'''
(ROOT/'referrals.html').write_text(page('referrals','Refer a business: $25 credit each, on any product','Refer a business to Netquor. When they become a paying customer, you each get a $25 account credit that works on any Netquor product.',ref_body))

# ------------------------------------------------------------------ partners and jobs
areas=[
 ('Networking',['Hands-on experience with routing, switching, VLANs, VPNs and Wi-Fi, from work, a home lab or school','Comfort reading packet captures and logs, and explaining a fault to someone who is not a specialist','Patience for careful, repeatable configuration'],['Help design, test and document network and SDN builds for small sites','Help troubleshoot VPN and Network Solutions issues','Write the setup notes customers and partners follow']),
 ('Coding',['Working skill in a scripting or web language such as Python or JavaScript','Experience with APIs, automation or Apple device management is helpful, not required','A habit of testing your own changes'],['Build and maintain site tools, calculators and automation','Help with integrations and small internal tools','Fix bugs, with notes on what changed']),
 ('Attention to detail: QA and documentation',['A keen eye for the small mistake: a wrong number, a broken link, a step out of order','Clear, plain writing','Interest in checking work against real devices and real prices'],['Test pages, tools and setup guides before release and report what breaks','Check pricing and wording across the site against the current price list','Write and maintain setup guides and help articles']),
 ('Sales and local partnerships',['Comfort talking with owners of small businesses and with local IT shops','Good connections in Fargo-Moorhead, or a client base of your own','Honesty about what a product does and does not do'],['Introduce Netquor to local businesses, advisors and IT shops','Run partner onboarding calls and follow-up','Report what customers ask for and what stops them']),
]
role_cards=''.join(f'''<article class="nq-who"><h3>{E(t)}</h3><p class="nq-who-label" style="margin-top:0">You have</p><ul class="nq-pain">{''.join(f'<li>{E(x)}</li>' for x in have)}</ul><p class="nq-who-label" style="margin-top:0">You will</p><ul class="nq-pain">{''.join(f'<li>{E(x)}</li>' for x in do)}</ul><a class="nq-who-cta" href="mailto:hello@netquor.com?subject=Work%20with%20Netquor%3A%20{E(t).replace(' ','%20').replace(':','%3A')}">Tell us about yourself</a></article>''' for t,have,do in areas)
partners_body=f'''
    <header class="hero-section" style="padding-bottom: 32px;">
        <div class="container" style="max-width: 1000px;">
            <p class="nq-eyebrow">Work with Netquor</p>
            <h1 class="mb-3">Refer or resell our services, or join the team that builds them</h1>
            <p class="lead text-muted mb-4" style="max-width: 44rem;">Netquor is a small company in Fargo, North Dakota. We are looking for local advisors, IT shops and freelancers who know businesses that need our services, and for people with networking, coding or sharp-eyed detail skills who want to help build and support them.</p>
            <div class="d-flex flex-wrap align-items-center gap-3">
                <a href="#partners" class="btn btn-primary-cyber">Become a channel partner <i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a>
                <a href="#roles" class="btn btn-outline-info">See where we need help</a>
            </div>
        </div>
    </header>

    <section class="nq-section" id="partners" style="padding-top: 24px;">
        <div class="container" style="max-width: 1000px;">
            <div class="nq-section-head"><p class="nq-eyebrow">Channel partner program</p><h2>Three ways to partner</h2><p class="text-muted">There is no fee to apply, no required purchase and no inventory. Channel partners are paid for their own sales work and have no ownership interest in Netquor.</p></div>
            {table(['Tier','Who it suits','Terms'],[
              ['<b>Referral partner</b><br><small>Open now, by email</small>','Advisors, accountants, bookkeepers, agencies and freelancers who know a business that needs device management or networking.','Netquor Fleet: 20% of net fees collected for each referred account for its first 12 months. Other products: the standard <a href="referrals.html">$25 referral credit</a>. Netquor Phone: terms are set after it starts billing.'],
              ['<b>Reseller</b><br><small>By application</small>','IT shops and small MSPs that want to own the customer relationship, bill the customer and give first-line support.','Terms are agreed in writing after we talk about your book of business. We do not publish a reseller rate yet.'],
              ['<b>Managed partner</b><br><small>By application</small>','MSPs and IT firms that deploy, manage and support devices and networks for clients as a core service.','Terms are agreed in writing, including who supports what. We onboard a few partners at a time because support is small, and we say so plainly.'],
            ])}
        </div>
    </section>

    <div class="nq-rule" role="presentation"></div>

    <section class="nq-section">
        <div class="container" style="max-width: 1000px;">
            <div class="nq-section-head"><p class="nq-eyebrow">How commission is calculated</p><h2>The arithmetic, at list price</h2><p class="text-muted">These figures are arithmetic, not results. Netquor has no partner payout history yet, no partner has earned these amounts, and most will earn less. Discounts, free trials, annual billing and unpaid invoices lower the real number.</p></div>
            {table(['Example','Calculation','Result'],[
              ['One referred customer, 8 Macs and 8 iPhones','8 x $5.95 + 8 x $3.95 = $79.20 a month. 20% = $15.84','$15.84 a month, $190.08 over 12 months'],
              ['Ten referred customers like that','10 x $79.20 = $792.00 a month. 20% = $158.40','$158.40 a month, $1,900.80 over 12 months'],
              ['If those ten customers pay annually','Annual Fleet pays for 10 months of the monthly price: $7,920.00 a year. 20% = $1,584.00','$1,584.00 for the year'],
              ['If a customer qualifies for startup pricing','Half price for 12 months, so the base halves: $39.60 a month. 20% = $7.92','$7.92 a month for that customer'],
            ])}
            <p class="text-muted small mt-3">Commission is calculated on net cash collected, after any discount the customer receives, so partner terms do not add a discount of their own. Net excludes tax, refunds, chargebacks, credits and processing fees.</p>
        </div>
    </section>

    <div class="nq-rule" role="presentation"></div>

    <section class="nq-section">
        <div class="container" style="max-width: 1000px;">
            <div class="nq-section-head"><p class="nq-eyebrow">The rules</p><h2>What partners agree to</h2></div>
            <div class="nq-safe">
                <div><b>Register each lead</b><p>Email us the business and contact. We confirm in writing that it is new to Netquor. Attribution lasts 90 days from that confirmation.</p></div>
                <div><b>New customers only</b><p>Existing customers, accounts in a trial, and businesses you own or are affiliated with do not qualify.</p></div>
                <div><b>Cash only</b><p>Commission is paid on cash collected, never on invoices paid with credit.</p></div>
                <div><b>Paid after the dispute window</b><p>Monthly in arrears, 60 days after the customer's payment, once refund and dispute windows have closed. Balances under $25 roll forward. We need a W-9 before the first payout.</p></div>
                <div><b>Say that you get paid</b><p>If you recommend Netquor and earn commission, disclose it clearly in the same message. The FTC requires this for any material connection.</p></div>
                <div><b>No exclusivity</b><p>You can work with other vendors, and customers can buy from Netquor directly. Programs and rates may change with notice, and earned commission is honored.</p></div>
            </div>
        </div>
    </section>

    <div class="nq-rule" role="presentation"></div>

    <section class="nq-section" id="roles">
        <div class="container">
            <div class="nq-section-head"><p class="nq-eyebrow">Where we need help</p><h2>Skills we are looking for</h2><p class="text-muted">Four areas. Tell us which fits and what you have worked on, even if it was a home lab or a school project. A resume is welcome, not required.</p></div>
            <div class="nq-who-grid">{role_cards}</div>
            <p class="text-muted small mt-4">Each opportunity may be employee, contractor or project work, and we will tell you which before work starts. Pay is discussed in the first conversation and confirmed in writing before you begin. Netquor is an equal opportunity employer and welcomes applicants regardless of race, color, religion, sex, national origin, age, disability or any other protected status.</p>
        </div>
    </section>

    <section class="nq-section" id="faq">
        <div class="container" style="max-width: 900px;">
            <div class="nq-section-head"><p class="nq-eyebrow">Questions</p><h2>Common questions</h2></div>
            {faq([
              ('Is there a fee to join?','No. There is no fee to apply or to join as a Referral partner. Resellers and Managed partners go through a short onboarding with us.'),
              ('How much could I earn?','It depends on how many devices and services your referred customers use, and for how long. The arithmetic above shows how commission is calculated at list price. It is not a promise, and we have no partner earnings history yet.'),
              ('Do I support the customers?','Referral partners do not. Resellers and Managed partners handle first-line support for their own customers. Netquor supports partners by email and does not publish a service-level agreement.'),
              ('Does this cover Netquor Phone?','Netquor Phone is in early access and not billed yet. Partner terms for it will be set after billing starts.'),
              ('How do I apply?','Email <a href="mailto:hello@netquor.com?subject=Channel%20partner">hello@netquor.com</a> with your business, the kind of customers you work with, and which tier you are interested in. We reply in writing.'),
            ])}
        </div>
    </section>

    <section class="nq-section" style="padding-top: 0;">
        <div class="container" style="max-width: 900px;">
            <div class="nq-start"><div class="nq-start-main"><div><h2>Tell us about you</h2><p class="text-muted mb-0">Write with what you do, who you work with and what you have in mind. We reply in writing.</p></div><div class="nq-contact"><a href="mailto:hello@netquor.com?subject=Work%20with%20Netquor" class="btn btn-primary-cyber">Email us <i class="bi bi-arrow-right ms-1" aria-hidden="true"></i></a><a href="tel:+18887171701" class="nq-contact-link"><i class="bi bi-telephone" aria-hidden="true"></i><span>+1 (888) 717-1701</span></a></div></div></div>
            <p class="text-muted small mt-4">Channel partner commissions are payments for sales work and are not an investment. Nothing on this page is an offer to sell, or a solicitation of an offer to buy, any security. Examples are arithmetic at list price, not promises. Netquor Phone is in early access and is not billed yet. Terms may change.</p>
        </div>
    </section>
'''
(ROOT/'partners.html').write_text(page('partners','Work with Netquor: channel partners and open roles','Refer or resell Netquor services as a channel partner, or tell us about your networking, coding or attention-to-detail skills. Fargo, North Dakota.',partners_body))

# register pages in the nav stamper
p=(ROOT/'tools/build-nav.py').read_text()
for name in ('startups.html','referrals.html','partners.html'):
    if f'"{name}"' not in p:
        p=p.replace('"readiness.html": "body",',f'"readiness.html": "body", "{name}": "body",')
(ROOT/'tools/build-nav.py').write_text(p)
print('pages written')
