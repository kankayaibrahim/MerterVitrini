from lxml import etree as ET
import sys
import os
import json
import urllib.request
import re
import hashlib
import asyncio
import aiohttp
import aiofiles
from datetime import datetime
import psycopg
from psycopg_pool import ConnectionPool
import uuid
import time
from PIL import Image
import PIL.Image
import redis
import platform
from bs4 import BeautifulSoup

# ==============================================================================
# CONFIGURATION BLOCK
# ==============================================================================
# Tedarikçi fiyatı doğrudan (0% kar marjı ile birebir) vitrine yansıtılır
PROFIT_RATE = 0.0

CAT_ALT_ETEK = "kadin-giyim/alt-giyim/etek"
CAT_DIGER = "kadin-giyim/diger"
CAT_TAKIM_IKILI = "kadin-giyim/takim-tulum/ikili-takim"
CAT_TULUM_SALOPET = "kadin-giyim/takim-tulum/tulum-salopet"
CAT_ELBISE = "kadin-giyim/elbise-abiye/elbise"
CAT_CEKET_BLAZER = "kadin-giyim/dis-giyim/ceket-blazer"

COLOR_SUTLU_KAHVE = "Sütlü Kahve"
COLOR_ZUMRUT = "Zümrüt"
COLOR_KIRMIZI = "Kırmızı"
COLOR_CICEK_DESEN = "Çiçek Desen"
COLOR_CICEK_DESEN_MAVI = "Çiçek Desen Mavi"
COLOR_ALTIN = "Altın"

FABRIC_DALGIC = "Dalgıç"
FABRIC_MODAL_BASKILI = "Modal Baskılı"
FABRIC_DIJITAL_BASKILI = "Dijital Baskılı"

EXT_WEBP = ".webp"
ETIKA_XML_FILE = "ETIKA_XML.xml"

STANDARD_SIZE_MAP = {
    "XS": 30, "S": 40, "M": 50, "L": 60, "XL": 70, 
    "XXL": 80, "2XL": 80, "XXXL": 90, "3XL": 90, 
    "XXXXL": 100, "4XL": 100, "5XL": 110, "6XL": 120,
    "7XL": 130, "8XL": 140, "STANDART": 500, "STANDARD": 500,
    "3XS": 10, "XXXS": 10, "2XS": 20, "XXS": 20
}

def _parse_single_size_weight(s):
    s = s.strip().upper()
    if s in STANDARD_SIZE_MAP:
        return STANDARD_SIZE_MAP[s]
    if s.isdigit():
        return int(s)
    m = re.match(r'^(\d+)(XL|XXL|XXXL|XS|XXS|XXXS|L|M|S)$', s)
    if m:
        val = int(m.group(1))
        unit = m.group(2)
        if unit in ('XL', 'L'):
            return 70 + (val - 1) * 10
        if unit in ('XS', 'S'):
            return 40 - val * 10
    if s.endswith('XL'):
        return 70 + (s.count('X') - 1) * 10
    if s.endswith('XS'):
        return 40 - s.count('X') * 10
    return 999

def _parse_range_weight(token):
    token = token.strip().upper()
    if token in STANDARD_SIZE_MAP:
        return STANDARD_SIZE_MAP[token]
    parts = re.split(r'[-/_]', token)
    if len(parts) == 2:
        part1, part2 = parts[0].strip(), parts[1].strip()
        if part1.isdigit() and part2.endswith('XL'):
            return min(_parse_single_size_weight(part1 + 'XL'), _parse_single_size_weight(part2))
        if part1.isdigit() and part2.endswith('XS'):
            return min(_parse_single_size_weight(part1 + 'XS'), _parse_single_size_weight(part2))
        return min(_parse_single_size_weight(part1), _parse_single_size_weight(part2))
    return _parse_single_size_weight(token)

def _size_sort_key(token):
    token = token.strip().upper()
    if not token:
        return (999, 999, token)
    if token.isdigit():
        return (0, int(token), token)
    if token in STANDARD_SIZE_MAP:
        return (1, STANDARD_SIZE_MAP[token], token)
    return (1, _parse_range_weight(token), token)

def sort_packing_ratio(ratio_str):
    if not ratio_str:
        return ratio_str
    tokens = [t.strip() for t in ratio_str.split(',') if t.strip()]
    if not tokens:
        return ratio_str
    tokens.sort(key=_size_sort_key)
    return ",".join(tokens)

def is_xl_or_above(ratio):
    if not ratio:
        return False
    
    plus_size_indicators = {
        "XL", "XXL", "2XL", "XXXL", "3XL", "XXXXL", "4XL", "5XL", "6XL", "7XL", "8XL", "2-3XL", "L-XL"
    }
    
    tokens = [t.strip().upper() for t in ratio.split(',')]
    for token in tokens:
        if token in plus_size_indicators:
            return True
        parts = re.split(r'[-/_]', token)
        for part in parts:
            part = part.strip()
            if part in plus_size_indicators or part.endswith('XL') or part.endswith('XS') and part != 'XS':
                return True
            if any(ind in part for ind in ("XL", "XXL", "2XL", "3XL", "4XL", "5XL")):
                return True
    return False

FEED_ID = "etika"
FEED_URL = "https://etikafashion.com/xml/products/merchant/952"
XML_TEMP_FILE = "etika_xml.xml"

# Hardcoded Category Mapping (XML path -> target database category slug path)
CATEGORY_MAPPING = {
    "CROP": "kadin-giyim/ust-giyim/crop",
    "Etek": CAT_ALT_ETEK,
    "Denim": "kadin-giyim/alt-giyim/pantolon",
    "Elegant": CAT_DIGER,
    "Vintage": CAT_DIGER,
    "KOT TRENC": "kadin-giyim/dis-giyim/trenckot",
    "Takımlar": CAT_TAKIM_IKILI,
    "BLUZ FIRFIRLI": "kadin-giyim/ust-giyim/bluz",
    "TULUM AYROBİN": CAT_TULUM_SALOPET,
    "Siyah Beyaz Aşkı": CAT_DIGER,
    "BÜSTİYER GÜPELİ": "kadin-giyim/ust-giyim/bustiyer",
    "BÜSTİYER GİPELİ": "kadin-giyim/ust-giyim/bustiyer",
    "Ceket > MINI ELBİSE": CAT_ELBISE,
    "TAKIM > MIDI ELBİSE": CAT_TAKIM_IKILI,
    "Tulum > MINI ELBİSE": CAT_TULUM_SALOPET,
    "YILBAŞI KOLEKSİYONU": CAT_DIGER,
    "Ceket > MİDİ ELBİSE": CAT_ELBISE,
    "ELBİSE > MIDI ELBİSE": CAT_ELBISE,
    "ELBİSE > MINI ELBİSE": CAT_ELBISE,
    "KOT ETEK > MIDI ELBİSE": CAT_ALT_ETEK,
    "KOT TULUM > MİDİ ELBİSE": CAT_TULUM_SALOPET,
    "TRİKO TAKIM > MİDİ ELBİSE": CAT_TAKIM_IKILI,
    "Elbiseler > Midi Boy Elbiseler": CAT_ELBISE,
    "Elbiseler > Mini Boy Elbiseler": CAT_ELBISE,
    "Ceket > CEKET": CAT_CEKET_BLAZER,
    "Ceket": CAT_CEKET_BLAZER,
    "CEKET": CAT_CEKET_BLAZER,
    "Ceket > Blazer Ceket": CAT_CEKET_BLAZER,
    "Blazer Ceket": CAT_CEKET_BLAZER
}

# Dynamic Environment and Directory Settings
IS_WINDOWS = (platform.system() == "Windows")

if IS_WINDOWS:
    # On Windows (Local Dev/Debug): create "downloads/products/flora" inside script's folder
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    IMAGE_UPLOAD_DIR = os.path.join(SCRIPT_DIR, "downloads", "products", "flora")
    DB_IMAGE_PREFIX = "./downloads/products/flora"
else:
    # On Linux (Production/Staging): standard server path
    IMAGE_UPLOAD_DIR = "/var/www/media/products/flora"
    DB_IMAGE_PREFIX = "/uploads/products/flora"

# Predefined Turkish Colors list to match against titles (if needed as fallback)
COLORS_LIST = [
    "Saks Mavi", COLOR_SUTLU_KAHVE, "Zümrüt Yeşili", COLOR_ZUMRUT, "Siyah", "Beyaz", "Gri", "Ekru", "Pembe", "Saks",
    "Fuşya", "Turuncu", "Yeşil", "Lila", "Mavi", "Mor", "Haki", "Bej", "Bordo",
    COLOR_KIRMIZI, "Sarı", "Turkuaz", "Kahve", "Gold", "Silver", "Lame", "Antrasit", "Hardal"
]

FABRIC_KEYWORDS = ["Polyester", "Pamuk", "Keten", "Viskon", "Denim", "Saten", "Likra", "Akrilik", "Kadife", "Deri", "Şifon", "Triko", "İthal", "Aerobin", "Atlas"]

def _parse_env_line(line):
    line = line.strip()
    if not line or line.startswith("#"):
        return None, None
    parts = line.split("=", 1)
    if len(parts) != 2:
        return None, None
    key, val = parts[0].strip(), parts[1].strip()
    if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
        val = val[1:-1]
    return key, val

def _apply_config_json(cfg_path):
    if not os.path.exists(cfg_path):
        return
    try:
        with open(cfg_path, "r", encoding="utf-8") as f:
            cfg_data = json.load(f)
        key_map = {
            "db_host": "DB_HOST",
            "db_port": "DB_PORT",
            "db_user": "DB_USER",
            "db_password": "DB_PASSWORD",
            "db_name": "DB_NAME",
        }
        for cfg_key, env_key in key_map.items():
            if cfg_key in cfg_data and not os.environ.get(env_key):
                os.environ[env_key] = str(cfg_data[cfg_key])
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to load config.json from {cfg_path}: {e}\n")

def _apply_dotenv(env_path):
    if not os.path.exists(env_path):
        return False
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                k, v = _parse_env_line(line)
                if k:
                    os.environ[k] = v
        return True
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to load .env from {env_path}: {e}\n")
        return False

# Safe .env & config.json loader function
def load_env():
    search_dirs = [
        os.path.dirname(os.path.abspath(__file__)),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."),
    ]
    for d in search_dirs:
        _apply_config_json(os.path.join(d, "config.json"))
        if _apply_dotenv(os.path.join(d, ".env")):
            break

# Load environment settings from .env
load_env()

# Database Settings with Env Fallbacks
DB_HOST = os.environ.get("DB_HOST", "localhost")
try:
    DB_PORT = int(os.environ.get("DB_PORT", 5432))
except (ValueError, TypeError):
    DB_PORT = 5432
DB_USER = os.environ.get("DB_USER", "postgres")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
DB_NAME = os.environ.get("DB_NAME", "merterdevdb")

REDIS_URL = os.environ.get("REDIS_URL", "")
redis_client = None
if REDIS_URL:
    try:
        redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to initialize Redis client: {e}\n")

def slugify(value):
    if not value:
        return ""
    value = str(value).lower()
    tr_translation = {
        "ı": "i", "ş": "s", "ğ": "g", "ü": "u", "ö": "o", "ç": "c",
        "i̇": "i"
    }
    for tr_c, eng_c in tr_translation.items():
        value = value.replace(tr_c, eng_c)
        
    value = re.sub(r'[\s_]+', '-', value)
    value = re.sub(r'[^a-z0-9\-]', '', value)
    value = re.sub(r'-+', '-', value)
    return value.strip('-')

def turkish_lowercase(text):
    if not text:
        return ""
    res = []
    for c in text:
        if c == 'İ':
            res.append('i')
        elif c == 'I':
            res.append('ı')
        elif c == 'Ş':
            res.append('ş')
        elif c == 'Ç':
            res.append('ç')
        elif c == 'Ğ':
            res.append('ğ')
        elif c == 'Ü':
            res.append('ü')
        elif c == 'Ö':
            res.append('ö')
        else:
            res.append(c.lower())
    return "".join(res)

