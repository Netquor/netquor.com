#!/usr/bin/env python3
"""Builds .agents/agent/facts.json from the live site, so the website AI agent can only state what the site states.

Run after changing any product card or price:   python3 tools/build-agent-facts.py
The agent's recommend_product tool reads this file and nothing else. Statuses, prices and links come from index.html (the app cards
and the price table), never from the prompt.
"""
import html, json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
s = (ROOT / "index.html").read_text()
text = lambda x: html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", x))).strip()

products = []
for m in re.finditer(r'<article class="nq-app">(.*?)</article>', s, re.S):
    a = m.group(1)
    name = text(re.search(r"<h4>(.*?)</h4>", a, re.S).group(1))
    status = text(re.search(r'class="nq-app-status"[^>]*>(.*?)</span>', a, re.S).group(1))
    fix = text(re.search(r'<p class="nq-app-fix">(.*?)</p>', a, re.S).group(1)).removeprefix("Fixes").strip()
    desc = text(re.findall(r"<p>(.*?)</p>", a, re.S)[0])
    meta = text(re.search(r'<p class="nq-app-meta">(.*?)</p>', a, re.S).group(1))
    feats = [text(x) for x in re.findall(r"<li>(.*?)</li>", a, re.S)]
    link = re.search(r'<a href="([^"]+)" class="nq-app-primary"', a).group(1)
    if not link.startswith("http"):
        link = "https://www.netquor.com/" + link
    products.append({"name": name, "status": status, "fixes": fix, "description": desc, "price_note": meta, "features": feats, "url": link})

price_rows = []
for m in re.finditer(r'<a class="nq-prices-row"[^>]*>(.*?)</a>', s, re.S):
    cells = [text(c) for c in re.findall(r'<span role="cell"[^>]*>(.*?)</span>(?=\s*<span role="cell"|\s*$)', m.group(1), re.S)]
    price_rows.append(text(m.group(1)))

facts = {
    "generated_from": "index.html",
    "company": {"name": "Netquor Technologies LLC", "location": "Fargo, North Dakota", "email": "hello@netquor.com", "phone": "+1 (888) 717-1701", "helpdesk": "https://support.netquor.com", "account": "https://account.netquor.com/"},
    "products": products,
    "price_table_text": price_rows,
    "rules": ["Netquor Phone is in early access and not billed yet; its prices are planned launch prices.",
              "Netquor Central is in development, has no price and no self-serve sign-up.",
              "Netquor SDN is quoted per site.",
              "Bundle: 10% off monthly plan fees with two products, 15% with three; annual and volume pricing do not combine; usage is never discounted."],
}
out = ROOT / ".agents" / "agent" / "facts.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(facts, indent=1, ensure_ascii=False))
print(f"{len(products)} products, {len(price_rows)} price rows -> {out.relative_to(ROOT)}")
