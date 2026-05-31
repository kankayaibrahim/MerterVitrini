from lxml import etree as ET
import sys
import os
import ujson as json
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
PROFIT_RATE = 0.20

def sort_packing_ratio(ratio_str):
    if not ratio_str:
        return ratio_str
    
    standard_map = {
        "XS": 30, "S": 40, "M": 50, "L": 60, "XL": 70, 
        "XXL": 80, "2XL": 80, "XXXL": 90, "3XL": 90, 
        "XXXXL": 100, "4XL": 100, "5XL": 110, "6XL": 120,
        "7XL": 130, "8XL": 140, "STANDART": 500, "STANDARD": 500,
        "3XS": 10, "XXXS": 10, "2XS": 20, "XXS": 20
    }
    
    import re
    
    def parse_single_size_weight(s):
        s = s.strip().upper()
        if s in standard_map:
            return standard_map[s]
        if s.isdigit():
            return int(s)
        m = re.match(r'^([0-9]+)(XL|XXL|XXXL|XS|XXS|XXXS|L|M|S)$', s)
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

    def parse_range_weight(token):
        token = token.strip().upper()
        if token in standard_map:
            return standard_map[token]
        parts = re.split(r'[-/_]', token)
        if len(parts) == 2:
            part1, part2 = parts[0].strip(), parts[1].strip()
            if part1.isdigit() and part2.endswith('XL'):
                return min(parse_single_size_weight(part1 + 'XL'), parse_single_size_weight(part2))
            elif part1.isdigit() and part2.endswith('XS'):
                return min(parse_single_size_weight(part1 + 'XS'), parse_single_size_weight(part2))
            return min(parse_single_size_weight(part1), parse_single_size_weight(part2))
        return parse_single_size_weight(token)

    def size_sort_key(token):
        token = token.strip().upper()
        if not token:
            return (999, 999, token)
        if token.isdigit():
            return (0, int(token), token)
        if token in standard_map:
            return (1, standard_map[token], token)
        return (1, parse_range_weight(token), token)

    tokens = [t.strip() for t in ratio_str.split(',') if t.strip()]
    if not tokens:
        return ratio_str
    tokens.sort(key=size_sort_key)
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

FEED_ID = "etika"
FEED_URL = "https://etikafashion.com/xml/products/merchant/952"
XML_TEMP_FILE = "etika_xml.xml"

# Hardcoded Category Mapping (XML path -> target database category slug path)
CATEGORY_MAPPING = {
    "CROP": "kadin-giyim/ust-giyim/crop",
    "Etek": "kadin-giyim/alt-giyim/etek",
    "Denim": "kadin-giyim/alt-giyim/pantolon",
    "Elegant": "kadin-giyim/diger",
    "Vintage": "kadin-giyim/diger",
    "KOT TRENC": "kadin-giyim/dis-giyim/trenckot",
    "Takımlar": "kadin-giyim/takim-tulum/ikili-takim",
    "BLUZ FIRFIRLI": "kadin-giyim/ust-giyim/bluz",
    "TULUM AYROBİN": "kadin-giyim/takim-tulum/tulum-salopet",
    "Siyah Beyaz Aşkı": "kadin-giyim/diger",
    "BÜSTİYER GÜPELİ": "kadin-giyim/ust-giyim/bustiyer",
    "BÜSTİYER GİPELİ": "kadin-giyim/ust-giyim/bustiyer",
    "Ceket > MINI ELBİSE": "kadin-giyim/elbise-abiye/elbise",
    "TAKIM > MIDI ELBİSE": "kadin-giyim/takim-tulum/ikili-takim",
    "Tulum > MINI ELBİSE": "kadin-giyim/takim-tulum/tulum-salopet",
    "YILBAŞI KOLEKSİYONU": "kadin-giyim/diger",
    "Ceket > MİDİ ELBİSE": "kadin-giyim/elbise-abiye/elbise",
    "ELBİSE > MIDI ELBİSE": "kadin-giyim/elbise-abiye/elbise",
    "ELBİSE > MINI ELBİSE": "kadin-giyim/elbise-abiye/elbise",
    "KOT ETEK > MIDI ELBİSE": "kadin-giyim/alt-giyim/etek",
    "KOT TULUM > MİDİ ELBİSE": "kadin-giyim/takim-tulum/tulum-salopet",
    "TRİKO TAKIM > MİDİ ELBİSE": "kadin-giyim/takim-tulum/ikili-takim",
    "Elbiseler > Midi Boy Elbiseler": "kadin-giyim/elbise-abiye/elbise",
    "Elbiseler > Mini Boy Elbiseler": "kadin-giyim/elbise-abiye/elbise"
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
    "Saks Mavi", "Sütlü Kahve", "Zümrüt Yeşili", "Zümrüt", "Siyah", "Beyaz", "Gri", "Ekru", "Pembe", "Saks",
    "Fuşya", "Turuncu", "Yeşil", "Lila", "Mavi", "Mor", "Haki", "Bej", "Bordo",
    "Kırmızı", "Sarı", "Turkuaz", "Kahve", "Gold", "Silver", "Lame", "Antrasit", "Hardal"
]

FABRIC_KEYWORDS = ["Polyester", "Pamuk", "Keten", "Viskon", "Denim", "Saten", "Likra", "Akrilik", "Kadife", "Deri", "Şifon", "Triko", "İthal", "Aerobin", "Atlas"]

# Safe .env loader function
def load_env():
    search_dirs = [
        os.path.dirname(os.path.abspath(__file__)),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", ".."),
    ]
    for d in search_dirs:
        env_path = os.path.join(d, ".env")
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        parts = line.split("=", 1)
                        if len(parts) == 2:
                            key, val = parts[0].strip(), parts[1].strip()
                            if val.startswith('"') and val.endswith('"'):
                                val = val[1:-1]
                            elif val.startswith("'") and val.endswith("'"):
                                val = val[1:-1]
                            os.environ[key] = val
                break
            except Exception as e:
                sys.stderr.write(f"Warning: Failed to load .env from {env_path}: {e}\n")