def _turkish_first_upper(c):
    if c == 'i':
        return 'İ'
    if c == 'ı':
        return 'I'
    return c.upper()

def turkish_title(text):
    if not text:
        return ""
    words = text.strip().split()
    title_words = []
    for w in words:
        if not w:
            continue
        title_words.append(_turkish_first_upper(w[0]) + turkish_lowercase(w[1:]))
    return " ".join(title_words)

SPECIAL_MAPPINGS = {
    "oranj": "Turuncu",
    "sax": "Saks",
    "cicekli": "Çiçekli",
    "cıceklı": "Çiçekli",
    "desenli": "Desenli",
    "desenlı": "Desenli",
    "ek desen": COLOR_CICEK_DESEN,
    "ek desen mavi": COLOR_CICEK_DESEN_MAVI,
    "ek desen pembe": "Çiçek Desen Pembe",
    "ek desen yeşil": "Çiçek Desen Yeşil",
    "ek d. mavi": COLOR_CICEK_DESEN_MAVI,
    "ek d. sarı": "Çiçek Desen Sarı",
    "çiçek desen": COLOR_CICEK_DESEN,
    "çiçek desen mavi": COLOR_CICEK_DESEN_MAVI,
    "çiçek desen pembe": "Çiçek Desen Pembe",
    "çiçek desen yeşil": "Çiçek Desen Yeşil",
    "çiçek d. mavi": COLOR_CICEK_DESEN_MAVI,
    "çiçek d. sarı": "Çiçek Desen Sarı",
    "gul desen pembe": "Gül Desen Pembe",
    "gül desen pembe": "Gül Desen Pembe",
    "gümüş pul payet": "Gümüş Pul Payet",
    "bebe mavisi": "Bebe Mavisi",
    "haki yeşil": "Haki Yeşil",
    "indigo": "İndigo",
    "kiremit": "Kiremit",
    "kiremıt": "Kiremit",
    "kırmızı": COLOR_KIRMIZI,
    "lacivert": "Lacivert",
    "mürdüm": "Mürdüm",
    "pembe çiçekli": "Pembe Çiçekli",
    "petrol yeşili": "Petrol Yeşili",
    "puantiye": "Puantiyeli",
    "sarı": "Sarı",
    "siyah beyaz": "Siyah Beyaz",
    "siyah beyaz çizgili": "Siyah Beyaz Çizgili",
    "sütlü kahve": COLOR_SUTLU_KAHVE,
    "taş": "Taş",
    "toprak": "Toprak",
    "turkuaz yeşil": "Turkuaz Yeşil",
    "yaprak desen": "Yaprak Desen",
    "yılan desen": "Yılan Desen",
    "zümrüt": COLOR_ZUMRUT,
    "mavi beyaz": "Mavi Beyaz",
    "mavi sim": "Mavi Sim",
    "pembe sim": "Pembe Sim",
    "beyaz mavi": "Beyaz Mavi",
    "açık mavi": "Açık Mavi",
    "koyu mavi": "Koyu Mavi",
    "bal köpüğü": "Bal Köpüğü",
    "altın": COLOR_ALTIN,
    "camel": "Camel",
    "gold": COLOR_ALTIN,
    "silver": "Gümüş",
}

def standardize_color(name):
    if not name:
        return ""
    name_clean = " ".join(name.strip().split())
    low = turkish_lowercase(name_clean)
    if low in SPECIAL_MAPPINGS:
        return SPECIAL_MAPPINGS[low]
    return turkish_title(name_clean)

SPECIAL_FABRIC_MAPPINGS = {
    "dalgiç": FABRIC_DALGIC,
    "dalgic": FABRIC_DALGIC,
    "dalgiç-": FABRIC_DALGIC,
    "fi̇sto": "Fisto",
    "fişto": "Fisto",
    "nakişli": "Nakışlı",
    "pamukulu": "Pamuklu",
    "pamuk": "Pamuklu",
    "dubai̇": "Dubai",
    "dubai": "Dubai",
    "ithal": "İthal",
    "iki iplik": "İki İplik",
    "iki̇ i̇pli̇k": "İki İplik",
    "atlas-şifon": "Atlas Şifon",
    "atlas-sifon": "Atlas Şifon",
    "orme krep": "Örme Krep",
    "örme krep": "Örme Krep",
    "sifon": "Şifon",
    "suet": "Süet",
    "suet krep": "Süet Krep",
    "suprem": "Süprem",
    "viskon": "Viskon",
    "yumos": "Yumoş",
    "kaskorse": "Kaşkorse",
    "kasorse": "Kaşkorse",
    "kase": "Kaşe",
    "aerobi̇n": "Aerobin",
    "akri̇li̇k": "Akrilik",
    "deri̇": "Deri",
    "dokuma vi̇skon": "Dokuma Viskon",
    "modal baskialti": FABRIC_MODAL_BASKILI,
    "modal baskıaltı": FABRIC_MODAL_BASKILI,
    "modal baskılı": FABRIC_MODAL_BASKILI,
    "modal baskili": FABRIC_MODAL_BASKILI,
    "dijital": FABRIC_DIJITAL_BASKILI,
    "dijital baskılı": FABRIC_DIJITAL_BASKILI,
    "dijital baskili": FABRIC_DIJITAL_BASKILI,
    "sofia": "Sofia",
    "sofıa": "Sofia",
}

def standardize_fabric(name):
    if not name:
        return ""
    name_clean = " ".join(name.strip().split())
    low = turkish_lowercase(name_clean)
    if low in SPECIAL_FABRIC_MAPPINGS:
        return SPECIAL_FABRIC_MAPPINGS[low]
    return turkish_title(name_clean)



TRANSLATION_MAP = {
    # Attributes
    "Boy": {"en": "Length", "pl": "Długość", "ar": "الطول", "ru": "Длина", "de": "Länge"},
    "Cinsiyet": {"en": "Gender", "pl": "Płeć", "ar": "الجنس", "ru": "Пол", "de": "Geschlecht"},
    "Desen": {"en": "Pattern", "pl": "Wzór", "ar": "النقş", "ru": "Узор", "de": "Muster"},
    "Kalıp": {"en": "Fit", "pl": "Fason", "ar": "القالب", "ru": "Посадка", "de": "Passform"},
    "Kol Boyu": {"en": "Sleeve Length", "pl": "Długość rękawa", "ar": "طول الكم", "ru": "Длина рукава", "de": "Ärmellänge"},
    "Ortam": {"en": "Occasion", "pl": "Okazja", "ar": "المناسبة", "ru": "Событие", "de": "Anlass"},
    "Persona": {"en": "Persona", "pl": "Persona", "ar": "الشخصية", "ru": "Персона", "de": "Persona"},
    "Siluet": {"en": "Silhouette", "pl": "Sylwetka", "ar": "الصورة الظلية", "ru": "Силуэт", "de": "Silhouette"},
    "Yaş Grubu": {"en": "Age Group", "pl": "Grupa wiekowa", "ar": "الفئة العمرية", "ru": "Возрастная группа", "de": "Altersgruppe"},
    "Astar Durumu": {"en": "Lining Status", "pl": "Podszewka", "ar": "حالة البطانة", "ru": "Наличие подкладки", "de": "Futterstatus"},
    "Baskı/Nakış Tekniği": {"en": "Print/Embroidery", "pl": "Nadruk/Haft", "ar": "تقنية الطباعة/التطريز", "ru": "Печать/Вышивка", "de": "Druck/Stickerei"},
    "Cep": {"en": "Pocket", "pl": "Kieszeń", "ar": "الجيب", "ru": "Карман", "de": "Tasche"},
    "Kalınlık": {"en": "Thickness", "pl": "Grubość", "ar": "السماكة", "ru": "Толщина", "de": "Dicke"},
    "Kap": {"en": "Hood/Cup", "pl": "Kaptur/Miseczka", "ar": "كاب/غطاء", "ru": "Капюшон/Чашка", "de": "Kappe/Körbchen"},
    "Kapama Şekli": {"en": "Closure", "pl": "Zapięcie", "ar": "طريقة الإغلاق", "ru": "Способ застегивания", "de": "Verschlussart"},
    "Kemer/Kuşak Durumu": {"en": "Belt/Sash", "pl": "Pasek/Szarfa", "ar": "حالة الحزام", "ru": "Без ремня", "de": "Ohne Gürtel"},
    "Kol Tipi": {"en": "Sleeve Type", "pl": "Typ rękawa", "ar": "نوع الكم", "ru": "Tip рукава", "de": "Ärmeltyp"},
    "Koleksiyon": {"en": "Collection", "pl": "Kolekcja", "ar": "المجموعة", "ru": "Коллекция", "de": "Kollektion"},
    "Yaka Tipi": {"en": "Collar/Neckline", "pl": "Kołnierz/Dekolt", "ar": "نوع الياقة", "ru": "Тип воротника", "de": "Kragentyp"},
    "Kumaş Tipi": {"en": "Fabric Type", "pl": "Rodzaj tkaniny", "ar": "نوع القماش", "ru": "Тип ткани", "de": "Stoffart"},
    "Parça Sayısı": {"en": "Number of Pieces", "pl": "Liczba części", "ar": "عدد القطع", "ru": "Количество", "de": "Teileanzahl"},

    # Values
    "Kadın": {"en": "Women", "pl": "Kobieta", "ar": "نسائي", "ru": "Женщины", "de": "Damen"},
    "Kadın / Kız": {"en": "Women", "pl": "Kobieta", "ar": "نسائي", "ru": "Женщины", "de": "Damen"},
    "Midi": {"en": "Midi", "pl": "Midi", "ar": "ميدي", "ru": "Миди", "de": "Midi"},
    "Maxi": {"en": "Maxi", "pl": "Maxi", "ar": "ماكسي", "ru": "Макси", "de": "Maxi"},
    "Mini": {"en": "Mini", "pl": "Mini", "ar": "ميني", "ru": "Мини", "de": "Mini"},
    "Astarsız": {"en": "Unlined", "pl": "Bez podszewki", "ar": "بدون بطانة", "ru": "Без подкладки", "de": "Ungefüttert"},
    "Astarlı": {"en": "Lined", "pl": "Z podszewką", "ar": "مبطن", "ru": "С подкладкой", "de": "Gefüttert"},
    "Baskısız": {"en": "Without Print", "pl": "Bez nadruku", "ar": "بدون طباعة", "ru": "Без принта", "de": "Ohne Druck"},
    "Baskılı": {"en": "Printed", "pl": "Z nadrukiem", "ar": "مطبوع", "ru": "С принтом", "de": "Bedruckt"},
    "Cepsiz": {"en": "Pocketless", "pl": "Bez kieszeni", "ar": "بدون جيوب", "ru": "Без карманов", "de": "Ohne Taschen"},
    "Cepli": {"en": "With Pockets", "pl": "Z kieszeniami", "ar": "بجيوب", "ru": "С карманами", "de": "Mit Taschen"},
    "Düz": {"en": "Plain", "pl": "Gładki", "ar": "سada", "ru": "Однотонный", "de": "Einfarbig"},
    "Orta": {"en": "Medium", "pl": "Średnia", "ar": "متوسط", "ru": "Средний", "de": "Mittel"},
    "A-line": {"en": "A-line", "pl": "A-line", "ar": "ألف لاين", "ru": "А-силуэт", "de": "A-Linie"},
    "Kapsız": {"en": "Without Hood/Cup", "pl": "Bez kaptura/miseczki", "ar": "بدون كاب/غطاء", "ru": "Без капюшона/чашек", "de": "Ohne Kappe/Körbchen"},
    "Kapamasız": {"en": "Without Closure", "pl": "Bez zapięcia", "ar": "بدون إغلاق", "ru": "Без застежки", "de": "Ohne Verschluss"},
    "Kemersiz": {"en": "Without Belt", "pl": "Bez paska", "ar": "بدون حزام", "ru": "Без ремня", "de": "Ohne Gürtel"},
    "Kemerli": {"en": "With Belt", "pl": "Z paskiem", "ar": "بحزام", "ru": "С ремнем", "de": "Mit Gürtel"},
    "Kısa": {"en": "Short", "pl": "Krótki", "ar": "قصير", "ru": "Короткий", "de": "Kurz"},
    "Uzun": {"en": "Long", "pl": "Długi", "ar": "طويل", "ru": "Длинный", "de": "Lang"},
    "Düşük Kol": {"en": "Low Sleeve", "pl": "Obniżony rękaw", "ar": "كم منخفض", "ru": "Заниженный рукав", "de": "Tief angesetzter Ärmel"},
    "Casual / Günlük": {"en": "Casual", "pl": "Casual/Codzienny", "ar": "كاجوال / يومي", "ru": "Повседневный", "de": "Lässig/Freizeit"},
    "Günlük": {"en": "Casual", "pl": "Na co dzień", "ar": "يومي", "ru": "Повседневный", "de": "Freizeit"},
    "Feminine": {"en": "Feminine", "pl": "Kobiecy", "ar": "أنثوي", "ru": "Женственный", "de": "Feminin"},
    "V Yaka": {"en": "V-Neck", "pl": "Dekolt V", "ar": "ياقة V", "ru": "V-образный выrez", "de": "V-Ausschnitt"},
    "Yetişkin": {"en": "Adult", "pl": "Dorosły", "ar": "بالغ", "ru": "Взрослые", "de": "Erwachsene"},
    "Genç": {"en": "Teen", "pl": "Nastolatek", "ar": "يافع", "ru": "Подростки", "de": "Jugendliche"},
    "Bodycon": {"en": "Bodycon", "pl": "Bodycon", "ar": "ضيق", "ru": "Облегающий", "de": "Bodycon"},
    "Bodycone": {"en": "Bodycon", "pl": "Bodycon", "ar": "ضيق", "ru": "Облегающий", "de": "Bodycon"},
    "Omzu Açık": {"en": "Off Shoulder", "pl": "Odkryte ramiona", "ar": "أكتاف مكشوفة", "ru": "С открытыми плечами", "de": "Schulterfrei"},
    "Şık/Gece": {"en": "Elegant/Night", "pl": "Eleganckie/Wieczór", "ar": "أنيق/سهرة", "ru": "Элегантный/Вечер", "de": "Elegant/Abend"}
}

