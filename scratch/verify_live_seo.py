import json
import re
import urllib.request

RE_TITLE = re.compile(r"<title>([^<]+)</title>", re.IGNORECASE)
RE_CANONICAL = re.compile(
    r'<link\b[^>]*?\brel=["\']canonical["\'][^>]*?\bhref=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
RE_HREFLANG = re.compile(
    r'<link\b[^>]*?\brel=["\']alternate["\'][^>]*?\bhreflang=["\']([^"\']+)["\'][^>]*?\bhref=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
RE_JSON_LD = re.compile(
    r'<script\b[^>]*?\btype=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)
RE_LOC = re.compile(r"<loc>([^<]+)</loc>")

def fetch_url(url: str):
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.getcode(), resp.read().decode("utf-8", errors="replace")

print("=" * 60)
print("1. ROBOTS.TXT CHECK")
print("=" * 60)
status, robots = fetch_url("https://mertervitrini.com.tr/robots.txt")
print(f"Status: {status}")
print("Robots Content:\n", robots)

print("=" * 60)
print("2. SITEMAP.XML CHECK")
print("=" * 60)
status, sitemap = fetch_url("https://mertervitrini.com.tr/sitemap.xml")
locs = RE_LOC.findall(sitemap)
print(f"Status: {status}")
print(f"Total URLs in Sitemap: {len(locs)}")
product_locs = [l for l in locs if "/product/" in l]
blog_locs = [l for l in locs if "/blog" in l]
category_locs = [l for l in locs if "/tr/" in l or "/en/" in l or "/ru/" in l]
print(f"Product URLs in Sitemap: {len(product_locs)}")
print(f"Blog URLs in Sitemap: {len(blog_locs)}")
print(f"Sample Products (first 3): {product_locs[:3]}")
print(f"Sample Blog URLs: {blog_locs[:5]}")

print("=" * 60)
print("3. CATEGORY PAGE CHECK (https://mertervitrini.com.tr/tr/kadin-giyim)")
print("=" * 60)
status, cat_html = fetch_url("https://mertervitrini.com.tr/tr/kadin-giyim")
print(f"Status: {status}")
title_match = RE_TITLE.search(cat_html)
canonical_match = RE_CANONICAL.search(cat_html)
print(f"Page Title: {title_match.group(1) if title_match else 'NOT FOUND'}")
print(f"Canonical URL: {canonical_match.group(1) if canonical_match else 'NOT FOUND'}")

ld_matches = RE_JSON_LD.findall(cat_html)
print(f"JSON-LD Blocks Count: {len(ld_matches)}")
for idx, ld in enumerate(ld_matches):
    try:
        data = json.loads(ld)
        print(f"JSON-LD #{idx+1} Type: {data.get('@type') or [item.get('@type') for item in data.get('@graph', [])]}")
    except Exception as e:
        print(f"JSON-LD parse error: {e}")

print("=" * 60)
print("4. SAMPLE PRODUCT CHECK")
print("=" * 60)
if product_locs:
    sample_prod_url = product_locs[0]
    print(f"Testing Product: {sample_prod_url}")
    status, prod_html = fetch_url(sample_prod_url)
    print(f"Status: {status}")
    p_title = RE_TITLE.search(prod_html)
    p_canonical = RE_CANONICAL.search(prod_html)
    p_hreflang = RE_HREFLANG.findall(prod_html)
    print(f"Product Title: {p_title.group(1) if p_title else 'NOT FOUND'}")
    print(f"Product Canonical: {p_canonical.group(1) if p_canonical else 'NOT FOUND'}")
    print(f"Product Hreflang Count: {len(p_hreflang)}")
    for lang, href in p_hreflang[:4]:
        print(f"  hreflang={lang} -> {href}")

    p_ld = RE_JSON_LD.findall(prod_html)
    print(f"Product JSON-LD Blocks: {len(p_ld)}")
    for idx, ld in enumerate(p_ld):
        try:
            data = json.loads(ld)
            types = data.get("@type") or [item.get("@type") for item in data.get("@graph", [])]
            print(f"  JSON-LD #{idx+1} Types: {types}")
        except Exception as e:
            print(f"  JSON-LD parse error: {e}")

print("=" * 60)
print("5. BLOG POSTS CHECK (https://mertervitrini.com.tr/tr/blog)")
print("=" * 60)
status, blog_html = fetch_url("https://mertervitrini.com.tr/tr/blog")
print(f"Blog Index Status: {status}")
b_title = RE_TITLE.search(blog_html)
print(f"Blog Index Title: {b_title.group(1) if b_title else 'NOT FOUND'}")
articles = [
    "Merter Toptan Giyim Alışveriş Rehberi",
    "Toptan Tekstilde Seri ve Asorti Nedir",
    "Türkiye'den Toptan Giyim İhracatı",
]
for a in articles:
    found = a.lower() in blog_html.lower()
    print(f"Article '{a}' found on blog page: {found}")
