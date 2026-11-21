#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Black Fashion Toptan (Shopify XML) Parser
------------------------------------------
Kaynak XML: https://panel.toserof.com/feeds/cc5b687cc5c0bee2e642697247869dad94a89800a0204207.xml
Firma: Black Fashion (Alias: BLACK_FASHION)

Temel İş Kuralları:
1. Fiyat Politikası: whatsapp_only_ordering = true olduğu için buying_price = 0.0, price = 0.0,
   single_price = None, discounted_price = None, currency = "TRY".
2. Stok Politikası:
   - stok > 0 olan ürünler is_active = true olarak kaydedilir ve görselleri indirilir.
   - stok = 0 olan ürünler is_active = false olarak veritabanına alınır (atlanmaz).
   - Hediye kartı, kargo bedeli ve test ürünleri filtrelenip atlanır ("kargo cep" gibi ürün adları korunur).
3. Seri Politikası:
   - 3 bedenli serilerde SSMMLL -> series_ratio = "2-2-2" (6 adet/paket).
   - 4 bedenli -> "1-2-2-1", 2 bedenli -> "2-2", 1 beden/Standart -> "1", 5+ -> "1-1-..."
4. Test / Önizleme:
   `python backend/parsers/black_fashion.py --dry-run --samples 3`
"""

import argparse
import asyncio
import hashlib
import html
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.request
import uuid
from collections import Counter
from datetime import datetime
from io import BytesIO

import aiohttp
from lxml import etree as ET

try:
    from PIL import Image, ImageOps
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import redis
except ImportError:
    redis = None

try:
    from psycopg_pool import ConnectionPool
except ImportError:
    ConnectionPool = None


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))

DEFAULT_FEED_ID = "black_fashion"
DEFAULT_BRAND_ALIAS = "BLACK_FASHION"
DEFAULT_BRAND_NAME = "Black Fashion"
XML_URL = "https://panel.toserof.com/feeds/cc5b687cc5c0bee2e642697247869dad94a89800a0204207.xml"
DEFAULT_LOCAL_XML = os.path.join(REPO_ROOT, "docs", "xmller", "BLACK_FASHION_XML.xml")
CONFIG_JSON_FILENAME = "config.json"

XML_TEMP_FILE = os.path.join(SCRIPT_DIR, "black_fashion_temp.xml")
XML_HISTORY_DIR = os.path.join(SCRIPT_DIR, "downloads", "xml_history")
SYNC_STATS_FILE = os.path.join(SCRIPT_DIR, "sync_stats.txt")
FAILED_IMAGES_CSV = os.path.join(SCRIPT_DIR, "failed_images_black_fashion.csv")

EXT_WEBP = ".webp"
DB_IMAGE_PREFIX = "/uploads/products/black_fashion"
RETRY_HTTP_STATUSES = {429, 502, 503, 504}
RETRY_BACKOFF_SECONDS = (10, 25, 45)
XML_HISTORY_PREFIX = "black_fashion-"

COLOR_KIRMIZI = "Kırmızı"
COLOR_YESIL = "Yeşil"
FABRIC_DENIM = "Denim / Kot"

SHOPIFY_HREF_RE = re.compile(r'href\s*=\s*(["\'])(https?://[^"\']+)\1', flags=re.I)
CAP_WORD_RE = re.compile(r"\bcap\b")

if os.path.exists("/var/www/media"):
    IMAGE_UPLOAD_DIR = "/var/www/media/products/black_fashion"
elif os.path.exists(os.path.join(REPO_ROOT, "frontend", "public")):
    IMAGE_UPLOAD_DIR = os.path.join(REPO_ROOT, "frontend", "public", "uploads", "products", "black_fashion")
else:
    IMAGE_UPLOAD_DIR = os.path.join(SCRIPT_DIR, "uploads", "products", "black_fashion")


def _load_runtime_config():
    """Load DB and Redis settings from env or backend/config.json."""
    cfg_candidates = [
        os.path.join(REPO_ROOT, "backend", CONFIG_JSON_FILENAME),
        os.path.join(REPO_ROOT, "backend", "bin", CONFIG_JSON_FILENAME),
        os.path.join(SCRIPT_DIR, "..", CONFIG_JSON_FILENAME),
    ]
    file_cfg = {}
    for path in cfg_candidates:
        if os.path.isfile(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    file_cfg = json.load(f)
                break
            except Exception:
                pass

    return {
        "db_host": os.environ.get("DB_HOST") or file_cfg.get("db_host") or "127.0.0.1",
        "db_port": os.environ.get("DB_PORT") or file_cfg.get("db_port") or "5432",
        "db_user": os.environ.get("DB_USER") or file_cfg.get("db_user") or "postgres",
        "db_password": os.environ.get("DB_PASSWORD") or file_cfg.get("db_password") or "",
        "db_name": os.environ.get("DB_NAME") or file_cfg.get("db_name") or "merterdevdb",
        "redis_url": os.environ.get("REDIS_URL") or file_cfg.get("redis_url") or "",
    }


def _init_redis_client(redis_url):
    if not redis or not redis_url:
        return None
    try:
        client = redis.from_url(redis_url, decode_responses=True, socket_timeout=2)
        client.ping()
        return client
    except Exception:
        return None


def execute_values_psycopg3(cur, sql_template, rows, page_size=1000):
    """Emulate psycopg2 execute_values for psycopg3 using mogrify/VALUES %s batching."""
    if not rows:
        return
    sql_str = sql_template.strip()
    if "VALUES %s" not in sql_str:
        raise ValueError("sql_template must contain 'VALUES %s'")
    prefix, suffix = sql_str.split("VALUES %s", 1)
    num_cols = len(rows[0])
    row_placeholder = "(" + ", ".join(["%s"] * num_cols) + ")"
    for start in range(0, len(rows), page_size):
        chunk = rows[start : start + page_size]
        values_clause = ", ".join([row_placeholder] * len(chunk))
        flat_params = [item for row in chunk for item in row]
        query = f"{prefix} VALUES {values_clause} {suffix}"
        cur.execute(query, flat_params)


# ==================== SLUGIFY & TEXT HELPERS ====================

TR_LOWER_MAP = str.maketrans("ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ", "abcçdefgğhıijklmnoöprsştuüvyz")
TR_UPPER_MAP = str.maketrans("abcçdefgğhıijklmnoöprsştuüvyz", "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ")
TR_ASCII_MAP = str.maketrans("çğıöşüÇĞİÖŞÜıİ", "cgiosucgiosuii")


def tr_lower(text):
    return (text or "").translate(TR_LOWER_MAP).lower()


def slugify_tr(text):
    val = tr_lower(text).translate(TR_ASCII_MAP)
    val = re.sub(r"[^a-z0-9]+", "-", val).strip("-")
    return val or "urun"


def clean_html_text(raw_html):
    if not raw_html:
        return ""
    unescaped = html.unescape(raw_html)
    no_tags = re.sub(r"<[^>]+>", " ", unescaped)
    return re.sub(r"\s+", " ", no_tags).strip()


def sanitize_html_description(raw_html):
    if not raw_html:
        return ""
    cleaned = re.sub(r"<script[^>]*>.*?</script>", "", raw_html, flags=re.I | re.S)
    cleaned = re.sub(r"<style[^>]*>.*?</style>", "", cleaned, flags=re.I | re.S)
    cleaned = SHOPIFY_HREF_RE.sub(
        lambda m: 'href="#"' if "myshopify" in m.group(2).lower() else m.group(0),
        cleaned,
    )
    return cleaned.strip()


def truncate_short_desc(plain_text, max_len=240):
    if not plain_text:
        return ""
    if len(plain_text) <= max_len:
        return plain_text
    cut = plain_text[: max_len - 1].rsplit(" ", 1)[0]
    return f"{cut}…"


# ==================== NON-APPAREL SKIP RULES ====================

SKIP_SOURCE_IDS = {
    "blackfashion-hediye-karti",
    "kargo-bedeli",
    "toptan-site-kargo-ucreti",
    "test-1-tl",
    "test-15-tl-kopya",
}

SKIP_TITLE_PATTERNS = (
    "hediye kartı",
    "hediye karti",
    "kargo bedeli",
    "kargo ücreti",
    "kargo ucreti",
    "test 1 tl",
    "test 15 tl",
    "test ürünü",
    "test urunu",
)


def should_skip_non_apparel(source_id, title):
    sid = tr_lower(source_id).strip()
    tlow = tr_lower(title).strip()
    if sid in SKIP_SOURCE_IDS:
        return True, f"skip_id:{sid}"
    if sid.startswith(("yurt-disi-kargo-ucreti", "test-")):
        return True, f"skip_prefix:{sid}"
    if any(pat in tlow for pat in SKIP_TITLE_PATTERNS):
        return True, f"skip_title:{tlow}"
    return False, None


# ==================== SIZE SORTING & SERIES RULES ====================

STANDARD_SIZE_ORDER = {
    "XXS": 0,
    "2XS": 0,
    "XS": 1,
    "XS/S": 1.5,
    "S": 2,
    "S/M": 2.5,
    "S-M": 2.5,
    "M": 3,
    "M/L": 3.5,
    "M-L": 3.5,
    "L": 4,
    "L/XL": 4.5,
    "L-XL": 4.5,
    "XL": 5,
    "XXL": 6,
    "2XL": 6,
    "3XL": 7,
    "XXXL": 7,
    "4XL": 8,
    "5XL": 9,
    "STANDART": 999,
    "TEK BEDEN": 999,
    "STD": 999,
    "ONE SIZE": 999,
    "OS": 999,
}

PLUS_SIZE_MARKERS = {"XL", "L/XL", "L-XL", "XXL", "2XL", "3XL", "XXXL", "4XL", "5XL"}


def normalize_size_token(raw_size):
    val = (raw_size or "").strip()
    if not val:
        return "Standart"
    upper = val.upper()
    if upper in ("DEFAULT TITLE", "STANDART", "TEK BEDEN", "ONE SIZE", "STD", "OS"):
        return "Standart"
    if upper in ("1 BEDEN", "2 BEDEN", "3 BEDEN", "4 BEDEN"):
        return upper.split()[0]
    return val.upper() if len(val) <= 5 and val.isalpha() else val


def size_sort_key(size_label):
    up = size_label.upper().strip()
    if up in STANDARD_SIZE_ORDER:
        return (0, STANDARD_SIZE_ORDER[up], up)
    num_match = re.match(r"^(\d+(?:\.\d+)?)", up)
    if num_match:
        return (1, float(num_match.group(1)), up)
    return (2, 0.0, up)


def sort_sizes_canonically(sizes):
    deduped = []
    seen = set()
    for sz in sizes:
        norm = normalize_size_token(sz)
        key = norm.upper()
        if key not in seen:
            seen.add(key)
            deduped.append(norm)
    deduped.sort(key=size_sort_key)
    return deduped


def calculate_series_ratio(sorted_sizes):
    n = len(sorted_sizes)
    if n <= 1:
        return "1", 1
    if n == 2:
        return "2-2", 4
    if n == 3:
        # SSMMLL kuralı: 3 bedenli seriler 2-2-2 şeklinde 6'lı paket olur
        return "2-2-2", 6
    if n == 4:
        return "1-2-2-1", 6
    return "-".join(["1"] * n), n


def is_xl_or_above(packing_ratio):
    if not packing_ratio:
        return False
    tokens = [tok.strip().upper() for tok in packing_ratio.split(",") if tok.strip()]
    if any(t in ("2XL", "XXL", "3XL", "4XL", "5XL") for t in tokens):
        return True
    has_plus = any(
        tok in PLUS_SIZE_MARKERS or (tok.isdigit() and int(tok) >= 44)
        for tok in tokens
    )
    # S/M içeren normal genç seri sadece L/XL kapsıyorsa büyük beden saymayalım
    return has_plus and not any(t in ("XS", "S", "M") for t in tokens)


# ==================== COLOR, FABRIC, SEASON & GROUP EXTRACTION ====================

COLOR_LEXICON = [
    ("yağ yeşili", "Yağ Yeşili"),
    ("acı kahve", "Acı Kahve"),
    ("gül kurusu", "Gül Kurusu"),
    ("bebek mavisi", "Bebek Mavisi"),
    ("buz mavisi", "Buz Mavisi"),
    ("gece mavisi", "Lacivert"),
    ("indigo mavisi", "İndigo"),
    ("kobalt mavisi", "Saks"),
    ("zümrüt yeşili", "Zümrüt"),
    ("mint yeşili", "Mint"),
    ("su yeşili", "Su Yeşili"),
    ("fıstık yeşili", "Fıstık Yeşili"),
    ("haki yeşil", "Haki"),
    ("kemik rengi", "Ekru"),
    ("taş rengi", "Taş"),
    ("koyu gri", "Antrasit"),
    ("açık gri", "Gri"),
    ("koyu kahve", "Kahverengi"),
    ("sütlü kahve", "Kahverengi"),
    ("yavruağzı", "Yavruağzı"),
    ("yavru ağzı", "Yavruağzı"),
    ("antrasit", "Antrasit"),
    ("lacivert", "Lacivert"),
    ("kahverengi", "Kahverengi"),
    ("kahve", "Kahverengi"),
    ("turuncu", "Turuncu"),
    ("kırmızı", COLOR_KIRMIZI),
    ("kirmizi", COLOR_KIRMIZI),
    ("mürdüm", "Mürdüm"),
    ("murdum", "Mürdüm"),
    ("zümrüt", "Zümrüt"),
    ("turkuaz", "Turkuaz"),
    ("hardal", "Hardal"),
    ("tarçın", "Tarçın"),
    ("tarcin", "Tarçın"),
    ("kiremit", "Kiremit"),
    ("bordo", "Bordo"),
    ("vizon", "Vizon"),
    ("fuşya", "Fuşya"),
    ("fusya", "Fuşya"),
    ("pudra", "Pudra"),
    ("kamel", "Kamel"),
    ("camel", "Kamel"),
    ("siyah", "Siyah"),
    ("beyaz", "Beyaz"),
    ("ekru", "Ekru"),
    ("krem", "Krem"),
    ("haki", "Haki"),
    ("yeşil", COLOR_YESIL),
    ("yesil", COLOR_YESIL),
    ("mavi", "Mavi"),
    ("sarı", "Sarı"),
    ("sari", "Sarı"),
    ("pembe", "Pembe"),
    ("lila", "Lila"),
    ("bej", "Bej"),
    ("taş", "Taş"),
    ("tas", "Taş"),
    ("taba", "Taba"),
    ("gri", "Gri"),
    ("mor", "Mor"),
    ("füme", "Füme"),
    ("fume", "Füme"),
    ("saks", "Saks"),
    ("sax", "Saks"),
    ("indigo", "İndigo"),
    ("mint", "Mint"),
    ("somon", "Somon"),
    ("mercan", "Mercan"),
    ("çağla", "Çağla"),
    ("cagla", "Çağla"),
    ("leopar", "Leopar"),
    ("zebra", "Zebra"),
    ("gold", "Gold"),
    ("altın", "Gold"),
    ("gümüş", "Gümüş"),
    ("bronz", "Bronz"),
]

COLOR_TRANSLATIONS = {
    "Siyah": {"en": "Black", "ru": "Черный", "ar": "أسود", "de": "Schwarz", "fr": "Noir", "pl": "Czarny", "bg": "Черен"},
    "Beyaz": {"en": "White", "ru": "Белый", "ar": "أبيض", "de": "Weiß", "fr": "Blanc", "pl": "Biały", "bg": "Бял"},
    "Ekru": {"en": "Ecru", "ru": "Экрю", "ar": "إيكرو", "de": "Ecru", "fr": "Écru", "pl": "Ecru", "bg": "Екрю"},
    "Krem": {"en": "Cream", "ru": "Кремовый", "ar": "كريمي", "de": "Creme", "fr": "Crème", "pl": "Kremowy", "bg": "Кремав"},
    "Bej": {"en": "Beige", "ru": "Бежевый", "ar": "بيج", "de": "Beige", "fr": "Beige", "pl": "Beżowy", "bg": "Бежов"},
    "Vizon": {"en": "Mink", "ru": "Норковый", "ar": "منك", "de": "Nerz", "fr": "Vison", "pl": "Norkowy", "bg": "Норка"},
    "Taş": {"en": "Stone", "ru": "Каменный", "ar": "حجري", "de": "Stein", "fr": "Pierre", "pl": "Kamienny", "bg": "Камък"},
    "Haki": {"en": "Khaki", "ru": "Хаки", "ar": "كاكي", "de": "Khaki", "fr": "Kaki", "pl": "Khaki", "bg": "Каки"},
    "Kahverengi": {"en": "Brown", "ru": "Коричневый", "ar": "بني", "de": "Braun", "fr": "Marron", "pl": "Brązowy", "bg": "Кафяв"},
    "Lacivert": {"en": "Navy", "ru": "Темно-синий", "ar": "كحلي", "de": "Marineblau", "fr": "Bleu marine", "pl": "Granatowy", "bg": "Тъмносин"},
    "Mavi": {"en": "Blue", "ru": "Синий", "ar": "أزرق", "de": "Blau", "fr": "Bleu", "pl": "Niebieski", "bg": "Син"},
    "Bordo": {"en": "Burgundy", "ru": "Бордовый", "ar": "عنابي", "de": "Bordeaux", "fr": "Bordeaux", "pl": "Bordowy", "bg": "Бордо"},
    COLOR_KIRMIZI: {"en": "Red", "ru": "Красный", "ar": "أحمر", "de": "Rot", "fr": "Rouge", "pl": "Czerwony", "bg": "Червен"},
    COLOR_YESIL: {"en": "Green", "ru": "Зеленый", "ar": "أخضر", "de": "Grün", "fr": "Vert", "pl": "Zielony", "bg": "Зелен"},
    "Sarı": {"en": "Yellow", "ru": "Желтый", "ar": "أصفر", "de": "Gelb", "fr": "Jaune", "pl": "Żółty", "bg": "Жълт"},
    "Pembe": {"en": "Pink", "ru": "Розовый", "ar": "وردي", "de": "Rosa", "fr": "Rose", "pl": "Różowy", "bg": "Розов"},
    "Gri": {"en": "Gray", "ru": "Серый", "ar": "رمادي", "de": "Grau", "fr": "Gris", "pl": "Szary", "bg": "Сив"},
    "Antrasit": {"en": "Anthracite", "ru": "Антрацит", "ar": "فحمي", "de": "Anthracit", "fr": "Anthracite", "pl": "Antracyt", "bg": "Антрацит"},
    "Standart": {"en": "Standard", "ru": "Стандарт", "ar": "قياسي", "de": "Standard", "fr": "Standard", "pl": "Standard", "bg": "Стандарт"},
}

FABRIC_KEYWORDS = [
    ("denim", FABRIC_DENIM),
    ("kot ", FABRIC_DENIM),
    ("keten", "Keten"),
    ("saten", "Saten"),
    ("şifon", "Şifon"),
    ("sifon", "Şifon"),
    ("krep", "Krep"),
    ("kadife", "Kadife"),
    ("kaşe", "Kaşe"),
    ("kase", "Kaşe"),
    ("peluş", "Peluş"),
    ("pelus", "Peluş"),
    ("triko", "Triko"),
    ("poplin", "Poplin"),
    ("gabardin", "Gabardin"),
    ("suni deri", "Deri"),
    ("deri", "Deri"),
    ("süet", "Süet"),
    ("suet", "Süet"),
    ("dantel", "Dantel"),
    ("payet", "Payet"),
    ("tül", "Tül"),
    ("viskon", "Viskon"),
    ("viscose", "Viskon"),
    ("modal", "Modal"),
    ("pamuk", "Pamuk"),
    ("cotton", "Pamuk"),
    ("akrilik", "Akrilik"),
    ("yün", "Yün"),
    ("scuba", "Scuba"),
    ("koton", "Pamuk"),
    ("likralı", "Likralı Dokuma"),
    ("likra", "Likra"),
    ("elastan", "Elastan"),
    ("polyester", "Polyester"),
]

FABRIC_TRANSLATIONS = {
    "Polyester": {"en": "Polyester", "ru": "Полиэстер", "ar": "بوليستر", "de": "Polyester", "fr": "Polyester", "pl": "Poliester", "bg": "Полиестер"},
    "Pamuk": {"en": "Cotton", "ru": "Хлопок", "ar": "قطن", "de": "Baumwolle", "fr": "Coton", "pl": "Bawełna", "bg": "Памук"},
    "Viskon": {"en": "Viscose", "ru": "Вискоза", "ar": "فيسكوز", "de": "Viskose", "fr": "Viscose", "pl": "Wiskoza", "bg": "Вискоза"},
    "Keten": {"en": "Linen", "ru": "Лен", "ar": "كتان", "de": "Leinen", "fr": "Lin", "pl": "Len", "bg": "Лен"},
    FABRIC_DENIM: {"en": "Denim", "ru": "Деним", "ar": "دنيم", "de": "Denim", "fr": "Denim", "pl": "Denim", "bg": "Деним"},
    "Triko": {"en": "Knitwear", "ru": "Трикотаж", "ar": "تريكو", "de": "Strick", "fr": "Maille", "pl": "Dzianina", "bg": "Трико"},
    "Krep": {"en": "Crepe", "ru": "Креп", "ar": "كريب", "de": "Krepp", "fr": "Crêpe", "pl": "Krepa", "bg": "Креп"},
    "Saten": {"en": "Satin", "ru": "Атлас", "ar": "ساتان", "de": "Satin", "fr": "Satin", "pl": "Satyna", "bg": "Сатен"},
    "Deri": {"en": "Leather", "ru": "Кожа", "ar": "جلد", "de": "Leder", "fr": "Cuir", "pl": "Skóra", "bg": "Кожа"},
    "Likralı Dokuma": {"en": "Stretch Woven", "ru": "Стрейч-ткань", "ar": "قماش مطاط", "de": "Stretch-Gewebe", "fr": "Tissu extensible", "pl": "Tkanina elastyczna", "bg": "Еластична тъкан"},
}


def extract_color(title, clean_desc=""):
    haystack = tr_lower(f"{title} {clean_desc[:160]}")
    # Önce ürün başlığında tam kelime eşleşmesi ara
    title_low = tr_lower(title)
    for token, canonical in COLOR_LEXICON:
        if re.search(rf"(?<![a-zçğıöşü]){re.escape(token)}(?![a-zçğıöşü])", title_low):
            return canonical
    for token, canonical in COLOR_LEXICON:
        if re.search(rf"(?<![a-zçğıöşü]){re.escape(token)}(?![a-zçğıöşü])", haystack):
            return canonical
    return "Standart"


def extract_fabric(title, clean_desc=""):
    # Kombin önerisi / kullanım alanı cümlelerindeki başka ürünlerin kumaş adlarını (örn. "denim şort", "deri çanta") ele
    cut_desc = clean_desc or ""
    cut_match = re.search(r"(?:stil öner|nasıl kombinlenir|kullanım alanları)", tr_lower(cut_desc))
    if cut_match:
        cut_desc = cut_desc[: cut_match.start()]

    title_low = tr_lower(title)
    desc_low = tr_lower(cut_desc)

    # 1. Öncelikle ürün başlığındaki açık kumaş/dokuma tipini koru (ör. "Saten Pantolon" -> "Saten")
    for kw, canonical in FABRIC_KEYWORDS:
        if kw in title_low:
            return canonical

    # 2. Ardından "%97 polyester" gibi oran ifadelerinden ana kumaşı çek
    pct_match = re.search(r"%\s*\d+\s*([a-zçğıöşü]+)", desc_low)
    if pct_match:
        token = pct_match.group(1)
        for kw, canonical in FABRIC_KEYWORDS:
            if kw.strip() in token or token in kw.strip():
                return canonical

    # 3. Yoksa ana ürün açıklaması içinden kumaş tara
    for kw, canonical in FABRIC_KEYWORDS:
        if kw in desc_low:
            return canonical
    return "Polyester"


def extract_season(title, clean_desc=""):
    text_low = tr_lower(f"{title} {clean_desc}")
    if any(k in text_low for k in ("fw24", "fw25", "fw26", "sonbahar", "kış koleksiyon", "kaban", "palto", "mont", "peluş", "kazak", "süveter", "triko hırka")):
        return "Sonbahar / Kış"
    if any(k in text_low for k in ("ss24", "ss25", "ss26", "yaz koleksiyon", "ilkbahar", "pareo", "keten şort", "bikini", "mayo")):
        return "İlkbahar / Yaz"
    return "4 Mevsim"


def extract_model_group_id(stok_kodu, clean_desc, source_id):
    code = (stok_kodu or "").strip()
    if code and "-" in code:
        prefix = code.split("-", 1)[0].strip()
        if prefix:
            return prefix
    match = re.search(r"ürün kodu\s*:\s*([a-z0-9\-]+)", tr_lower(clean_desc))
    if match:
        return match.group(1).upper()
    return code or source_id


# ==================== CATEGORY RESOLUTION ====================

SHOPIFY_ID_TO_SLUG = {
    "295389036727": "bluz",
    "295387791543": "ikili-takim",
    "295389003959": "kazak-suveter",
    "295388905655": "gomlek",
    "295390904503": "pantolon",
    "295388741815": "hirka",
    "295388577975": "elbise",
    "295390773431": "pantolon",
    "295390871735": "etek",
    "295391887543": "ceket-blazer",
    "295388709047": "bodysuit-korse",
    "295391133879": "trenckot",
    "295391199415": "kaban-palto",
    "295388283063": "canta",
    "295388479671": "crop",
    "295391068343": "yelek",
    "295388807351": "sweatshirt",
    "295390740663": "esofman-alti",
    "295388774583": "kazak-suveter",
    "295391101111": "kaban-palto",
    "295391920311": "ceket-blazer",
    "295390576823": "esofman-takimi",
    "295388545207": "tulum-salopet",
    "295388315831": "kemer",
    "295390642359": "ikili-takim",
    "295391035575": "kaban-palto",
    "295389397175": "kulot-ic-camasiri",
    "295388381367": "sal-esarp",
}

LIVE_CATEGORY_SLUG_PATHS = {
    "bluz": "kadin-giyim/ust-giyim/bluz",
    "bustiyer": "kadin-giyim/ust-giyim/bustiyer",
    "gomlek": "kadin-giyim/ust-giyim/gomlek",
    "tisort": "kadin-giyim/ust-giyim/tisort",
    "crop": "kadin-giyim/ust-giyim/crop",
    "pantolon": "kadin-giyim/alt-giyim/pantolon",
    "etek": "kadin-giyim/alt-giyim/etek",
    "tayt": "kadin-giyim/alt-giyim/tayt",
    "sort": "kadin-giyim/alt-giyim/sort",
    "elbise": "kadin-giyim/elbise-abiye/elbise",
    "abiye": "kadin-giyim/elbise-abiye/abiye",
    "kazak-suveter": "kadin-giyim/triko-hirka-kazak/kazak-suveter",
    "hirka": "kadin-giyim/triko-hirka-kazak/hirka",
    "triko-body": "kadin-giyim/triko-hirka-kazak/triko-body",
    "tunik": "kadin-giyim/triko-hirka-kazak/tunik",
    "ceket-blazer": "kadin-giyim/dis-giyim/ceket-blazer",
    "kaban-palto": "kadin-giyim/dis-giyim/kaban-palto",
    "trenckot": "kadin-giyim/dis-giyim/trenckot",
    "yelek": "kadin-giyim/dis-giyim/yelek",
    "ikili-takim": "kadin-giyim/takim-tulum/ikili-takim",
    "tulum-salopet": "kadin-giyim/takim-tulum/tulum-salopet",
    "bra-sporcu-sutyeni": "kadin-giyim/ic-giyim/bra-sporcu-sutyeni",
    "kulot-ic-camasiri": "kadin-giyim/ic-giyim/kulot-ic-camasiri",
    "bodysuit-korse": "kadin-giyim/ic-giyim/bodysuit-korse",
    "esofman-alti": "kadin-giyim/spor-esofman/esofman-alti",
    "esofman-takimi": "kadin-giyim/spor-esofman/esofman-takimi",
    "sweatshirt": "kadin-giyim/spor-esofman/sweatshirt",
    "pareo": "kadin-giyim/pareo",
    "diger": "kadin-giyim/diger",
    "canta": "aksesuar-canta/canta",
    "kemer": "aksesuar-canta/kemer",
    "sal-esarp": "aksesuar-canta/sal-esarp",
    "sapka-bere-atki": "aksesuar-canta/sapka-bere-atki",
    "bel-aksesuari": "aksesuar-canta/bel-aksesuari",
}

KW_GOMLEK = "gömlek"

# (slug, include_keywords, exclude_keywords, regex_pattern)
CATEGORY_TITLE_RULES = (
    # 1. Kesin eşleşen takım ve dış/özel parçalar
    ("esofman-takimi", ("eşofman takımı", "esofman takimi"), (), None),
    ("esofman-alti", ("eşofman altı", "esofman alti", "eşofman alt", "jogger eşofman", "eşofman"), (), None),
    ("ikili-takim", ("ikili takım", "2'li takım", "2li takım", "üçlü takım", "3'lü takım", "takım", "takim"), (), None),
    ("tulum-salopet", ("tulum", "salopet"), (), None),
    ("pareo", ("pareo",), (), None),
    # 2. Aksesuarlar & Çanta & İç Giyim (0040 kategorileri dahil)
    ("bel-aksesuari", ("bel aksesuar", "bel zinciri"), (), None),
    ("canta", ("çanta", "canta", "portföy", "clutch"), (), None),
    ("kemer", ("kemer",), ("kemerli pantolon", "kemerli elbise", "kemerli etek", "kemerli kaban", "kemerli trençkot", "kemerli ceket", "kemerli yelek", "kemerli şort"), None),
    ("sal-esarp", ("şal", "sal ", "eşarp", "esarp", "bandana", "fular"), ("şal yaka", "sal yaka"), None),
    ("sapka-bere-atki", ("şapka", "sapka", "bere", "atkı", "atki", "saç bandı", "sac bandi", "saç aksesuar", "sac aksesuar"), (), CAP_WORD_RE),
    ("kulot-ic-camasiri", ("külot", "kulot", "slip ", "tanga", "string", "iç çamaşır"), (), None),
    ("bra-sporcu-sutyeni", ("bra", "brale", "sütyen", "sutyen", "sporcu sütyen"), ("zebra", "drap"), None),
    ("bodysuit-korse", ("bodysuit", "korse"), (), None),
    # 3. Alt Giyim ("Bermuda Pantolon" her zaman pantolon olur)
    ("pantolon", ("pantolon", "jean", "denim pant", "palazzo", "baggy"), (), None),
    ("sort", ("şort", "sort", "skort"), (), None),
    ("tayt", ("tayt", "legging"), (), None),
    ("etek", ("etek",), (), None),
    # 4. Dış Giyim
    ("trenckot", ("trençkot", "trenckot"), (), None),
    ("kaban-palto", ("kaban", "palto", "pardösü", "manto", "mont", "şişme mont", "kürk"), (), None),
    ("yelek", ("yelek",), (), None),
    ("ceket-blazer", ("blazer", "ceket", "bomber"), (), None),
    # 5. Elbise & Abiye
    ("abiye", ("abiye",), (), None),
    ("elbise", ("elbise",), (), None),
    # 6. Triko / Sweat / Üst Giyim
    ("hirka", ("hırka", "hirka"), (), None),
    ("sweatshirt", ("sweatshirt", "hoodie", "sweat "), (), None),
    ("kazak-suveter", ("kazak", "süveter", "suveter"), (), None),
    ("tunik", ("tunik",), (), None),
    ("bodysuit-korse", ("triko body", "ribana body", "likralı body", "body"), ("bluz", KW_GOMLEK), None),
    ("triko-body", ("badi",), ("bluz", KW_GOMLEK), None),
    ("bustiyer", ("büstiyer", "bustiyer", "corset"), (), None),
    ("tisort", ("t-shirt", "tişört", "tisort", "tshirt"), (), None),
    ("gomlek", (KW_GOMLEK, "gomlek"), (), None),
    ("crop", ("crop",), ("bluz",), None),
    ("bluz", ("bluz", "atlet", "top ", "üstü", "ustu", "triko"), (), None),
)


def _rule_matches_title(tlow, includes, excludes=(), pattern=None):
    if excludes and any(ex in tlow for ex in excludes):
        return False
    if pattern is not None and pattern.search(tlow):
        return True
    return any(inc in tlow for inc in includes)


def detect_category_slug_from_title(title_raw, shopify_cat_id=""):
    tlow = tr_lower(title_raw)
    for slug, includes, excludes, pattern in CATEGORY_TITLE_RULES:
        if _rule_matches_title(tlow, includes, excludes, pattern):
            return slug
    if shopify_cat_id and shopify_cat_id in SHOPIFY_ID_TO_SLUG:
        return SHOPIFY_ID_TO_SLUG[shopify_cat_id]
    return "diger"


def resolve_category_id(title_raw, shopify_cat_id, packing_ratio, slug_to_id, plus_size_map, diger_id):
    slug = detect_category_slug_from_title(title_raw, shopify_cat_id)
    cat_id = slug_to_id.get(slug)
    if not cat_id and shopify_cat_id in SHOPIFY_ID_TO_SLUG:
        cat_id = slug_to_id.get(SHOPIFY_ID_TO_SLUG[shopify_cat_id])
    if not cat_id:
        cat_id = diger_id
    if cat_id and is_xl_or_above(packing_ratio):
        cat_id = plus_size_map.get(cat_id, cat_id)
    return slug, cat_id


# ==================== SYNC RUN, PROGRESS & XML DOWNLOAD ====================

def _resolve_feed_url(conn, feed_id, cli_url=None):
    if cli_url and cli_url.strip():
        return cli_url.strip()
    env_url = (os.environ.get("FEED_URL") or "").strip()
    if env_url:
        return env_url
    if conn:
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT coalesce(feed_url, '') FROM integration.xml_feeds WHERE id = %s", (feed_id,))
                row = cur.fetchone()
                if row and (row[0] or "").strip():
                    return row[0].strip()
        except Exception as exc:
            sys.stderr.write(f"Warning: Failed querying feed_url for {feed_id}: {exc}\n")
    return XML_URL


def _parse_retry_after_seconds(headers, fallback):
    if not headers:
        return fallback
    raw = (headers.get("Retry-After") or "").strip()
    if not raw:
        return fallback
    try:
        return max(5, min(60, int(raw)))
    except ValueError:
        return fallback


def _fetch_xml_bytes_with_retry(target_url, max_attempts=4):
    last_exc = None
    for attempt in range(max_attempts):
        req = urllib.request.Request(
            target_url,
            headers={"User-Agent": "MerterVitriniB2B-Sync/1.0 (+https://mertervitrini.com.tr)"},
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            last_exc = exc
            if exc.code not in RETRY_HTTP_STATUSES or attempt + 1 >= max_attempts:
                raise
            wait_sec = _parse_retry_after_seconds(
                exc.headers,
                RETRY_BACKOFF_SECONDS[min(attempt, len(RETRY_BACKOFF_SECONDS) - 1)],
            )
            print(f"XML HTTP {exc.code} received; retrying in {wait_sec}s (attempt {attempt + 1}/{max_attempts})...")
            sys.stdout.flush()
            time.sleep(wait_sec)
        except urllib.error.URLError as exc:
            last_exc = exc
            if attempt + 1 >= max_attempts:
                raise
            wait_sec = RETRY_BACKOFF_SECONDS[min(attempt, len(RETRY_BACKOFF_SECONDS) - 1)]
            print(f"XML network error ({exc}); retrying in {wait_sec}s...")
            sys.stdout.flush()
            time.sleep(wait_sec)
    raise last_exc


def _cleanup_old_xml_history(prefix=XML_HISTORY_PREFIX, keep_latest=10):
    if not os.path.isdir(XML_HISTORY_DIR):
        return
    try:
        files = sorted(
            f for f in os.listdir(XML_HISTORY_DIR)
            if f.startswith(prefix) and f.endswith(".xml")
        )
        if len(files) <= keep_latest:
            return
        for stale in files[: len(files) - keep_latest]:
            try:
                os.remove(os.path.join(XML_HISTORY_DIR, stale))
            except OSError:
                pass
    except OSError:
        pass


def _download_xml_to_temp(xml_file_override=None, xml_url=None):
    t_start = time.time()
    if xml_file_override:
        if not os.path.isfile(xml_file_override):
            raise FileNotFoundError(f"XML dosyası bulunamadı: {xml_file_override}")
        shutil.copyfile(xml_file_override, XML_TEMP_FILE)
        print(f"Loaded local XML file ({os.path.getsize(XML_TEMP_FILE):,} bytes) in {time.time() - t_start:.2f}s")
        return XML_TEMP_FILE

    target_url = (xml_url or "").strip() or XML_URL
    os.makedirs(XML_HISTORY_DIR, exist_ok=True)
    print(f"Downloading Black Fashion XML feed from {target_url} ...")
    sys.stdout.flush()
    raw_bytes = _fetch_xml_bytes_with_retry(target_url)
    with open(XML_TEMP_FILE, "wb") as f:
        f.write(raw_bytes)
    ts_name = f"{XML_HISTORY_PREFIX}{datetime.now().strftime('%Y%m%d_%H%M%S')}.xml"
    with open(os.path.join(XML_HISTORY_DIR, ts_name), "wb") as hf:
        hf.write(raw_bytes)
    print(f"Downloaded XML feed ({len(raw_bytes):,} bytes) in {time.time() - t_start:.2f}s")
    return XML_TEMP_FILE


def update_sync_progress(
    conn,
    redis_client,
    sync_run_id,
    status,
    items_parsed,
    items_added,
    items_updated,
    variants_aligned,
    errors_skipped,
    images_total,
    images_downloaded,
    timings=None,
):
    if not conn or not sync_run_id:
        return
    try:
        pct = 0
        if status == "success":
            pct = 100
        elif images_total > 0:
            pct = 50 + (images_downloaded * 50 // images_total)
        elif items_parsed > 0:
            pct = min(48, items_parsed * 48 // 3200)

        summary = {
            "items_parsed": items_parsed,
            "items_added": items_added,
            "items_updated": items_updated,
            "variants_aligned": variants_aligned,
            "errors_skipped": errors_skipped,
            "images_total": images_total,
            "images_downloaded": images_downloaded,
            "percentage": pct,
        }
        if timings:
            summary["timings"] = timings

        summary_json = json.dumps(summary)
        with conn.cursor() as cur:
            if status == "success":
                cur.execute(
                    "UPDATE integration.sync_runs SET completed_at = CURRENT_TIMESTAMP, status = %s, summary = %s WHERE id = %s",
                    (status, summary_json, sync_run_id),
                )
            else:
                cur.execute(
                    "UPDATE integration.sync_runs SET status = %s, summary = %s WHERE id = %s",
                    (status, summary_json, sync_run_id),
                )
        conn.commit()

        if redis_client:
            try:
                redis_key = f"sync_run:progress:{sync_run_id}"
                redis_client.setex(redis_key, 86400, json.dumps({"status": status, **summary}))
            except Exception:
                pass
    except Exception as exc:
        sys.stderr.write(f"Warning: Failed to update sync progress: {exc}\n")


def _init_sync_run(conn, feed_id, cli_sync_run_id=None):
    sync_run_id = cli_sync_run_id or os.environ.get("SYNC_RUN_ID")
    if sync_run_id:
        return sync_run_id
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM integration.sync_runs WHERE feed_id = %s AND status = 'running' ORDER BY started_at DESC LIMIT 1",
            (feed_id,),
        )
        row = cur.fetchone()
        if row:
            return str(row[0])
        cur.execute(
            "INSERT INTO integration.sync_runs (feed_id, status) VALUES (%s, 'running') RETURNING id",
            (feed_id,),
        )
        new_id = str(cur.fetchone()[0])
    conn.commit()
    return new_id


def _resolve_brand_id(conn, feed_id):
    with conn.cursor() as cur:
        cur.execute("SELECT brand_id FROM integration.xml_feeds WHERE id = %s", (feed_id,))
        row = cur.fetchone()
        if row and row[0]:
            return str(row[0])
        cur.execute(
            "SELECT id FROM catalog.brands WHERE alias_code = %s OR LOWER(brand_name) = %s LIMIT 1",
            (DEFAULT_BRAND_ALIAS, tr_lower(DEFAULT_BRAND_NAME)),
        )
        row = cur.fetchone()
        if row and row[0]:
            return str(row[0])
    raise RuntimeError("Black Fashion markası (BLACK_FASHION) catalog.brands içinde bulunamadı!")


def _load_db_metadata(conn, feed_id):
    slug_to_id = {}
    plus_size_map = {}
    diger_id = None
    products_cache = {}
    variants_cache = {}
    colors_cache = {}
    fabrics_cache = {}

    with conn.cursor() as cur:
        cur.execute("SELECT id, slug FROM catalog.categories")
        cats = cur.fetchall()
        for cid, slug in cats:
            slug_to_id[slug] = str(cid)
        for cid, slug in cats:
            if slug.startswith("buyuk-beden-"):
                base_slug = slug[len("buyuk-beden-") :]
                if base_slug in slug_to_id:
                    plus_size_map[slug_to_id[base_slug]] = str(cid)
        diger_id = slug_to_id.get("diger")
        if not diger_id:
            cur.execute("SELECT id FROM catalog.categories WHERE slug = 'kadin-giyim' LIMIT 1")
            parent_row = cur.fetchone()
            if parent_row:
                cur.execute(
                    "INSERT INTO catalog.categories (parent_id, title, slug, is_active) VALUES (%s, 'Diğer', 'diger', true) RETURNING id",
                    (parent_row[0],),
                )
            else:
                cur.execute("INSERT INTO catalog.categories (title, slug, is_active) VALUES ('Diğer', 'diger', true) RETURNING id")
            diger_id = str(cur.fetchone()[0])
            conn.commit()

        cur.execute("SELECT id, color_name FROM catalog.colors")
        for cid, name in cur.fetchall():
            colors_cache[name] = str(cid)

        cur.execute("SELECT id, fabric_name FROM catalog.fabrics")
        for fid, name in cur.fetchall():
            fabrics_cache[name] = str(fid)

        cur.execute("SELECT id, source_product_id, slug FROM catalog.products WHERE feed_id = %s", (feed_id,))
        for pid, src_id, slug in cur.fetchall():
            products_cache[src_id] = (str(pid), slug)

        cur.execute(
            """
            SELECT id, product_id, source_variant_id
            FROM catalog.product_variants
            WHERE product_id IN (SELECT id FROM catalog.products WHERE feed_id = %s)
            """,
            (feed_id,),
        )
        for vid, pid, src_vid in cur.fetchall():
            variants_cache[(str(pid), src_vid)] = str(vid)

    return {
        "slug_to_id": slug_to_id,
        "plus_size_map": plus_size_map,
        "diger_id": diger_id,
        "products_cache": products_cache,
        "variants_cache": variants_cache,
        "colors_cache": colors_cache,
        "fabrics_cache": fabrics_cache,
    }


# ==================== IMAGE DOWNLOAD & WEBP PIPELINE ====================

def _convert_bytes_to_webp(raw_bytes, dest_webp_path):
    os.makedirs(os.path.dirname(dest_webp_path), exist_ok=True)
    if PIL_AVAILABLE:
        with Image.open(BytesIO(raw_bytes)) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                img = img.convert("RGBA")
            elif img.mode != "RGB":
                img = img.convert("RGB")
            img.save(dest_webp_path, format="WEBP", quality=84, method=4)
        return os.path.getsize(dest_webp_path)
    with open(dest_webp_path, "wb") as f:
        f.write(raw_bytes)
    return len(raw_bytes)


async def _download_single_image(sem, session, url, dest_webp_path):
    if os.path.exists(dest_webp_path):
        return url, True, ""
    async with sem:
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=35)) as resp:
                if resp.status != 200:
                    return url, False, f"HTTP {resp.status}"
                raw = await resp.read()
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, _convert_bytes_to_webp, raw, dest_webp_path)
            return url, True, ""
        except Exception as exc:
            return url, False, str(exc)


async def _download_all_images(unique_downloads, conn, redis_client, sync_run_id, stats):
    total = len(unique_downloads)
    if total == 0:
        return 0, {}
    os.makedirs(IMAGE_UPLOAD_DIR, exist_ok=True)
    done = 0
    failed = {}
    pending = []
    for url, dest_path in unique_downloads.items():
        if os.path.exists(dest_path):
            done += 1
        else:
            pending.append((url, dest_path))

    if done > 0:
        pct = done * 100 // total
        print(f"-> Downloaded {done}/{total} images ({pct}%)...")
        sys.stdout.flush()

    if not pending:
        return done, failed

    sem = asyncio.Semaphore(14)
    connector = aiohttp.TCPConnector(limit=20)
    last_report = time.time()
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [asyncio.create_task(_download_single_image(sem, session, url, path)) for url, path in pending]
        for fut in asyncio.as_completed(tasks):
            url, ok, err_msg = await fut
            if ok:
                done += 1
            else:
                failed[url] = err_msg
            now = time.time()
            if now - last_report >= 1.5 or done + len(failed) >= total:
                last_report = now
                pct = done * 100 // total
                print(f"-> Downloaded {done}/{total} images ({pct}%)...")
                sys.stdout.flush()
                update_sync_progress(
                    conn,
                    redis_client,
                    sync_run_id,
                    "running",
                    stats["items_parsed"],
                    stats["items_added"],
                    stats["items_updated"],
                    stats["variants_aligned"],
                    stats["errors_skipped"],
                    total,
                    done,
                )
    return done, failed


# ==================== XML PARSING CORE ====================

def _safe_non_negative_int(raw_val):
    try:
        return max(0, int(float((raw_val or "0").strip())))
    except (ValueError, TypeError):
        return 0


def _extract_raw_variants(elem):
    raw_variants = []
    varyantlar_el = elem.find("varyantlar")
    if varyantlar_el is not None:
        for var_el in varyantlar_el.findall("varyant"):
            secenek_raw = (var_el.findtext("secenek") or "").strip()
            # Hediye kartı tutar seçeneklerini atla ("500₺" vb.)
            if "₺" in secenek_raw:
                continue
            raw_variants.append(
                {
                    "size": normalize_size_token(secenek_raw),
                    "stock": _safe_non_negative_int(var_el.findtext("stok")),
                    "sku": (var_el.findtext("stok_kodu") or "").strip(),
                    "barcode": (var_el.findtext("barkod") or "").strip(),
                }
            )
    if not raw_variants:
        raw_variants.append(
            {
                "size": "Standart",
                "stock": _safe_non_negative_int(elem.findtext("stok")),
                "sku": (elem.findtext("stok_kodu") or "").strip(),
                "barcode": (elem.findtext("barkod") or "").strip(),
            }
        )
    return raw_variants


def _merge_variant_into_bucket(size_agg, variant):
    skey = variant["size"]
    existing = size_agg.get(skey)
    if existing is None:
        size_agg[skey] = dict(variant)
        return
    existing["stock"] += variant["stock"]
    if not existing["barcode"] and variant["barcode"]:
        existing["barcode"] = variant["barcode"]


def _aggregate_variants_by_size(raw_variants, elem):
    size_agg = {}
    for variant in raw_variants:
        _merge_variant_into_bucket(size_agg, variant)

    total_stock = sum(v["stock"] for v in size_agg.values())
    if total_stock == 0 and len(size_agg) == 1:
        urun_stock = _safe_non_negative_int(elem.findtext("stok"))
        if urun_stock > 0:
            only_key = next(iter(size_agg))
            size_agg[only_key]["stock"] = urun_stock
            total_stock = urun_stock
    return size_agg, total_stock


def _build_variant_rows(sorted_sizes, size_agg, product_uuid, source_product_id, variants_cache, is_new_product, sync_run_id, stats):
    variant_rows = []
    for sz in sorted_sizes:
        v = size_agg.get(sz)
        if not v:
            continue
        source_var_id = f"{source_product_id}:{sz}"
        vid = None if is_new_product else variants_cache.get((product_uuid, source_var_id))
        if not vid:
            vid = str(uuid.uuid4())
        variant_rows.append(
            (
                vid,
                product_uuid,
                sz,
                v["barcode"],
                v["stock"],
                False,
                source_var_id,
                sync_run_id,
                v["stock"] > 0,
            )
        )
        stats["variants_aligned"] += 1
    return variant_rows


def _parse_urun_variants(elem, product_uuid, source_product_id, variants_cache, is_new_product, sync_run_id, stats):
    raw_variants = _extract_raw_variants(elem)
    sorted_sizes = sort_sizes_canonically([v["size"] for v in raw_variants])
    packing_ratio = ",".join(sorted_sizes) if sorted_sizes else "Standart"
    series_ratio, min_order_qty = calculate_series_ratio(sorted_sizes)

    size_agg, total_stock = _aggregate_variants_by_size(raw_variants, elem)
    has_positive_var = any(v["stock"] > 0 for v in size_agg.values())
    has_zero_var = any(v["stock"] == 0 for v in size_agg.values())
    is_broken_series = total_stock > 0 and has_positive_var and has_zero_var

    variant_rows = _build_variant_rows(
        sorted_sizes, size_agg, product_uuid, source_product_id, variants_cache, is_new_product, sync_run_id, stats
    )
    return {
        "variant_rows": variant_rows,
        "packing_ratio": packing_ratio,
        "series_ratio": series_ratio,
        "min_order_qty": min_order_qty,
        "total_stock": total_stock,
        "is_broken_series": is_broken_series,
    }


def _init_parse_state():
    parsed_data = {
        "products_to_upsert": {},
        "variants_to_upsert": {},
        "colors_to_upsert": {},
        "fabrics_to_upsert": {},
        "images_by_product": {},
        "unique_downloads": {},
        "dry_run_samples": [],
    }
    stats = {
        "total_xml_nodes": 0,
        "items_parsed": 0,
        "items_added": 0,
        "items_updated": 0,
        "variants_aligned": 0,
        "errors_skipped": 0,
        "skipped_non_apparel": 0,
        "active_count": 0,
        "inactive_count": 0,
        "broken_series_count": 0,
        "low_stock_count": 0,
        "category_counts": Counter(),
        "series_counts": Counter(),
        "skipped_reasons": [],
        "diger_titles": [],
    }
    return parsed_data, stats


def _get_or_register_lookup_id(name, cache_map, upsert_map):
    if name in cache_map:
        return cache_map[name]
    item_id = upsert_map.get(name) or str(uuid.uuid4())
    upsert_map[name] = item_id
    cache_map[name] = item_id
    return item_id


def _resolve_product_identity(source_product_id, title, products_cache, stats):
    cached_prod = products_cache.get(source_product_id)
    if cached_prod:
        stats["items_updated"] += 1
        return cached_prod[0], cached_prod[1], False
    product_uuid = str(uuid.uuid4())
    product_slug = f"{slugify_tr(title)[:90]}-{product_uuid[:8]}"
    stats["items_added"] += 1
    return product_uuid, product_slug, True


def _collect_urun_images(elem, product_slug, is_active, download_inactive_images, unique_downloads):
    resimler_el = elem.find("resimler")
    if resimler_el is None:
        return []
    img_urls = []
    for img_el in resimler_el.findall("resim"):
        url_text = (img_el.text or "").strip()
        if url_text and url_text not in img_urls:
            img_urls.append(url_text)
    prod_images = []
    for img_url in img_urls:
        url_hash = hashlib.md5(img_url.encode("utf-8")).hexdigest()[:12]
        filename = f"{product_slug}-{url_hash}{EXT_WEBP}"
        db_url = f"{DB_IMAGE_PREFIX}/{filename}"
        local_path = os.path.join(IMAGE_UPLOAD_DIR, filename)
        prod_images.append((img_url, local_path, db_url))
        if is_active or download_inactive_images:
            unique_downloads[img_url] = local_path
    return prod_images


def _update_stock_and_category_stats(stats, total_stock, var_info, cat_slug, source_product_id, title, shopify_cat):
    if total_stock > 0:
        stats["active_count"] += 1
        if total_stock <= 5:
            stats["low_stock_count"] += 1
        if var_info["is_broken_series"]:
            stats["broken_series_count"] += 1
    else:
        stats["inactive_count"] += 1
    stats["category_counts"][cat_slug] += 1
    stats["series_counts"][var_info["series_ratio"]] += 1
    if cat_slug == "diger":
        stats["diger_titles"].append((source_product_id, title, shopify_cat))


def _build_dry_run_sample(
    source_product_id,
    group_id,
    title,
    stok_kodu,
    is_active,
    total_stock,
    cat_slug,
    shopify_cat,
    color_name,
    fabric_name,
    season,
    var_info,
    prod_images,
):
    return {
        "source_product_id": source_product_id,
        "group_id": group_id,
        "title": title,
        "sku": stok_kodu,
        "is_active": is_active,
        "total_stock": total_stock,
        "category_slug": cat_slug,
        "category_path": LIVE_CATEGORY_SLUG_PATHS.get(cat_slug, cat_slug),
        "shopify_cat": shopify_cat,
        "color": color_name,
        "fabric": fabric_name,
        "season": season,
        "packing_ratio": var_info["packing_ratio"],
        "series_ratio": var_info["series_ratio"],
        "minimum_order_quantity": var_info["min_order_qty"],
        "price": 0.0,
        "buying_price": 0.0,
        "currency": "TRY",
        "images_count": len(prod_images),
        "first_image_db": prod_images[0][2] if prod_images else None,
    }


def _process_single_urun(elem, feed_id, brand_id, sync_run_id, meta, parsed_data, stats, download_inactive_images):
    stats["total_xml_nodes"] += 1
    raw_id = (elem.findtext("id") or "").strip()
    stok_kodu = (elem.findtext("stok_kodu") or "").strip()
    source_product_id = raw_id or stok_kodu
    title = (elem.findtext("urun_adi") or "").strip()

    if not source_product_id or not title:
        stats["errors_skipped"] += 1
        return

    skip_flag, skip_reason = should_skip_non_apparel(source_product_id, title)
    if skip_flag:
        stats["skipped_non_apparel"] += 1
        stats["skipped_reasons"].append((source_product_id, title, skip_reason))
        return

    product_uuid, product_slug, is_new = _resolve_product_identity(
        source_product_id, title, meta["products_cache"], stats
    )
    raw_desc = elem.findtext("aciklama") or ""
    clean_desc = clean_html_text(raw_desc)
    sanitized_desc = sanitize_html_description(raw_desc)
    short_desc = truncate_short_desc(clean_desc, 240)

    var_info = _parse_urun_variants(
        elem, product_uuid, source_product_id, meta["variants_cache"], is_new, sync_run_id, stats
    )
    total_stock = var_info["total_stock"]
    is_active = total_stock > 0

    shopify_cat = (elem.findtext("kategori") or "").strip()
    cat_slug, cat_id = resolve_category_id(
        title,
        shopify_cat,
        var_info["packing_ratio"],
        meta["slug_to_id"],
        meta["plus_size_map"],
        meta["diger_id"],
    )
    _update_stock_and_category_stats(stats, total_stock, var_info, cat_slug, source_product_id, title, shopify_cat)

    color_name = extract_color(title, clean_desc)
    color_id = _get_or_register_lookup_id(color_name, meta["colors_cache"], parsed_data["colors_to_upsert"])

    fabric_name = extract_fabric(title, clean_desc)
    fabric_id = _get_or_register_lookup_id(fabric_name, meta["fabrics_cache"], parsed_data["fabrics_to_upsert"])

    season = extract_season(title, clean_desc)
    group_id = extract_model_group_id(stok_kodu, clean_desc, source_product_id)
    barcode = (elem.findtext("barkod") or "").strip()
    source_url = (elem.findtext("url") or "").strip()

    meta_attrs = json.dumps(
        {
            "shopify_category_id": shopify_cat,
            "original_brand": DEFAULT_BRAND_NAME,
            "whatsapp_only_ordering": True,
        },
        ensure_ascii=False,
    )

    # Black Fashion: whatsapp_only_ordering = true -> fiyatlar 0.0
    parsed_data["products_to_upsert"][source_product_id] = (
        product_uuid,
        feed_id,
        source_product_id,
        group_id,
        title,
        product_slug,
        cat_id,
        "Kadın",
        sync_run_id,
        is_active,
        brand_id,
        var_info["series_ratio"],
        var_info["packing_ratio"],
        0.35,
        var_info["min_order_qty"],
        season,
        0.0,
        0.0,
        None,
        None,
        "TRY",
        10.0,
        total_stock,
        stok_kodu or source_product_id,
        barcode,
        short_desc,
        sanitized_desc,
        meta_attrs,
        source_url,
        color_id,
        fabric_id,
    )

    for v_row in var_info["variant_rows"]:
        parsed_data["variants_to_upsert"][(product_uuid, v_row[6])] = v_row

    prod_images = _collect_urun_images(
        elem, product_slug, is_active, download_inactive_images, parsed_data["unique_downloads"]
    )
    if prod_images:
        parsed_data["images_by_product"][product_uuid] = prod_images

    if len(parsed_data["dry_run_samples"]) < 20:
        parsed_data["dry_run_samples"].append(
            _build_dry_run_sample(
                source_product_id,
                group_id,
                title,
                stok_kodu,
                is_active,
                total_stock,
                cat_slug,
                shopify_cat,
                color_name,
                fabric_name,
                season,
                var_info,
                prod_images,
            )
        )

    stats["items_parsed"] += 1


def _log_parsed_progress(stats):
    print(
        f"-> Parsed {stats['items_parsed']} products... "
        f"(Added: {stats['items_added']}, Updated: {stats['items_updated']}, Errors: {stats['errors_skipped']})"
    )
    sys.stdout.flush()


def _stream_parse_xml(xml_path, feed_id, brand_id, sync_run_id, meta, download_inactive_images=False):
    parsed_data, stats = _init_parse_state()
    context = ET.iterparse(xml_path, events=("end",), tag="urun")
    for _, elem in context:
        try:
            _process_single_urun(
                elem, feed_id, brand_id, sync_run_id, meta, parsed_data, stats, download_inactive_images
            )
            if stats["items_parsed"] > 0 and stats["items_parsed"] % 250 == 0:
                _log_parsed_progress(stats)
        except Exception as exc:
            stats["errors_skipped"] += 1
            sys.stderr.write(f"Warning: Failed parsing <urun>: {exc}\n")
        finally:
            elem.clear()
            while elem.getprevious() is not None:
                del elem.getparent()[0]
    _log_parsed_progress(stats)
    return parsed_data, stats


# ==================== DATABASE BULK WRITE ====================

def _write_colors_batch(cur, colors_to_upsert):
    if not colors_to_upsert:
        return
    color_rows = [(cid, name) for name, cid in colors_to_upsert.items()]
    execute_values_psycopg3(
        cur,
        "INSERT INTO catalog.colors (id, color_name) VALUES %s ON CONFLICT (color_name) DO NOTHING",
        color_rows,
        page_size=1000,
    )
    trans_rows = [
        (cid, lang, tr_val)
        for name, cid in colors_to_upsert.items()
        for lang, tr_val in COLOR_TRANSLATIONS.get(name, {}).items()
    ]
    if trans_rows:
        execute_values_psycopg3(
            cur,
            "INSERT INTO catalog.color_translations (color_id, language_code, color_name) VALUES %s ON CONFLICT (color_id, language_code) DO NOTHING",
            trans_rows,
            page_size=2000,
        )


def _write_fabrics_batch(cur, fabrics_to_upsert):
    if not fabrics_to_upsert:
        return
    fabric_rows = [(fid, name) for name, fid in fabrics_to_upsert.items()]
    execute_values_psycopg3(
        cur,
        "INSERT INTO catalog.fabrics (id, fabric_name) VALUES %s ON CONFLICT (fabric_name) DO NOTHING",
        fabric_rows,
        page_size=1000,
    )
    fab_trans = [
        (fid, lang, tr_val)
        for name, fid in fabrics_to_upsert.items()
        for lang, tr_val in FABRIC_TRANSLATIONS.get(name, {}).items()
    ]
    if fab_trans:
        execute_values_psycopg3(
            cur,
            "INSERT INTO catalog.fabric_translations (fabric_id, language_code, fabric_name) VALUES %s ON CONFLICT (fabric_id, language_code) DO NOTHING",
            fab_trans,
            page_size=2000,
        )


def _write_products_batch(cur, products_to_upsert):
    if not products_to_upsert:
        return
    upsert_products_sql = """
    INSERT INTO catalog.products (
        id, feed_id, source_product_id, source_product_group_id, title, slug,
        category_id, gender, last_sync_run_id, is_active, brand_id,
        series_ratio, packing_ratio, shipping_weight_kg, minimum_order_quantity, season,
        buying_price, price, single_price, discounted_price, currency, tax_rate, stock, sku, barcode,
        short_description, description, meta_attributes, source_url,
        color_id, fabric_id
    )
    VALUES %s
    ON CONFLICT (feed_id, source_product_id) DO UPDATE SET
        source_product_group_id = EXCLUDED.source_product_group_id,
        title = EXCLUDED.title,
        category_id = EXCLUDED.category_id,
        gender = EXCLUDED.gender,
        last_sync_run_id = EXCLUDED.last_sync_run_id,
        is_active = EXCLUDED.is_active,
        deactivated_at = CASE
            WHEN EXCLUDED.is_active THEN NULL
            ELSE COALESCE(catalog.products.deactivated_at, CURRENT_TIMESTAMP)
        END,
        brand_id = EXCLUDED.brand_id,
        series_ratio = EXCLUDED.series_ratio,
        packing_ratio = EXCLUDED.packing_ratio,
        shipping_weight_kg = EXCLUDED.shipping_weight_kg,
        minimum_order_quantity = EXCLUDED.minimum_order_quantity,
        season = EXCLUDED.season,
        buying_price = EXCLUDED.buying_price,
        price = EXCLUDED.price,
        single_price = EXCLUDED.single_price,
        discounted_price = EXCLUDED.discounted_price,
        currency = EXCLUDED.currency,
        tax_rate = EXCLUDED.tax_rate,
        stock = EXCLUDED.stock,
        sku = EXCLUDED.sku,
        barcode = EXCLUDED.barcode,
        short_description = EXCLUDED.short_description,
        description = EXCLUDED.description,
        meta_attributes = EXCLUDED.meta_attributes,
        source_url = EXCLUDED.source_url,
        color_id = EXCLUDED.color_id,
        fabric_id = EXCLUDED.fabric_id,
        updated_at = CURRENT_TIMESTAMP
    """
    execute_values_psycopg3(cur, upsert_products_sql, list(products_to_upsert.values()), page_size=1000)


def _write_variants_batch(cur, variants_to_upsert):
    if not variants_to_upsert:
        return
    upsert_vars_sql = """
    INSERT INTO catalog.product_variants (
        id, product_id, variant_size, barcode, stock, is_single, source_variant_id, last_sync_run_id, is_active
    )
    VALUES %s
    ON CONFLICT (product_id, source_variant_id) DO UPDATE SET
        variant_size = EXCLUDED.variant_size,
        barcode = EXCLUDED.barcode,
        stock = EXCLUDED.stock,
        is_single = EXCLUDED.is_single,
        last_sync_run_id = EXCLUDED.last_sync_run_id,
        is_active = EXCLUDED.is_active,
        updated_at = CURRENT_TIMESTAMP
    """
    execute_values_psycopg3(cur, upsert_vars_sql, list(variants_to_upsert.values()), page_size=1000)


def _write_images_batch(cur, products_to_upsert, images_by_product):
    prod_uuids = [p[0] for p in products_to_upsert.values()]
    if not prod_uuids or not images_by_product:
        return
    cur.execute("DELETE FROM catalog.product_images WHERE product_id = ANY(%s::uuid[])", (prod_uuids,))
    img_rows = [
        (str(uuid.uuid4()), p_uuid, db_url, idx, idx == 0)
        for p_uuid, imgs in images_by_product.items()
        for idx, (_, _, db_url) in enumerate(imgs)
    ]
    if img_rows:
        execute_values_psycopg3(
            cur,
            "INSERT INTO catalog.product_images (id, product_id, image_url, sort_order, is_cover) VALUES %s",
            img_rows,
            page_size=2000,
        )


def _bulk_write_all(conn, parsed_data, timings):
    t_start = time.time()
    with conn.cursor() as cur:
        _write_colors_batch(cur, parsed_data["colors_to_upsert"])
        _write_fabrics_batch(cur, parsed_data["fabrics_to_upsert"])
        _write_products_batch(cur, parsed_data["products_to_upsert"])
        _write_variants_batch(cur, parsed_data["variants_to_upsert"])
        _write_images_batch(cur, parsed_data["products_to_upsert"], parsed_data["images_by_product"])
    conn.commit()
    timings["DB Bulk Write"] = time.time() - t_start


# ==================== DRY-RUN REPORTER & ENTRYPOINTS ====================

def _run_dry_run(args):
    xml_path = args.xml_file or (DEFAULT_LOCAL_XML if os.path.isfile(DEFAULT_LOCAL_XML) else None)
    feed_url = _resolve_feed_url(None, args.feed_id, args.xml_url)
    if xml_path:
        temp_xml = _download_xml_to_temp(xml_path, xml_url=feed_url)
    else:
        temp_xml = _download_xml_to_temp(None, xml_url=feed_url)

    meta = {
        "slug_to_id": dict(LIVE_CATEGORY_SLUG_PATHS),
        "plus_size_map": {},
        "diger_id": "kadin-giyim/diger",
        "products_cache": {},
        "variants_cache": {},
        "colors_cache": {},
        "fabrics_cache": {},
    }
    parsed_data, stats = _stream_parse_xml(
        temp_xml,
        args.feed_id,
        "dry-run-brand-id",
        "dry-run-sync-id",
        meta,
        download_inactive_images=False,
    )
    if os.path.exists(XML_TEMP_FILE):
        os.remove(XML_TEMP_FILE)

    print("\n================ BLACK FASHION XML --DRY-RUN SUMMARY ================")
    print(f"Toplam XML <urun> Düğümü       : {stats['total_xml_nodes']}")
    print(f"Atlanan (Giyim Dışı / Test)   : {stats['skipped_non_apparel']}")
    for sid, t, reason in stats["skipped_reasons"]:
        print(f"  - [{reason}] {sid} | {t}")
    print(f"İşlenen Ürün Sayısı           : {stats['items_parsed']}")
    print(f"  -> Aktif (stok > 0)         : {stats['active_count']}")
    print(f"  -> Pasif (stok = 0)         : {stats['inactive_count']}")
    print(f"  -> Kırık Seri (aktif içinde): {stats['broken_series_count']}")
    print(f"  -> Düşük Stok (1 <= s <= 5) : {stats['low_stock_count']}")
    print(f"Toplam Beden Varyantı         : {stats['variants_aligned']}")
    print(f"Aktif Ürün Eşsiz Görsel Sayısı: {len(parsed_data['unique_downloads'])}")

    print("\n--- Seri Oranı Dağılımı ---")
    for sr, cnt in stats["series_counts"].most_common():
        print(f"  {sr:12}: {cnt}")

    print("\n--- Kategori Eşleme Dağılımı ---")
    for slug, cnt in stats["category_counts"].most_common():
        full_path = LIVE_CATEGORY_SLUG_PATHS.get(slug, slug)
        print(f"  {full_path:42} ({slug}): {cnt}")

    if stats["diger_titles"]:
        print(f"\n--- 'diger' Kategorisine Düşen Ürünler ({len(stats['diger_titles'])}) ---")
        for sid, title, sc in stats["diger_titles"][:30]:
            print(f"  - [{sc or '-'}] {sid}: {title}")

    sample_n = max(1, args.samples)
    print(f"\n--- İlk {sample_n} Örnek Kayıt (JSON) ---")
    # Aktif ve çeşitli örnekler göstermek için ilk aktif + ilk pasif + farklı kategoriler seç
    chosen = []
    for sample in parsed_data["dry_run_samples"]:
        if len(chosen) < sample_n:
            chosen.append(sample)
    print(json.dumps(chosen, indent=2, ensure_ascii=False))
    print("=====================================================================\n")


def _run_production_sync(args):
    if ConnectionPool is None:
        sys.stderr.write("Error: psycopg_pool is required for database sync.\n")
        sys.exit(1)

    cfg = _load_runtime_config()
    redis_client = _init_redis_client(cfg["redis_url"])
    conninfo = (
        f"host={cfg['db_host']} port={cfg['db_port']} user={cfg['db_user']} "
        f"password={cfg['db_password']} dbname={cfg['db_name']}"
    )

    timings = {}
    t_total = time.time()
    pool = ConnectionPool(conninfo=conninfo, min_size=1, max_size=2)
    conn_ctx = pool.connection()
    conn = conn_ctx.__enter__()
    sync_run_id = None

    try:
        sync_run_id = _init_sync_run(conn, args.feed_id, args.sync_run_id)
        brand_id = _resolve_brand_id(conn, args.feed_id)
        feed_url = _resolve_feed_url(conn, args.feed_id, args.xml_url)
        meta = _load_db_metadata(conn, args.feed_id)

        temp_xml = _download_xml_to_temp(args.xml_file, xml_url=feed_url)
        t_parse = time.time()
        parsed_data, stats = _stream_parse_xml(
            temp_xml,
            args.feed_id,
            brand_id,
            sync_run_id,
            meta,
            download_inactive_images=args.download_inactive_images,
        )
        timings["XML Parse"] = time.time() - t_parse

        _bulk_write_all(conn, parsed_data, timings)
        images_total = len(parsed_data["unique_downloads"])
        update_sync_progress(
            conn,
            redis_client,
            sync_run_id,
            "running",
            stats["items_parsed"],
            stats["items_added"],
            stats["items_updated"],
            stats["variants_aligned"],
            stats["errors_skipped"],
            images_total,
            0,
        )

        t_img = time.time()
        images_downloaded, failed = asyncio.run(
            _download_all_images(parsed_data["unique_downloads"], conn, redis_client, sync_run_id, stats)
        )
        timings["Image Downloads"] = time.time() - t_img
        if failed:
            with open(FAILED_IMAGES_CSV, "w", encoding="utf-8") as cf:
                cf.write("url,error\n")
                for u, err_str in failed.items():
                    cf.write(f'"{u}","{err_str}"\n')

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE catalog.products SET is_active = false, deactivated_at = COALESCE(deactivated_at, CURRENT_TIMESTAMP) WHERE feed_id = %s AND last_sync_run_id IS DISTINCT FROM %s",
                (args.feed_id, sync_run_id),
            )
            cur.execute(
                "UPDATE catalog.product_variants SET is_active = false WHERE product_id IN (SELECT id FROM catalog.products WHERE feed_id = %s) AND last_sync_run_id IS DISTINCT FROM %s",
                (args.feed_id, sync_run_id),
            )
        conn.commit()

        timings["Total"] = time.time() - t_total
        update_sync_progress(
            conn,
            redis_client,
            sync_run_id,
            "success",
            stats["items_parsed"],
            stats["items_added"],
            stats["items_updated"],
            stats["variants_aligned"],
            stats["errors_skipped"],
            images_total,
            images_downloaded,
            timings=timings,
        )
        print(f"Black Fashion sync finished successfully in {timings['Total']:.2f}s!")
    except Exception as exc:
        sys.stderr.write(f"Fatal Black Fashion sync error: {exc}\n")
        if sync_run_id:
            update_sync_progress(conn, redis_client, sync_run_id, "failed", 0, 0, 0, 0, 0, 0, 0)
        raise
    finally:
        _cleanup_old_xml_history()
        if os.path.exists(XML_TEMP_FILE):
            try:
                os.remove(XML_TEMP_FILE)
            except OSError:
                pass
        try:
            conn_ctx.__exit__(None, None, None)
        except Exception:
            pass
        pool.close()


def main():
    parser = argparse.ArgumentParser(description="Black Fashion Shopify XML B2B Sync Parser")
    parser.add_argument("--dry-run", action="store_true", help="Parse XML locally without writing to DB or downloading images")
    parser.add_argument("--samples", type=int, default=3, help="Number of sample products to print in --dry-run")
    parser.add_argument("--xml-file", type=str, default=None, help="Path to local XML file override")
    parser.add_argument("--xml-url", type=str, default=None, help="XML feed URL override")
    parser.add_argument(
        "--feed-id",
        type=str,
        default=os.environ.get("FEED_ID") or DEFAULT_FEED_ID,
        help="Target integration.xml_feeds.id",
    )
    parser.add_argument("--sync-run-id", type=str, default=None, help="Sync run UUID")
    parser.add_argument("--production", action="store_true", help="Run in production mode (accepted by Go worker)")
    parser.add_argument("--download-inactive-images", action="store_true", help="Also download images for stok=0 products")
    args = parser.parse_args()

    if args.dry_run:
        _run_dry_run(args)
    else:
        _run_production_sync(args)


if __name__ == "__main__":
    main()