COLOR_TRANSLATION_MAP = {
    "Altın": {"en": "Gold", "pl": "Złoty", "bg": "Златист", "ar": "ذهبي", "ru": "Золотой", "de": "Gold"},
    "Antrasit": {"en": "Anthracite", "pl": "Antracyt", "bg": "Антрацит", "ar": "أنثراسيت", "ru": "Антрацит", "de": "Anthrazit"},
    "Bebe Mavisi": {"en": "Baby Blue", "pl": "Błękitny", "bg": "Бебешко синьо", "ar": "أزرق فاتح", "ru": "Голубой", "de": "Babyblau"},
    "Bej": {"en": "Beige", "pl": "Beżowy", "bg": "Бежов", "ar": "بيج", "ru": "Бежевый", "de": "Beige"},
    "Beyaz": {"en": "White", "pl": "Biały", "bg": "Бял", "ar": "أبيض", "ru": "Белый", "de": "Weiß"},
    "Bordo": {"en": "Burgundy", "pl": "Bordowy", "bg": "Бордо", "ar": "بورجوندي", "ru": "Бордовый", "de": "Burgunder"},
    "Desenli": {"en": "Patterned", "pl": "Wzorzysty", "bg": "С десен", "ar": "منقوش", "ru": "Узорчатый", "de": "Gemustert"},
    "Çiçek Desen": {"en": "Floral Patterned", "pl": "Wzorzysty w kwiaty", "bg": "Цветен десен", "ar": "منقوش بالزهور", "ru": "Цветочный узор", "de": "Blumenmuster"},
    "Çiçek Desenli": {"en": "Floral Patterned", "pl": "Wzorzysty w kwiaty", "bg": "Цветен десен", "ar": "منقوش بالزهور", "ru": "Цветочный узор", "de": "Blumenmuster"},
    "Gri": {"en": "Grey", "pl": "Szary", "bg": "Сив", "ar": "رمادي", "ru": "Серый", "de": "Grau"},
    "Haki": {"en": "Khaki", "pl": "Chaki", "bg": "Хаки", "ar": "خاكي", "ru": "Хаки", "de": "Khaki"},
    "Hardal": {"en": "Mustard", "pl": "Musztardowy", "bg": "Горчица", "ar": "خردلي", "ru": "Горчичный", "de": "Senf"},
    "Kahve": {"en": "Brown", "pl": "Brązowy", "bg": "Кафяв", "ar": "بني", "ru": "Коричневый", "de": "Braun"},
    "Kamuflaj": {"en": "Camouflage", "pl": "Kamuflaż", "bg": "Камуфлаж", "ar": "تمويه", "ru": "Камуфляж", "de": "Tarnung"},
    "Kırmızı": {"en": "Red", "pl": "Czerwony", "bg": "Червен", "ar": "أحمر", "ru": "Красный", "de": "Rot"},
    "Lacivert": {"en": "Navy Blue", "pl": "Granatowy", "bg": "Тъмносин", "ar": "كحلي", "ru": "Темно-синий", "de": "Dunkelblau"},
    "Leopar": {"en": "Leopard", "pl": "Pantera", "bg": "Леопард", "ar": "نمر", "ru": "Леопардовый", "de": "Leopard"},
    "Lila": {"en": "Lilac", "pl": "Liliowy", "bg": "Лилав", "ar": "ليلكي", "ru": "Лиловый", "de": "Lila"},
    "Mavi": {"en": "Blue", "pl": "Niebieski", "bg": "Син", "ar": "أزرق", "ru": "Синий", "de": "Blau"},
    "Mor": {"en": "Purple", "pl": "Fioletowy", "bg": "Лилав", "ar": "بنفسجي", "ru": "Фиолетовый", "de": "Lila/Violett"},
    "Mürdüm": {"en": "Plum", "pl": "Śliwkowy", "bg": "Слива", "ar": "خوخي", "ru": "Сливовый", "de": "Pflaume"},
    "Pembe": {"en": "Pink", "pl": "Różowy", "bg": "Розов", "ar": "وردي", "ru": "Розовый", "de": "Rosa"},
    "Pudra": {"en": "Powder Pink", "pl": "Pudrowy róż", "bg": "Пудра", "ar": "وردي مغبر", "ru": "Пудровый", "de": "Puderrosa"},
    "Saks Mavi": {"en": "Royal Blue", "pl": "Chabrowy", "bg": "Кралско синьо", "ar": "أزرق ملكي", "ru": "Королевский синий", "de": "Königsblau"},
    "Sarı": {"en": "Yellow", "pl": "Żółty", "bg": "Жълт", "ar": "أصفر", "ru": "Желтый", "de": "Gelb"},
    "Siyah": {"en": "Black", "pl": "Czarny", "bg": "Череn", "ar": "أسود", "ru": "Черный", "de": "Schwarz"},
    "Sütlü Kahve": {"en": "Latte", "pl": "Kawa z mlekiem", "bg": "Кафе с мляко", "ar": "قهوة بالحليب", "ru": "Кофе с молоком", "de": "Milchkaffee"},
    "Turkuaz": {"en": "Turquoise", "pl": "Turkusowy", "bg": "Тюркоаз", "ar": "تركواز", "ru": "Бирюзовый", "de": "Türkis"},
    "Turuncu": {"en": "Orange", "pl": "Pomarańczowy", "bg": "Оранжев", "ar": "برتقالي", "ru": "Оранжевый", "de": "Orange"},
    "Yeşil": {"en": "Green", "pl": "Zielony", "bg": "Зелен", "ar": "أخضر", "ru": "Зеленый", "de": "Grün"},
    "Zümrüt": {"en": "Emerald", "pl": "Szmaragdowy", "bg": "Изумрудено зелен", "ar": "زمردي", "ru": "Изумрудный", "de": "Smaragdgrün"},
    "Standart": {"en": "Standard", "pl": "Standardowy", "bg": "Стандартен", "ar": "قياسي", "ru": "Стандартный", "de": "Standard"}
}

def translate_color(text, lang):
    if not text:
        return ""
    text_stripped = text.strip()
    for k, v in COLOR_TRANSLATION_MAP.items():
        if k.lower() == text_stripped.lower():
            return v.get(lang, text_stripped)
    return text_stripped

