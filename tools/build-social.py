#!/usr/bin/env python3
"""Turns social profile URLs in tools/social.json into footer links, Organization sameAs and twitter:site on the homepage.
With no URLs filled in, nothing is added, so the site never links to an account that does not exist."""
import json, pathlib, re
ROOT = pathlib.Path(__file__).resolve().parent.parent
cfg = json.loads((ROOT / "tools/social.json").read_text())
ICON = {"facebook": ("bi-facebook", "Facebook"), "x": ("bi-twitter-x", "X"), "instagram": ("bi-instagram", "Instagram"), "linkedin": ("bi-linkedin", "LinkedIn")}
urls = {k: v.strip() for k, v in cfg.items() if k in ICON and v.strip()}
for k, v in urls.items():
    if not v.startswith("https://"):
        raise SystemExit(f"{k}: use the full https:// profile URL")

p = ROOT / "index.html"
s = p.read_text()
links = "".join(f'<a href="{u}" rel="me noopener" target="_blank" aria-label="Netquor on {ICON[k][1]}"><i class="bi {ICON[k][0]}" aria-hidden="true"></i></a>' for k, u in urls.items())
block = f'<!-- nq-social:start -->{f"<p class=\"nq-social\">{links}</p>" if links else ""}<!-- nq-social:end -->'
if "nq-social:start" in s:
    s = re.sub(r"<!-- nq-social:start -->.*?<!-- nq-social:end -->", lambda m: block, s, flags=re.S)
else:
    s = s.replace('+1 (888) 717-1701</a></p>', '+1 (888) 717-1701</a></p>\n                    ' + block, 1)

# structured data: sameAs on the Organization
m = re.search(r'<script type="application/ld\+json">(.*?)</script>', s, re.S)
d = json.loads(m.group(1))
for g in d["@graph"]:
    if g.get("@id") == "https://www.netquor.com/#org":
        if urls: g["sameAs"] = list(urls.values())
        else: g.pop("sameAs", None)
s = s.replace(m.group(1), json.dumps(d, ensure_ascii=False))

# twitter:site
s = re.sub(r'\s*<meta name="twitter:site" content="[^"]*">', "", s)
if "x" in urls:
    handle = "@" + urls["x"].rstrip("/").split("/")[-1]
    s = s.replace('<meta name="twitter:card"', f'<meta name="twitter:site" content="{handle}">\n  <meta name="twitter:card"', 1)
p.write_text(s)
print("linked:", ", ".join(urls) or "none (no URLs set)")
