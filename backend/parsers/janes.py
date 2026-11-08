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
import re

# ==============================================================================
# CONFIGURATION BLOCK
# ==============================================================================
# Tedarikçi fiyatı doğrudan (0% kar marjı ile birebir) vitrine yansıtılır
PROFIT_RATE = 0.0

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
    
    import re
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

import platform

JANES_XML_FILE = "janestoptanxmltr.xml"
EXT_WEBP = ".webp"
COLOR_CICEKLI = "Çiçekli"
COLOR_CICEK_DESEN_MAVI = "Çiçek Desen Mavi"
COLOR_ALTIN = "Altın"
FABRIC_DALGIC = "Dalgıç"
FABRIC_MODAL_BASKILI = "Modal Baskılı"
FABRIC_DIJITAL_BASKILI = "Dijital Baskılı"
VAL_OMZU_ACIK = "Omzu Açık"
VAL_KADIN = "Kadın"

FEED_ID = "janes"
FEED_URL = "https://janestoptan.net/production/xml/janestoptanxmltr"
XML_TEMP_FILE = JANES_XML_FILE

# Dynamic Environment and Directory Settings
IS_WINDOWS = (platform.system() == "Windows")

if IS_WINDOWS:
    # On Windows (Local Dev/Debug): create "downloads/products/edusa" inside script's folder
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    IMAGE_UPLOAD_DIR = os.path.join(SCRIPT_DIR, "downloads", "products", "edusa")
    DB_IMAGE_PREFIX = "./downloads/products/edusa"
else:
    # On Linux (Production/Staging): standard server path
    IMAGE_UPLOAD_DIR = "/var/www/media/products/edusa"
    DB_IMAGE_PREFIX = "/uploads/products/edusa"

# Hardcoded category mapping overrides
HARDCODED_CATEGORY_MAPPING = {
    "Giyim/Kadın/bluz": "019e61eb-a386-7d38-af18-f83369521c05",      # Bluz
    "Giyim/Kadın/abiye": "019e61ef-770f-7f44-8d5e-d13239c72da9",     # Abiye
    "Giyim/Kadın/takim": "019e61f2-2dd6-7d16-8454-8d1e4609e98e",     # İkili Takım
    "Giyim/Kadın/elbise": "019e61ef-28a9-7f3c-a35f-8c4ccb8d4232",    # Elbise
    "Giyim/Kadın/pantolon": "019e61ed-ee84-7592-9a0a-877da842fd6e",  # Pantolon
    "Giyim/Kadın/tulum": "019e61f2-6059-7b0d-a860-811a70e1df5a",     # Tulum & Salopet
    "Giyim/Kadın/etek": "019e61ee-1ca1-7a44-a1f6-f530217dcc0a",      # Etek
    "Giyim/Kadın/jean": "019e61ed-ee84-7592-9a0a-877da842fd6e",      # Pantolon
    "Giyim/Kadın/tayt": "019e61ee-3f25-77bd-9f16-41c8ff61f4cb",      # Tayt
    "Giyim/Kadın/sort": "019e61ee-60a5-7822-82ad-319420c5be5f",      # Şort
    "Giyim/Kadın/şort": "019e61ee-60a5-7822-82ad-319420c5be5f",      # Şort
    "Giyim/Kadın/kazak": "019e61f0-308b-711f-9879-00510c0f6c99",     # Kazak & Süveter
    "Giyim/Kadın/hirka": "019e61f0-58e0-7b16-bddc-b29569781aca",     # Hırka
    "Giyim/Kadın/hırka": "019e61f0-58e0-7b16-bddc-b29569781aca",     # Hırka
    "Giyim/Kadın/tunik": "019e61f0-a49b-71e4-8d0d-b11e6f42dbae",     # Tunik
    "Giyim/Kadın/triko": "019e61f0-0503-7fe2-8ded-0c9a350a1128",     # Triko, Hırka & Kazak
}

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
    # search standard locations for .env and config.json
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
# ==============================================================================


def slugify(value):
    if not value:
        return ""
    value = str(value).lower()
    
    # Safe Turkish to English characters mapping
    tr_translation = {
        "ı": "i", "ş": "s", "ğ": "g", "ü": "u", "ö": "o", "ç": "c",
        "i̇": "i"
    }
    for tr_c, eng_c in tr_translation.items():
        value = value.replace(tr_c, eng_c)
        
    value = re.sub(r'[\s_]+', '-', value)
    value = re.sub(r'[^a-z0-9\-]', '', value) # Strictly lower ASCII english characters and hyphens
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
    "cicekli": COLOR_CICEKLI,
    "cıceklı": COLOR_CICEKLI,
    "desenli": "Desenli",
    "desenlı": "Desenli",
    "ek desen": "Çiçek Desen",
    "ek desen mavi": COLOR_CICEK_DESEN_MAVI,
    "ek desen pembe": "Çiçek Desen Pembe",
    "ek desen yeşil": "Çiçek Desen Yeşil",
    "ek d. mavi": COLOR_CICEK_DESEN_MAVI,
    "ek d. sarı": "Çiçek Desen Sarı",
    "çiçek desen": "Çiçek Desen",
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
    "kırmızı": "Kırmızı",
    "lacivert": "Lacivert",
    "mürdüm": "Mürdüm",
    "pembe çiçekli": "Pembe Çiçekli",
    "petrol yeşili": "Petrol Yeşili",
    "puantiye": "Puantiyeli",
    "sarı": "Sarı",
    "siyah beyaz": "Siyah Beyaz",
    "siyah beyaz çizgili": "Siyah Beyaz Çizgili",
    "sütlü kahve": "Sütlü Kahve",
    "taş": "Taş",
    "toprak": "Toprak",
    "turkuaz yeşil": "Turkuaz Yeşil",
    "yaprak desen": "Yaprak Desen",
    "yılan desen": "Yılan Desen",
    "zümrüt": "Zümrüt",
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

DESEN_MAPPINGS = {
    "cicekli": COLOR_CICEKLI,
    "cıceklı": COLOR_CICEKLI,
    "desenli": "Desenli",
    "desenlı": "Desenli",
}

SILUET_MAPPINGS = {
    "bodycon": "Bodycon",
    "bodycone": "Bodycon",
    "omzu acık": VAL_OMZU_ACIK,
    "omzu acik": VAL_OMZU_ACIK,
    "omzu açik": VAL_OMZU_ACIK,
    "omzu açık": VAL_OMZU_ACIK,
}

def standardize_attribute_value(tanim, value):
    if not value:
        return ""
    val_clean = " ".join(value.strip().split())
    low = turkish_lowercase(val_clean)
    
    if tanim == "Renk":
        return standardize_color(val_clean)
    if tanim in ("Kumaş Tipi", "Kumaş"):
        return standardize_fabric(val_clean)
    if low in ("çıt çıt", "cit cit", "çıtçıt", "citcit"):
        return "Çıtçıt"
    if "çarpraz" in low:
        val_clean = re.sub(r'(?i)çarpraz', 'Çapraz', val_clean)
        
    if tanim == "Cinsiyet":
        return "Erkek" if "erkek" in low else VAL_KADIN
    if tanim == "Desen":
        return DESEN_MAPPINGS.get(low, turkish_title(val_clean))
    if tanim == "Siluet":
        return SILUET_MAPPINGS.get(low, turkish_title(val_clean))
            
    return turkish_title(val_clean)