FABRIC_TRANSLATION_MAP = {
    "AEROBİN": {"en": "Aerobin", "pl": "Aerobin", "bg": "Аеробин", "ar": "آيروبين", "ru": "Аэробин", "de": "Aerobin"},
    "AKRİLİK": {"en": "Acrylic", "pl": "Akryl", "bg": "Акрил", "ar": "أكريليك", "ru": "Акрил", "de": "Acryl"},
    "ATLAS": {"en": "Satin", "pl": "Satyna", "bg": "Сатен", "ar": "أطلс", "ru": "Атлас", "de": "Satin"},
    "BÜRÜMCÜK": {"en": "Seersucker", "pl": "Kora", "bg": "Сийрсокър", "ar": "سيرساكر", "ru": "Жатка", "de": "Seersucker"},
    "DALGIÇ": {"en": "Scuba", "pl": "Nurek", "bg": "Дайвинг", "ar": "سكوبا", "ru": "Дайвинг", "de": "Tauchstoff"},
    "DERİ": {"en": "Leather", "pl": "Skóra", "bg": "Кожа", "ar": "جلد", "ru": "Кожа", "de": "Leder"},
    "DOKUMA": {"en": "Woven", "pl": "Tkany", "bg": "Тъкан", "ar": "منسوج", "ru": "Тканый", "de": "Gewebt"},
    "DOKUMA KREP": {"en": "Woven Crepe", "pl": "Krepa tkana", "bg": "Тъкан креп", "ar": "كريب منسوج", "ru": "Тканый креп", "de": "Gewebter Krepp"},
    "DOKUMA KREP JANJAN": {"en": "Shimmer Woven Crepe", "pl": "Tkana krepa mieniąca", "bg": "Тъкан креп ян-ян", "ar": "كريب منسوج لامع", "ru": "Тканый креп хамелеон", "de": "Gewebter Schimmer-Krepp"},
    "DOKUMA VİSKON": {"en": "Woven Viscose", "pl": "Wiskoza tkana", "bg": "Тъкана вискоза", "ar": "فيسكوز منسوج", "ru": "Тканая вискоза", "de": "Gewebte Viskose"},
    "DUBAİ": {"en": "Dubai Crepe", "pl": "Krepa dubajska", "bg": "Дубай креп", "ar": "كريب دبي", "ru": "Дубайский креп", "de": "Dubai-Krepp"},
    "JANJAN KREP": {"en": "Shimmer Crepe", "pl": "Krepa mieniąca", "bg": "Креп ян-ян", "ar": "كريب لامع", "ru": "Креп хамелеон", "de": "Schimmer-Krepp"},
    "JARSE": {"en": "Jersey", "pl": "Dżersej", "bg": "Жарсе", "ar": "جيرسي", "ru": "Джерси", "de": "Jersey"},
    "KADİFE": {"en": "Velvet", "pl": "Aksamit", "bg": "Кадифе", "ar": "مخمل", "ru": "Бархат", "de": "Samt"},
    "KAŞE": {"en": "Cashmere-like", "pl": "Flausz", "bg": "Кашмир тип", "ar": "كاشمير", "ru": "Кашемир-лайк", "de": "Tuch/Kaschmir-Art"},
    "KAŞKORSE": {"en": "Ribbed", "pl": "Prążek", "bg": "Рипс", "ar": "ريب", "ru": "Kaшкорсе", "de": "Rippstrick"},
    "KETEN": {"en": "Linen", "pl": "Len", "bg": "Лен", "ar": "كتان", "ru": "Лен", "de": "Leinen"},
    "KOT": {"en": "Denim", "pl": "Dżins", "bg": "Деним", "ar": "جينز", "ru": "Джинса", "de": "Denim"},
    "KREP": {"en": "Crepe", "pl": "Krepa", "bg": "Креп", "ar": "كريب", "ru": "Krepp", "de": "Krepp"},
    "MODAL": {"en": "Modal", "pl": "Modal", "bg": "Модал", "ar": "مودال", "ru": "Модал", "de": "Modal"},
    "MODAL BASKILI": {"en": "Printed Modal", "pl": "Modal drukowany", "bg": "Щампован модал", "ar": "مودال مطبوع", "ru": "Модал с принтом", "de": "Bedruckter Modal"},
    "MÜSLİN": {"en": "Muslin", "pl": "Muślin", "bg": "Муселин", "ar": "موسلين", "ru": "Муслин", "de": "Musselin"},
    "MİKRO": {"en": "Microfiber", "pl": "Mikrofibra", "bg": "Микрофибър", "ar": "مايكرو", "ru": "Микрофибра", "de": "Mikrofaser"},
    "OTTOMAN": {"en": "Ottoman", "pl": "Ottoman", "bg": "Отоман", "ar": "عثماني", "ru": "Оттоман", "de": "Ottoman"},
    "PAMUKLU": {"en": "Cotton", "pl": "Bawełna", "bg": "Памук", "ar": "قطن", "ru": "Хлопок", "de": "Baumwolle"},
    "PAMUK": {"en": "Cotton", "pl": "Bawełna", "bg": "Памук", "ar": "قطن", "ru": "Хлопок", "de": "Baumwolle"},
    "PEGASUS": {"en": "Pegasus", "pl": "Pegasus", "bg": "Пегас", "ar": "بيغاسوس", "ru": "Пегас", "de": "Pegasus"},
    "PERA KETEN": {"en": "Pera Linen", "pl": "Len Pera", "bg": "Пера лен", "ar": "كتان بيرا", "ru": "Лен Пера", "de": "Pera-Leinen"},
    "POLAR": {"en": "Fleece", "pl": "Polar", "bg": "Полар", "ar": "صوف قطبي", "ru": "Флис", "de": "Fleece"},
    "POPLİN": {"en": "Poplin", "pl": "Popelina", "bg": "Поплин", "ar": "بوبلين", "ru": "Поплин", "de": "Popeline"},
    "SANDY": {"en": "Sandy", "pl": "Sandy", "bg": "Санди", "ar": "ساندي", "ru": "Санди", "de": "Sandy"},
    "SCUBA": {"en": "Scuba", "pl": "Scuba", "bg": "Скуба", "ar": "سكوبا", "ru": "Скуба", "de": "Scuba"},
    "SOFIA": {"en": "Sofia", "pl": "Sofia", "bg": "София", "ar": "صوفيا", "ru": "София", "de": "Sofia"},
    "SÜET": {"en": "Suede", "pl": "Zamsz", "bg": "Велур", "ar": "جمل", "ru": "Замша", "de": "Wildleder"},
    "SÜET KREP": {"en": "Suede Crepe", "pl": "Zamsz-krepa", "bg": "Велурен креп", "ar": "كريب مخملي", "ru": "Замшевый креп", "de": "Wildleder-Krepp"},
    "SÜPREM": {"en": "Single Jersey", "pl": "Suprem", "bg": "Супрем", "ar": "سوبريم", "ru": "Супрем", "de": "Single-Jersey"},
    "TRİKO": {"en": "Knitwear", "pl": "Dzianina", "bg": "Трикотаж", "ar": "تريكو", "ru": "Трикотаж", "de": "Strickware"},
    "TRİKOTON": {"en": "Tricotton", "pl": "Tricotton", "bg": "Трикотон", "ar": "تريكوتون", "ru": "Трикотон", "de": "Tricotton"},
    "VİSKON": {"en": "Viscose", "pl": "Wiskoza", "bg": "Вискоза", "ar": "فيسكوز", "ru": "Вискоза", "de": "Viskose"},
    "WAFFLE": {"en": "Waffle", "pl": "Wafel", "bg": "Вафла", "ar": "وافل", "ru": "Вафля", "de": "Waffel-Struktur"},
    "WELLSOFT": {"en": "Wellsoft", "pl": "Wellsoft", "bg": "Уелсофт", "ar": "ويلسوفت", "ru": "Веллсофт", "de": "Wellsoft"},
    "YUMOŞ": {"en": "Fluffy", "pl": "Puszysty", "bg": "Пухкав", "ar": "يوموش", "ru": "Пушистый", "de": "Kuschelig"},
    "ÖRME KREP": {"en": "Knitted Crepe", "pl": "Krepa dziana", "bg": "Плетен креп", "ar": "كريب محبوк", "ru": "Трикотажный креп", "de": "Strick-Krepp"},
    "İKİ İPLİK": {"en": "Two-Thread Fleece", "pl": "Dresówka dwunitkowa", "bg": "Двуконечен полар", "ar": "خيطين", "ru": "Двунитка", "de": "Zweifaden-Vlies"},
    "İTHAL KETEN": {"en": "Imported Linen", "pl": "Len importowany", "bg": "Вносен лен", "ar": "كتان مستورد", "ru": "Импортный лен", "de": "Importiertes Leinen"},
    "İTHAL KREP": {"en": "Imported Crepe", "pl": "Krepa importowana", "bg": "Вносен креп", "ar": "كريب مستورد", "ru": "Importierter Krepp", "de": "Importierter Krepp"},
    "İTHAL": {"en": "Imported", "pl": "Importowane", "bg": "Вносен", "ar": "مستورد", "ru": "Импортный", "de": "Importiert"},
    "ŞİFON": {"en": "Chiffon", "pl": "Szyfon", "bg": "Шифон", "ar": "شيفون", "ru": "Шифон", "de": "Chiffon"}
}

def translate_fabric(text, lang):
    if not text:
        return ""
    text_stripped = text.strip().upper()
    for k, v in FABRIC_TRANSLATION_MAP.items():
        if k.upper() == text_stripped:
            return v.get(lang, text_stripped)
    return text_stripped

def translate_item(text, lang):
    if not text:
        return ""
    text_stripped = text.strip()
    for k, v in TRANSLATION_MAP.items():
        if k.lower() == text_stripped.lower():
            return v.get(lang, text_stripped)
    return text_stripped

def clean_title(title_text):
    if not title_text:
        return ""
    import html
    title_text = html.unescape(title_text)
    
    # Strip any occurrences of brand name
    cleaned = re.sub(r'(?i)\betika\s*(fashion)?\b', '', title_text)
    cleaned = re.sub(r'(?i)\bflora\b', '', cleaned)
    cleaned = cleaned.strip(" ,-")
    
    return turkish_title(cleaned.strip())

def extract_fabric_from_detail(detail_html):
    if not detail_html:
        return "Polyester"
    import html
    text = html.unescape(detail_html)
    # Search for Kumaş Bilgisi : X
    match = re.search(r'Kuma[şs]\s+Bilgisi\s*:\s*([^<·•\s:,]+)', text, re.IGNORECASE)
    if match:
        fabric_name = match.group(1).strip().upper()
        # Clean extra characters
        fabric_name = re.sub(r'[^\w\s\-\u00C0-\u017F]', '', fabric_name)
        return fabric_name.strip().capitalize()
    
    # Fallback to scanning for keywords in text
    for f in FABRIC_KEYWORDS:
        if f.lower() in text.lower():
            return f
    return "Polyester"

def _clean_text_node(text):
    if not text:
        return ""
    text = text.replace('\xa0', ' ')
    text = re.sub(r'\s+', ' ', text)
    return text.strip(" ·•\t\n\r:")

def _process_table_row(row):
    cells = row.find_all(['td', 'th'], recursive=False)
    cell_texts = []
    for cell in cells:
        ct = _clean_text_node(cell.get_text())
        if ct:
            cell_texts.append(ct)
    return " - ".join(cell_texts) if cell_texts else None

def _extract_soup_lines(soup):
    lines = []
    table = soup.find('table')
    if table:
        rows = [tr for tr in table.find_all('tr') if tr.find_parent('table') == table]
        for row in rows:
            line = _process_table_row(row)
            if line:
                lines.append(line)
    else:
        for child in soup.children:
            txt = _clean_text_node(child.get_text() if child.name else str(child))
            if txt:
                lines.append(txt)
    return lines

def _is_size_chart_line(line_clean):
    if "ÖLÇÜ" in line_clean and "BEDEN" in line_clean:
        return True
    if " - " in line_clean:
        parts = [p.strip() for p in line_clean.split(" - ")]
        if len(parts) == 4 and any(s_val in parts[0] for s_val in ['S', 'M', 'L', 'XL', 'XXL', '36', '38', '40', '42']):
            return True
    return False

def clean_html_to_plain_text(html_content):
    if not html_content:
        return ""
    import html
    raw_html = html.unescape(html_content)
    soup = BeautifulSoup(raw_html, "html.parser")
    for s in soup(["style", "script"]):
        s.decompose()
        
    lines = _extract_soup_lines(soup)
    final_lines = []
    seen = set()
    for line in lines:
        line_clean = line.strip(" -|·•")
        if not line_clean or _is_size_chart_line(line_clean):
            continue
        if line_clean in seen and len(line_clean) < 10:
            continue
        seen.add(line_clean)
        
        keywords = ["Kumaş Bilgisi", "Ölçüleri", "Boy", "Göğüs", "Bel", "Kalça", "Beden", "Numune Beden"]
        if any(keyword in line_clean for keyword in keywords) and ":" in line_clean:
            parts = line_clean.split(":", 1)
            final_lines.append(f"• {parts[0].strip()}: {parts[1].strip()}")
        else:
            final_lines.append(f"• {line_clean}")
                    
    return "\n".join(final_lines)

def execute_values_psycopg3(cur, query, values, page_size=1000):
    if not values:
        return
    for i in range(0, len(values), page_size):
        chunk = values[i:i+page_size]
        row_placeholders = []
        flat_params = []
        for row in chunk:
            row_placeholders.append("(" + ",".join(["%s"] * len(row)) + ")")
            flat_params.extend(row)
        placeholders_str = ",".join(row_placeholders)
        
        pos = query.find("%s")
        if pos != -1:
            exec_query = query[:pos] + placeholders_str + query[pos+2:]
            cur.execute(exec_query, flat_params)
        else:
            raise ValueError("Query must contain '%s' placeholder for values.")

def convert_image_to_webp_exif(path, meta):
    try:
        webp_path = path.replace(".jpg", EXT_WEBP)
        if not os.path.exists(path):
            return False, "Raw JPG file not found"
            
        orig_size = os.path.getsize(path)
        
        with Image.open(path) as img:
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
                
            max_dimension = 1200
            if img.width > max_dimension or img.height > max_dimension:
                img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
                
            exif = PIL.Image.Exif()
            exif[40091] = meta["title"].encode('utf-16le')
            exif[40092] = meta["description"].encode('utf-16le')
            exif[40093] = meta["brand"].encode('utf-16le')
            exif[40094] = meta["tags"].encode('utf-16le')
            exif[40095] = meta["subject"].encode('utf-16le')
            
            img.save(webp_path, "WEBP", exif=exif.tobytes(), quality=75)
            
        opt_size = os.path.getsize(webp_path)
        os.remove(path)
        return True, (orig_size, opt_size)
    except Exception as e:
        return False, str(e)

