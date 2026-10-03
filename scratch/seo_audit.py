import json
import re
import urllib.request

RE_LOC = re.compile(r"<loc>([^<]+)</loc>")
RE_TITLE = re.compile(r"<title>([^<]+)</title>", re.IGNORECASE)
RE_DESC = re.compile(
    r'<meta\b[^>]*?\bname=["\']description["\'][^>]*?\bcontent=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
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
RE_H1 = re.compile(r"<h1\b[^>]*>(.*?)</h1>", re.IGNORECASE | re.DOTALL)
RE_TAGS = re.compile(r"<[^>]+>")

def fetch(url: str):
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"},
    )
    with urllib.request.urlopen(req) as resp:
        return resp.geturl(), resp.status, resp.read().decode("utf-8", errors="replace")

urls = [
    "https://mertervitrini.com.tr/robots.txt",
    "https://mertervitrini.com.tr/sitemap.xml",
    "https://mertervitrini.com.tr/",
    "https://mertervitrini.com.tr/tr",
    "https://mertervitrini.com.tr/tr/kadin-giyim",
    "https://mertervitrini.com.tr/product/kadin-yuksek-bel-yanlari-lastik-onu-dugmeli-kot-pantolon-lacivert-gci7",
]

print("=== LIVE SEO AUDIT FOR GOOGLEBOT ===")
for u in urls:
    try:
        final_url, status, html = fetch(u)
        print(f"\n--- URL: {u} (Final: {final_url}, Status: {status}) ---")
        if u.endswith(".txt"):
            print(html[:500])
        elif u.endswith(".xml"):
            locs = RE_LOC.findall(html)
            print(f"Total sitemap URLs: {len(locs)}")
            print("Sample locs:", locs[:5])
        else:
            title = RE_TITLE.findall(html)
            desc = RE_DESC.findall(html)
            canonical = RE_CANONICAL.findall(html)
            hreflangs = RE_HREFLANG.findall(html)
            jsonlds = RE_JSON_LD.findall(html)
            h1 = RE_H1.findall(html)

            print(f"Title: {title[0] if title else 'NONE'}")
            print(f"Description: {desc[0] if desc else 'NONE'}")
            print(f"Canonical: {canonical[0] if canonical else 'NONE'}")
            print(f"Hreflangs count: {len(hreflangs)}, Sample: {hreflangs[:3]}")
            print(f"H1 count: {len(h1)}, Value: {[RE_TAGS.sub('', x).strip() for x in h1]}")
            print(f"JSON-LD count: {len(jsonlds)}")
            if jsonlds:
                for idx, j in enumerate(jsonlds):
                    try:
                        parsed = json.loads(j)
                        print(f"  JSON-LD #{idx+1} Type: {parsed.get('@type')}, Context: {parsed.get('@context')}")
                    except Exception as e:
                        print(f"  JSON-LD #{idx+1} raw length: {len(j)} (parse err: {e})")
    except Exception as e:
        print(f"Error fetching {u}: {e}")
