#!/usr/bin/env python3
import os
import sys
import json
import time
import hashlib
import requests
import psycopg

def load_env():
    """Loads environment variables from local .env file."""
    search_dirs = [
        r"c:\Projects\mertervitrini.com.tr",
        r"c:\Projects\mertervitrini.com.tr\scripts",
        os.path.dirname(os.path.abspath(__file__))
    ]
    for d in search_dirs:
        env_path = os.path.join(d, ".env")
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        os.environ[parts[0].strip()] = parts[1].strip().strip('"').strip("'")
            break

load_env()

# Database Configs from Env
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", 5432))
DB_USER = os.environ.get("DB_USER", "postgres")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "DHMwK0Qzyox7")
DB_NAME = os.environ.get("DB_NAME", "merterdevdb")
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")

def get_db_connection():
    conninfo = f"host={DB_HOST} port={DB_PORT} user={DB_USER} password={DB_PASSWORD} dbname={DB_NAME}"
    return psycopg.connect(conninfo)

def calculate_content_hash(product_payload):
    """Generates a stable SHA-256 hash of the product payload to prevent double optimization of duplicate content."""
    title = product_payload.get("title", "").strip().lower()
    desc = product_payload.get("original_description", "").strip().lower()
    fabric = product_payload.get("fabric", "").strip().lower()
    gender = product_payload.get("gender", "").strip().lower()
    
    raw_str = f"{title}|{desc}|{fabric}|{gender}"
    return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

def get_cached_ai_seo(content_hash, ai_engine="deepseek"):
    """Checks if we already have an optimized version of this exact content fingerprint."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT seo_title, seo_description, meta_title, meta_description, tags, highlights
                FROM catalog.product_ai_content
                WHERE content_hash = %s AND ai_engine = %s;
            """, (content_hash, ai_engine))
            row = cur.fetchone()
            if row:
                tags_data = row[4]
                if isinstance(tags_data, str):
                    tags_data = json.loads(tags_data)
                elif tags_data is None:
                    tags_data = []

                highlights_data = row[5]
                if isinstance(highlights_data, str):
                    highlights_data = json.loads(highlights_data)
                elif highlights_data is None:
                    highlights_data = []

                return {
                    "seo_title": row[0],
                    "seo_description": row[1],
                    "meta_title": row[2],
                    "meta_description": row[3],
                    "tags": tags_data,
                    "highlight_features": highlights_data
                }
            return None

def fetch_sample_products():
    """Fetches up to 5 RANDOM products from the database, excluding 'etika' feed products."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT p.id, p.title, p.description, p.gender, p.season, p.kumas_fabric, p.series_ratio
                FROM catalog.products p
                WHERE p.is_active = true
                  AND (p.feed_id IS NULL OR p.feed_id <> 'etika')
                ORDER BY random()
                LIMIT 5;
            """)
            return cur.fetchall()

def get_deepseek_seo(product_data, api_key):
    """Contacts DeepSeek API to optimize title and description for SEO. Returns (seo_data, usage)."""
    url = "https://api.deepseek.com/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }

    system_prompt = (
        "Sen profesyonel bir e-ticaret SEO uzmanı ve metin yazarısın. "
        "Sana gönderilen ürün bilgilerini (başlık, açıklama, kumaş, cinsiyet vb.) analiz ederek "
        "arama motorlarında (Google) toptan ve perakende aramalarında en üst sırada çıkacak içerikler üreteceksin. "
        "Geri dönüşünü MUTLAKA sadece belirtilen JSON formatında yapmalısın. Ekstra hiçbir açıklama yazma.\n\n"
        "İstenen Çıktı JSON Şeması:\n"
        "{\n"
        '  "seo_title": "Ürünün anahtar kelimeler içeren, dikkat çekici başlığı (maks 60 karakter)",\n'
        '  "seo_description": "Ürünün kumaşını, kalıbını, tarzını açıklayan, anahtar kelimeler içeren akıcı ve SEO uyumlu detaylı açıklama metni",\n'
        '  "meta_title": "Google için optimize edilmiş meta başlık (en fazla 60 karakter)",\n'
        '  "meta_description": "Tıklama odaklı, kısa ve net meta açıklama (en fazla 155 karakter)",\n'
        '  "tags": ["anahtar", "kelime", "listesi", "en az 5 adet"],\n'
        '  "highlight_features": ["Öne çıkan özellik 1", "Öne çıkan özellik 2"]\n'
        "}"
    )

    user_prompt = f"Lütfen şu ürün için SEO optimizasyonu yap:\n{json.dumps(product_data, ensure_ascii=False)}"

    payload = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.7
    }

    response = requests.post(url, headers=headers, json=payload, timeout=30)
    response.raise_for_status()
    
    resp_json = response.json()
    result_content = resp_json["choices"][0]["message"]["content"]
    usage = resp_json.get("usage", {})
    return json.loads(result_content), usage