# Load environment settings from .env
load_env()

# Database Settings with Env Fallbacks
DB_HOST = os.environ.get("DB_HOST", "localhost")
try:
    DB_PORT = int(os.environ.get("DB_PORT", 5432))
except:
    DB_PORT = 5432
DB_USER = os.environ.get("DB_USER", "postgres")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "DHMwK0Qzyox7")
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
        "i̇": "i", "ö": "o", "ü": "u", "ş": "s", "ğ": "g", "ç": "c"
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

def turkish_title(text):
    if not text:
        return ""
    words = text.strip().split()
    title_words = []
    for w in words:
        if not w:
            continue
        first = w[0]
        rest = w[1:]
        
        # Upper first
        first_upper = first.upper()
        if first == 'i':
            first_upper = 'İ'
        elif first == 'ı':
            first_upper = 'I'
            
        # Lower rest
        rest_lower = []
        for c in rest:
            if c == 'İ':
                rest_lower.append('i')
            elif c == 'I':
                rest_lower.append('ı')
            elif c == 'Ş':
                rest_lower.append('ş')
            elif c == 'Ç':
                rest_lower.append('ç')
            elif c == 'Ğ':
                rest_lower.append('ğ')
            elif c == 'Ü':
                rest_lower.append('ü')
            elif c == 'Ö':
                rest_lower.append('ö')
            else:
                rest_lower.append(c.lower())
                
        title_words.append(first_upper + "".join(rest_lower))
    return " ".join(title_words)