TRANSLATION_MAP = {
    # Attributes
    "Boy": {"en": "Length", "pl": "Długość", "ar": "الطool", "ru": "Длина", "de": "Länge"},
    "Cinsiyet": {"en": "Gender", "pl": "Płeć", "ar": "الجنس", "ru": "Пол", "de": "Geschlecht"},
    "Desen": {"en": "Pattern", "pl": "Wzór", "ar": "Wzór", "ru": "Узор", "de": "Muster"},
    "Kalıp": {"en": "Fit", "pl": "Fason", "ar": "القالب", "ru": "Посадка", "de": "Passform"},
    "Kol Boyu": {"en": "Sleeve Length", "pl": "Długość rękawa", "ar": "طول الكم", "ru": "Длина рукава", "de": "Ärmellänge"},
    "Ortam": {"en": "Occasion", "pl": "Okazja", "ar": "المناسبة", "ru": "Событие", "de": "Anlass"},
    "Persona": {"en": "Persona", "pl": "Persona", "ar": "الشخصية", "ru": "Персона", "de": "Persona"},
    "Siluet": {"en": "Silhouette", "pl": "Sylwetka", "ar": "الصورة الظلية", "ru": "Силуэт", "de": "Silhouette"},
    "Yaş Grubu": {"en": "Age Group", "pl": "Grupa wiekowa", "ar": "الفئة العمرية", "ru": "Возрастная группа", "de": "Altersgruppe"},
    "Astar Durumu": {"en": "Lining Status", "pl": "Podszewka", "ar": "حالة البطانة", "ru": "Наличие подкладки", "de": "Futterstatus"},
    "Baskı/Nakış Tekniği": {"en": "Print/Embroidery", "pl": "Nadruk/Haft", "ar": "تقنية الطباعة/التطريz", "ru": "Печать/Вышивка", "de": "Druck/Stickerei"},
    "Cep": {"en": "Pocket", "pl": "Kieszeń", "ar": "الجيب", "ru": "Karman", "de": "Tasche"},
    "Kalınlık": {"en": "Thickness", "pl": "Grubość", "ar": "السмаكة", "ru": "Толщина", "de": "Dicke"},
    "Kap": {"en": "Hood/Cup", "pl": "Kaptur/Miseczka", "ar": "كab/غطاء", "ru": "Капюшон/Чашка", "de": "Kappe/Körbchen"},
    "Kapama Şekli": {"en": "Closure", "pl": "Zapięcie", "ar": "طريقة الإغلاق", "ru": "Способ застегивания", "de": "Verschlussart"},
    "Kemer/Kuşak Durumu": {"en": "Belt/Sash", "pl": "Pasek/Szarfa", "ar": "حالة الحزام", "ru": "Bez remnya", "de": "Ohne Gürtel"},
    "Kol Tipi": {"en": "Sleeve Type", "pl": "Typ rękawa", "ar": "نوع الكم", "ru": "Тип рукава", "de": "Ärmeltyp"},
    "Koleksiyon": {"en": "Collection", "pl": "Kolekcja", "ar": "المجموعة", "ru": "Коллекция", "de": "Kollektion"},
    "Yaka Tipi": {"en": "Collar/Neckline", "pl": "Kołnierz/Dekolt", "ar": "نوع الياقة", "ru": "Tip vorotnika", "de": "Kragentyp"},
    "Kumaş Tipi": {"en": "Fabric Type", "pl": "Rodzaj tkaniny", "ar": "نوع القماش", "ru": "Тип ткани", "de": "Stoffart"},
    "Parça Sayısı": {"en": "Number of Pieces", "pl": "Liczba części", "ar": "عدد القطع", "ru": "Kolichestvo", "de": "Teileanzahl"},

    # Values
    VAL_KADIN: {"en": "Women", "pl": "Kobieta", "ar": "نسائي", "ru": "Женщины", "de": "Damen"},
    "Kadın / Kız": {"en": "Women", "pl": "Kobieta", "ar": "نسائي", "ru": "Женщины", "de": "Damen"},
    "Midi": {"en": "Midi", "pl": "Midi", "ar": "ميدي", "ru": "Миди", "de": "Midi"},
    "Maxi": {"en": "Maxi", "pl": "Maxi", "ar": "ماكسi", "ru": "Макси", "de": "Maxi"},
    "Mini": {"en": "Mini", "pl": "Mini", "ar": "ميني", "ru": "Мини", "de": "Mini"},
    "Astarsız": {"en": "Unlined", "pl": "Bez podszewki", "ar": "بدون بطانة", "ru": "Без подкладки", "de": "Ungefüttert"},
    "Astarlı": {"en": "Lined", "pl": "Z podszewką", "ar": "مبطن", "ru": "С подкладкой", "de": "Gefüttert"},
    "Baskısız": {"en": "Without Print", "pl": "Bez nadruku", "ar": "Bez nadruku", "ru": "Без printa", "de": "Ohne Druck"},
    "Baskılı": {"en": "Printed", "pl": "Z nadrukiem", "ar": "motto", "ru": "С принтом", "de": "Bedruckt"},
    "Cepsiz": {"en": "Pocketless", "pl": "Bez kieszeni", "ar": "بدون جيوب", "ru": "Bez karmanov", "de": "Ohne Taschen"},
    "Cepli": {"en": "With Pockets", "pl": "Z kieszeniami", "ar": "بجيوب", "ru": "S karmanami", "de": "Mit Taschen"},
    "Düz": {"en": "Plain", "pl": "Gładki", "ar": "سادة", "ru": "Однотонный", "de": "Einfarbig"},
    "Orta": {"en": "Medium", "pl": "Średnia", "ar": "متوسط", "ru": "Средний", "de": "Mittel"},
    "A-line": {"en": "A-line", "pl": "A-line", "ar": "ألف لاين", "ru": "А-силуэт", "de": "A-Linie"},
    "Kapsız": {"en": "Without Hood/Cup", "pl": "Bez kaptura/miseczki", "ar": "بدون كاب/غطاء", "ru": "Без капюшона/чашек", "de": "Ohne Kappe/Körbchen"},
    "Kapamasız": {"en": "Without Closure", "pl": "Bez zapięcia", "ar": "بدون إغلاق", "ru": "Bez zastezhki", "de": "Ohne Verschluss"},
    "Kemersiz": {"en": "Without Belt", "pl": "Bez paska", "ar": "Bez paska", "ru": "Bez remnya", "de": "Ohne Gürtel"},
    "Kemerli": {"en": "With Belt", "pl": "Z paskiem", "ar": "بحزام", "ru": "S remnem", "de": "Mit Gürtel"},
    "Kısa": {"en": "Short", "pl": "Krótki", "ar": "قصير", "ru": "Короткий", "de": "Kurz"},
    "Uzun": {"en": "Long", "pl": "Długi", "ar": "طويل", "ru": "Длинный", "de": "Lang"},
    "Düşük Kol": {"en": "Low Sleeve", "pl": "Obniżony rękaw", "ar": "كم منخفض", "ru": "Заниженный рукав", "de": "Tief angesetzter Ärmel"},
    "Casual / Günlük": {"en": "Casual", "pl": "Casual/Codzienny", "ar": "كاجوال / يومي", "ru": "Повседневный", "de": "Lässig/Freizeit"},
    "Günlük": {"en": "Casual", "pl": "Na co diżeń", "ar": "yomi", "ru": "Повседневный", "de": "Freizeit"},
    "Feminine": {"en": "Feminine", "pl": "Kobiecy", "ar": "أنثوي", "ru": "Женственны", "de": "Feminin"},
    "V Yaka": {"en": "V-Neck", "pl": "Dekolt V", "ar": "ياقة V", "ru": "V-образный вырез", "de": "V-Ausschnitt"},
    "Yetişkin": {"en": "Adult", "pl": "Dorosły", "ar": "بالغ", "ru": "Взрослые", "de": "Erwachsene"},
    "Genç": {"en": "Teen", "pl": "Nastolatek", "ar": "يافع", "ru": "Подростки", "de": "Jugendliche"},
    "Bodycon": {"en": "Bodycon", "pl": "Bodycon", "ar": "ضيق", "ru": "Оblegający", "de": "Bodycon"},
    "Bodycone": {"en": "Bodycon", "pl": "Bodycon", "ar": "ضيق", "ru": "Оblegający", "de": "Bodycon"},
    VAL_OMZU_ACIK: {"en": "Off Shoulder", "pl": "Odkryte ramiona", "ar": "أكتاf مكشوفة", "ru": "С открытыми плечами", "de": "Schulterfrei"},
    "Şık/Gece": {"en": "Elegant/Night", "pl": "Eleganckie/Wieczór", "ar": "أنيق/سهرة", "ru": "Элегантный/Вечер", "de": "Elegant/Abend"}
}