def save_or_update_ai_seo(product_id, seo_data, content_hash, product_payload, ai_engine="deepseek"):
    """Saves or updates the AI generated SEO content and original product info in the dedicated table."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO catalog.product_ai_content (
                    product_id, ai_engine, content_hash, 
                    original_title, original_description, original_fabric, original_gender,
                    seo_title, seo_description, meta_title, meta_description, tags, highlights, updated_at
                ) VALUES (
                    %s, %s, %s, 
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, NOW()
                )
                ON CONFLICT (content_hash, ai_engine) 
                DO UPDATE SET
                    product_id = EXCLUDED.product_id,
                    original_title = EXCLUDED.original_title,
                    original_description = EXCLUDED.original_description,
                    original_fabric = EXCLUDED.original_fabric,
                    original_gender = EXCLUDED.original_gender,
                    seo_title = EXCLUDED.seo_title,
                    seo_description = EXCLUDED.seo_description,
                    meta_title = EXCLUDED.meta_title,
                    meta_description = EXCLUDED.meta_description,
                    tags = EXCLUDED.tags,
                    highlights = EXCLUDED.highlights,
                    updated_at = NOW();
            """, (
                product_id,
                ai_engine,
                content_hash,
                product_payload["title"],
                product_payload["original_description"],
                product_payload["fabric"],
                product_payload["gender"],
                seo_data["seo_title"],
                seo_data["seo_description"],
                seo_data["meta_title"],
                seo_data["meta_description"],
                json.dumps(seo_data["tags"]),
                json.dumps(seo_data["highlight_features"])
            ))
            conn.commit()