def update_image_metrics_db(pool, db_image_url, orig_size, opt_size):
    try:
        with pool.connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE catalog.product_images 
                    SET original_size_bytes = %s,
                         optimized_size_bytes = %s,
                         is_optimized = true,
                         optimized_at = CURRENT_TIMESTAMP 
                    WHERE image_url = %s;
                """, (orig_size, opt_size, db_image_url))
            conn.commit()
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to update DB metrics for {db_image_url}: {e}\n")

async def download_image_file_async(sem, session, url, local_path):
    async with sem:
        try:
            req_headers = {'User-Agent': 'Mozilla/5.0'}
            async with session.get(url, headers=req_headers, timeout=aiohttp.ClientTimeout(total=20)) as response:
                if response.status == 200:
                    content = await response.read()
                    async with aiofiles.open(local_path, 'wb') as f:
                        await f.write(content)
                    return True, ""
                else:
                    return False, f"HTTP status {response.status}"
        except Exception as e:
            return False, str(e)

async def download_image_task_wrapper(sem, session, url, path, meta, db_pool):
    import shutil
    
    hash_prefix = hashlib.sha256(url.encode('utf-8')).hexdigest()[:16]
    original_filename = f"{hash_prefix}.jpg"
        
    cache_dir = os.path.join(IMAGE_UPLOAD_DIR, "cache")
    os.makedirs(cache_dir, exist_ok=True)
    
    cache_path_jpg = os.path.join(cache_dir, original_filename)
    
    webp_path = path.replace(".jpg", ".webp")
    db_image_url = f"{DB_IMAGE_PREFIX}/{os.path.basename(webp_path)}"
    
    success = True
    err_msg = ""
    orig_size = 0
    opt_size = 0
    
    try:
        # Case A: Original JPG already exists in cache
        if os.path.exists(cache_path_jpg):
            shutil.copy(cache_path_jpg, path)
            success = True
        # Case B: Download raw JPG to cache under original name
        else:
            success, err_msg = await download_image_file_async(sem, session, url, cache_path_jpg)
            if success:
                shutil.copy(cache_path_jpg, path)
                
        # Perform WebP conversion ONLY on the target file inside the main uploads directory
        if success:
            loop = asyncio.get_running_loop()
            conv_success, result = await loop.run_in_executor(None, convert_image_to_webp_exif, path, meta)
            if conv_success:
                orig_size, opt_size = result
                loop.run_in_executor(None, update_image_metrics_db, db_pool, db_image_url, orig_size, opt_size)
            else:
                success = False
                err_msg = f"WebP conversion failed: {result}"
            
    except Exception as e:
        success = False
        err_msg = f"Cache processing failed: {str(e)}"
        
    return url, path, success, err_msg

def format_progress_string(images_downloaded, images_total, t_start):
    elapsed = time.time() - t_start
    speed = images_downloaded / elapsed if elapsed > 0 else 0
    remaining = images_total - images_downloaded
    eta_sec = remaining / speed if speed > 0 else 0
    
    eta_m, eta_s = divmod(int(eta_sec), 60)
    eta_h, eta_m = divmod(eta_m, 60)
    eta_str = f"{eta_h:02d}:{eta_m:02d}:{eta_s:02d}" if eta_h > 0 else f"{eta_m:02d}:{eta_s:02d}"
    
    pct = (images_downloaded * 100 // images_total) if images_total > 0 else 0
    
    bar_len = 15
    filled = int(bar_len * images_downloaded // images_total) if images_total > 0 else 0
    bar = '=' * filled + '-' * (bar_len - filled)
    
    go_line = f"-> Downloaded {images_downloaded}/{images_total} images ({pct}%)..."
    human_line = f"-> Syncing Images: [{bar}] {pct}% | {images_downloaded}/{images_total} | {speed:.1f} img/s | ETA: {eta_str}"
    return f"{go_line}\n{human_line}"

def _cleanup_jpg_files(upload_dir):
    if not os.path.exists(upload_dir):
        return
    try:
        cleaned_count = 0
        for f in os.listdir(upload_dir):
            if f.lower().endswith(('.jpg', '.jpeg')):
                f_path = os.path.join(upload_dir, f)
                if os.path.isfile(f_path):
                    os.remove(f_path)
                    cleaned_count += 1
        if cleaned_count > 0:
            print(f"Successfully cleaned up {cleaned_count} leftover JPG files!")
            sys.stdout.flush()
    except Exception as cleanup_err:
        sys.stderr.write(f"Warning: Failed to clean up leftover JPGs: {cleanup_err}\n")
        sys.stderr.flush()

def _partition_unique_images(unique_downloads):
    pending_downloads = {}
    skipped_updates = []
    images_downloaded = 0
    for path, meta in unique_downloads.items():
        url = meta["url"]
        webp_path = path.replace(".jpg", EXT_WEBP)
        db_image_url = f"{DB_IMAGE_PREFIX}/{os.path.basename(webp_path)}"
        if os.path.exists(webp_path):
            images_downloaded += 1
            try:
                webp_size = os.path.getsize(webp_path)
                skipped_updates.append((webp_size, webp_size, db_image_url))
            except OSError:
                pass
        else:
            pending_downloads[url] = (path, meta)
    return pending_downloads, skipped_updates, images_downloaded

def _bulk_update_skipped_images(conn, skipped_updates):
    if not skipped_updates:
        return
    print(f"Bulk updating database metrics for {len(skipped_updates)} already optimized skipped images...")
    try:
        with conn.cursor() as cur:
            execute_values_psycopg3(
                cur,
                """
                UPDATE catalog.product_images 
                SET original_size_bytes = s.orig::bigint,
                    optimized_size_bytes = s.opt::bigint,
                    is_optimized = true,
                    optimized_at = CURRENT_TIMESTAMP 
                FROM (VALUES %s) AS s(orig, opt, img_url)
                WHERE catalog.product_images.image_url = s.img_url;
                """,
                skipped_updates,
                page_size=1000
            )
        conn.commit()
        print("Successfully bulk updated database metrics for existing optimized images!")
    except Exception as db_err:
        print(f"Warning: failed to bulk update skipped images: {db_err}")
        conn.rollback()

async def _download_pending_batch(pending_downloads, pool, conn, sync_run_id, progress_ctx):
    images_total, t_start = progress_ctx["images_total"], progress_ctx["t_start"]
    failed_downloads = {}
    images_downloaded = progress_ctx["images_downloaded"]
    
    sem = asyncio.Semaphore(15)
    async with aiohttp.ClientSession() as session:
        tasks = [
            asyncio.create_task(download_image_task_wrapper(sem, session, url, path, meta, pool))
            for url, (path, meta) in pending_downloads.items()
        ]
        
        last_print_time = time.time()
        for completed_fut in asyncio.as_completed(tasks):
            url, path, success, err_msg = await completed_fut
            meta = pending_downloads[url][1]
            if success:
                images_downloaded += 1
            else:
                failed_downloads[url] = (path, meta, err_msg)
                
            curr_time = time.time()
            if images_downloaded > 0 and (curr_time - last_print_time >= 1.5 or images_downloaded == images_total):
                last_print_time = curr_time
                print(format_progress_string(images_downloaded, images_total, t_start))
                sys.stdout.flush()
                update_sync_progress(conn, sync_run_id, "running", progress_ctx["items_parsed"], progress_ctx["items_added"], progress_ctx["items_updated"], progress_ctx["variants_aligned"], progress_ctx["errors_skipped"], images_total, images_downloaded)
    return images_downloaded, failed_downloads

def _build_retry_tasks(current_retry_tasks, sem, session, pool):
    tasks = []
    already_done = 0
    for url, (path, meta, _) in current_retry_tasks:
        webp_path = path.replace(".jpg", EXT_WEBP)
        if os.path.exists(path) or os.path.exists(webp_path):
            already_done += 1
        else:
            tasks.append(asyncio.create_task(download_image_task_wrapper(sem, session, url, path, meta, pool)))
    return tasks, already_done

async def _consume_retry_tasks(tasks, current_retry_tasks, conn, sync_run_id, progress_ctx, images_downloaded):
    failed_downloads = {}
    last_print_time = time.time()
    images_total = progress_ctx["images_total"]
    t_start = progress_ctx["t_start"]
    for completed_fut in asyncio.as_completed(tasks):
        url, path, success, err_msg = await completed_fut
        meta_found = next((m for u, (p, m, _) in current_retry_tasks if u == url), None)
        if success:
            images_downloaded += 1
        else:
            failed_downloads[url] = (path, meta_found, err_msg)
        curr_time = time.time()
        if images_downloaded > 0 and (curr_time - last_print_time >= 1.5 or images_downloaded == images_total):
            last_print_time = curr_time
            print(format_progress_string(images_downloaded, images_total, t_start))
            sys.stdout.flush()
            update_sync_progress(conn, sync_run_id, "running", progress_ctx["items_parsed"], progress_ctx["items_added"], progress_ctx["items_updated"], progress_ctx["variants_aligned"], progress_ctx["errors_skipped"], images_total, images_downloaded)
    return images_downloaded, failed_downloads

async def _execute_retry_attempt(current_retry_tasks, pool, conn, sync_run_id, progress_ctx, images_downloaded):
    sem = asyncio.Semaphore(10)
    async with aiohttp.ClientSession() as session:
        tasks, already_done = _build_retry_tasks(current_retry_tasks, sem, session, pool)
        images_downloaded += already_done
        if not tasks:
            return images_downloaded, {}
        return await _consume_retry_tasks(tasks, current_retry_tasks, conn, sync_run_id, progress_ctx, images_downloaded)

async def _retry_failed_downloads(failed_downloads, pool, conn, sync_run_id, progress_ctx):
    images_downloaded = progress_ctx["images_downloaded"]
    max_retries = 5
    for attempt in range(1, max_retries + 1):
        if not failed_downloads:
            break
        print(f"\n--- Retrying {len(failed_downloads)} failed image downloads asynchronously (Attempt {attempt}/{max_retries}) ---")
        sys.stdout.flush()
        await asyncio.sleep(2)
        current_retry_tasks = list(failed_downloads.items())
        images_downloaded, failed_downloads = await _execute_retry_attempt(
            current_retry_tasks, pool, conn, sync_run_id, progress_ctx, images_downloaded
        )
    return images_downloaded, failed_downloads

async def download_images_async(unique_downloads, conn, pool, sync_run_id, items_parsed, items_added, items_updated, variants_aligned, errors_skipped):
    print("Extracting unique images for parallel downloads...")
    t_download_start = time.time()
    images_total = len(unique_downloads)
    print(f"Found {images_total} unique images to download.")
    
    _cleanup_jpg_files(IMAGE_UPLOAD_DIR)
    update_sync_progress(conn, sync_run_id, "running", items_parsed, items_added, items_updated, variants_aligned, errors_skipped, images_total, 0)
    
    pending_downloads, skipped_updates, images_downloaded = _partition_unique_images(unique_downloads)
    if images_downloaded > 0:
        update_sync_progress(conn, sync_run_id, "running", items_parsed, items_added, items_updated, variants_aligned, errors_skipped, images_total, images_downloaded)
        pct = (images_downloaded * 100 // images_total) if images_total > 0 else 0
        print(f"-> Already existing images skipped: {images_downloaded}/{images_total} ({pct}%)")
        sys.stdout.flush()
        
    _bulk_update_skipped_images(conn, skipped_updates)
    
    progress_ctx = {
        "images_total": images_total,
        "images_downloaded": images_downloaded,
        "t_start": t_download_start,
        "items_parsed": items_parsed,
        "items_added": items_added,
        "items_updated": items_updated,
        "variants_aligned": variants_aligned,
        "errors_skipped": errors_skipped
    }
    
    failed_downloads = {}
    if pending_downloads:
        images_downloaded, failed_downloads = await _download_pending_batch(pending_downloads, pool, conn, sync_run_id, progress_ctx)
        progress_ctx["images_downloaded"] = images_downloaded
        
    if failed_downloads:
        images_downloaded, failed_downloads = await _retry_failed_downloads(failed_downloads, pool, conn, sync_run_id, progress_ctx)
        
    _cleanup_jpg_files(IMAGE_UPLOAD_DIR)
    return images_downloaded, failed_downloads, time.time() - t_download_start

def update_sync_progress(conn, sync_run_id, status, items_parsed, items_added, items_updated, variants_aligned, errors_skipped, images_total, images_downloaded, timings=None, error_msg=None):
    try:
        pct_val = 0
        if images_total > 0:
            pct_val = 50 + (images_downloaded * 50 // images_total)
        elif items_parsed > 0:
            pct_val = min(45, items_parsed * 45 // 1900)
            
        summary = {
            "items_parsed": items_parsed,
            "items_added": items_added,
            "items_updated": items_updated,
            "variants_aligned": variants_aligned,
            "errors_skipped": errors_skipped,
            "images_total": images_total,
            "images_downloaded": images_downloaded,
            "percentage": pct_val
        }
        if timings:
            summary["timings"] = timings
        if error_msg:
            summary["error"] = error_msg
            
        summary_json = json.dumps(summary)
        
        with conn.cursor() as cur:
            if status == "success" or status == "failed":
                cur.execute(
                    "UPDATE integration.sync_runs SET completed_at = CURRENT_TIMESTAMP, status = %s, summary = %s WHERE id = %s",
                    (status, summary_json, sync_run_id)
                )
            else:
                cur.execute(
                    "UPDATE integration.sync_runs SET status = %s, summary = %s WHERE id = %s",
                    (status, summary_json, sync_run_id)
                )
        conn.commit()

        # Redis Real-Time Progress Streamer
        global redis_client
        if redis_client and sync_run_id:
            try:
                redis_key = f"sync_run:progress:{sync_run_id}"
                redis_payload = {
                    "status": status,
                    **summary
                }
                redis_client.setex(redis_key, 86400, json.dumps(redis_payload))
            except Exception as re:
                sys.stderr.write(f"Warning: Failed to set Redis progress for {sync_run_id}: {re}\n")
    except Exception as e:
        sys.stderr.write(f"Failed to update progress: {str(e)}\n")

def log_sync_timings(timings, sync_run_id, status, items_parsed, items_added, items_updated, variants_aligned, errors_skipped, images_total, images_downloaded):
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        stats_file_path = os.path.join(script_dir, "sync_stats.txt")
        
        with open(stats_file_path, "w", encoding="utf-8") as f:
            f.write("====================================================\n")
            f.write("ETIKA AUTONOMOUS SYNC PERFORMANCE STATS\n")
            f.write(f"Timestamp: {datetime.now().isoformat()}\n")
            f.write(f"Sync Run ID: {sync_run_id}\n")
            f.write(f"Status: {status.upper()}\n")
            f.write("====================================================\n\n")
            
            f.write("SYNCHRONIZATION METRICS:\n")
            f.write(f"- Products Parsed: {items_parsed}\n")
            f.write(f"- Products Added: {items_added}\n")
            f.write(f"- Products Updated: {items_updated}\n")
            f.write(f"- Variants Aligned: {variants_aligned}\n")
            f.write(f"- Image Downloads (Total): {images_total}\n")
            f.write(f"- Image Downloads (Success): {images_downloaded}\n")
            f.write(f"- Errors Skipped: {errors_skipped}\n\n")
            
            f.write("STEP DURATION BENCHMARKS:\n")
            for step, duration in timings.items():
                f.write(f"- {step:30}: {duration:.4f} seconds\n")
            f.write("\n====================================================\n")
        print(f"Performance statistics written successfully to: {stats_file_path}")
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to write sync_stats.txt: {str(e)}\n")

def cleanup_old_xml_files(supplier_prefix):
    try:
        import glob
        xml_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads", "xml_history")
        if not os.path.exists(xml_dir):
            return
        
        # 90 days in seconds (3 months)
        retention_period = 90 * 24 * 60 * 60
        now = time.time()
        
        pattern = os.path.join(xml_dir, f"{supplier_prefix}-*.xml")
        for filepath in glob.glob(pattern):
            if os.path.isfile(filepath):
                file_age = now - os.path.getmtime(filepath)
                if file_age > retention_period:
                    os.remove(filepath)
                    print(f"Cleaned up archived XML file older than 90 days: {filepath}")
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to cleanup old XML files: {str(e)}\n")

def load_yasakli_gorseller():
    banned = set()
    try:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(script_dir, "banned_images.txt")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    filename_clean = line.strip().lower()
                    if filename_clean and not filename_clean.startswith("#"):
                        banned.add(filename_clean)
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to load banned_images.txt: {e}\n")
    return banned

def _init_sync_run(conn):
    sync_run_id = None
    try:
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument('--sync-run-id', type=str, default=None)
        parser.add_argument('--production', action='store_true')
        args, _ = parser.parse_known_args()
        if args.sync_run_id:
            sync_run_id = args.sync_run_id
            print(f"Sync run ID passed via CLI: {sync_run_id}")
    except Exception:
        pass
        
    if not sync_run_id:
        sync_run_id = os.environ.get("SYNC_RUN_ID")
        if sync_run_id:
            print(f"Sync run ID retrieved from environment: {sync_run_id}")
            
    if not sync_run_id:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM integration.sync_runs WHERE feed_id = %s AND status = 'running' ORDER BY started_at DESC LIMIT 1",
                (FEED_ID,)
            )
            row = cur.fetchone()
            if row:
                sync_run_id = row[0]
                print(f"Debug Mode: Found active sync run in database: {sync_run_id}")
            else:
                cur.execute(
                    "INSERT INTO integration.sync_runs (feed_id, status) VALUES (%s, 'running') RETURNING id",
                    (FEED_ID,)
                )
                sync_run_id = cur.fetchone()[0]
                conn.commit()
                print(f"Debug Mode: Created standalone sync run in database: {sync_run_id}")
    return sync_run_id

def _resolve_brand_id(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT brand_id FROM integration.xml_feeds WHERE id = %s", (FEED_ID,))
        row = cur.fetchone()
        if row and row[0]:
            return str(row[0])
        cur.execute("SELECT id FROM catalog.brands WHERE alias_code = 'FLORA'")
        row = cur.fetchone()
        if row and row[0]:
            return str(row[0])
    raise ValueError("Critical Error: 'FLORA' alias_code is not registered in catalog.brands. Please check DB seed!")

def _load_plus_size_mapping(conn):
    plus_size_mapping = {}
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, slug FROM catalog.categories")
            cats = cur.fetchall()
            cat_by_slug = {slug: str(cid) for cid, slug in cats}
            for cid, slug in cats:
                cid_str = str(cid)
                if slug.startswith("buyuk-beden-"):
                    std_slug = slug[len("buyuk-beden-"):]
                    if std_slug in cat_by_slug:
                        std_id = cat_by_slug[std_slug]
                        plus_size_mapping[std_id] = cid_str
            if "buyuk-beden" in cat_by_slug:
                plus_size_mapping["buyuk-beden-root"] = cat_by_slug["buyuk-beden"]
    except Exception as e:
        print(f"Warning: Failed to load plus size category mapping: {e}")
    return plus_size_mapping

def _resolve_diger_category_id(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM catalog.categories WHERE title = 'Diğer' OR slug = 'diger' LIMIT 1")
        row = cur.fetchone()
        if row:
            return str(row[0])
    raise ValueError("Critical Error: 'diger' category slug is not registered in catalog.categories. Please check DB seed!")

def _download_xml_feed(timings):
    timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    xml_history_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads", "xml_history")
    os.makedirs(xml_history_dir, exist_ok=True)
    archived_file_path = os.path.join(xml_history_dir, f"etika-{timestamp}.xml")
    
    print(f"Downloading XML Feed from: {FEED_URL}")
    t_start = time.time()
    download_success = False
    try:
        req = urllib.request.Request(FEED_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as response, open(archived_file_path, 'wb') as temp_file:
            temp_file.write(response.read())
        timings["1. Feed Download"] = time.time() - t_start
        print(f"Successfully downloaded and archived feed to: {archived_file_path} (took {timings['1. Feed Download']:.2f}s)")
        download_success = True
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to download XML feed from network: {str(e)}\n")
        fallback_paths = [
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "xmller", ETIKA_XML_FILE),
            os.path.join(os.path.dirname(os.path.abspath(__file__)), ETIKA_XML_FILE),
            ETIKA_XML_FILE,
            rf"c:\Projects\mertervitrini.com.tr\docs\xmller\{ETIKA_XML_FILE}"
        ]
        for path in fallback_paths:
            if os.path.exists(path):
                print(f"Using cached local XML feed file from: {path}")
                import shutil
                shutil.copy(path, archived_file_path)
                download_success = True
                break
    if not download_success:
        return None
    import shutil
    shutil.copy(archived_file_path, XML_TEMP_FILE)
    return archived_file_path

def _load_in_memory_caches(conn, timings):
    print("Loading in-memory database caches for products, variants, colors, and fabrics...")
    t_start = time.time()
    products_cache = {}
    variants_cache = {}
    colors_cache = {}
    fabrics_cache = {}
    category_path_to_id = {}
    with conn.cursor() as cur:
        cur.execute("SELECT id, color_name FROM catalog.colors")
        for cid, name in cur.fetchall():
            colors_cache[name] = str(cid)

        cur.execute("SELECT id, fabric_name FROM catalog.fabrics")
        for fid, name in cur.fetchall():
            fabrics_cache[name] = str(fid)

        cur.execute("SELECT id, parent_id, slug FROM catalog.categories")
        cats = cur.fetchall()
        cat_map = {str(cid): (str(pid) if pid else None, slug) for cid, pid, slug in cats}
        
        def get_full_path(cid):
            pid, slug = cat_map[cid]
            if pid and pid in cat_map:
                return get_full_path(pid) + "/" + slug
            return slug
            
        for cid in cat_map:
            category_path_to_id[get_full_path(cid)] = cid

        cur.execute("SELECT id, source_product_id, slug FROM catalog.products WHERE feed_id = %s", (FEED_ID,))
        for pid, source_pid, slug in cur.fetchall():
            products_cache[source_pid] = (str(pid), slug)
            
        cur.execute(
            """
            SELECT id, product_id, source_variant_id 
            FROM catalog.product_variants 
            WHERE product_id IN (SELECT id FROM catalog.products WHERE feed_id = %s)
            """,
            (FEED_ID,)
        )
        for vid, pid, source_vid in cur.fetchall():
            variants_cache[(str(pid), source_vid)] = str(vid)
            
    timings["2. Cache Loading"] = time.time() - t_start
    print(f"Loaded {len(products_cache)} products, {len(variants_cache)} variants, {len(colors_cache)} colors, and {len(fabrics_cache)} fabrics (took {timings['2. Cache Loading']:.2f}s).")
    return products_cache, variants_cache, colors_cache, fabrics_cache, category_path_to_id

def _parse_price(val_str):
    if not val_str:
        return 0.0
    cleaned_num = re.sub(r'[^\d.]', '', val_str.replace(',', '.'))
    try:
        return float(cleaned_num)
    except (ValueError, TypeError):
        return 0.0

def _extract_color_from_specs(elem):
    specs_node = elem.find('specs')
    if specs_node is None:
        return None
    for spec in specs_node.findall('spec'):
        label = spec.findtext('label')
        if label and label.strip().lower() == 'renk':
            val = spec.findtext('value')
            if val:
                return val.strip()
    return None

def _extract_color_from_title(title_raw):
    for c in COLORS_LIST:
        if re.search(rf"(?i)\b{c}\b", title_raw):
            return c
    return None

def _resolve_color(elem, sku, title_raw, colors_cache, colors_to_upsert):
    v_color = _extract_color_from_specs(elem)
    if not v_color and sku and '-' in sku:
        v_color = sku.split('-', 1)[1].strip()
    if not v_color:
        v_color = _extract_color_from_title(title_raw) or "Standart"
        
    v_color = standardize_color(v_color)
    if v_color not in colors_cache:
        color_uuid = str(uuid.uuid4())
        colors_cache[v_color] = color_uuid
        colors_to_upsert[v_color] = color_uuid
    return colors_cache[v_color], v_color

def _resolve_fabric(detail_raw, fabrics_cache, fabrics_to_upsert):
    v_fabric = extract_fabric_from_detail(detail_raw)
    v_fabric = standardize_fabric(v_fabric)
    if v_fabric not in fabrics_cache:
        fabric_uuid = str(uuid.uuid4())
        fabrics_cache[v_fabric] = fabric_uuid
        fabrics_to_upsert[v_fabric] = fabric_uuid
    return fabrics_cache[v_fabric], v_fabric

def _detect_category_from_title(title_lower, default_path):
    if "pareo" in title_lower:
        return "kadin-giyim/pareo"
    if "elbise" in title_lower and not any(k in title_lower for k in ["takım", "takim", "tulum"]):
        return CAT_ELBISE
    if "takım" in title_lower or "takim" in title_lower:
        return CAT_TAKIM_IKILI
    if "tulum" in title_lower:
        return CAT_TULUM_SALOPET
    if "etek" in title_lower:
        return CAT_ALT_ETEK
    if any(k in title_lower for k in ["pantolon", "jean", "kot"]):
        return "kadin-giyim/alt-giyim/pantolon"
    if "tayt" in title_lower:
        return "kadin-giyim/alt-giyim/tayt"
    if any(k in title_lower for k in ["şort", "sort"]):
        return "kadin-giyim/alt-giyim/sort"
    if any(k in title_lower for k in ["kazak", "süveter", "suveter", "sweatshirt", "sweat"]):
        return "kadin-giyim/triko-hirka-kazak/kazak-suveter"
    if any(k in title_lower for k in ["hırka", "hirka"]):
        return "kadin-giyim/triko-hirka-kazak/hirka"
    if any(k in title_lower for k in ["ceket", "blazer"]):
        return CAT_CEKET_BLAZER
    if "tunik" in title_lower:
        return "kadin-giyim/triko-hirka-kazak/tunik"
    return default_path

def _resolve_plus_size_category(category_id, plus_size_mapping):
    if not (category_id and is_xl_or_above("S,M,L")):
        return category_id
    return plus_size_mapping.get(category_id, plus_size_mapping.get("buyuk-beden-root", category_id))

def _resolve_category(category_path_xml, title_tr_cleaned, category_path_to_id, diger_category_id, plus_size_mapping):
    category_path = CATEGORY_MAPPING.get(category_path_xml, "")
    category_path = _detect_category_from_title(title_tr_cleaned.lower(), category_path)
    category_id = category_path_to_id.get(category_path, diger_category_id)
    return _resolve_plus_size_category(category_id, plus_size_mapping)

def _collect_product_images(elem, title_tr_cleaned, category_path_xml, detail_cleaned, v_color, v_fabric, yasakli_gorseller, unique_downloads):
    all_img_urls = []
    images_node = elem.find('images')
    if images_node is not None:
        for img in images_node.findall('image'):
            src = img.findtext('src')
            if src and src not in all_img_urls:
                url_filename = src.split('/')[-1].strip().lower()
                if url_filename in yasakli_gorseller:
                    continue
                all_img_urls.append(src)
                
    product_images = []
    for idx, img_url in enumerate(all_img_urls):
        hash_prefix = hashlib.sha256(img_url.encode('utf-8')).hexdigest()[:16]
        local_filename_jpg = f"flora-{hash_prefix}.jpg"
        local_filename_webp = f"flora-{hash_prefix}.webp"
        local_file_path = os.path.join(IMAGE_UPLOAD_DIR, local_filename_jpg)
        db_image_url = f"{DB_IMAGE_PREFIX}/{local_filename_webp}"
        
        product_images.append((img_url, local_file_path, db_image_url))
        tags_str = "; ".join([t for t in ["FLORA", v_color, v_fabric] if t])
        
        unique_downloads[local_file_path] = {
            "url": img_url,
            "title": title_tr_cleaned,
            "subject": category_path_xml or "Giyim",
            "tags": tags_str,
            "description": detail_cleaned or title_tr_cleaned,
            "brand": "Etika Fashion"
        }
    return product_images

def _extract_buying_price(sale_price_str, cost_price_str):
    buying_price = _parse_price(sale_price_str)
    if buying_price <= 0.0:
        buying_price = _parse_price(cost_price_str)
    return buying_price

def _parse_tax_rate(tax_str):
    if not tax_str:
        return 10.0
    try:
        return float(tax_str)
    except (ValueError, TypeError):
        return 10.0

def _parse_stock(stock_str):
    if not stock_str:
        return 99
    try:
        return int(stock_str)
    except (ValueError, TypeError):
        return 99

def _add_product_variants(product_uuid, product_id, sku, ean, total_stock, sync_run_id, variants_cache, variants_to_upsert):
    for size_name in ['S', 'M', 'L']:
        source_variant_id = f"{product_id}-{size_name.lower()}"
        variant_uuid = variants_cache.get((product_uuid, source_variant_id), str(uuid.uuid4()))
        variants_cache[(product_uuid, source_variant_id)] = variant_uuid
        var_gtin = f"{ean}-{size_name}" if ean else f"{sku}-{size_name}"
        variants_to_upsert[(product_uuid, source_variant_id)] = (
            variant_uuid, product_uuid, size_name, var_gtin, total_stock, False, source_variant_id, sync_run_id, True
        )

def _clean_iterparse_element(elem):
    elem.clear()
    while elem.getprevious() is not None:
        del elem.getparent()[0]

def _should_skip_product(product_id, title_raw, buying_price, stats):
    if not product_id or not title_raw:
        stats["errors_skipped"] += 1
        return True
    title_lower = title_raw.lower()
    if "hediye kart" in title_lower or "gift card" in title_lower:
        return True
    if buying_price <= 0.0:
        stats["errors_skipped"] += 1
        return True
    return False

def _determine_gender(gender_xml, title_lower):
    is_male = (gender_xml and gender_xml.strip().upper() == 'M') or ("erkek" in title_lower)
    return "Erkek" if is_male else "Kadın"

def _get_or_create_product_identity(product_id, title_tr_cleaned, products_cache, stats):
    if product_id in products_cache:
        product_uuid, product_slug = products_cache[product_id]
        stats["items_updated"] += 1
    else:
        product_uuid = str(uuid.uuid4())
        product_slug = slugify(title_tr_cleaned)
        products_cache[product_id] = (product_uuid, product_slug)
        stats["items_added"] += 1
    return product_uuid, product_slug

def _process_product_element(elem, brand_id, diger_category_id, plus_size_mapping, caches, yasakli_gorseller, sync_run_id, parsed_data, stats):
    products_cache, variants_cache, colors_cache, fabrics_cache, category_path_to_id = caches
    
    product_id = elem.findtext('id')
    title_raw = elem.findtext('title')
    buying_price = _extract_buying_price(elem.findtext('salePrice'), elem.findtext('costPrice'))
    
    if _should_skip_product(product_id, title_raw, buying_price, stats):
        return
        
    title_lower = title_raw.lower()
    category_path_xml = (elem.findtext('categoryPath') or "").strip()
    if category_path_xml and category_path_xml not in CATEGORY_MAPPING:
        sys.stderr.write(f"Uyarı: Bilinmeyen kategori yolu: '{category_path_xml}' (Ürün ID: {product_id}). Otomatik eşleniyor.\n")

    sku = elem.findtext('sku')
    ean = elem.findtext('ean')
    mpn = elem.findtext('mpn')
    detail_raw = elem.findtext('detail')
    gender_xml = elem.findtext('gender')
    
    detail_cleaned = clean_html_to_plain_text(detail_raw)
    title_tr_cleaned = clean_title(title_raw)
    gender = _determine_gender(gender_xml, title_lower)
    
    color_uuid, v_color = _resolve_color(elem, sku, title_raw, colors_cache, parsed_data["colors_to_upsert"])
    fabric_uuid, v_fabric = _resolve_fabric(detail_raw, fabrics_cache, parsed_data["fabrics_to_upsert"])
    category_id = _resolve_category(category_path_xml, title_tr_cleaned, category_path_to_id, diger_category_id, plus_size_mapping)
    
    v_price = buying_price * (1 + PROFIT_RATE)
    v_tax = _parse_tax_rate(elem.findtext('tax'))
    total_stock = _parse_stock(elem.findtext('stock'))
    
    product_uuid, product_slug = _get_or_create_product_identity(product_id, title_tr_cleaned, products_cache, stats)
        
    parsed_data["attributes_by_product"][product_uuid] = {"Cinsiyet": gender, "Kumaş Tipi": v_fabric, "Renk": v_color}
    parsed_data["images_by_product"][product_uuid] = _collect_product_images(
        elem, title_tr_cleaned, category_path_xml, detail_cleaned, v_color, v_fabric, yasakli_gorseller, parsed_data["unique_downloads"]
    )
    
    _add_product_variants(product_uuid, product_id, sku, ean, total_stock, sync_run_id, variants_cache, parsed_data["variants_to_upsert"])
    stats["variants_aligned"] += 3
    
    sku_val = f"FL-{sku}" if sku else f"FL-{product_id}"
    barcode_val = ean if ean else product_id
    meta_attr_val = json.dumps({"original_brand": "Etika Fashion"})
    mpn_val = mpn if mpn else product_id
    
    parsed_data["products_to_upsert"][product_id] = (
        product_uuid, FEED_ID, product_id, mpn_val, title_tr_cleaned, product_slug,
        category_id, gender, sync_run_id, True, brand_id,
        "2-2-2", "S,M,L", 0.35, 6, "Tüm Sezonlar",
        buying_price, v_price, None, v_price, "TRY", v_tax, total_stock, sku_val, barcode_val,
        "", detail_cleaned, meta_attr_val, f"https://etikafashion.com/search?q={product_id}",
        color_uuid, fabric_uuid
    )
    stats["items_parsed"] += 1

def _stream_parse_xml_feed(conn, pool, sync_run_id, brand_id, diger_category_id, plus_size_mapping, caches, yasakli_gorseller, timings):
    print("Streaming XML products in memory...")
    t_start = time.time()
    parsed_data = {
        "products_to_upsert": {},
        "variants_to_upsert": {},
        "colors_to_upsert": {},
        "fabrics_to_upsert": {},
        "product_translations_to_upsert": [],
        "attributes_by_product": {},
        "images_by_product": {},
        "unique_downloads": {}
    }
    stats = {"items_parsed": 0, "items_added": 0, "items_updated": 0, "variants_aligned": 0, "errors_skipped": 0}
    os.makedirs(IMAGE_UPLOAD_DIR, exist_ok=True)
    
    try:
        context = ET.iterparse(XML_TEMP_FILE, events=('end',))
        for _, elem in context:
            if elem.tag != 'product':
                continue
            try:
                _process_product_element(elem, brand_id, diger_category_id, plus_size_mapping, caches, yasakli_gorseller, sync_run_id, parsed_data, stats)
            except ValueError as cat_err:
                error_msg = f"Kritik Hata: {cat_err}"
                sys.stderr.write(error_msg + "\n")
                update_sync_progress(conn, sync_run_id, "failed", stats["items_parsed"], stats["items_added"], stats["items_updated"], stats["variants_aligned"], stats["errors_skipped"], 0, 0, error_msg=error_msg)
                pool.close()
                sys.exit(error_msg)
            except Exception as node_err:
                stats["errors_skipped"] += 1
                if stats["errors_skipped"] <= 10:
                    sys.stderr.write(f"Warning: Failed to parse product: {node_err}\n")
            finally:
                _clean_iterparse_element(elem)
                
            if stats["items_parsed"] > 0 and stats["items_parsed"] % 200 == 0:
                print(f"-> Parsed {stats['items_parsed']} products... (Added: {stats['items_added']}, Updated: {stats['items_updated']}, Errors: {stats['errors_skipped']})")
                sys.stdout.flush()
    except Exception as parse_err:
        sys.stderr.write(f"Parser critical error during streaming parse: {parse_err}\n")
        update_sync_progress(conn, sync_run_id, "failed", 0, 0, 0, 0, 0, 0, 0)
        pool.close()
        sys.exit(1)
        
    timings["3. XML Streaming Parsing"] = time.time() - t_start
    print(f"Parsed {stats['items_parsed']} products into memory in {timings['3. XML Streaming Parsing']:.2f}s.")
    return parsed_data, stats

def _write_colors(cur, colors_to_upsert):
    t_db = time.time()
    colors_rows = [(cid, name) for name, cid in colors_to_upsert.items()]
    color_trans = [(cid, lang, translate_color(name, lang)) for name, cid in colors_to_upsert.items() for lang in ["en", "pl", "bg", "ar", "ru", "de"]]
    execute_values_psycopg3(cur, "INSERT INTO catalog.colors (id, color_name) VALUES %s ON CONFLICT (color_name) DO NOTHING", colors_rows)
    execute_values_psycopg3(cur, "INSERT INTO catalog.color_translations (color_id, language_code, color_name) VALUES %s ON CONFLICT (color_id, language_code) DO NOTHING", color_trans)
    print(f"-> Bulk upserted {len(colors_rows)} colors in {time.time() - t_db:.2f}s.")

def _write_fabrics(cur, fabrics_to_upsert):
    t_db = time.time()
    fabrics_rows = [(fid, name) for name, fid in fabrics_to_upsert.items()]
    fabric_trans = [(fid, lang, translate_fabric(name, lang)) for name, fid in fabrics_to_upsert.items() for lang in ["en", "pl", "bg", "ar", "ru", "de"]]
    execute_values_psycopg3(cur, "INSERT INTO catalog.fabrics (id, fabric_name) VALUES %s ON CONFLICT (fabric_name) DO NOTHING", fabrics_rows)
    execute_values_psycopg3(cur, "INSERT INTO catalog.fabric_translations (fabric_id, language_code, fabric_name) VALUES %s ON CONFLICT (fabric_id, language_code) DO NOTHING", fabric_trans)
    print(f"-> Bulk upserted {len(fabrics_rows)} fabrics in {time.time() - t_db:.2f}s.")

def _write_products(cur, products_to_upsert, timings):
    t_db = time.time()
    upsert_query = """
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
        is_active = true,
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
    execute_values_psycopg3(cur, upsert_query, list(products_to_upsert.values()))
    timings["5. DB Products Upsert"] = time.time() - t_db
    print(f"-> Bulk upserted products successfully in {timings['5. DB Products Upsert']:.2f}s.")