SPECIAL_MAPPINGS = {
    "oranj": "Turuncu",
    "sax": "Saks",
    "cicekli": "Çiçekli",
    "cıceklı": "Çiçekli",
    "desenli": "Desenli",
    "desenlı": "Desenli",
    "ek desen": "Çiçek Desen",
    "ek desen mavi": "Çiçek Desen Mavi",
    "ek desen pembe": "Çiçek Desen Pembe",
    "ek desen yeşil": "Çiçek Desen Yeşil",
    "ek d. mavi": "Çiçek Desen Mavi",
    "ek d. sarı": "Çiçek Desen Sarı",
    "çiçek desen": "Çiçek Desen",
    "çiçek desen mavi": "Çiçek Desen Mavi",
    "çiçek desen pembe": "Çiçek Desen Pembe",
    "çiçek desen yeşil": "Çiçek Desen Yeşil",
    "çiçek d. mavi": "Çiçek Desen Mavi",
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
    "altın": "Altın",
    "camel": "Camel",
    "gold": "Altın",
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
    "dalgiç": "Dalgıç",
    "dalgic": "Dalgıç",
    "dalgiç-": "Dalgıç",
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
    "modal baskialti": "Modal Baskılı",
    "modal baskıaltı": "Modal Baskılı",
    "modal baskılı": "Modal Baskılı",
    "modal baskili": "Modal Baskılı",
    "dijital": "Dijital Baskılı",
    "dijital baskılı": "Dijital Baskılı",
    "dijital baskili": "Dijital Baskılı",
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

def clean_title(title_text, group_id):
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
    match = re.search(r'Kuma[şs]\s+Bilgisi\s*:\s*([^<\n\r·•\s\:\,]+)', text, re.IGNORECASE)
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

def clean_html_to_plain_text(html_content):
    if not html_content:
        return ""
    import html
    # Unescape HTML entities first
    raw_html = html.unescape(html_content)
    soup = BeautifulSoup(raw_html, "html.parser")
    
    # Strip style and script
    for s in soup(["style", "script"]):
        s.decompose()
        
    lines = []
    
    def process_element(elem):
        if not elem:
            return
        if elem.name == 'table':
            # Process rows belonging directly to this table
            rows = [tr for tr in elem.find_all('tr') if tr.find_parent('table') == elem]
            for row in rows:
                # Process cells belonging directly to this row
                cells = row.find_all(['td', 'th'], recursive=False)
                cell_texts = []
                for cell in cells:
                    # Check if cell has nested tables
                    nested_tables = cell.find_all('table')
                    if nested_tables:
                        # Process nested table or standard text first
                        nested_clones = []
                        for nt in nested_tables:
                            nested_clones.append(nt.extract())
                        
                        # Process own text of the cell
                        cell_text = clean_text(cell.get_text())
                        if cell_text:
                            cell_texts.append(cell_text)
                            
                        # Now process nested tables separately
                        for nt in nested_clones:
                            process_element(nt)
                    else:
                        cell_text = clean_text(cell.get_text())
                        if cell_text:
                            cell_texts.append(cell_text)
                if cell_texts:
                    lines.append(" - ".join(cell_texts))
        elif elem.name in ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li']:
            text = clean_text(elem.get_text())
            if text:
                lines.append(text)
        else:
            # Process children
            for child in elem.children:
                if child.name:
                    process_element(child)
                else:
                    text = clean_text(str(child))
                    if text:
                        lines.append(text)
                        
    def clean_text(text):
        if not text:
            return ""
        # Remove multiple whitespaces, bullets, etc.
        text = text.replace('\xa0', ' ')
        text = re.sub(r'\s+', ' ', text)
        text = text.strip(" ·•\t\n\r:")
        return text

    # Let's process the whole soup
    if soup.find('table'):
        process_element(soup.find('table'))
    else:
        for child in soup.children:
            if child.name:
                process_element(child)
            else:
                text = clean_text(str(child))
                if text:
                    lines.append(text)
                    
    final_lines = []
    seen = set()
    for line in lines:
        line_clean = line.strip(" -|·•")
        if not line_clean:
            continue
        
        # Skip size chart header completely
        if "ÖLÇÜ" in line_clean and "BEDEN" in line_clean:
            continue
            
        # Skip size chart rows: e.g. "S - 36 - 84-89 - 91-96"
        if " - " in line_clean:
            parts = [p.strip() for p in line_clean.split(" - ")]
            if len(parts) == 4 and any(s_val in parts[0] for s_val in ['S', 'M', 'L', 'XL', 'XXL', '36', '38', '40', '42']):
                continue
        
        # Avoid duplicate labels
        if line_clean in seen and len(line_clean) < 10:
            continue
        seen.add(line_clean)
        
        # Format bullet point
        if any(keyword in line_clean for keyword in ["Kumaş Bilgisi", "Ölçüleri", "Boy", "Göğüs", "Bel", "Kalça", "Beden", "Numune Beden"]):
            if ":" in line_clean:
                parts = line_clean.split(":", 1)
                final_lines.append(f"• {parts[0].strip()}: {parts[1].strip()}")
            else:
                final_lines.append(f"• {line_clean}")
        else:
            if " - " in line_clean:
                parts = [p.strip() for p in line_clean.split(" - ")]
                final_lines.append(f"• {line_clean}")
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
        webp_path = path.replace(".jpg", ".webp")
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

async def download_images_async(unique_downloads, conn, pool, sync_run_id, items_parsed, items_added, items_updated, variants_aligned, errors_skipped):
    print("Extracting unique images for parallel downloads...")
    t_download_start = time.time()
    print(f"Found {len(unique_downloads)} unique images to download.")
    images_total = len(unique_downloads)
    images_downloaded = 0
    
    # Clean up any leftover .jpg files in the parent directory from previous aborted runs
    if os.path.exists(IMAGE_UPLOAD_DIR):
        print(f"Cleaning up any leftover JPG files in parent directory: {IMAGE_UPLOAD_DIR}...")
        sys.stdout.flush()
        try:
            cleaned_count = 0
            for f in os.listdir(IMAGE_UPLOAD_DIR):
                if f.lower().endswith(('.jpg', '.jpeg')):
                    f_path = os.path.join(IMAGE_UPLOAD_DIR, f)
                    if os.path.isfile(f_path):
                        os.remove(f_path)
                        cleaned_count += 1
            if cleaned_count > 0:
                print(f"Successfully cleaned up {cleaned_count} leftover JPG files from previous runs!")
                sys.stdout.flush()
        except Exception as cleanup_err:
            sys.stderr.write(f"Warning: Failed to clean up leftover JPGs: {cleanup_err}\n")
            sys.stderr.flush()

    
    update_sync_progress(conn, sync_run_id, "running", items_parsed, items_added, items_updated, variants_aligned, errors_skipped, images_total, 0)
    
    pending_downloads = {}
    skipped_updates = []
    
    for path, meta in unique_downloads.items():
        url = meta["url"]
        webp_path = path.replace(".jpg", ".webp")
        db_image_url = f"{DB_IMAGE_PREFIX}/{os.path.basename(webp_path)}"
        
        if os.path.exists(webp_path):
            images_downloaded += 1
            try:
                webp_size = os.path.getsize(webp_path)
                skipped_updates.append((webp_size, webp_size, db_image_url))
            except:
                pass
        elif os.path.exists(path):
            pending_downloads[url] = (path, meta)
        else:
            pending_downloads[url] = (path, meta)
            
    if images_downloaded > 0:
        update_sync_progress(conn, sync_run_id, "running", items_parsed, items_added, items_updated, variants_aligned, errors_skipped, images_total, images_downloaded)
        pct = (images_downloaded * 100 // images_total) if images_total > 0 else 0
        print(f"-> Already existing images skipped: {images_downloaded}/{images_total} ({pct}%)")
        sys.stdout.flush()
        
    if skipped_updates:
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
            
    failed_downloads = {}
    
    if pending_downloads:
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
                    print(format_progress_string(images_downloaded, images_total, t_download_start))
                    sys.stdout.flush()
                    update_sync_progress(conn, sync_run_id, "running", items_parsed, items_added, items_updated, variants_aligned, errors_skipped, images_total, images_downloaded)

    # Retry Pipeline
    MAX_RETRIES = 5
    for attempt in range(1, MAX_RETRIES + 1):
        if not failed_downloads:
            break
            
        print(f"\n--- Retrying {len(failed_downloads)} failed image downloads asynchronously (Attempt {attempt}/{MAX_RETRIES}) ---")
        sys.stdout.flush()
        
        await asyncio.sleep(2)
        
        current_retry_tasks = list(failed_downloads.items())
        failed_downloads = {}
        
        sem = asyncio.Semaphore(10)
        async with aiohttp.ClientSession() as session:
            tasks = []
            for url, (path, meta, _) in current_retry_tasks:
                webp_path = path.replace(".jpg", ".webp")
                if os.path.exists(path) or os.path.exists(webp_path):
                    images_downloaded += 1
                else:
                    tasks.append(asyncio.create_task(download_image_task_wrapper(sem, session, url, path, meta, pool)))
                    
            if tasks:
                last_print_time = time.time()
                for completed_fut in asyncio.as_completed(tasks):
                    url, path, success, err_msg = await completed_fut
                    meta_found = None
                    for u, (p, m, _) in current_retry_tasks:
                        if u == url:
                            meta_found = m
                            break
                    if success:
                        images_downloaded += 1
                    else:
                        failed_downloads[url] = (path, meta_found, err_msg)
                        
                    curr_time = time.time()
                    if images_downloaded > 0 and (curr_time - last_print_time >= 1.5 or images_downloaded == images_total):
                        last_print_time = curr_time
                        print(format_progress_string(images_downloaded, images_total, t_download_start))
                        sys.stdout.flush()
                        update_sync_progress(conn, sync_run_id, "running", items_parsed, items_added, items_updated, variants_aligned, errors_skipped, images_total, images_downloaded)
                    
    # Final cleanup of any temporary copied .jpg files in the parent directory
    if os.path.exists(IMAGE_UPLOAD_DIR):
        try:
            for f in os.listdir(IMAGE_UPLOAD_DIR):
                if f.lower().endswith(('.jpg', '.jpeg')):
                    f_path = os.path.join(IMAGE_UPLOAD_DIR, f)
                    if os.path.isfile(f_path):
                        os.remove(f_path)
        except Exception as cleanup_err:
            sys.stderr.write(f"Warning: Failed to perform final JPG cleanup: {cleanup_err}\n")
            sys.stderr.flush()
            
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
        SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
        stats_file_path = os.path.join(SCRIPT_DIR, "sync_stats.txt")
        
        with open(stats_file_path, "w", encoding="utf-8") as f:
            f.write("====================================================\n")
            f.write(f"ETIKA AUTONOMOUS SYNC PERFORMANCE STATS\n")
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

def run_parser():
    print(f"--- Etika Autonomous XML Sync Started ({datetime.now().isoformat()}) ---")
    timings = {}
    start_total = time.time()
    
    # Load manually curated banned images blocklist
    yasakli_gorseller = load_yasakli_gorseller()
    if yasakli_gorseller:
        print(f"Loaded {len(yasakli_gorseller)} manually curated banned image filename(s) from banned_images.txt.")
        sys.stdout.flush()
    
    # 1. Database connection pool initialization
    conninfo = f"host={DB_HOST} port={DB_PORT} user={DB_USER} password={DB_PASSWORD} dbname={DB_NAME}"
    pool = ConnectionPool(conninfo=conninfo, min_size=1, max_size=2)
    try:
        conn_ctx = pool.connection()
        conn = conn_ctx.__enter__()
    except Exception as e:
        sys.stderr.write(f"Database connection failed: {str(e)}\n")
        pool.close()
        sys.exit(1)
        
    # 2. Get or Create sync_run_id
    sync_run_id = None
    try:
        import argparse
        parser = argparse.ArgumentParser()
        parser.add_argument('--sync-run-id', type=str, default=None)
        parser.add_argument('--production', action='store_true')
        args, unknown = parser.parse_known_args()
        if args.sync_run_id:
            sync_run_id = args.sync_run_id
            print(f"Sync run ID passed via CLI: {sync_run_id}")
    except:
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
                
    # 2.5 Resolve BRAND_ID dynamically from DB for FLORA
    BRAND_ID = None
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT brand_id FROM integration.xml_feeds WHERE id = %s", (FEED_ID,))
            row = cur.fetchone()
            if row and row[0]:
                BRAND_ID = row[0]
            else:
                cur.execute("SELECT id FROM catalog.brands WHERE alias_code = 'FLORA'")
                row = cur.fetchone()
                if row and row[0]:
                    BRAND_ID = row[0]
                    
        if not BRAND_ID:
            raise ValueError("Critical Error: 'FLORA' alias_code is not registered in catalog.brands. Please check DB seed!")
        print(f"Resolved Brand ID dynamically: {BRAND_ID}")
    except Exception as e:
        sys.stderr.write(f"Error: Failed to dynamically query Brand ID: {str(e)}\n")
        raise e

    # 3. Load category mapping (hardcoded inside CATEGORY_MAPPING at the top of this file)
    pass

    # 3.4 Load plus-size category equivalents mapping: standard_id -> buyuk_beden_id
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

    # 3.5 Resolve and cache 'Diğer' category ID at startup
    diger_category_id = None
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM catalog.categories WHERE title = 'Diğer' OR slug = 'diger' LIMIT 1")
            row = cur.fetchone()
            if row:
                diger_category_id = str(row[0])
        if not diger_category_id:
            raise ValueError("Critical Error: 'diger' category slug is not registered in catalog.categories. Please check DB seed!")
    except Exception as e:
        sys.stderr.write(f"Error: Failed to resolve 'Diğer' category: {str(e)}\n")
        raise e

    # 4. Download XML Feed and archive it for 3 months
    timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    xml_history_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downloads", "xml_history")
    os.makedirs(xml_history_dir, exist_ok=True)
    
    archived_file_path = os.path.join(xml_history_dir, f"etika-{timestamp}.xml")
    
    print(f"Downloading XML Feed from: {FEED_URL}")
    t_start = time.time()
    download_success = False
    try:
        req = urllib.request.Request(FEED_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=60) as response:
            with open(archived_file_path, 'wb') as temp_file:
                temp_file.write(response.read())
        timings["1. Feed Download"] = time.time() - t_start
        print(f"Successfully downloaded and archived feed to: {archived_file_path} (took {timings['1. Feed Download']:.2f}s)")
        download_success = True
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to download XML feed from network: {str(e)}\n")
        # Local fallback if feed exists in workspace
        fallback_paths = [
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "xmller", "ETIKA_XML.xml"),
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "ETIKA_XML.xml"),
            "ETIKA_XML.xml",
            r"c:\Projects\mertervitrini.com.tr\docs\xmller\ETIKA_XML.xml"
        ]
        for path in fallback_paths:
            if os.path.exists(path):
                print(f"Using cached local XML feed file from: {path}")
                import shutil
                shutil.copy(path, archived_file_path)
                download_success = True
                break
                
    if not download_success:
        sys.stderr.write("Critical Error: XML feed file could not be retrieved.\n")
        update_sync_progress(conn, sync_run_id, "failed", 0, 0, 0, 0, 0, 0, 0)
        pool.close()
        sys.exit(1)

    # Copy the archived file to the standard XML_TEMP_FILE path for processing
    import shutil
    shutil.copy(archived_file_path, XML_TEMP_FILE)

    # 4.5 Load existing DB caches to prevent duplicate SQL writes
    print("Loading in-memory database caches for products, variants, colors, and fabrics...")
    t_start = time.time()
    products_cache = {} # source_product_id -> (product_uuid, slug)
    variants_cache = {} # (product_uuid, source_variant_id) -> variant_uuid
    colors_cache = {} # name -> color_uuid
    fabrics_cache = {} # name -> fabric_uuid
    category_path_to_id = {} # full_path -> category_uuid
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, color_name FROM catalog.colors")
            for cid, name in cur.fetchall():
                colors_cache[name] = cid

            cur.execute("SELECT id, fabric_name FROM catalog.fabrics")
            for fid, name in cur.fetchall():
                fabrics_cache[name] = fid

            cur.execute("SELECT id, parent_id, slug FROM catalog.categories")
            cats = cur.fetchall()
            cat_map = {cid: (pid, slug) for cid, pid, slug in cats}
            
            def get_full_path(cid):
                pid, slug = cat_map[cid]
                if pid and pid in cat_map:
                    return get_full_path(pid) + "/" + slug
                return slug
                
            for cid in cat_map:
                full_path = get_full_path(cid)
                category_path_to_id[full_path] = cid

            cur.execute("SELECT id, source_product_id, slug FROM catalog.products WHERE feed_id = %s", (FEED_ID,))
            for pid, source_pid, slug in cur.fetchall():
                products_cache[source_pid] = (pid, slug)
                
            cur.execute(
                """
                SELECT id, product_id, source_variant_id 
                FROM catalog.product_variants 
                WHERE product_id IN (SELECT id FROM catalog.products WHERE feed_id = %s)
                """,
                (FEED_ID,)
            )
            for vid, pid, source_vid in cur.fetchall():
                variants_cache[(pid, source_vid)] = vid
        timings["2. Cache Loading"] = time.time() - t_start
        print(f"Loaded {len(products_cache)} products, {len(variants_cache)} variants, {len(colors_cache)} colors, and {len(fabrics_cache)} fabrics (took {timings['2. Cache Loading']:.2f}s).")
    except Exception as e:
        sys.stderr.write(f"Warning: Failed to load in-memory caches: {str(e)}\n")

    # 5. Parse XML in memory using memory-efficient streaming
    print("Streaming XML products in memory...")
    t_start = time.time()
    
    items_parsed = 0
    items_added = 0
    items_updated = 0
    variants_aligned = 0
    errors_skipped = 0
    
    products_to_upsert = {}
    variants_to_upsert = {}
    colors_to_upsert = {}
    fabrics_to_upsert = {}
    product_translations_to_upsert = []
    attributes_by_product = {}
    images_by_product = {}
    unique_downloads = {}
    
    os.makedirs(IMAGE_UPLOAD_DIR, exist_ok=True)
    
    try:
        context = ET.iterparse(XML_TEMP_FILE, events=('end',))
        for event, elem in context:
            if elem.tag == 'product':
                try:
                    product_id = elem.findtext('id')
                    sku = elem.findtext('sku')
                    ean = elem.findtext('ean')
                    mpn = elem.findtext('mpn')
                    category_path_xml = elem.findtext('categoryPath')
                    title_raw = elem.findtext('title')
                    detail_raw = elem.findtext('detail')
                    detail_cleaned = clean_html_to_plain_text(detail_raw)
                    stock_str = elem.findtext('stock')
                    gender_xml = elem.findtext('gender')
                    sale_price_str = elem.findtext('salePrice')
                    cost_price_str = elem.findtext('costPrice')
                    tax_str = elem.findtext('tax')
                    desi_str = elem.findtext('desi')
                    
                    if not product_id or not title_raw:
                        errors_skipped += 1
                        elem.clear()
                        continue
                        
                    # Skip Gift Cards or non-apparel place holders
                    title_raw_lower = title_raw.lower()
                    if "hediye kart" in title_raw_lower or "gift card" in title_raw_lower:
                        elem.clear()
                        continue
                        
                    # Clean title
                    title_tr_cleaned = clean_title(title_raw, product_id)
                    
                    # Gender Resolution
                    gender = "Kadın" # Default for Etika feed
                    if gender_xml and gender_xml.strip().upper() == 'M':
                        gender = "Erkek"
                    if "erkek" in title_raw.lower():
                        gender = "Erkek"
                        
                    # Color Extraction from specs or fallback to SKU/title
                    v_color = "Standart"
                    specs_node = elem.find('specs')
                    if specs_node is not None:
                        for spec in specs_node.findall('spec'):
                            label = spec.findtext('label')
                            if label and label.strip().lower() == 'renk':
                                val = spec.findtext('value')
                                if val:
                                    v_color = val.strip()
                                    break
                    if v_color == "Standart" and sku and '-' in sku:
                        v_color = sku.split('-', 1)[1].strip()
                        
                    # Title-based color fallback
                    if v_color == "Standart":
                        for c in COLORS_LIST:
                            if re.search(rf"(?i)\b{c}\b", title_raw):
                                v_color = c
                                break
                                
                    v_color = standardize_color(v_color)
                    if v_color not in colors_cache:
                        color_uuid = str(uuid.uuid4())
                        colors_cache[v_color] = color_uuid
                        colors_to_upsert[v_color] = color_uuid
                    color_uuid = colors_cache[v_color]
                    
                    # Fabric Extraction from detail HTML using regex and BS4
                    v_fabric = extract_fabric_from_detail(detail_raw)
                    v_fabric = standardize_fabric(v_fabric)
                    if v_fabric not in fabrics_cache:
                        fabric_uuid = str(uuid.uuid4())
                        fabrics_cache[v_fabric] = fabric_uuid
                        fabrics_to_upsert[v_fabric] = fabric_uuid
                    fabric_uuid = fabrics_cache[v_fabric]
                    
                    # Category Path Resolution with critical halt on unmapped values
                    if not category_path_xml:
                        category_path_xml = ""
                    category_path_xml = category_path_xml.strip()
                    
                    if category_path_xml not in CATEGORY_MAPPING:
                        error_msg = f"Kritik Hata: XML içerisinde eşleşmeyen kategori yolu bulundu: '{category_path_xml}' (Ürün ID: {product_id}). Lütfen bu kategoriyi etika.py içerisindeki CATEGORY_MAPPING sözlüğüne ekleyin!"
                        sys.stderr.write(error_msg + "\n")
                        sys.stderr.flush()
                        update_sync_progress(conn, sync_run_id, "failed", items_parsed, items_added, items_updated, variants_aligned, errors_skipped, 0, 0, error_msg=error_msg)
                        pool.close()
                        sys.exit(error_msg)
                        
                    category_path = CATEGORY_MAPPING[category_path_xml]
                    
                    # Dynamic title-based category self-correction / override
                    title_lower = title_tr_cleaned.lower()
                    if "elbise" in title_lower:
                        category_path = "kadin-giyim/elbise-abiye/elbise"
                    elif "takım" in title_lower or "takim" in title_lower:
                        category_path = "kadin-giyim/takim-tulum/ikili-takim"
                    elif "tulum" in title_lower:
                        category_path = "kadin-giyim/takim-tulum/tulum-salopet"
                        
                    category_id = category_path_to_id.get(category_path, diger_category_id)
                    
                    # Auto redirect to plus-size category hierarchy if product size is XL or above
                    if category_id and is_xl_or_above("S,M,L"):
                        if category_id in plus_size_mapping:
                            category_id = plus_size_mapping[category_id]
                        elif "buyuk-beden-root" in plus_size_mapping:
                            category_id = plus_size_mapping["buyuk-beden-root"]
                    
                    # Parse Pricing
                    def parse_price(val_str):
                        if not val_str:
                            return 0.0
                        cleaned_num = re.sub(r'[^\d.]', '', val_str.replace(',', '.'))
                        try:
                            return float(cleaned_num)
                        except:
                            return 0.0
                            
                    buying_price = parse_price(sale_price_str)
                    if buying_price <= 0.0:
                        buying_price = parse_price(cost_price_str)
                        
                    # Skip products whose price is 0 (or negative)
                    if buying_price <= 0.0:
                        errors_skipped += 1
                        if errors_skipped <= 10:
                            print(f"Warning: Skipping product {product_id} ('{title_raw}') due to 0 salePrice/costPrice.")
                        elem.clear()
                        continue
                        
                    v_price = buying_price * (1 + PROFIT_RATE)
                    v_single_price = None
                    v_disc_price = v_price
                    v_currency = "TRY"
                    
                    # VAT Tax rate
                    v_tax = 10.0
                    if tax_str:
                        try:
                            v_tax = float(tax_str)
                        except:
                            pass
                            
                    # Desi
                    desi_val = "1"
                    if desi_str:
                        desi_val = str(desi_str).strip()
                        
                    shipping_weight_kg = 0.35
                    
                    # Resolve product uuid
                    if product_id in products_cache:
                        product_uuid, product_slug = products_cache[product_id]
                        items_updated += 1
                    else:
                        product_uuid = str(uuid.uuid4())
                        product_slug = slugify(title_tr_cleaned)
                        products_cache[product_id] = (product_uuid, product_slug)
                        items_added += 1
                        
                    # Attributes Map
                    prod_attributes = {
                        "Cinsiyet": gender,
                        "Kumaş Tipi": v_fabric,
                        "Renk": v_color
                    }
                    attributes_by_product[product_uuid] = prod_attributes
                    
                    # Extract images
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
                                
                    images_by_product[product_uuid] = []
                    for idx, img_url in enumerate(all_img_urls):
                        hash_prefix = hashlib.sha256(img_url.encode('utf-8')).hexdigest()[:16]
                        local_filename_jpg = f"flora-{hash_prefix}.jpg"
                        local_filename_webp = f"flora-{hash_prefix}.webp"
                        local_file_path = os.path.join(IMAGE_UPLOAD_DIR, local_filename_jpg)
                        db_image_url = f"{DB_IMAGE_PREFIX}/{local_filename_webp}"
                        
                        images_by_product[product_uuid].append((img_url, local_file_path, db_image_url))
                        
                        tags_list = ["FLORA", v_color, v_fabric]
                        tags_str = "; ".join([t for t in tags_list if t])
                        
                        unique_downloads[local_file_path] = {
                            "url": img_url,
                            "title": title_tr_cleaned,
                            "subject": category_path_xml or "Giyim",
                            "tags": tags_str,
                            "description": detail_cleaned or title_tr_cleaned,
                            "brand": "Etika Fashion"
                        }
                        
                    # Dynamic sizes S, M, L generation
                    total_stock = 99
                    if stock_str:
                        try:
                            total_stock = int(stock_str)
                        except:
                            pass
                            
                    for size_name in ['S', 'M', 'L']:
                        # 1. Series Pack Variant (is_single = False)
                        source_variant_id = f"{product_id}-{size_name.lower()}"
                        if (product_uuid, source_variant_id) in variants_cache:
                            variant_uuid = variants_cache[(product_uuid, source_variant_id)]
                        else:
                            variant_uuid = str(uuid.uuid4())
                            variants_cache[(product_uuid, source_variant_id)] = variant_uuid
                            
                        var_gtin = f"{ean}-{size_name}" if ean else f"{sku}-{size_name}"
                        variants_to_upsert[(product_uuid, source_variant_id)] = (
                            variant_uuid, product_uuid, size_name, var_gtin,
                            total_stock, False, source_variant_id, sync_run_id, True
                        )
                        variants_aligned += 1
                        
                        
                    meta_attr_val = json.dumps({"original_brand": "Etika Fashion"})
                    sku_val = f"FL-{sku}" if sku else f"FL-{product_id}"
                    barcode_val = ean if ean else product_id
                    
                    products_to_upsert[product_id] = (
                        product_uuid, FEED_ID, product_id, mpn if mpn else product_id, title_tr_cleaned, product_slug,
                        category_id, gender, sync_run_id, True, BRAND_ID,
                        "2-2-2", "S,M,L", shipping_weight_kg, 6, "Tüm Sezonlar",
                        buying_price, v_price, v_single_price, v_disc_price, v_currency, v_tax, total_stock, sku_val, barcode_val,
                        "", detail_cleaned, meta_attr_val, f"https://etikafashion.com/search?q={product_id}",
                        color_uuid, fabric_uuid
                    )

                    
                    items_parsed += 1
                    
                except Exception as node_err:
                    errors_skipped += 1
                    if errors_skipped <= 10:
                        sys.stderr.write(f"Warning: Failed to parse product {product_id if 'product_id' in locals() else 'unknown'}: {node_err}\n")
                
                elem.clear()
                while elem.getprevious() is not None:
                    del elem.getparent()[0]
                    
                if items_parsed % 200 == 0:
                    print(f"-> Parsed {items_parsed} products... (Added: {items_added}, Updated: {items_updated}, Errors: {errors_skipped})")
                    sys.stdout.flush()
                    
    except Exception as parse_err:
        sys.stderr.write(f"Parser critical error during streaming parse: {parse_err}\n")
        update_sync_progress(conn, sync_run_id, "failed", 0, 0, 0, 0, 0, 0, 0)
        pool.close()
        sys.exit(1)
        
    timings["3. XML Streaming Parsing"] = time.time() - t_start
    print(f"Parsed {items_parsed} products into memory in {timings['3. XML Streaming Parsing']:.2f}s.")
    
    # 6. Bulk DB write transaction
    print(f"Writing collected batches to database (Products: {len(products_to_upsert)}, Variants: {len(variants_to_upsert)})...")
    sys.stdout.flush()
    
    try:
        with conn.cursor() as cur:
            # A. Colors Bulk Write
            if colors_to_upsert:
                t_db_start = time.time()
                colors_insert_rows = []
                color_trans_insert_rows = []
                for name, cid in colors_to_upsert.items():
                    colors_insert_rows.append((cid, name))
                    for lang in ["en", "pl", "bg", "ar", "ru", "de"]:
                        colors_trans_name = translate_color(name, lang)
                        color_trans_insert_rows.append((cid, lang, colors_trans_name))
                        
                execute_values_psycopg3(cur, "INSERT INTO catalog.colors (id, color_name) VALUES %s ON CONFLICT (color_name) DO NOTHING", colors_insert_rows)
                execute_values_psycopg3(cur, "INSERT INTO catalog.color_translations (color_id, language_code, color_name) VALUES %s ON CONFLICT (color_id, language_code) DO NOTHING", color_trans_insert_rows)
                print(f"-> Bulk upserted {len(colors_insert_rows)} colors in {time.time() - t_db_start:.2f}s.")
                
            # B. Fabrics Bulk Write
            if fabrics_to_upsert:
                t_db_start = time.time()
                fabrics_insert_rows = []
                fabric_trans_insert_rows = []
                for name, fid in fabrics_to_upsert.items():
                    fabrics_insert_rows.append((fid, name))
                    for lang in ["en", "pl", "bg", "ar", "ru", "de"]:
                        fabrics_trans_name = translate_fabric(name, lang)
                        fabric_trans_insert_rows.append((fid, lang, fabrics_trans_name))
                        
                execute_values_psycopg3(cur, "INSERT INTO catalog.fabrics (id, fabric_name) VALUES %s ON CONFLICT (fabric_name) DO NOTHING", fabrics_insert_rows)
                execute_values_psycopg3(cur, "INSERT INTO catalog.fabric_translations (fabric_id, language_code, fabric_name) VALUES %s ON CONFLICT (fabric_id, language_code) DO NOTHING", fabric_trans_insert_rows)
                print(f"-> Bulk upserted {len(fabrics_insert_rows)} fabrics in {time.time() - t_db_start:.2f}s.")
                
            # C. Products Bulk Write
            if products_to_upsert:
                t_db_start = time.time()
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
                timings["5. DB Products Upsert"] = time.time() - t_db_start
                print(f"-> Bulk upserted products successfully in {timings['5. DB Products Upsert']:.2f}s.")
                
            # D. Product Translations Bulk Write
            if product_translations_to_upsert:
                t_db_start = time.time()
                upsert_trans_query = """
                INSERT INTO catalog.product_translations (product_id, language_code, title, short_description, description)
                VALUES %s
                ON CONFLICT (product_id, language_code) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description
                """
                execute_values_psycopg3(cur, upsert_trans_query, product_translations_to_upsert)
                print(f"-> Bulk upserted {len(product_translations_to_upsert)} translations in {time.time() - t_db_start:.2f}s.")
                
            # E. Product Variants Bulk Write
            if variants_to_upsert:
                t_db_start = time.time()
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
                timings["6. DB Variants Upsert"] = time.time() - t_db_start
                print(f"-> Bulk upserted variants successfully in {timings['6. DB Variants Upsert']:.2f}s.")
                
            # F. Attribute Mappings and Image Relations Writes
            processed_product_uuids = [p[0] for p in products_to_upsert.values()]
            if processed_product_uuids:
                cached_attrs = {}
                cur.execute("SELECT id, attribute_name FROM catalog.attributes;")
                for attr_id, attribute_name in cur.fetchall():
                    cached_attrs[attribute_name] = attr_id

                cached_vals = {}
                cur.execute("SELECT id, attribute_id, attribute_value FROM catalog.attribute_values;")
                for val_id, attr_id, attribute_value in cur.fetchall():
                    cached_vals[(attr_id, attribute_value)] = val_id
                    
                t_db_start = time.time()
                cur.execute("DELETE FROM catalog.product_attributes_map WHERE product_id = ANY(%s::uuid[])", (processed_product_uuids,))
                cur.execute("DELETE FROM catalog.product_images WHERE product_id = ANY(%s::uuid[])", (processed_product_uuids,))
                timings["7. DB Clean Old Relations"] = time.time() - t_db_start
                
                mappings_insert_rows = []
                images_insert_rows = []
                
                for p_uuid, attrs in attributes_by_product.items():
                    for attr_name, attr_value in attrs.items():
                        # Resolve attribute_id
                        attr_id = cached_attrs.get(attr_name)
                        if not attr_id:
                            attr_id = str(uuid.uuid4())
                            cur.execute(
                                "INSERT INTO catalog.attributes (id, attribute_name) VALUES (%s, %s) ON CONFLICT (attribute_name) DO UPDATE SET attribute_name = EXCLUDED.attribute_name RETURNING id;",
                                (attr_id, attr_name)
                            )
                            attr_id = cur.fetchone()[0]
                            cached_attrs[attr_name] = attr_id
                            
                            # Translation
                            for lang in ["en", "pl", "ar", "ru", "de"]:
                                t_name = translate_item(attr_name, lang)
                                if t_name:
                                    cur.execute("""
                                        INSERT INTO catalog.attribute_translations (attribute_id, language_code, attribute_name)
                                        VALUES (%s, %s, %s)
                                        ON CONFLICT (attribute_id, language_code) DO UPDATE SET attribute_name = EXCLUDED.attribute_name;
                                    """, (attr_id, lang, t_name))
                                    
                        # Resolve attribute_value_id
                        val_id = cached_vals.get((attr_id, attr_value))
                        if not val_id:
                            val_id = str(uuid.uuid4())
                            cur.execute("""
                                INSERT INTO catalog.attribute_values (id, attribute_id, attribute_value)
                                VALUES (%s, %s, %s)
                                ON CONFLICT (attribute_id, attribute_value) DO UPDATE SET attribute_value = EXCLUDED.attribute_value
                                RETURNING id;
                            """, (val_id, attr_id, attr_value))
                            val_id = cur.fetchone()[0]
                            cached_vals[(attr_id, attr_value)] = val_id
                            
                            for lang in ["en", "pl", "ar", "ru", "de"]:
                                t_val = translate_item(attr_value, lang)
                                if t_val:
                                    cur.execute("""
                                        INSERT INTO catalog.attribute_value_translations (attribute_value_id, language_code, attribute_value)
                                        VALUES (%s, %s, %s)
                                        ON CONFLICT (attribute_value_id, language_code) DO UPDATE SET attribute_value = EXCLUDED.attribute_value;
                                    """, (val_id, lang, t_val))
                                    
                        map_uuid = str(uuid.uuid4())
                        mappings_insert_rows.append((map_uuid, p_uuid, val_id))
                        
                for p_uuid, imgs in images_by_product.items():
                    for idx, (img_url, local_path, db_image_url) in enumerate(imgs):
                        img_uuid = str(uuid.uuid4())
                        is_cover = (idx == 0)
                        images_insert_rows.append((img_uuid, p_uuid, db_image_url, idx, is_cover))
                        
                if mappings_insert_rows:
                    t_db_start = time.time()
                    execute_values_psycopg3(cur, "INSERT INTO catalog.product_attributes_map (id, product_id, attribute_value_id) VALUES %s", mappings_insert_rows)
                    timings["8. DB Attributes Mapping Insert"] = time.time() - t_db_start
                    
                if images_insert_rows:
                    t_db_start = time.time()
                    execute_values_psycopg3(cur, "INSERT INTO catalog.product_images (id, product_id, image_url, sort_order, is_cover) VALUES %s", images_insert_rows)
                    timings["9. DB Image Mappings Insert"] = time.time() - t_db_start
                    
        conn.commit()
        print("Successfully committed bulk DB updates!")
        sys.stdout.flush()
    except Exception as e:
        sys.stderr.write(f"Database transaction error: {str(e)}\n")
        conn.rollback()
        update_sync_progress(conn, sync_run_id, "failed", items_parsed, items_added, items_updated, variants_aligned, errors_skipped, 0, 0)
        pool.close()
        sys.exit(1)
        
    # 8. Process Image Downloads in Parallel
    images_total = len(unique_downloads)
    images_downloaded, failed_downloads, download_duration = asyncio.run(
        download_images_async(
            unique_downloads, conn, pool, sync_run_id,
            items_parsed, items_added, items_updated, variants_aligned, errors_skipped
        )
    )
    timings["10. Image Downloads"] = download_duration
    
    # Log failed images
    if failed_downloads:
        import csv
        try:
            failed_csv = os.path.join(os.path.dirname(os.path.abspath(__file__)), "failed_images.csv")
            with open(failed_csv, "w", encoding="utf-8", newline="") as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(["Timestamp", "Sync Run ID", "Image URL", "Local Path", "Last Error"])
                for url, (path, last_error) in failed_downloads.items():
                    writer.writerow([datetime.now().isoformat(), sync_run_id, url, path, last_error])
            print(f"Warning: {len(failed_downloads)} failed images logged to: {failed_csv}")
        except:
            pass
            
    # 9. Clean up unseen items from this feed (Deactivation)
    print("Deactivating old products not seen in this sync run...")
    t_deact_start = time.time()
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE catalog.products SET is_active = false WHERE feed_id = %s AND last_sync_run_id != %s",
            (FEED_ID, sync_run_id)
        )
        cur.execute(
            """
            UPDATE catalog.product_variants 
            SET is_active = false 
            WHERE product_id IN (SELECT id FROM catalog.products WHERE feed_id = %s) AND last_sync_run_id != %s
            """,
            (FEED_ID, sync_run_id)
        )
    conn.commit()
    timings["11. Inactive Products Cleanup"] = time.time() - t_deact_start
    
    # Overall duration
    timings["Total Sync Duration"] = time.time() - start_total
    
    print("\n====================================================")
    print("ETIKA SYNC PERFORMANCE SUMMARY:")
    for step, duration in timings.items():
        print(f"- {step:30}: {duration:.4f} seconds")
    print("====================================================\n")
    sys.stdout.flush()
    
    # Complete run in DB
    print("Writing final success state to sync run metadata...")
    update_sync_progress(conn, sync_run_id, "success", items_parsed, items_added, items_updated, variants_aligned, errors_skipped, images_total, images_downloaded, timings)
    log_sync_timings(timings, sync_run_id, "success", items_parsed, items_added, items_updated, variants_aligned, errors_skipped, images_total, images_downloaded)
    
    # Clean temp XML file
    if os.path.exists(XML_TEMP_FILE):
        os.remove(XML_TEMP_FILE)
        
    # Rotate and cleanup archived XML files older than 90 days
    cleanup_old_xml_files("etika")
        
    try: conn_ctx.__exit__(None, None, None)
    except: pass
    pool.close()
    print("--- Etika Autonomous XML Sync Finished Successfully ---")

if __name__ == "__main__":
    run_parser()