def main():
    print("=" * 65)
    print("      DEEPSEEK YAPAY ZEKA SEO OPTİMİZASYON TEST ARACI")
    print("=" * 65)

    # 2. API Key Control
    api_key = DEEPSEEK_API_KEY
    if not api_key:
        api_key = input("[!] Lütfen DeepSeek API anahtarınızı girin: ").strip()
        if not api_key:
            print("[HATA] API anahtarı boş bırakılamaz!")
            sys.exit(1)

    # 3. Fetch Sample Products (Randomized!)
    print("\n[+] Veritabanından rastgele 5 ürün getiriliyor...")
    try:
        products = fetch_sample_products()
    except Exception as e:
        print(f"[HATA] Veritabanı bağlantı hatası: {e}")
        sys.exit(1)

    if not products:
        print("[!] Veritabanında ürün bulunamadı!")
        sys.exit(0)

    print("\n--- RASTGELE 5 ÜRÜN ---")
    for i, p in enumerate(products, 1):
        pid, title, desc, gender, season, fabric, ratio = p
        desc_preview = (desc[:60] + "...") if desc else "Açıklama yok"
        print(f"{i}) Başlık: {title} | Cinsiyet: {gender or 'Belirsiz'} | Kumaş: {fabric or 'Belirsiz'}")
        print(f"   Açıklama: {desc_preview}\n")

    # 4. Product Selection
    try:
        selection = int(input("[?] SEO optimizasyonu yapmak istediğiniz ürünün numarasını seçin (1-5): ").strip())
        if selection < 1 or selection > len(products):
            raise ValueError()
    except ValueError:
        print("[HATA] Geçersiz seçim yapıldı!")
        sys.exit(1)

    selected_product = products[selection - 1]
    pid, title, desc, gender, season, fabric, ratio = selected_product

    product_payload = {
        "title": title,
        "original_description": desc or "",
        "gender": gender or "",
        "season": season or "",
        "fabric": fabric or "",
        "series_ratio": ratio or ""
    }

    # 5. Calculate Payload Hash for Duplication / Local Caching Detection
    content_hash = calculate_content_hash(product_payload)

    # 6. Check Local AI Cache First (Save Money and Time!)
    print("\n[+] Yerel AI önbelleği kontrol ediliyor...")
    cached_seo = get_cached_ai_seo(content_hash, "deepseek")
    
    usage = None
    if cached_seo:
        print("\n[⚡] HARİKA! Bu ürünün SEO metinleri yerel önbellekte (local cache) bulundu!")
        print("[⚡] API çağrısı atlanarak 100% hız ve bütçe tasarrufu sağlandı! ($0.00000 USD)")
        seo_data = cached_seo
    else:
        # 7. Contact DeepSeek API (If Cache Miss)
        print("\n[🤖] DeepSeek API ile bağlantı kuruluyor ve SEO metinleri üretiliyor...")
        try:
            t_start = time.time()
            seo_data, usage = get_deepseek_seo(product_payload, api_key)
            t_end = time.time()
            print(f"[OK] Yapay zeka yanıtı başarıyla oluşturuldu! ({t_end - t_start:.2f} saniye)")
        except Exception as e:
            print(f"[HATA] DeepSeek API hatası: {e}")
            sys.exit(1)

    # 8. Show Optimization Results
    print("\n" + "=" * 65)
    print("              SEO METİN KARŞILAŞTIRMA TABLOSU")
    print("=" * 65)
    print(f"[*] ÜRÜN ID: {pid}")
    print(f"[*] İÇERİK PARMAK İZİ (HASH): {content_hash}\n")
    print(f"🔴 ORİJİNAL BAŞLIK   : {title}")
    print(f"🟢 YENİ SEO BAŞLIĞI  : {seo_data.get('seo_title')}")
    print("-" * 65)
    print(f"🔴 ORİJİNAL AÇIKLAMA :\n{desc or '(Boş)'}\n")
    print(f"🟢 YENİ SEO AÇIKLAMA :\n{seo_data.get('seo_description')}")
    print("-" * 65)
    print(f"🔵 META BAŞLIĞI      : {seo_data.get('meta_title')}")
    print(f"🔵 META AÇIKLAMASI   : {seo_data.get('meta_description')}")
    print(f"🔵 ETİKETLER (TAGS)  : {', '.join(seo_data.get('tags', []))}")
    print(f"🔵 ÖNE ÇIKANLAR      :")
    for feat in seo_data.get("highlight_features", []):
        print(f"   * {feat}")
    print("=" * 65)

    if usage:
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        total_tokens = usage.get("total_tokens", 0)
        
        # DeepSeek V3 Pricing: $0.14/1M input, $0.28/1M output
        input_cost = (prompt_tokens / 1_000_000) * 0.14
        output_cost = (completion_tokens / 1_000_000) * 0.28
        total_cost = input_cost + output_cost
        
        print("📊 APİ KULLANIM VE MALİYET RAPORU:")
        print(f"   - Girdi Token (Input)   : {prompt_tokens}")
        print(f"   - Çıktı Token (Output)  : {completion_tokens}")
        print(f"   - Toplam Token (Total)  : {total_tokens}")
        print(f"   - Yaklaşık Maliyet ($)  : ${total_cost:.5f} USD (~{total_cost * 32.5:.4f} TL)")
        print("=" * 65)
    elif cached_seo:
        print("📊 APİ KULLANIM VE MALİYET RAPORU:")
        print("   - Durum                 : YEREL ÖNBELLEK ÇARPIŞMASI (CACHE HIT)")
        print("   - Harcanan Token / Ücret : 0 Token / $0.00000 USD (Bedava)")
        print("=" * 65)

    # 9. Apply to Database automatically
    print("\n[+] SEO verileri otomatik olarak 'catalog.product_ai_content' tablosuna kaydediliyor...")
    try:
        save_or_update_ai_seo(pid, seo_data, content_hash, product_payload, ai_engine="deepseek")
        print("[OK] SEO verileri başarıyla veritabanına kaydedildi!")
    except Exception as e:
        print(f"[HATA] Veritabanı güncelleme hatası: {e}")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[*] İşlem kullanıcı tarafından iptal edildi.")
        sys.exit(0)
