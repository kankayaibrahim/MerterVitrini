# -*- coding: utf-8 -*-
"""
Merter Vitrini - Tedarikçi Blog Yazıları Otomatik Oluşturucu & Yayınlayıcı
docs/tedarikciler.json içerisindeki tüm tedarikçileri analiz eder,
tekilleştirir, zengin B2B toptan makaleler üretir ve veritabanına yazar.
"""

import os
import sys
import json
import re
from pathlib import Path
import paramiko

scripts_dir = Path(__file__).resolve().parent
from unified_deployer import SERVER_CONFIG, PROJECTS_CONFIG


def slugify(text: str) -> str:
    """Türkçe karakterleri dönüştürerek URL uyumlu temiz slug üretir."""
    text = text.replace("İ", "i").replace("I", "i").replace("ı", "i")
    text = text.replace("Ğ", "g").replace("ğ", "g")
    text = text.replace("Ü", "u").replace("ü", "u")
    text = text.replace("Ş", "s").replace("ş", "s")
    text = text.replace("Ö", "o").replace("ö", "o")
    text = text.replace("Ç", "c").replace("ç", "c")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text


def clean_brand_name(name: str) -> str:
    """Marka adındaki XML ve gereksiz ekleri temizler."""
    name = re.sub(r"XML$", "", name, flags=re.IGNORECASE).strip()
    return name