def _write_variants(cur, variants_to_upsert, timings):
    t_db = time.time()
    upsert_vars_query = """
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
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
    """
    execute_values_psycopg3(cur, upsert_vars_query, list(variants_to_upsert.values()))
    timings["6. DB Variants Upsert"] = time.time() - t_db
    print(f"-> Bulk upserted variants successfully in {timings['6. DB Variants Upsert']:.2f}s.")

def _sync_attribute_value_id(cur, cached_attrs, cached_vals, attr_name, attr_value):
    attr_id = cached_attrs.get(attr_name)
    if not attr_id:
        attr_id = str(uuid.uuid4())
        cur.execute("INSERT INTO catalog.attributes (id, attribute_name) VALUES (%s, %s) ON CONFLICT (attribute_name) DO UPDATE SET attribute_name = EXCLUDED.attribute_name RETURNING id;", (attr_id, attr_name))
        attr_id = cur.fetchone()[0]
        cached_attrs[attr_name] = attr_id
    val_id = cached_vals.get((attr_id, attr_value))
    if not val_id:
        val_id = str(uuid.uuid4())
        cur.execute("INSERT INTO catalog.attribute_values (id, attribute_id, attribute_value) VALUES (%s, %s, %s) ON CONFLICT (attribute_id, attribute_value) DO UPDATE SET attribute_value = EXCLUDED.attribute_value RETURNING id;", (val_id, attr_id, attr_value))
        val_id = cur.fetchone()[0]
        cached_vals[(attr_id, attr_value)] = val_id
    return val_id

