import subprocess
import sys

PROBES = [
    {
        "name": "Probe 1: robots.txt",
        "url": "https://mertervitrini.com.tr/robots.txt",
        "expected_status": "200",
        "checks": ["Clean-param", "Disallow: /admin", "Sitemap: https://mertervitrini.com.tr/sitemap.xml"]
    },
    {
        "name": "Probe 2: sitemap.xml",
        "url": "https://mertervitrini.com.tr/sitemap.xml",
        "expected_status": "200",
        "checks": ["<sitemapindex", "/sitemap/0.xml", "/sitemap/1.xml"]
    },
    {
        "name": "Probe 3: llms.txt",
        "url": "https://mertervitrini.com.tr/llms.txt",
        "expected_status": "200",
        "checks": ["Merter Vitrini", "B2B"]
    },
    {
        "name": "Probe 4: tr/pages/hakkimizda",
        "url": "https://mertervitrini.com.tr/tr/pages/hakkimizda",
        "expected_status": "200",
        "checks": ["Hakkımızda"]
    },
    {
        "name": "Probe 5: en/blog",
        "url": "https://mertervitrini.com.tr/en/blog",
        "expected_status": "200",
        "checks": ["Blog", "mertervitrini.com.tr"]
    },
    {
        "name": "Probe 6: es/kadin-giyim (unsupported lang prefix -> 404)",
        "url": "https://mertervitrini.com.tr/es/kadin-giyim",
        "expected_status": "404",
        "checks": []
    },
    {
        "name": "Probe 7: product/non-existent-probe-12345 (non-existent entity -> 404)",
        "url": "https://mertervitrini.com.tr/product/non-existent-probe-12345",
        "expected_status": "404",
        "checks": []
    },
    {
        "name": "Probe 8: api/v1/store/feeds/google-merchant.xml",
        "url": "https://mertervitrini.com.tr/api/v1/store/feeds/google-merchant.xml",
        "expected_status": "200",
        "checks": ["<g:excluded_destination>Shopping_ads</g:excluded_destination>", "Wholesale B2B - Member Quote"]
    }
]

def run_curl_probe(probe):
    print("=" * 60)
    print(f"Executing {probe['name']} -> {probe['url']}")
    
    cmd = [
        "curl.exe", "-s", "-i", "-k",
        "--retry", "5",
        "--retry-connrefused",
        "--retry-delay", "2",
        "--resolve", "mertervitrini.com.tr:443:213.202.255.80",
        "--max-time", "30",
        probe["url"]
    ]
    
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace")
    except Exception as e:
        print(f"[ERROR] Failed to execute curl: {e}")
        return False
        
    output = res.stdout
    if not output:
        print(f"[FAIL] No output received from curl. STDERR: {res.stderr}")
        return False
        
    lines = output.splitlines()
    status_line = lines[0] if lines else ""
    print(f"Status Line: {status_line}")
    
    if probe["expected_status"] not in status_line:
        print(f"[FAIL] Expected status {probe['expected_status']}, got: {status_line}")
        return False
        
    for check in probe["checks"]:
        if check not in output:
            print(f"[FAIL] Content check failed. Expected '{check}' not found in response!")
            return False
        print(f"  [OK] Verified content: '{check}'")
        
    print(f"[SUCCESS] {probe['name']} PASSED 100%!")
    return True

all_passed = True
for probe in PROBES:
    if not run_curl_probe(probe):
        all_passed = False

print("\n" + "=" * 60)
if all_passed:
    print("ALL 8 PRODUCTION PROBES PASSED 100% WITH VERIFIED STATUS CODES & PAYLOADS!")
    sys.exit(0)
else:
    print("SOME PRODUCTION PROBES FAILED!")
    sys.exit(1)