def generate_turkish_article(brand_name: str, active_products: int) -> dict:
    """Tedarikçi markası için kapsamlı, SEO uyumlu Türkçe B2B makale üretir."""
    title = f"{brand_name} - Merter Toptan Kadın Giyim & Tekstil Üreticisi"
    meta_title = f"{brand_name} Toptan Satış & Merter Vitrini B2B Koleksiyonu"
    meta_description = (
        f"{brand_name} toptan kadın giyim ve tekstil koleksiyonları. Merter Vitrini güvencesiyle "
        f"doğrudan üretici fiyatları, seri alım avantajları ve güvenli toptan sipariş fırsatları."
    )
    summary = (
        f"{brand_name} markasının Merter tekstil piyasasındaki en güncel kadın giyim modelleri, "
        f"toptan seri alım avantajları ve doğrudan imalatçıdan sipariş imkanları Merter Vitrini güvencesiyle sunulmaktadır."
    )

    stock_note = ""
    if active_products > 0:
        stock_note = f"\n> **Aktif Koleksiyon Notu:** {brand_name} markasının güncel sezon ürünleri Merter Vitrini toptan kataloğunda aktif olarak listelenmekte olup, hızlı stok teslimatı ile sevk edilmektedir.\n"

    content = f"""# {brand_name} - Merter Toptan Kadın Giyim & Tekstil Üreticisi

Türkiye'nin ve dünyanın önde gelen hazır giyim üretim merkezlerinden biri olan **İstanbul Merter**, toptan kadın giyim sektöründe trendleri belirleyen lider üreticilere ev sahipliği yapmaktadır. Bu markalar arasında özgün koleksiyonları, kaliteli kumaş seçimleri ve titiz işçiliğiyle öne çıkan **{brand_name}**, butik sahipleri, mağaza zincirleri ve e-ticaret işletmeleri için güvenilir ve güçlü bir tedarik kaynağıdır.

Merter Vitrini olarak, **{brand_name}** koleksiyonlarını doğrudan imalatçı avantajları ve kurumsal B2B altyapımızla toptan alıcılarla buluşturuyoruz.
{stock_note}
---

## 1. {brand_name} Marka Profili ve Üretim Gücü

**{brand_name}**, kadın giyim modasında güncel dünya trendlerini Merter'in yüksek üretim kapasitesiyle harmanlayan dinamik bir üreticidir. Kumaş seçiminden dikiş kalitesine, kalıp ergonomisinden son ütü-paketleme aşamasına kadar her detayda yüksek kalite standartlarını gözetmektedir.

* **Tasarım Çizgisi:** Hem günlük şehir şıklığını hem de özel anları hedefleyen geniş model yelpazesi.
* **Kumaş & Malzeme Kalitesi:** Nefes alabilen viskon, pamuk, dökümlü saten, şifon ve kışlık sezonlar için birinci sınıf triko kumaşlar.
* **Hızlı Koleksiyon Döngüsü:** Sezon içerisinde sürekli yenilenen haftalık kapsül modeller sayesinde butik vitrinlerinin her zaman güncel ve cazip kalması sağlanır.

---

## 2. Öne Çıkan Ürün Grupları

**{brand_name}** koleksiyonlarında butiklerin en çok talep ettiği ve satış sirkülasyonu yüksek olan ürün kategorileri şunlardır:

1. **Elbise Koleksiyonları:** Günlük midi/maxi elbiseler, kuşaklı gömlek elbiseler, keten yazlık modeller ve şık davet elbiseleri.
2. **İkili Takım & Ceket Kombinleri:** Sosyal medyada ve vitrinlerde yüksek talep gören blazer pantolon takımları ve rahat kesim ikili setler.
3. **Üst Giyim (Bluz, Gömlek, Büstiyer):** Detaylı dikiş işçiliği, poplin gömlekler ve her mevsime uyum sağlayan şık üstler.
4. **Triko & Kazak Grupları:** Sonbahar ve kış sezonlarının vazgeçilmezi dökümlü hırkalar ve fitilli triko modelleri.
5. **Alt Giyim (Etek, Pantolon):** Rahat kalıp kumaş pantolonlar, pileli etekler ve sezonun moda renkleriyle hazırlanan tasarımlar.

---

## 3. Butikler İçin Toptan Seri (Lot) ve Fiyat Avantajları

Tekstil perakendesinde kârlılığın temeli, aracı komisyoncuları atlayarak doğrudan birinci elden ürün tedarik etmektir. **{brand_name}** ürünleri, Merter Vitrini B2B platformunda doğrudan fabrika çıkış koşullarıyla sunulur:

* **Orijinal Seri Paketleme:** Modeller S-M-L veya S-M-L-XL gibi standart beden dağılımlı orijinal asorti paketlerde gönderilir.
* **Yüksek Kâr Marjı:** Doğrudan üreticiden tedarik sayesinde perakende satışta %100 ile %180 arasında kâr marjı yakalama imkanı sunar.
* **Düşük Minimum Sipariş (MOQ):** Butiklerin bütçelerini verimli yönetebilmeleri ve ürün çeşitliliğini artırabilmeleri için esnek paket alım seçenekleri.

---

## 4. Merter Vitrini Güvencesiyle Güvenli B2B Tedarik

Fiziksel olarak Merter sokaklarında günlerce toptancı aramak, nakit taşıma riski almak veya lojistik karmaşayla uğraşmak zorunda değilsiniz. **Merter Vitrini**, toptan tedarik sürecinizi modernleştirerek güvence altına alır:

* **Doğrulanmış Üretici Garantisi:** Platformdaki tüm markalar yerinde incelenmiş, üretim kalitesi doğrulanmış seçkin firmalardır.
* **Sigortalı Kapıya Teslimat:** Türkiye içi hızlı kargo avantajının yanı sıra, yurt dışına (Avrupa, Balkanlar, BDT, Körfez ve Afrika) gümrükleme destekli kapı teslim sevkiyat.
* **Gizli SKU ve Tedarikçi Koruması:** Perakende müşterilerinizin toptan fiyatları ve tedarik kaynağınızı görmesini engelleyen özel maskelenmiş B2B kodlama altyapısı.
* **Kurumsal Fatura & Güvenli Ödeme:** Kredi kartı, banka transferi ve uluslararası ödeme güvencesi.

---

## 5. {brand_name} Ürünleri Nasıl Sipariş Verilir?

1. **Kataloğu İnceleyin:** Merter Vitrini toptan kadın giyim kategorisinde **{brand_name}** ve diğer üreticilerin en güncel modellerini inceleyin.
2. **Seri Adetlerini Belirleyin:** Butiğinizin müşteri profiline uygun beden dağılımındaki serileri sepetinize ekleyin.
3. **B2B Siparişinizi Tamamlayın:** Güvenli ödeme adımının ardından siparişiniz Merter merkez depomuzdan titiz bir kalite kontrolden geçirilerek kargoya verilir.

Toptan kadın giyim tedariğinizde **{brand_name}** kalitesini mağazanıza taşımak ve rekabette öne geçmek için Merter Vitrini kataloğunu hemen keşfetmeye başlayın!
"""
    return {
        "title": title,
        "meta_title": meta_title,
        "meta_description": meta_description,
        "summary": summary,
        "content": content.strip()
    }