def _write_attributes_and_images(cur, parsed_data):
    processed_product_uuids = [p[0] for p in parsed_data["products_to_upsert"].values()]
    if not processed_product_uuids:
        return
        
    cur.execute("DELETE FROM catalog.product_attributes_map WHERE product_id = ANY(%s::uuid[])", (processed_product_uuids,))
    cur.execute("DELETE FROM catalog.product_images WHERE product_id = ANY(%s::uuid[])", (processed_product_uuids,))
    
    cached_attrs = {name: aid for aid, name in cur.execute("SELECT id, attribute_name FROM catalog.attributes;").fetchall()}
    cached_vals = {(aid, val): vid for vid, aid, val in cur.execute("SELECT id, attribute_id, attribute_value FROM catalog.attribute_values;").fetchall()}
    
    mappings_rows = []
    for p_uuid, attrs in parsed_data["attributes_by_product"].items():
        for attr_name, attr_value in attrs.items():
            val_id = _sync_attribute_value_id(cur, cached_attrs, cached_vals, attr_name, attr_value)
            mappings_rows.append((str(uuid.uuid4()), p_uuid, val_id))
            
    images_rows = []
    for p_uuid, imgs in parsed_data["images_by_product"].items():
        for idx, (_, _, db_image_url) in enumerate(imgs):
            images_rows.append((str(uuid.uuid4()), p_uuid, db_image_url, idx, idx == 0))
            
    if mappings_rows:
        execute_values_psycopg3(cur, "INSERT INTO catalog.product_attributes_map (id, product_id, attribute_value_id) VALUES %s", mappings_rows)
    if images_rows:
        execute_values_psycopg3(cur, "INSERT INTO catalog.product_images (id, product_id, image_url, sort_order, is_cover) VALUES %s", images_rows)