COLOR_TRANSLATION_MAP = {
    "Altın": {"en": "Gold", "pl": "Złoty", "bg": "Златист", "ar": "ذهبي", "ru": "Золотой", "de": "Gold"},
    "Antrasit": {"en": "Anthracite", "pl": "Antracyt", "bg": "Антрацит", "ar": "أنثراسيت", "ru": "Антрацит", "de": "Anthrazit"},
    "Bebe Mavisi": {"en": "Baby Blue", "pl": "Błękitny", "bg": "Бебешко синьо", "ar": "أزرق فاتح", "ru": "Голубой", "de": "Babyblau"},
    "Bej": {"en": "Beige", "pl": "Beżowy", "bg": "Бежов", "ar": "بيج", "ru": "Бежевый", "de": "Beige"},
    "Beyaz": {"en": "White", "pl": "Biały", "bg": "Бял", "ar": "أبيض", "ru": "Белый", "de": "Weiß"},
    "Bordo": {"en": "Burgundy", "pl": "Bordowy", "bg": "Бордо", "ar": "بورجوندي", "ru": "Бордовый", "de": "Burgunder"},
    "Desenli": {"en": "Patterned", "pl": "Wzorzysty", "bg": "С десен", "ar": "منqوش", "ru": "Узорчатый", "de": "Gemustert"},
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
    "Siyah": {"en": "Black", "pl": "Czarny", "bg": "Черен", "ar": "أسود", "ru": "Черный", "de": "Schwarz"},
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
    "ATLAS": {"en": "Satin", "pl": "Satyna", "bg": "Сатен", "ar": "أطلس", "ru": "Атлас", "de": "Satin"},
    "DİJİTAL BASKILI": {"en": "Digital Printed", "pl": "Druk cyfrowy", "bg": "Дигитален печат", "ar": "طباعة رقمية", "ru": "Цифровая печать", "de": "Digitaldruck"},
    "BÜRÜMCÜK": {"en": "Seersucker", "pl": "Kora", "bg": "Сийрсокър", "ar": "سيرсаكر", "ru": "Жатка", "de": "Seersucker"},
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
    "İTHAL KREP": {"en": "Imported Crepe", "pl": "Krepa importowana", "bg": "Вносен креп", "ar": "كريب مستورد", "ru": "Импортный креп", "de": "Importierter Krepp"},
    "ŞİFON": {"en": "Chiffon", "pl": "Szyfon", "bg": "Шифон", "ar": "شيفон", "ru": "Шифон", "de": "Chiffon"}
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

def _clean_id_from_title(title, id_str):
    if not (id_str and id_str.isdigit()):
        return title
    title = re.sub(rf'\b{id_str}\b', '', title)
    title = re.sub(r'[\s,-]{2,}', ' ', title)
    return title.strip(" ,-")

def clean_title(title_text, varyasyon_id, group_id):
    if not title_text:
        return ""
    import html
    title_text = html.unescape(title_text)
    
    cleaned = title_text
    if varyasyon_id:
        cleaned = _clean_id_from_title(cleaned, str(varyasyon_id).strip())
    if group_id:
        numeric_part = re.search(r'\d+', str(group_id).strip())
        if numeric_part:
            cleaned = _clean_id_from_title(cleaned, numeric_part.group())

    cleaned = re.sub(r'\b\d{4,8}\b', '', cleaned)
    cleaned = re.sub(r'[\s,-]{2,}', ' ', cleaned)
    
    return turkish_title(cleaned.strip(" ,-"))

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
            print(f"Successfully cleaned up {cleaned_count} leftover JPG files from previous runs!")
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
            except (OSError, IOError):
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
    failed_downloads = {}
    images_total = progress_ctx["images_total"]
    t_start = progress_ctx["t_start"]
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
    max_retries = 10
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

def update_sync_progress(conn, sync_run_id, status, items_parsed, items_added, items_updated, variants_aligned, errors_skipped, images_total, images_downloaded, timings=None):
    try:
        # Dynamic progressive percentage: XML parsing is 0-45%, bulk DB is 48%, image download is 50-100%
        pct_val = 0
        if images_total > 0:
            pct_val = 50 + (images_downloaded * 50 // images_total)
        elif items_parsed > 0:
            pct_val = min(45, items_parsed * 45 // 2200)
            
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
            
        summary_json = json.dumps(summary)
        
        with conn.cursor() as cur:
            if status == "success":
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

        # Publish progress to Redis key for real-time backend updates
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
        SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
        stats_file_path = os.path.join(SCRIPT_DIR, "sync_stats.txt")
        
        with open(stats_file_path, "w", encoding="utf-8") as f:
            f.write("====================================================\n")
            f.write("JANES AUTONOMOUS SYNC PERFORMANCE STATS\n")
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
    brand_id = "019e620f-2ca6-774c-9450-6c69015045a4"
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT brand_id FROM integration.xml_feeds WHERE id = %s", (FEED_ID,))
            row = cur.fetchone()
            if row and row[0]:
                brand_id = str(row[0])
            else:
                cur.execute("SELECT id FROM catalog.brands WHERE alias_code = 'EDUSA'")
                row = cur.fetchone()
                if row and row[0]:
                    brand_id = str(row[0])
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to dynamically query Brand ID: {str(e)}\n")
    return brand_id

def _load_category_mapping(conn):
    category_mapping = dict(HARDCODED_CATEGORY_MAPPING)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT category_mapping FROM integration.xml_feeds WHERE id = %s", (FEED_ID,))
            row = cur.fetchone()
            if row and row[0]:
                db_mapping = row[0] if isinstance(row[0], dict) else json.loads(row[0])
                category_mapping.update(db_mapping)
    except Exception as e:
        print(f"Warning: Failed to load category mappings: {str(e)}")
    return category_mapping

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
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM catalog.categories WHERE title = 'Diğer' OR slug = 'diger' LIMIT 1")
            row = cur.fetchone()
            if row:
                return str(row[0])
            cur.execute("SELECT id FROM catalog.categories WHERE slug = 'kadin-giyim' LIMIT 1")
            parent_row = cur.fetchone()
            parent_id = str(parent_row[0]) if parent_row else None
            
            if parent_id:
                cur.execute(
                    "INSERT INTO catalog.categories (parent_id, title, slug, is_active) VALUES (%s, 'Diğer', 'diger', true) RETURNING id",
                    (parent_id,)
                )
            else:
                cur.execute("INSERT INTO catalog.categories (title, slug, is_active) VALUES ('Diğer', 'diger', true) RETURNING id")
            diger_category_id = str(cur.fetchone()[0])
            conn.commit()
            return diger_category_id
    except Exception as e:
        print(f"Warning: Failed to resolve 'Diğer' category: {str(e)}")
        return None

def _resolve_pareo_category_id(conn):
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM catalog.categories WHERE slug = 'pareo' LIMIT 1")
            row = cur.fetchone()
            if row:
                return str(row[0])
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to query pareo category: {e}\n")
    return None

def _download_xml_feed(timings):
    import shutil
    timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    xml_history_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads", "xml_history")
    os.makedirs(xml_history_dir, exist_ok=True)
    archived_file_path = os.path.join(xml_history_dir, f"janes-{timestamp}.xml")
    
    print(f"Downloading XML Feed from: {FEED_URL}")
    t_start = time.time()
    download_success = False
    try:
        req = urllib.request.Request(FEED_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=40) as response, open(archived_file_path, 'wb') as temp_file:
            temp_file.write(response.read())
        timings["1. Feed Download"] = time.time() - t_start
        print(f"Successfully downloaded and archived feed to: {archived_file_path} (took {timings['1. Feed Download']:.2f}s)")
        download_success = True
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to download XML feed from network: {str(e)}\n")
        fallback_paths = [
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", JANES_XML_FILE),
            os.path.join(os.path.dirname(os.path.abspath(__file__)), JANES_XML_FILE),
            JANES_XML_FILE
        ]
        for path in fallback_paths:
            if os.path.exists(path):
                print(f"Using cached local XML feed file from: {path}")
                shutil.copy2(path, archived_file_path)
                timings["1. Feed Download"] = 0.01
                download_success = True
                break
                
    if not download_success:
        return None
    shutil.copy(archived_file_path, XML_TEMP_FILE)
    return archived_file_path

def _load_in_memory_caches(conn, timings):
    print("Loading in-memory database caches for products and variants...")
    t_start = time.time()
    products_cache = {}
    variants_cache = {}
    colors_cache = {}
    fabrics_cache = {}
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, color_name FROM catalog.colors")
            for cid, name in cur.fetchall():
                colors_cache[name] = str(cid)

            cur.execute("SELECT id, fabric_name FROM catalog.fabrics")
            for fid, name in cur.fetchall():
                fabrics_cache[name] = str(fid)

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
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to load in-memory caches: {str(e)}\n")
    return products_cache, variants_cache, colors_cache, fabrics_cache

def _detect_category_by_title(title_lower):
    if "elbise" in title_lower and not any(k in title_lower for k in ["takım", "takim", "tulum"]):
        return "019e61ef-28a9-7f3c-a35f-8c4ccb8d4232"
    if any(k in title_lower for k in ["takım", "takim"]):
        return "019e61f2-2dd6-7d16-8454-8d1e4609e98e"
    if "tulum" in title_lower:
        return "019e61f2-6059-7b0d-a860-811a70e1df5a"
    if "etek" in title_lower:
        return "019e61ee-1ca1-7a44-a1f6-f530217dcc0a"
    if any(k in title_lower for k in ["pantolon", "jean", "kot"]):
        return "019e61ed-ee84-7592-9a0a-877da842fd6e"
    if "tayt" in title_lower:
        return "019e61ee-3f25-77bd-9f16-41c8ff61f4cb"
    if any(k in title_lower for k in ["şort", "sort"]):
        return "019e61ee-60a5-7822-82ad-319420c5be5f"
    if any(k in title_lower for k in ["kazak", "süveter", "suveter", "sweatshirt", "sweat"]):
        return "019e61f0-308b-711f-9879-00510c0f6c99"
    if any(k in title_lower for k in ["hırka", "hirka"]):
        return "019e61f0-58e0-7b16-bddc-b29569781aca"
    if "tunik" in title_lower:
        return "019e61f0-a49b-71e4-8d0d-b11e6f42dbae"
    return None

def _resolve_product_category(parent_title, is_erkek, category_tag, category_mapping, pareo_category_id, diger_category_id, plus_size_mapping, packing_ratio):
    category_id = None
    if parent_title and "pareo" in parent_title.lower():
        category_id = pareo_category_id
        
    if not category_id and parent_title:
        category_id = _detect_category_by_title(parent_title.lower())
        
    if not category_id:
        if is_erkek:
            erkek_cats = {
                "Giyim/Kadın/bluz": "9f216fd1-ece0-467c-afa8-5d5cca50b1a2",
                "Giyim/Kadın/t-shirt": "2eab834d-5287-491d-8da6-24a2535efaee",
                "Giyim/Kadın/takim": "a40f68e0-45b6-4da8-825a-607a950b68a0",
            }
            category_id = erkek_cats.get(category_tag, "019e65f2-7d68-7a86-8155-fd60fcacd359")
        elif category_tag and category_tag in category_mapping:
            category_id = category_mapping[category_tag]
            
    if not category_id:
        category_id = diger_category_id
        
    if category_id and is_xl_or_above(packing_ratio):
        category_id = plus_size_mapping.get(category_id, plus_size_mapping.get("buyuk-beden-root", category_id))
        
    return category_id

def _parse_secenek_prices(secenek):
    v_buying_price = 0.0
    try:
        v_buying_price = float(secenek.findtext('SatisFiyati') or 0.0)
    except (ValueError, TypeError):
        pass
        
    v_buying_disc_price = None
    try:
        v_buying_disc_price = float(secenek.findtext('IndirimliFiyat') or 0.0)
        if v_buying_disc_price <= 0.0:
            v_buying_disc_price = None
    except (ValueError, TypeError):
        pass
        
    v_price = v_buying_price * (1 + PROFIT_RATE)
    v_disc_price = v_buying_disc_price * (1 + PROFIT_RATE) if v_buying_disc_price is not None else None
    v_currency = secenek.findtext('ParaBirimiKodu') or secenek.findtext('ParaBirimi') or "USD"
    
    v_tax = 10.0
    try:
        v_tax = float(secenek.findtext('KdvOrani') or 10.0)
        if v_tax < 1.0:
            v_tax = v_tax * 100.0
    except (ValueError, TypeError):
        pass
        
    return v_buying_price, v_price, v_disc_price, v_currency, v_tax

def _parse_beden_elements(bedenler, source_product_id):
    size_variants = []
    total_stock = 0
    if bedenler is None:
        return size_variants, total_stock
    for b in bedenler.findall('Beden'):
        size_name = (b.text or "").strip()
        if not size_name:
            continue
        size_stock = 0
        try:
            size_stock = int(b.attrib.get('adet') or 0)
        except (ValueError, TypeError):
            pass
        size_barcode = b.attrib.get('barkod') or ""
        total_stock += size_stock
        source_variant_id = size_barcode if size_barcode else f"{source_product_id}-{slugify(size_name)}"
        size_variants.append({
            "size": size_name,
            "stock": size_stock,
            "barcode": size_barcode,
            "is_single": False,
            "source_variant_id": source_variant_id
        })
    return size_variants, total_stock

def _collect_secenek_variants(secenek, source_product_id, v_barcode, product_uuid, sync_run_id, variants_cache, variants_to_upsert):
    size_variants, total_stock = _parse_beden_elements(secenek.find('Bedenler'), source_product_id)
    if not size_variants:
        total_stock = 99
        size_variants.append({
            "size": "Standart",
            "stock": 99,
            "barcode": v_barcode,
            "is_single": False,
            "source_variant_id": source_product_id
        })
        
    for svar in size_variants:
        sv_id = svar["source_variant_id"]
        variant_uuid = variants_cache.get((product_uuid, sv_id), str(uuid.uuid4()))
        variants_cache[(product_uuid, sv_id)] = variant_uuid
        variants_to_upsert[(product_uuid, sv_id)] = (
            variant_uuid, product_uuid, svar["size"], svar["barcode"],
            svar["stock"], svar["is_single"], sv_id, sync_run_id, True
        )
    return total_stock, len(size_variants)

def _collect_secenek_images(secenek, product_uuid, title, category_tag, desc_tr_val, v_color, v_fabric, images_by_product, unique_downloads):
    resimler = secenek.find('Resimler')
    if resimler is None:
        return
    for resim in resimler.findall('Resim'):
        img_url = resim.text
        if not img_url:
            continue
        hash_prefix = hashlib.sha256(img_url.encode('utf-8')).hexdigest()[:16]
        local_filename_jpg = f"edusa-{hash_prefix}.jpg"
        local_filename_webp = f"edusa-{hash_prefix}.webp"
        local_file_path = os.path.join(IMAGE_UPLOAD_DIR, local_filename_jpg)
        db_image_url = f"{DB_IMAGE_PREFIX}/{local_filename_webp}"
        
        if product_uuid not in images_by_product:
            images_by_product[product_uuid] = []
            
        if not any(x[0] == img_url for x in images_by_product[product_uuid]):
            images_by_product[product_uuid].append((img_url, local_file_path, db_image_url))
            
        tags_str = "; ".join([t for t in ["EDUSA", v_color, v_fabric] if t])
        unique_downloads[local_file_path] = {
            "url": img_url,
            "title": title,
            "subject": category_tag or "Giyim",
            "tags": tags_str,
            "description": desc_tr_val or title,
            "brand": "Jane's Toptan"
        }

def _collect_secenek_attributes(secenek):
    prod_attributes = {}
    ek_ozellik = secenek.find('EkSecenekOzellik')
    if ek_ozellik is not None:
        for ozellik in ek_ozellik.findall('Ozellik'):
            tanim = ozellik.attrib.get('Tanim')
            deger = ozellik.attrib.get('Deger') or ozellik.text
            if tanim:
                tanim = tanim.strip()
                deger = (deger or "").strip()
                if deger:
                    prod_attributes[tanim] = standardize_attribute_value(tanim, deger)
    return prod_attributes

def _resolve_secenek_color_and_fabric(secenek, colors_cache, fabrics_cache, parsed_data):
    v_color = standardize_color((secenek.findtext('Renk') or "Standart").strip())
    if v_color not in colors_cache:
        color_uuid = str(uuid.uuid4())
        colors_cache[v_color] = color_uuid
        parsed_data["colors_to_upsert"][v_color] = color_uuid
        
    v_fabric = standardize_fabric((secenek.findtext('Kumas') or "").strip())
    if v_fabric and v_fabric not in fabrics_cache:
        fabric_uuid = str(uuid.uuid4())
        fabrics_cache[v_fabric] = fabric_uuid
        parsed_data["fabrics_to_upsert"][v_fabric] = fabric_uuid
        
    color_uuid = colors_cache.get(v_color)
    fabric_uuid = fabrics_cache.get(v_fabric) if v_fabric else None
    return v_color, v_fabric, color_uuid, fabric_uuid

def _build_secenek_titles(elem_ctx, source_product_id, v_color):
    title_tr_cleaned = clean_title(elem_ctx["parent_title"], source_product_id, elem_ctx["parent_product_group_id"])
    title = f"{title_tr_cleaned} - {v_color}" if v_color and v_color != "Standart" else title_tr_cleaned
    if not title or len(title.strip()) <= 15:
        return None, None, None, None
        
    t_color_en = translate_color(v_color, "en")
    t_color_pl = translate_color(v_color, "pl")
    t_color_ar = translate_color(v_color, "ar")
    
    title_en_cleaned = clean_title(elem_ctx["p_title_en"], source_product_id, elem_ctx["parent_product_group_id"])
    title_en_final = f"{title_en_cleaned} - {t_color_en}" if v_color and v_color != "Standart" and t_color_en else (title_en_cleaned or title_tr_cleaned)
    title_pl_cleaned = clean_title(elem_ctx["p_title_pl"], source_product_id, elem_ctx["parent_product_group_id"])
    title_pl_final = f"{title_pl_cleaned} - {t_color_pl}" if v_color and v_color != "Standart" and t_color_pl else (title_pl_cleaned or title_tr_cleaned)
    title_ar_cleaned = clean_title(elem_ctx["p_title_ar"], source_product_id, elem_ctx["parent_product_group_id"])
    title_ar_final = f"{title_ar_cleaned} - {t_color_ar}" if v_color and v_color != "Standart" and t_color_ar else (title_ar_cleaned or title_tr_cleaned)
    
    return title, title_en_final, title_pl_final, title_ar_final

def _resolve_product_identity(source_product_id, title, products_cache, stats):
    if source_product_id in products_cache:
        product_uuid, product_slug = products_cache[source_product_id]
        stats["items_updated"] += 1
    else:
        product_uuid = str(uuid.uuid4())
        product_slug = slugify(title)
        products_cache[source_product_id] = (product_uuid, product_slug)
        stats["items_added"] += 1
    return product_uuid, product_slug

def _append_product_translations(parsed_data, product_uuid, elem_ctx, titles_final):
    import html
    title_en_final, title_pl_final, title_ar_final = titles_final
    desc_en_val = html.unescape(elem_ctx["desc_en"] or "").strip()
    desc_pl_val = html.unescape(elem_ctx["desc_pl"] or "").strip()
    desc_ar_val = html.unescape(elem_ctx["desc_ar"] or "").strip()
    
    if elem_ctx["p_title_en"] or elem_ctx["desc_en"]:
        parsed_data["product_translations_to_upsert"].append((product_uuid, "en", title_en_final, "", desc_en_val))
    if elem_ctx["p_title_pl"] or elem_ctx["desc_pl"]:
        parsed_data["product_translations_to_upsert"].append((product_uuid, "pl", title_pl_final, "", desc_pl_val))
    if elem_ctx["p_title_ar"] or elem_ctx["desc_ar"]:
        parsed_data["product_translations_to_upsert"].append((product_uuid, "ar", title_ar_final, "", desc_ar_val))

def _parse_secenek_item(secenek, elem_ctx, meta_ctx, caches, parsed_data, stats):
    products_cache, variants_cache, colors_cache, fabrics_cache = caches
    sync_run_id, brand_id = meta_ctx["sync_run_id"], meta_ctx["brand_id"]
    
    v_color, v_fabric, color_uuid, fabric_uuid = _resolve_secenek_color_and_fabric(secenek, colors_cache, fabrics_cache, parsed_data)
    
    source_product_id = secenek.findtext('VaryasyonID') or secenek.findtext('StokKodu')
    if not source_product_id:
        source_product_id = f"{elem_ctx['parent_product_group_id']}-{slugify(v_color)}"
        
    v_sku = secenek.findtext('StokKodu')
    v_barcode = secenek.findtext('Barkod')
    
    v_min_order = 1
    try:
        v_min_order = int(secenek.findtext('minSipAdet') or 1)
    except (ValueError, TypeError):
        pass
        
    title, title_en_final, title_pl_final, title_ar_final = _build_secenek_titles(elem_ctx, source_product_id, v_color)
    if not title:
        stats["errors_skipped"] += 1
        return
        
    import html
    desc_tr_val = html.unescape(elem_ctx["desc_tr"] or "").strip()
    
    v_buying_price, v_price, v_disc_price, v_currency, v_tax = _parse_secenek_prices(secenek)
    
    product_uuid, product_slug = _resolve_product_identity(source_product_id, title, products_cache, stats)
    
    total_stock, variants_count = _collect_secenek_variants(
        secenek, source_product_id, v_barcode, product_uuid, sync_run_id, variants_cache, parsed_data["variants_to_upsert"]
    )
    stats["variants_aligned"] += variants_count
    
    meta_attr_val = json.dumps({"original_brand": elem_ctx["original_brand"]})

    parsed_data["products_to_upsert"][source_product_id] = (
        product_uuid, FEED_ID, source_product_id, elem_ctx["parent_product_group_id"], title, product_slug,
        elem_ctx["category_id"], elem_ctx["gender"], sync_run_id, True, brand_id,
        elem_ctx["series_ratio"] if elem_ctx["series_ratio"] else "1", elem_ctx["packing_ratio"] if elem_ctx["packing_ratio"] else "Standart",
        elem_ctx["shipping_weight_kg"], v_min_order, elem_ctx["season"],
        v_buying_price, v_price, None, v_disc_price if v_disc_price is not None else v_price, v_currency, v_tax, total_stock, v_sku, v_barcode,
        "", desc_tr_val, meta_attr_val, elem_ctx["urun_url"],
        color_uuid, fabric_uuid
    )
    
    _append_product_translations(parsed_data, product_uuid, elem_ctx, (title_en_final, title_pl_final, title_ar_final))

    _collect_secenek_images(
        secenek, product_uuid, title, elem_ctx["category_tag"], desc_tr_val, v_color, v_fabric,
        parsed_data["images_by_product"], parsed_data["unique_downloads"]
    )
    
    prod_attrs = _collect_secenek_attributes(secenek)
    if prod_attrs:
        parsed_data["attributes_by_product"][product_uuid] = prod_attrs
        
    stats["items_parsed"] += 1

def _process_urun_element(elem, meta_ctx, caches, parsed_data, stats):
    raw_group_id = elem.findtext('UrunKartiID')
    if raw_group_id and any(kw in raw_group_id.lower() for kw in ["janes", "janness", "janess", "jane's"]):
        stats["errors_skipped"] += 1
        return
        
    parent_product_group_id = raw_group_id.split("-")[0].strip() if raw_group_id and "-" in raw_group_id else raw_group_id
    parent_title = elem.findtext('UrunAdi')
    is_erkek = bool(parent_title and "erkek" in parent_title.lower())
    gender = "Erkek" if is_erkek else "Kadın"
    
    category_tag = elem.findtext('KategoriTree') or elem.findtext('Kategori') or elem.findtext('KategoriID')
    series_ratio = elem.findtext('Seri')
    packing_ratio = sort_packing_ratio(elem.findtext('OzelAlan1'))
    
    shipping_weight_kg = 0.35
    agirlik_str = elem.findtext('Agirlik')
    if agirlik_str:
        try:
            shipping_weight_kg = float(agirlik_str) / 1000.0
        except (ValueError, TypeError):
            pass
            
    category_id = _resolve_product_category(
        parent_title, is_erkek, category_tag, meta_ctx["category_mapping"],
        meta_ctx["pareo_category_id"], meta_ctx["diger_category_id"],
        meta_ctx["plus_size_mapping"], packing_ratio
    )
    
    elem_ctx = {
        "parent_product_group_id": parent_product_group_id,
        "parent_title": parent_title,
        "gender": gender,
        "category_tag": category_tag,
        "category_id": category_id,
        "series_ratio": series_ratio,
        "packing_ratio": packing_ratio,
        "shipping_weight_kg": shipping_weight_kg,
        "season": elem.findtext('Sezon'),
        "p_title_en": elem.findtext('UrunAdiEn'),
        "p_title_pl": elem.findtext('UrunAdiPl'),
        "p_title_ar": elem.findtext('UrunAdiAr'),
        "desc_tr": elem.findtext('Aciklama'),
        "desc_en": elem.findtext('AciklamaEn'),
        "desc_pl": elem.findtext('aciklamaPl') or elem.findtext('AciklamaPl'),
        "desc_ar": elem.findtext('AciklamaAr'),
        "urun_url": elem.findtext('UrunUrl'),
        "original_brand": elem.findtext('Marka') or "Jane's"
    }
    
    urun_secenek = elem.find('UrunSecenek')
    if urun_secenek is not None:
        for secenek in urun_secenek.findall('Secenek'):
            _parse_secenek_item(secenek, elem_ctx, meta_ctx, caches, parsed_data, stats)

def _stream_parse_xml_feed(conn, pool, sync_run_id, meta_ctx, caches, timings):
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
        context = ET.iterparse(XML_TEMP_FILE, events=('end',), tag='Urun')
        for _, elem in context:
            try:
                _process_urun_element(elem, meta_ctx, caches, parsed_data, stats)
            except Exception as e:
                sys.stderr.write(f"Warning: Failed to import product XML node: {str(e)}\n")
                stats["errors_skipped"] += 1
            finally:
                elem.clear()
                while elem.getprevious() is not None:
                    del elem.getparent()[0]
                    
            if stats["items_parsed"] > 0 and stats["items_parsed"] % 100 == 0:
                print(f"-> Parsed {stats['items_parsed']} products... (Added: {stats['items_added']}, Updated: {stats['items_updated']}, Errors: {stats['errors_skipped']})")
                sys.stdout.flush()
                update_sync_progress(conn, sync_run_id, "running", stats["items_parsed"], stats["items_added"], stats["items_updated"], stats["variants_aligned"], stats["errors_skipped"], 0, 0)
    except Exception as e:
        sys.stderr.write(f"Parser encountered critical error during XML parsing: {str(e)}\n")
        update_sync_progress(conn, sync_run_id, "failed", stats["items_parsed"], stats["items_added"], stats["items_updated"], stats["variants_aligned"], stats["errors_skipped"], 0, 0)
        pool.close()
        sys.exit(1)
        
    timings["3. XML Ingestion (Parse)"] = time.time() - t_start
    print(f"XML parsing completed! (took {timings['3. XML Ingestion (Parse)']:.2f}s)")
    return parsed_data, stats

def _write_colors(cur, colors_to_upsert):
    t_db = time.time()
    colors_insert_rows = [(cid, name) for name, cid in colors_to_upsert.items()]
    color_trans = [(cid, lang, translate_color(name, lang)) for name, cid in colors_to_upsert.items() for lang in ["en", "pl", "bg", "ar", "ru", "de"]]
    execute_values_psycopg3(cur, "INSERT INTO catalog.colors (id, color_name) VALUES %s ON CONFLICT (color_name) DO NOTHING", colors_insert_rows, page_size=1000)
    execute_values_psycopg3(cur, "INSERT INTO catalog.color_translations (color_id, language_code, color_name) VALUES %s ON CONFLICT (color_id, language_code) DO NOTHING", color_trans, page_size=2000)
    print(f"-> Bulk upserted {len(colors_insert_rows)} colors in {time.time() - t_db:.2f}s.")

def _write_fabrics(cur, fabrics_to_upsert):
    t_db = time.time()
    fabrics_insert_rows = [(fid, name) for name, fid in fabrics_to_upsert.items()]
    fabric_trans = [(fid, lang, translate_fabric(name, lang)) for name, fid in fabrics_to_upsert.items() for lang in ["en", "pl", "bg", "ar", "ru", "de"]]
    execute_values_psycopg3(cur, "INSERT INTO catalog.fabrics (id, fabric_name) VALUES %s ON CONFLICT (fabric_name) DO NOTHING", fabrics_insert_rows, page_size=1000)
    execute_values_psycopg3(cur, "INSERT INTO catalog.fabric_translations (fabric_id, language_code, fabric_name) VALUES %s ON CONFLICT (fabric_id, language_code) DO NOTHING", fabric_trans, page_size=2000)
    print(f"-> Bulk upserted {len(fabrics_insert_rows)} fabrics in {time.time() - t_db:.2f}s.")

def _write_products(cur, products_to_upsert, timings):
    t_db = time.time()
    upsert_products_query = """
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
    execute_values_psycopg3(cur, upsert_products_query, list(products_to_upsert.values()), page_size=1000)
    timings["4. DB Products Bulk Upsert"] = time.time() - t_db
    print(f"-> Bulk upserted products successfully (took {timings['4. DB Products Bulk Upsert']:.2f}s).")

def _write_translations(cur, product_translations_to_upsert):
    if not product_translations_to_upsert:
        return
    t_db = time.time()
    upsert_translations_query = """
    INSERT INTO catalog.product_translations (
        product_id, language_code, title, short_description, description
    )
    VALUES %s
    ON CONFLICT (product_id, language_code) DO UPDATE SET
        title = EXCLUDED.title,
        short_description = EXCLUDED.short_description,
        description = EXCLUDED.description
    """
    execute_values_psycopg3(cur, upsert_translations_query, product_translations_to_upsert, page_size=2000)
    print(f"-> Bulk upserted {len(product_translations_to_upsert)} product translations (took {time.time() - t_db:.2f}s).")

def _write_variants(cur, products_to_upsert, variants_to_upsert, timings):
    t_db = time.time()
    processed_product_uuids = [p[0] for p in products_to_upsert.values()]
    if processed_product_uuids:
        cur.execute("SELECT product_id, source_variant_id FROM catalog.product_variants WHERE product_id = ANY(%s::uuid[])", (processed_product_uuids,))
        existing_variants = cur.fetchall()
        obsolete_variants = [(pid, svid) for pid, svid in existing_variants if (str(pid), svid) not in variants_to_upsert]
        if obsolete_variants:
            chunk_size = 500
            for i in range(0, len(obsolete_variants), chunk_size):
                chunk = obsolete_variants[i:i+chunk_size]
                placeholders = ", ".join(["(%s, %s)"] * len(chunk))
                flat_params = [val for pair in chunk for val in pair]
                cur.execute(f"DELETE FROM catalog.product_variants WHERE (product_id, source_variant_id) IN ({placeholders})", flat_params)
                
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
    execute_values_psycopg3(cur, upsert_vars_query, list(variants_to_upsert.values()), page_size=1000)
    timings["5. DB Variants Bulk Upsert"] = time.time() - t_db
    print(f"-> Bulk upserted variants successfully (took {timings['5. DB Variants Bulk Upsert']:.2f}s).")

def _sync_attribute_value_and_translations(cur, cached_attrs, cached_vals, attr_name, attr_value):
    attr_id = cached_attrs.get(attr_name)
    if not attr_id:
        attr_id = str(uuid.uuid4())
        cur.execute("INSERT INTO catalog.attributes (id, attribute_name) VALUES (%s, %s) ON CONFLICT (attribute_name) DO UPDATE SET attribute_name = EXCLUDED.attribute_name RETURNING id;", (attr_id, attr_name))
        attr_id = cur.fetchone()[0]
        cached_attrs[attr_name] = attr_id
        for lang in ["en", "pl", "ar", "ru", "de"]:
            t_name = translate_item(attr_name, lang)
            if t_name:
                cur.execute("INSERT INTO catalog.attribute_translations (attribute_id, language_code, attribute_name) VALUES (%s, %s, %s) ON CONFLICT (attribute_id, language_code) DO UPDATE SET attribute_name = EXCLUDED.attribute_name;", (attr_id, lang, t_name))
                
    val_id = cached_vals.get((attr_id, attr_value))
    if not val_id:
        val_id = str(uuid.uuid4())
        cur.execute("INSERT INTO catalog.attribute_values (id, attribute_id, attribute_value) VALUES (%s, %s, %s) ON CONFLICT (attribute_id, attribute_value) DO UPDATE SET attribute_value = EXCLUDED.attribute_value RETURNING id;", (val_id, attr_id, attr_value))
        val_id = cur.fetchone()[0]
        cached_vals[(attr_id, attr_value)] = val_id
        for lang in ["en", "pl", "ar", "ru", "de"]:
            t_val = translate_item(attr_value, lang)
            if t_val:
                cur.execute("INSERT INTO catalog.attribute_value_translations (attribute_value_id, language_code, attribute_value) VALUES (%s, %s, %s) ON CONFLICT (attribute_value_id, language_code) DO UPDATE SET attribute_value = EXCLUDED.attribute_value;", (val_id, lang, t_val))
    return val_id

def _write_attributes_and_images(cur, products_to_upsert, attributes_by_product, images_by_product, timings):
    processed_product_uuids = [p[0] for p in products_to_upsert.values()]
    if not processed_product_uuids:
        return
        
    cached_attrs = {name: aid for aid, name in cur.execute("SELECT id, attribute_name FROM catalog.attributes;").fetchall()}
    cached_vals = {(aid, val): vid for vid, aid, val in cur.execute("SELECT id, attribute_id, attribute_value FROM catalog.attribute_values;").fetchall()}
    
    t_del = time.time()
    cur.execute("DELETE FROM catalog.product_attributes_map WHERE product_id = ANY(%s::uuid[])", (processed_product_uuids,))
    cur.execute("DELETE FROM catalog.product_images WHERE product_id = ANY(%s::uuid[])", (processed_product_uuids,))
    timings["6. DB Relations Delete"] = time.time() - t_del
    
    mappings_insert_rows = []
    for p_uuid, attrs in attributes_by_product.items():
        for attr_name, attr_value in attrs.items():
            val_id = _sync_attribute_value_and_translations(cur, cached_attrs, cached_vals, attr_name, attr_value)
            mappings_insert_rows.append((str(uuid.uuid4()), p_uuid, val_id))
            
    images_insert_rows = []
    for p_uuid, imgs in images_by_product.items():
        for idx, (_, _, db_image_url) in enumerate(imgs):
            images_insert_rows.append((str(uuid.uuid4()), p_uuid, db_image_url, idx, idx == 0))
            
    if mappings_insert_rows:
        t_db = time.time()
        execute_values_psycopg3(cur, "INSERT INTO catalog.product_attributes_map (id, product_id, attribute_value_id) VALUES %s ON CONFLICT (product_id, attribute_value_id) DO NOTHING", mappings_insert_rows, page_size=2000)
        timings["7. DB Attributes Insert"] = time.time() - t_db
    if images_insert_rows:
        t_db = time.time()
        execute_values_psycopg3(cur, "INSERT INTO catalog.product_images (id, product_id, image_url, sort_order, is_cover) VALUES %s", images_insert_rows, page_size=2000)
        timings["9. DB Image Mappings Insert"] = time.time() - t_db

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
        if parsed_data["product_translations_to_upsert"]:
            _write_translations(cur, parsed_data["product_translations_to_upsert"])
        if parsed_data["variants_to_upsert"]:
            _write_variants(cur, parsed_data["products_to_upsert"], parsed_data["variants_to_upsert"], timings)
        _write_attributes_and_images(cur, parsed_data["products_to_upsert"], parsed_data["attributes_by_product"], parsed_data["images_by_product"], timings)
    conn.commit()
    print("All database batch records committed successfully!")

def _log_failed_images(failed_downloads, sync_run_id):
    if not failed_downloads:
        return
    import csv
    try:
        SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
        failed_csv_path = os.path.join(SCRIPT_DIR, "failed_images.csv")
        with open(failed_csv_path, "w", encoding="utf-8", newline="") as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(["Timestamp", "Sync Run ID", "Image URL", "Local Path", "Last Error"])
            for url, (path, last_error) in failed_downloads.items():
                writer.writerow([datetime.now().isoformat(), sync_run_id, url, path, last_error])
        print(f"\nWarning: {len(failed_downloads)} images could not be downloaded after 10 attempts.")
        print(f"Failed images logged to: {failed_csv_path}")
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to write failed_images.csv: {str(e)}\n")

def _finalize_sync(conn, pool, conn_ctx, sync_run_id, timings, sync_stats, start_total):
    print("Deactivating old products not seen in this sync run...")
    t_deact_start = time.time()
    with conn.cursor() as cur:
        cur.execute("UPDATE catalog.products SET is_active = false WHERE feed_id = %s AND last_sync_run_id != %s", (FEED_ID, sync_run_id))
        cur.execute("UPDATE catalog.product_variants SET is_active = false WHERE product_id IN (SELECT id FROM catalog.products WHERE feed_id = %s) AND last_sync_run_id != %s", (FEED_ID, sync_run_id))
    conn.commit()
    timings["11. Inactive Products Cleanup"] = time.time() - t_deact_start
    timings["Total Sync Duration"] = time.time() - start_total
    
    print("\n====================================================")
    print("SYNCHRONIZATION PERFORMANCE SUMMARY:")
    for step, duration in timings.items():
        print(f"- {step:30}: {duration:.4f} seconds")
    print("====================================================\n")
    sys.stdout.flush()
    
    update_sync_progress(conn, sync_run_id, "success", sync_stats["items_parsed"], sync_stats["items_added"], sync_stats["items_updated"], sync_stats["variants_aligned"], sync_stats["errors_skipped"], sync_stats["images_total"], sync_stats["images_downloaded"], timings)
    log_sync_timings(timings, sync_run_id, "success", sync_stats["items_parsed"], sync_stats["items_added"], sync_stats["items_updated"], sync_stats["variants_aligned"], sync_stats["errors_skipped"], sync_stats["images_total"], sync_stats["images_downloaded"])
    
    if os.path.exists(XML_TEMP_FILE):
        os.remove(XML_TEMP_FILE)
    cleanup_old_xml_files("janes")
    
    try:
        conn_ctx.__exit__(None, None, None)
    except Exception:
        pass
    pool.close()
    print("--- Janes Autonomous XML Sync Process Finished Successfully ---")

def run_parser():
    print(f"--- Janes Autonomous XML Sync Process Started ({datetime.now().isoformat()}) ---")
    timings = {}
    start_total = time.time()
    
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
        category_mapping = _load_category_mapping(conn)
        plus_size_mapping = _load_plus_size_mapping(conn)
        diger_category_id = _resolve_diger_category_id(conn)
        pareo_category_id = _resolve_pareo_category_id(conn)
        
        archived_file_path = _download_xml_feed(timings)
        if not archived_file_path:
            sys.stderr.write("Failed to download XML feed and no cached file was found.\n")
            update_sync_progress(conn, sync_run_id, "failed", 0, 0, 0, 0, 0, 0, 0)
            pool.close()
            sys.exit(1)
            
        caches = _load_in_memory_caches(conn, timings)
        meta_ctx = {
            "sync_run_id": sync_run_id,
            "brand_id": brand_id,
            "category_mapping": category_mapping,
            "plus_size_mapping": plus_size_mapping,
            "diger_category_id": diger_category_id,
            "pareo_category_id": pareo_category_id
        }
        
        parsed_data, sync_stats = _stream_parse_xml_feed(conn, pool, sync_run_id, meta_ctx, caches, timings)
        
        _bulk_write_batches(conn, parsed_data, timings)
        
        images_total = len(parsed_data["unique_downloads"])
        images_downloaded, failed_downloads, download_duration = asyncio.run(
            download_images_async(
                parsed_data["unique_downloads"], conn, pool, sync_run_id,
                sync_stats["items_parsed"], sync_stats["items_added"], sync_stats["items_updated"],
                sync_stats["variants_aligned"], sync_stats["errors_skipped"]
            )
        )
        timings["10. Image Downloads"] = download_duration
        _log_failed_images(failed_downloads, sync_run_id)
        
        sync_stats["images_total"] = images_total
        sync_stats["images_downloaded"] = images_downloaded
        
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
