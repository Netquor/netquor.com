#!/usr/bin/env python3
"""Rename the Google Workspace dashboard product everywhere on the site.

Usage:  python3 tools/rename-product.py "Netquor Central" central        (display name, file slug)
It renames <old-slug>.html, rewrites links, names, titles and descriptions, then re-stamps the nav. Run from anywhere.
Current names are kept in tools/product-name.json so the next rename knows what to replace.
"""
import json, pathlib, re, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
STATE = ROOT / "tools" / "product-name.json"
cur = json.loads(STATE.read_text()) if STATE.exists() else {"name": "QUOR", "slug": "quor", "short": "QUOR"}
new_name, new_slug = sys.argv[1], sys.argv[2]
new_short = new_name.split(" ", 1)[1] if new_name.startswith("Netquor ") else new_name
files = [p for p in list(ROOT.glob("*.html")) + [ROOT / "llms.txt", ROOT / "sitemap.xml", ROOT / "tools/nav.html", ROOT / "tools/build-nav.py", ROOT / ".agents/product-marketing.md"] if p.exists()]
old_page, new_page = ROOT / f"{cur['slug']}.html", ROOT / f"{new_slug}.html"
if old_page.exists() and old_page != new_page:
    old_page.rename(new_page)
for p in files + [new_page]:
    if not p.exists():
        continue
    s = p.read_text()
    o = s
    s = s.replace(f"{cur['slug']}.html", f"{new_slug}.html")
    s = re.sub(rf"\b{re.escape(cur['name'])}\b", new_name, s)
    if cur["short"] != cur["name"]:
        s = re.sub(rf"(?<!Netquor ){re.escape(cur['short'])}\b", new_short, s)
    if s != o:
        p.write_text(s)
STATE.write_text(json.dumps({"name": new_name, "slug": new_slug, "short": new_short}))
subprocess.run([sys.executable, str(ROOT / "tools/build-nav.py")], check=True, stdout=subprocess.DEVNULL)
print(f"renamed to {new_name} ({new_slug}.html)")