def prepare_suppliers_data():
    """docs/tedarikciler.json'dan tekil tedarikçileri ayıklar ve makalelerini hazırlar."""
    json_path = Path(__file__).resolve().parent.parent / "docs" / "tedarikciler.json"
    with open(json_path, "r", encoding="utf-8") as f:
        suppliers = json.load(f)

    unique_by_slug = {}
    for item in suppliers:
        raw_name = item.get("name", "").strip()
        clean_name = clean_brand_name(raw_name)
        slug = slugify(clean_name)
        if not slug:
            continue

        active_prods = item.get("active_products", 0)
        total_prods = item.get("total_products", 0)

        if slug not in unique_by_slug or active_prods > unique_by_slug[slug]["active_products"]:
            unique_by_slug[slug] = {
                "manufacturer_id": item.get("manufacturer_id"),
                "raw_name": raw_name,
                "brand_name": clean_name,
                "slug": slug,
                "total_products": total_prods,
                "active_products": active_prods
            }

    curated_images = [
        "https://mertervitrini.com.tr/uploads/blog/merter-toptan-kadin-elbise-modelleri-ve-fiyatlari.webp",
        "https://mertervitrini.com.tr/uploads/blog/toptan-kadin-takim-modelleri-ikili-takim.webp",
        "https://mertervitrini.com.tr/uploads/blog/toptan-kadin-elbise-tedarigi-butik-rehberi.webp",
        "https://mertervitrini.com.tr/uploads/blog/toptan-triko-ve-kazak-tedarik-rehberi.webp",
        "https://mertervitrini.com.tr/uploads/blog/toptan-kadin-ust-giyim-bluz-gomlek-rehberi.webp",
        "https://mertervitrini.com.tr/uploads/blog/toptan-kadin-dis-giyim-kaban-trenchkot-mont.webp",
        "https://mertervitrini.com.tr/uploads/blog/toptan-kadin-etek-modelleri-pliseli-kalem.webp",
        "https://mertervitrini.com.tr/uploads/blog/toptan-kadin-pantolon-denim-kot-tedarigi.webp",
        "https://mertervitrini.com.tr/uploads/blog/b2b-butiklerin-vazgecilmezi-toptan-bustiyer-modelleri.webp",
        "https://mertervitrini.com.tr/uploads/blog/dogrudan-imalatcidan-toptan-giyim-almanin-avantajlari.webp",
        "https://mertervitrini.com.tr/uploads/blog/toptan-sweatshirt-ve-esofman-takimi-butik.webp",
        "https://mertervitrini.com.tr/uploads/blog/toptan-bohem-otantik-giyim-butik-modasi.webp",
        "https://mertervitrini.com.tr/uploads/blog/toptan-buyuk-beden-kadin-giyim-modelleri.webp",
        "https://mertervitrini.com.tr/uploads/blog/toptan-tesettur-giyim-tunik-ferace-modelleri.webp",
        "https://mertervitrini.com.tr/uploads/blog/tekstilde-kumas-turleri-ve-kalite-rehberi.webp",
        "https://mertervitrini.com.tr/uploads/blog/merter-laleli-gungoren-toptan-tekstil-kiyaslama.webp",
        "https://mertervitrini.com.tr/uploads/blog/sifirdan-giyim-butigi-nasil-acilir-maliyet-plani.webp",
        "https://mertervitrini.com.tr/uploads/blog/butik-stok-yonetimi-ve-olu-stoktan-kacinma.webp",
        "https://mertervitrini.com.tr/uploads/blog/butiklerde-kar-marji-ve-fiyatlandirma-stratejisi.webp",
        "https://mertervitrini.com.tr/uploads/blog/b2b-e-ticaret-ile-fiziksel-alisveris-karsilastirmasi.webp",
        "https://mertervitrini.com.tr/uploads/blog/e-ticaret-giyim-magazasi-acma-ve-tedarik-yonetimi.webp",
        "https://mertervitrini.com.tr/uploads/blog/instagram-ve-tiktokta-butik-acip-satis-yapma.webp",
        "https://mertervitrini.com.tr/uploads/blog/toptan-giyimde-guvenli-b2b-odeme-yontemleri.webp",
        "https://mertervitrini.com.tr/uploads/blog/turkiyeden-toptan-giyim-ihracati-kargo-gumruk.webp",
        "https://mertervitrini.com.tr/uploads/blog/turkiyeden-avrupaya-toptan-giyim-ihracati-atr.webp",
        "https://mertervitrini.com.tr/uploads/blog/balkan-ulkelerine-toptan-tekstil-ihracati.webp",
        "https://mertervitrini.com.tr/uploads/blog/korfez-ve-arap-ulkelerine-toptan-giyim-ihracati.webp",
        "https://mertervitrini.com.tr/uploads/blog/rusya-ve-bdt-ulkelerine-toptan-tekstil-kargo.webp",
        "https://mertervitrini.com.tr/uploads/blog/merter-toptan-giyim-alisveris-rehberi.webp",
        "https://mertervitrini.com.tr/uploads/blog/toptan-tekstilde-seri-asorti-nedir.webp",
    ]

    articles = []
    for idx, (slug, sup) in enumerate(sorted(unique_by_slug.items())):
        banner = curated_images[idx % len(curated_images)]
        art = generate_turkish_article(sup["brand_name"], sup["active_products"])
        articles.append({
            "slug": slug,
            "cover_image": banner,
            "brand_name": sup["brand_name"],
            "title": art["title"],
            "meta_title": art["meta_title"],
            "meta_description": art["meta_description"],
            "summary": art["summary"],
            "content": art["content"]
        })

    return articles


