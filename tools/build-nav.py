#!/usr/bin/env python3
"""Stamps the shared navigation (tools/nav.html) into every page of the site.

Run from anywhere:  python3 tools/build-nav.py
It replaces whatever is between <!-- nq-nav:start --> and <!-- nq-nav:end --> in each page, so edit tools/nav.html, run this, and every page follows.
The first run also swaps each page's older nav for the shared one.
"""
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
NAV = (ROOT / "tools" / "nav.html").read_text().strip()
START, END = "<!-- nq-nav:start -->", "<!-- nq-nav:end -->"
OLD_BOOTSTRAP_NAV = re.compile(r'[ \t]*<nav class="navbar navbar-expand-lg sticky-top"[^>]*>.*?</nav>', re.S)

# page -> how to place the nav the first time: "replace" an old Bootstrap navbar, "body" (right after <body>), or "before:<marker>" (above a page's own header)
PAGES = {
    "index.html": "replace", "sdn.html": "replace", "network.html": "replace", "vpn.html": "replace", "homeassistant.html": "replace", "digitalaccess.html": "body",
    "privacy.html": "body", "terms.html": "body", "fleet.html": 'before:<header class="nav">',
}
STATIC = {"fleet.html"}          # pages with their own sticky bar below: the shared nav scrolls away instead of stacking
FILE_FOR = {"index.html": "index.html"}

def mark_current(nav: str, page: str) -> str:
    """Highlight the entry for the page being shown."""
    nav = re.sub(r' class="is-current" aria-current="page"', "", nav)
    if page == "index.html":
        return nav
    def tag(m):
        return m.group(0).replace(f'href="{page}"', f'href="{page}" class="is-current" aria-current="page"')
    new = re.sub(rf'<a href="{re.escape(page)}">', tag, nav, count=1)
    if new != nav:                                   # a dropdown item: also mark "Products"
        new = new.replace('class="nq-link nq-dd-btn"', 'class="nq-link nq-dd-btn is-current"', 1)
    return new

ICONS = '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">'

import hashlib

def _ver(name: str) -> str:
    """A short fingerprint of the file, so browsers fetch a changed nav.css / nav.js instead of reusing a cached copy."""
    return hashlib.md5((ROOT / name).read_bytes()).hexdigest()[:8]

NO_THEME = {"fleet.html"}          # Fleet keeps its own stylesheet

def ensure_assets(html: str, page_name: str = "") -> str:
    if "bootstrap-icons" not in html:
        html = html.replace("</head>", "    " + ICONS + "\n</head>", 1)
    if 'href="nav.css' not in html:
        html = html.replace("</head>", '    <link rel="stylesheet" href="nav.css">\n    <script src="nav.js"></script>\n</head>', 1)
    if 'analytics.js' not in html:
        html = html.replace("</head>", '    <script src="analytics.js" defer></script>\n</head>', 1)
    if "family=Space+Grotesk" not in html:
        html = html.replace("</head>", '    <link rel="preconnect" href="https://fonts.googleapis.com">\n    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600&display=swap">\n</head>', 1)
    if 'href="nq.css' not in html and page_name not in NO_THEME:
        html = re.sub(r'(<link rel="stylesheet" href="nav\.css[^"]*">)', r'\1\n    <link rel="stylesheet" href="nq.css">', html, count=1)
    html = re.sub(r'href="nq\.css[^"]*"', f'href="nq.css?v={_ver("nq.css")}"', html)
    html = re.sub(r'src="analytics\.js[^"]*"', f'src="analytics.js?v={_ver("analytics.js")}"', html)
    html = re.sub(r'href="nav\.css[^"]*"', f'href="nav.css?v={_ver("nav.css")}"', html)
    html = re.sub(r'src="nav\.js[^"]*"', f'src="nav.js?v={_ver("nav.js")}"', html)
    return html

for page, how in PAGES.items():
    path = ROOT / page
    html = path.read_text()
    nav = mark_current(NAV, page)
    if page in STATIC:
        nav = nav.replace('<nav class="nq-nav"', '<nav class="nq-nav nq-static"', 1)
    block = "    " + nav.replace("\n", "\n    ")
    if START in html:
        html = re.sub(rf"[ \t]*{re.escape(START)}.*?{re.escape(END)}", lambda m: block, html, count=1, flags=re.S)
    elif how == "replace":
        assert OLD_BOOTSTRAP_NAV.search(html), f"{page}: no old navbar found"
        html = OLD_BOOTSTRAP_NAV.sub(lambda m: block, html, count=1)
    elif how == "body":
        html = re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + "\n" + block + "\n", html, count=1)
    elif how.startswith("before:"):
        marker = how[len("before:"):]
        assert marker in html, f"{page}: marker not found"
        html = html.replace(marker, block + "\n\n  " + marker, 1)
    html = ensure_assets(html, page)
    path.write_text(html)
    print("nav ->", page)