def _bulk_write_batches(conn, parsed_data, timings):
    print(f"Writing collected batches to database (Products: {len(parsed_data['products_to_upsert'])}, Variants: {len(parsed_data['variants_to_upsert'])})...")
    sys.stdout.flush()
    with conn.cursor() as cur:
        if parsed_data["colors_to_upsert"]:
            _write_colors(cur, parsed_data["colors_to_upsert"])
        if parsed_data["fabrics_to_upsert"]:
            _write_fabrics(cur, parsed_data["fabrics_to_upsert"])
        if parsed_data["products_to_upsert"]:
            _write_products(cur, parsed_data["products_to_upsert"], timings)
        if parsed_data["variants_to_upsert"]:
            _write_variants(cur, parsed_data["variants_to_upsert"], timings)
        _write_attributes_and_images(cur, parsed_data)
    conn.commit()
    print("Successfully committed bulk DB updates!")

def _log_failed_images(failed_downloads, sync_run_id):
    if not failed_downloads:
        return
    import csv
    try:
        failed_csv = os.path.join(os.path.dirname(os.path.abspath(__file__)), "failed_images.csv")
        with open(failed_csv, "w", encoding="utf-8", newline="") as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(["Timestamp", "Sync Run ID", "Image URL", "Local Path", "Last Error"])
            for url, (path, last_error) in failed_downloads.items():
                writer.writerow([datetime.now().isoformat(), sync_run_id, url, path, last_error])
        print(f"Warning: {len(failed_downloads)} failed images logged to: {failed_csv}")
    except (OSError, IOError) as e:
        sys.stderr.write(f"Warning: Failed to log failed_images.csv: {e}\n")

def _finalize_sync(conn, pool, conn_ctx, sync_run_id, timings, sync_stats, start_total):
    print("Deactivating old products not seen in this sync run...")
    t_deact = time.time()
    with conn.cursor() as cur:
        cur.execute("UPDATE catalog.products SET is_active = false WHERE feed_id = %s AND last_sync_run_id != %s", (FEED_ID, sync_run_id))
        cur.execute("UPDATE catalog.product_variants SET is_active = false WHERE product_id IN (SELECT id FROM catalog.products WHERE feed_id = %s) AND last_sync_run_id != %s", (FEED_ID, sync_run_id))
    conn.commit()
    timings["11. Inactive Products Cleanup"] = time.time() - t_deact
    timings["Total Sync Duration"] = time.time() - start_total
    
    print("\n====================================================")
    print("ETIKA SYNC PERFORMANCE SUMMARY:")
    for step, duration in timings.items():
        print(f"- {step:30}: {duration:.4f} seconds")
    print("====================================================\n")
    sys.stdout.flush()
    
    update_sync_progress(conn, sync_run_id, "success", sync_stats["items_parsed"], sync_stats["items_added"], sync_stats["items_updated"], sync_stats["variants_aligned"], sync_stats["errors_skipped"], sync_stats["images_total"], sync_stats["images_downloaded"], timings)
    log_sync_timings(timings, sync_run_id, "success", sync_stats["items_parsed"], sync_stats["items_added"], sync_stats["items_updated"], sync_stats["variants_aligned"], sync_stats["errors_skipped"], sync_stats["images_total"], sync_stats["images_downloaded"])
    
    if os.path.exists(XML_TEMP_FILE):
        os.remove(XML_TEMP_FILE)
    cleanup_old_xml_files("etika")
    
    try:
        conn_ctx.__exit__(None, None, None)
    except Exception:
        pass
    pool.close()
    print("--- Etika Autonomous XML Sync Finished Successfully ---")

def run_parser():
    print(f"--- Etika Autonomous XML Sync Started ({datetime.now().isoformat()}) ---")
    timings = {}
    start_total = time.time()
    yasakli_gorseller = load_yasakli_gorseller()
    if yasakli_gorseller:
        print(f"Loaded {len(yasakli_gorseller)} manually curated banned image filename(s) from banned_images.txt.")
        sys.stdout.flush()
    
    conninfo = f"host={DB_HOST} port={DB_PORT} user={DB_USER} password={DB_PASSWORD} dbname={DB_NAME}"
    pool = ConnectionPool(conninfo=conninfo, min_size=1, max_size=2)
    try:
        conn_ctx = pool.connection()
        conn = conn_ctx.__enter__()
    except Exception as e:
        sys.stderr.write(f"Database connection failed: {str(e)}\n")
        pool.close()
        sys.exit(1)
        
    try:
        sync_run_id = _init_sync_run(conn)
        brand_id = _resolve_brand_id(conn)
        print(f"Resolved Brand ID dynamically: {brand_id}")
        plus_size_mapping = _load_plus_size_mapping(conn)
        diger_category_id = _resolve_diger_category_id(conn)
        
        archived_file_path = _download_xml_feed(timings)
        if not archived_file_path:
            sys.stderr.write("Critical Error: XML feed file could not be retrieved.\n")
            update_sync_progress(conn, sync_run_id, "failed", 0, 0, 0, 0, 0, 0, 0)
            pool.close()
            sys.exit(1)
            
        caches = _load_in_memory_caches(conn, timings)
        parsed_data, sync_stats = _stream_parse_xml_feed(conn, pool, sync_run_id, brand_id, diger_category_id, plus_size_mapping, caches, yasakli_gorseller, timings)
        
        _bulk_write_batches(conn, parsed_data, timings)
        
        images_total = len(parsed_data["unique_downloads"])
        img_dl, failed_dl, dl_duration = asyncio.run(
            download_images_async(
                parsed_data["unique_downloads"], conn, pool, sync_run_id,
                sync_stats["items_parsed"], sync_stats["items_added"], sync_stats["items_updated"],
                sync_stats["variants_aligned"], sync_stats["errors_skipped"]
            )
        )
        timings["10. Image Downloads"] = dl_duration
        _log_failed_images(failed_dl, sync_run_id)
        
        sync_stats["images_total"] = images_total
        sync_stats["images_downloaded"] = img_dl
        
        _finalize_sync(conn, pool, conn_ctx, sync_run_id, timings, sync_stats, start_total)
    except Exception as ex:
        sys.stderr.write(f"Fatal error in run_parser: {ex}\n")
        try:
            conn_ctx.__exit__(None, None, None)
        except Exception:
            pass
        pool.close()
        sys.exit(1)

if __name__ == "__main__":
    run_parser()