def publish_to_server(articles):
    """Paramiko üzerinden AlmaLinux PostgreSQL veritabanına toplu aktarım gerçekleştirir."""
    hostname = SERVER_CONFIG.get("hostname", "")
    port = SERVER_CONFIG.get("port", 22)
    username = SERVER_CONFIG.get("username", "root")
    auth_secret = SERVER_CONFIG.get("password", "")
    db_password = os.environ.get("DB_PASSWORD") or PROJECTS_CONFIG.get("unified", {}).get("backend", {}).get("config_template", {}).get("db_password", "DHMwK0Qzyox7")

    print(f"[*] Toplam {len(articles)} tedarikçi blog makalesi yayınlanmak üzere hazırlandı.")
    print(f"[*] Sunucuya bağlanılıyor: {hostname}:{port}...")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(hostname, port=port, username=username, password=auth_secret)

    # Güvenli ve izole deploy dizini
    remote_base_dir = "/root/.merter_deploy"
    ssh.exec_command(f"mkdir -p {remote_base_dir}")

    remote_json_path = f"{remote_base_dir}/supplier_articles.json"
    remote_script_path = f"{remote_base_dir}/insert_supplier_blogs.py"

    sftp = ssh.open_sftp()
    with sftp.file(remote_json_path, "w") as f:
        json.dump(articles, f, ensure_ascii=False)

    remote_python_code = f"""# -*- coding: utf-8 -*-
import json
import psycopg2

conn = psycopg2.connect(
    dbname="merterdevdb",
    user="postgres",
    password="{db_password}",
    host="127.0.0.1",
    port=5432
)
conn.set_client_encoding('UTF8')
cur = conn.cursor()

with open("{remote_json_path}", "r", encoding="utf-8") as f:
    articles = json.load(f)

inserted_count = 0
updated_count = 0

for art in articles:
    slug = art["slug"]
    cover_image = art["cover_image"]
    title = art["title"]
    meta_title = art["meta_title"]
    meta_description = art["meta_description"]
    summary = art["summary"]
    content = art["content"]

    # 1. Upsert blog post
    cur.execute('''
        INSERT INTO catalog.blog_posts (slug, cover_image, is_active, updated_at)
        VALUES (%s, %s, true, CURRENT_TIMESTAMP)
        ON CONFLICT (slug) DO UPDATE
        SET cover_image = EXCLUDED.cover_image,
            is_active = true,
            updated_at = CURRENT_TIMESTAMP
        RETURNING id;
    ''', (slug, cover_image))
    post_id = cur.fetchone()[0]

    # 2. Upsert Turkish translation with localized slug
    cur.execute('''
        INSERT INTO catalog.blog_post_translations (
            post_id, language_code, slug, title, summary, content, meta_title, meta_description
        )
        VALUES (%s, 'tr', %s, %s, %s, %s, %s, %s)
        ON CONFLICT (post_id, language_code) DO UPDATE
        SET slug = EXCLUDED.slug,
            title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            content = EXCLUDED.content,
            meta_title = EXCLUDED.meta_title,
            meta_description = EXCLUDED.meta_description;
    ''', (post_id, slug, title, summary, content, meta_title, meta_description))

    inserted_count += 1

conn.commit()
print("SUCCESS: " + str(inserted_count) + " blog post inserted/updated.")
cur.close()
conn.close()
"""
    with sftp.file(remote_script_path, "w") as f:
        f.write(remote_python_code)
    sftp.close()

    print("[*] Sunucuda veritabanı aktarım scripti çalıştırılıyor...")
    _, stdout, stderr = ssh.exec_command(f"python3 {remote_script_path}")
    out = stdout.read().decode("utf-8")
    err = stderr.read().decode("utf-8")
    print("[*] Çıktı:", out.strip())
    if err.strip():
        print("[!] Hata:", err.strip())

    # Temizlik
    ssh.exec_command(f"rm -f {remote_json_path} {remote_script_path}")
    ssh.close()
    print("[+] Tedarikçi blog sayfaları başarıyla veritabanına aktarıldı!")


if __name__ == "__main__":
    arts = prepare_suppliers_data()
    publish_to_server(arts)
