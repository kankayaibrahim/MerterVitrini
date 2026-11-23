#!/usr/bin/env python3
"""Idempotent seeder for 10 Turkish B2B pillar & topical-authority blog guides.

Usage:
    python scripts/seed_seo_blog_guides.py --dry-run
    python scripts/seed_seo_blog_guides.py
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import TypedDict


class GuideSpec(TypedDict):
    slug: str
    title: str
    summary: str
    meta_title: str
    meta_description: str
    cover_image: str
    content: str


DEFAULT_COVER = "/images/merter-vitrini-og.jpg"


def load_env() -> None:
    """Loads environment variables from local .env file when present."""
    root_dir = Path(__file__).resolve().parent.parent
    for candidate in (root_dir / ".env", Path(__file__).resolve().parent / ".env"):
        if not candidate.exists():
            continue
        with candidate.open("r", encoding="utf-8") as fh:
            for raw_line in fh:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))
        break


def resolve_default_db_password() -> str:
    scripts_dir = str(Path(__file__).resolve().parent)
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)
    try:
        from unified_deployer import PROJECTS_CONFIG

        return (
            PROJECTS_CONFIG.get("unified", {})
            .get("backend", {})
            .get("config_template", {})
            .get("db_password", "")
        )
    except Exception:
        return ""


GUIDES: list[GuideSpec] = [
    {
        "slug": "toptan-hazir-giyim-nereden-alinir-istanbul-rehberi",
        "title": "Türkiye'de Toptan Hazır Giyim Nereden Alınır? İstanbul Pazarları ve Dijital Tedarik Rehberi",
        "summary": (
            "Merter, Laleli, Osmanbey ve Zeytinburnu toptan hazır giyim merkezlerinin karşılaştırması, "
            "üreticiden doğrudan alım ipuçları ve dijital B2B katalog avantajları."
        ),
        "meta_title": "Toptan Hazır Giyim Nereden Alınır? İstanbul Merkezleri | Merter Vitrini",
        "meta_description": (
            "Türkiye'de toptan hazır giyim nereden alınır? Merter, Osmanbey ve Laleli farkları, "
            "aracısız üretici fiyatları ve online B2B tedarik rehberi."
        ),
        "cover_image": DEFAULT_COVER,
        "content": """
<p>Türkiye'de <strong>toptan hazır giyim</strong> ticareti denildiğinde ilk akla gelen merkez İstanbul'dur. Ancak her tekstil bölgesinin hitap ettiği müşteri profili, minimum sipariş adedi (MOQ), kumaş kalitesi ve fiyat politikası birbirinden farklıdır. Fiziksel mağazanız, Instagram butiğiniz veya e-ticaret kanalınız için kârlı bir tedarik zinciri kurmak istiyorsanız doğru bölgeyi ve doğru üreticiyi seçmeniz kritik önem taşır.</p>

<h2>İstanbul Toptan Hazır Giyim Merkezleri Karşılaştırması</h2>
<table>
  <thead>
    <tr><th>Merkez</th><th>Güçlü Ürün Grupları</th><th>Hedef Müşteri</th><th>Tipik Minimum Alım</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>Merter</strong></td><td>Kadın günlük giyim, erkek, oversize, eşofman, elbise</td><td>Türkiye butikleri, e-ticaret, B2B ihracat</td><td>1 seri (3-5 adet)</td></tr>
    <tr><td><strong>Osmanbey</strong></td><td>Abiye, şık kadın dış giyim, ofis &amp; klasik koleksiyon</td><td>Lüks butikler, Ortadoğu &amp; Avrupa alıcıları</td><td>1-2 seri</td></tr>
    <tr><td><strong>Laleli</strong></td><td>Büyük beden, kürk/deri detaylı ürünler, ihracat odaklı seri</td><td>Rusya, BDT ve Doğu Avrupa toptancıları</td><td>Serili kargo paketleri</td></tr>
    <tr><td><strong>Zeytinburnu &amp; Güngören</strong></td><td>Deri ceket, triko, penye temel gruplar ve fason üretim</td><td>Yerli zincir mağazalar ve Private Label markalar</td><td>Modele göre değişken</td></tr>
  </tbody>
</table>

<h2>Neden Merter Toptan Hazır Giyimin Kalbidir?</h2>
<p>Merter tekstil merkezi, hem üretici atölyelerin hem de showroom'ların aynı sokaklarda buluştuğu Türkiye'nin en dinamik hazır giyim merkezidir. Haftalık çıkan yeni modeller sayesinde hızlı moda (fast fashion) döngüsüne uyum sağlamak isteyen butikler için benzersiz bir çeşitlilik sunar.</p>
<ul>
  <li><strong>Aracısız İmalatçı Fiyatı:</strong> Doğrudan üretici firmadan serili alım yaparak perakende marjınızı korursunuz.</li>
  <li><strong>Düşük MOQ Esnekliği:</strong> Çoğu Merter üreticisi 1 seri (örneğin S-M-L veya 36-38-40-42) ile deneme siparişi açmanıza olanak tanır.</li>
  <li><strong>Hızlı Sezon Yenileme:</strong> İlkbahar/Yaz ve Sonbahar/Kış geçişlerinde her hafta taze koleksiyonlara ulaşabilirsiniz.</li>
</ul>

<h2>Fiziksel Gezmek Yerine Dijital B2B Tedarik</h2>
<p>İstanbul dışındaki butikler ve yurtdışı alıcılar için her hafta Merter sokaklarını tek tek dolaşmak ciddi zaman ve seyahat maliyeti yaratır. <a href="/toptan-hazir-giyim">Toptan Hazır Giyim Kataloğumuz</a> üzerinden doğrulanmış üreticilerin güncel seri fiyatlarını, beden dağılımlarını ve WhatsApp/sepet sipariş kanallarını tek ekranda görebilirsiniz. Ayrıca <a href="/ureticiler">Merter Üretici Rehberi</a> sayfasından imalatçı firmaların adres ve showroom bilgilerine doğrudan erişebilirsiniz.</p>
""",
    },
    {
        "slug": "butik-acmak-icin-toptan-giyim-seri-asorti-moq-rehberi",
        "title": "Butik Açmak İçin Toptan Giyim Alımında Seri, Asorti ve Minimum Sipariş (MOQ) Rehberi",
        "summary": (
            "Yeni butik veya e-ticaret markası kurarken seri bozmadan stok yönetme, asorti hesabı yapma "
            "ve ilk sezon bütçesini verimli dağıtma rehberi."
        ),
        "meta_title": "Butik İçin Toptan Giyim: Seri, Asorti ve MOQ Rehberi | Merter Vitrini",
        "meta_description": (
            "Butik açarken toptan hazır giyim nasıl alınır? Seri, asorti, beden dağılımı ve "
            "minimum sipariş miktarı (MOQ) hesaplama kılavuzu."
        ),
        "cover_image": DEFAULT_COVER,
        "content": """
<p>Yeni bir kadın ya da erkek giyim butiği açarken en sık yapılan hata, görseli beğenilen her üründen kontrolsüz adetlerde sipariş geçmektir. <strong>Toptan hazır giyim</strong> terminolojisindeki seri, asorti, tek renk seri ve MOQ kavramlarını doğru bilmek, ilk 90 günde sermayenizin elinizde kalmasını sağlar.</p>

<h2>Seri ve Asorti Nedir? Nasıl Hesaplanır?</h2>
<ul>
  <li><strong>Standart Tek Renk Seri:</strong> Aynı model ve renkten farklı bedenlerin bir arada paketlenmesidir. Örneğin S-M-L (3'lü seri) veya 36-38-40-42 (4'lü seri).</li>
  <li><strong>Asorti (Karışık Beden / Renk Paketi):</strong> Üreticinin en çok satan beden oranlarına göre hazırladığı pakettir (örneğin 1 S, 2 M, 2 L, 1 XL = 6'lı paket).</li>
  <li><strong>MOQ (Minimum Order Quantity):</strong> Üreticinin sipariş açtığı en küçük paket sayısıdır. <a href="/toptan-hazir-giyim">Merter Vitrini kataloglarında</a> her ürün kartında seri içi adet ve minimum paket bilgisi şeffaf biçimde belirtilir.</li>
</ul>

<h2>İlk Siparişte Bütçe Dağılımı Önerisi (70-20-10 Kuralı)</h2>
<p>İlk açılış stoğunuzu tek bir kategoriye bağlamak yerine riski üçe bölün:</p>
<ol>
  <li><strong>%70 Ana Çekirdek Ürünler:</strong> Yıl boyu dönen basic tişört, gömlek, pantolon ve <a href="/tr/kadin-giyim">toptan kadın giyim</a> temel parçaları.</li>
  <li><strong>%20 Trend &amp; Vitrin Çekicileri:</strong> Sezonun öne çıkan elbise, ceket veya renkli ikili takım modelleri.</li>
  <li><strong>%10 Test Stoğu:</strong> Yeni bir üreticinin kalıp ve kumaş kalitesini ölçmek için 1'er seri alınan deneme modelleri.</li>
</ol>

<h2>Beden Kırılımı ve İade Riskini Azaltma</h2>
<p>Ürün açıklamasında kumaş likra oranı, manken ölçüleri ve kalıp bilgisi (dar kalıp, tam kalıp, oversize) bulunmayan ürünlerden uzak durun. Doğrulanmış tedarikçilerle çalışmak için <a href="/ureticiler">onaylı üreticiler dizinimizi</a> inceleyerek doğrudan numune ve kalıp teyidi alabilirsiniz.</p>
""",
    },
    {
        "slug": "merter-toptan-hazir-giyim-imalatci-rehberi",
        "title": "Merter Toptan Hazır Giyim Piyasası: Doğrudan İmalatçı Firmalara Ulaşma Kılavuzu",
        "summary": (
            "Merter'de aracı komisyonu ödemeden gerçek üretici showroom ve atölyelerle çalışma, "
            "fiyat doğrulama ve uzun vadeli B2B tedarik ortaklığı kurma yolları."
        ),
        "meta_title": "Merter Toptan Hazır Giyim İmalatçı Rehberi | Merter Vitrini",
        "meta_description": (
            "Merter'deki gerçek hazır giyim üreticilerine aracısız ulaşın. Açık firma vitrini, "
            "doğrudan WhatsApp iletişimi ve seri bazlı fabrika fiyatları."
        ),
        "cover_image": DEFAULT_COVER,
        "content": """
<p><strong>Merter toptan hazır giyim</strong> ekosistemi içinde hem doğrudan dikim atölyesine sahip üreticiler hem de yalnızca al-sat yapan aracı toptancılar bulunur. Kâr marjınızı büyütmenin en sürdürülebilir yolu, doğrudan üretici firmalarla (imalatçılarla) uzun soluklu çalışma ilişkisi kurmaktır.</p>

<h2>Gerçek Üreticiyi Aracıdan Nasıl Ayırt Edersiniz?</h2>
<ul>
  <li><strong>Süreklilik ve Renk Varyantı:</strong> İmalatçılar aynı modelin 4-8 renk varyantını düzenli olarak tekrar kesebilir (re-order imkânı).</li>
  <li><strong>Kumaş ve Gramaj Bilgisi:</strong> İmalatçı kumaşın iplik numarasını, çekme payını ve yıkama talimatını net bilir.</li>
  <li><strong>Açık Firma Kimliği:</strong> Merter Vitrini'nde yer alan her tedarikçinin ticari unvanı, showroom adresi ve doğrulanmış işletme statüsü şeffaf biçimde sunulur.</li>
</ul>

<h2>Açık Firma Vitrini Modeli Nedir?</h2>
<p>Geleneksel pazaryerlerinden farklı olarak Merter Vitrini'nde üretici firmalar kendi ticari adlarıyla vitrin açar. Müşteriler beğendikleri serileri ister sepet üzerinden teklife dönüştürebilir ister doğrudan üreticinin WhatsApp ve telefon hattından renk/stok teyidi alabilir.</p>
<p>Siz de <a href="/ureticiler">Merter üreticileri sayfasından</a> kadın, erkek ve özel koleksiyon üreticilerini filtreleyebilir; güncel sezon ürünlerini <a href="/toptan-hazir-giyim">Toptan Hazır Giyim</a> merkezinde karşılaştırabilirsiniz.</p>
""",
    },
    {
        "slug": "trendyol-ve-instagram-butikleri-icin-toptan-giyim-xml-tedarik",
        "title": "Trendyol, Hepsiburada ve Instagram Butikleri İçin Toptan Giyim ve XML Tedarik Stratejileri",
        "summary": (
            "Pazaryeri komisyonları ve kargo maliyetleri sonrası kâr bırakan toptan ürün seçimi, "
            "yüksek çözünürlüklü ürün görseli kullanımı ve stok senkronizasyonu."
        ),
        "meta_title": "E-Ticaret & Instagram Butikleri İçin Toptan Giyim Tedariki | Merter Vitrini",
        "meta_description": (
            "Trendyol ve Instagram butikleri için kârlı toptan hazır giyim tedarik stratejileri: "
            "komisyon hesabı, stok devri ve hızlı Merter teslimatı."
        ),
        "cover_image": DEFAULT_COVER,
        "content": """
<p>Online giyim satışı yapan butikler için tedarik sürecinin hızı, en az ürün fiyatı kadar belirleyicidir. Trendyol, Hepsiburada veya Instagram Shop üzerinden satış yaparken yüksek iade oranlarına yol açmayan, stüdyo görseli kaliteli ve hızlı temin edilebilen <strong>toptan hazır giyim</strong> serileri seçilmelidir.</p>

<h2>E-Ticaret Mağazaları İçin Toptan Ürün Seçim Kriterleri</h2>
<ol>
  <li><strong>Komisyon Sonrası Net Marj Hesabı:</strong> Pazaryeri komisyonu (%18-24), kargo ve KDV giderlerinden sonra toptan alış fiyatınızın en az 2.2x çarpanıyla satış yapabileceğiniz modellere yönelin.</li>
  <li><strong>Kalıp ve Kumaş Tutarlılığı:</strong> Beden uyumsuzluğu e-ticarette en büyük iade sebebidir; stabil kalıp çalışan üreticileri tercih edin.</li>
  <li><strong>Devamlı Model (Never-Out-Of-Stock):</strong> Reklam verdiğiniz bir model tükendiğinde yeniden kestirebileceğiniz imalatçılarla çalışın.</li>
</ol>

<h2>Merter Vitrini ile E-Ticaret Stok Planlaması</h2>
<p>Online satış yapan butikler <a href="/tr/kadin-giyim">toptan kadın giyim</a> ve <a href="/tr/erkek-giyim">toptan erkek giyim</a> kategorilerinden yeni sezon ürünleri anlık inceleyebilir, seri bazlı maliyet hesabı yapabilir ve gün içi kargo çıkışıyla stoklarını beklemeden yenileyebilir.</p>
""",
    },
    {
        "slug": "toptan-kadin-giyim-sezon-takvimi-koleksiyon-planlama",
        "title": "Toptan Kadın Giyimde Sezon Takvimi: Koleksiyon ve Stok Planlaması Nasıl Yapılır?",
        "summary": (
            "İlkbahar/Yaz, Bayram, Sonbahar/Kış ve yılbaşı dönemlerinde Merter fabrikalarının üretim takvimi "
            "ve butiklerin erken alım fırsatları."
        ),
        "meta_title": "Toptan Kadın Giyim Sezon Takvimi & Stok Planlama | Merter Vitrini",
        "meta_description": (
            "Toptan kadın hazır giyimde erken alım, sezon geçişi ve bayram/davet dönemleri için "
            "doğru stok planlama takvimi."
        ),
        "cover_image": DEFAULT_COVER,
        "content": """
<p><strong>Toptan kadın giyim</strong> piyasasında başarı, talep zirveye ulaşmadan 4 ila 6 hafta önce vitrini hazırlamaktan geçer. Merter atölyeleri perakendeden yaklaşık bir buçuk ay önde ilerler.</p>

<h2>Yıllık Toptan Hazır Giyim Takvimi</h2>
<table>
  <thead>
    <tr><th>Dönem</th><th>Toptan Alım Zamanı</th><th>Öne Çıkan Ürün Grupları</th></tr>
  </thead>
  <tbody>
    <tr><td>İlkbahar Geçiş</td><td>Şubat Başı – Mart Ortası</td><td>Trenchcoat, iki iplik takım, poplin gömlek</td></tr>
    <tr><td>Yaz &amp; Tatil</td><td>Nisan – Haziran</td><td>Viskon elbise, keten karışım takım, aerobin</td></tr>
    <tr><td>Sonbahar</td><td>Ağustos Sonu – Eylül</td><td>Kaşe ceket, ince triko, gabardin pantolon</td></tr>
    <tr><td>Kış &amp; Davet</td><td>Ekim – Aralık</td><td>Kalın kazak, kaban, saten &amp; kadife abiye</td></tr>
  </tbody>
</table>

<p>Yeni sezon ürünlerini ilk elden görmek için <a href="/toptan-hazir-giyim">Toptan Hazır Giyim</a> ana merkezimizi ve <a href="/tr/kadin-giyim">Kadın Giyim kataloğumuzu</a> düzenli takip edebilirsiniz.</p>
""",
    },
    {
        "slug": "private-label-ve-fason-hazir-giyim-uretimi-maliyet-rehberi",
        "title": "Private Label (Özel Etiket) ve Fason Hazır Giyim Üretimi: Maliyet ve Süreç Rehberi",
        "summary": (
            "Kendi marka etiketinizle fason üretim yaptırmanın adımları: kalıp çıkarma, numune onayı, "
            "kumaş kesimi ve Merter Vitrini fason destekli üreticiler."
        ),
        "meta_title": "Private Label ve Fason Hazır Giyim Üretimi Rehberi | Merter Vitrini",
        "meta_description": (
            "Markanıza özel etiket (Private Label) ve fason hazır giyim üretimi nasıl yaptırılır? "
            "Minimum adet, numune ve maliyet kalemleri."
        ),
        "cover_image": DEFAULT_COVER,
        "content": """
<p>Mağazanız veya online markanız belirli bir satış hacmine ulaştığında, rakiplerden ayrışmanın en güçlü yolu <strong>Private Label (özel etiket)</strong> veya fason üretimdir. Merter ve çevre tekstil bölgelerinde fason üretim kabul eden deneyimli atölyelerle kendi marka etiketiniz altında koleksiyon hazırlayabilirsiniz.</p>

<h2>Fason ve Private Label Sürecinin 5 Adımı</h2>
<ol>
  <li><strong>Model ve Tech-Pack Hazırlığı:</strong> Referans numune veya teknik çizim ile ölçü tablosunun netleştirilmesi.</li>
  <li><strong>Kumaş ve Aksesuar Seçimi:</strong> Kumaş tedariki, fermuar, düğme ve marka dokuma etiketinin belirlenmesi.</li>
  <li><strong>Numune (Fit Sample) Onayı:</strong> Seri kesime geçilmeden önce S/M beden üzerinde kalıp ve dikiş kontrolü.</li>
  <li><strong>Kesim, Dikim ve Ütü-Paket:</strong> Renk başına belirlenen minimum üretim adedine göre bant üretimi.</li>
  <li><strong>Kalite Kontrol ve Sevkiyat:</strong> Beden asortisine göre paketleme ve teslimat.</li>
</ol>

<p><a href="/ureticiler">Merter Vitrini Üreticiler</a> sayfasında "Private Label" ve "Fason Üretim" desteği sunan onaylı firmaları görüntüleyip doğrudan iletişime geçebilirsiniz.</p>
""",
    },
    {
        "slug": "toptan-tesettur-ve-buyuk-beden-giyim-kalip-kumas-rehberi",
        "title": "Toptan Tesettür ve Büyük Beden Giyimde Kalıp, Kumaş ve İç Göstermeme Standartları",
        "summary": (
            "Yüksek müşteri sadakati sunan tesettür ve büyük beden (42-54) toptan hazır giyim segmentinde "
            "kalite kriterleri, kumaş tercihleri ve stok yönetimi."
        ),
        "meta_title": "Toptan Tesettür & Büyük Beden Giyim Rehberi | Merter Vitrini",
        "meta_description": (
            "Toptan tesettür ve büyük beden kadın giyimde doğru kalıp, astar, kumaş gramajı ve "
            "yüksek tekrar satış oranı sağlayan tedarik kriterleri."
        ),
        "cover_image": DEFAULT_COVER,
        "content": """
<p>Tesettür giyim ve büyük beden hazır giyim kategorileri, hem yurtiçi butiklerde hem de Ortadoğu, Kuzey Afrika ve Avrupa pazarlarında müşteri sadakati en yüksek segmentler arasındadır. Bu alanda satış başarısı doğrudan doğru kalıp mühendisliğine ve nefes alan, iç göstermeyen kumaş seçimine dayanır.</p>

<h2>Dikkat Edilmesi Gereken Teknik Kalite Kriterleri</h2>
<ul>
  <li><strong>Gramaj ve Astar Dengesi:</strong> Açık renk tunik, elbise ve feracelerde iç göstermeyen dokuma yoğunluğu veya ince viskon astar tercih edilmelidir.</li>
  <li><strong>Büyük Bedende Rahatlık Payı:</strong> 44-54 arası bedenlerde yalnızca eni büyütmek yeterli değildir; kol evi, göğüs pensleri ve basen oturuşu özel derecelendirilmelidir.</li>
  <li><strong>Terletmeyen Doğal Elyaflar:</strong> Aerobin, tensel, pamuk-viskon ve medine ipeği gibi dökümlü kumaşlar tekrar sipariş oranını belirgin şekilde yükseltir.</li>
</ul>

<p>Güncel seri seçeneklerini <a href="/toptan-hazir-giyim">Toptan Hazır Giyim</a> vitrinimizde ve <a href="/tr/kadin-giyim">Kadın Giyim kategorimizde</a> inceleyebilirsiniz.</p>
""",
    },
    {
        "slug": "turkiyeden-yurtdisina-toptan-hazir-giyim-ihracati-atr-kargo",
        "title": "Türkiye'den Yurtdışına Toptan Hazır Giyim İhracatı: Kargo, A.TR ve Gümrük Süreçleri",
        "summary": (
            "Avrupa, Rusya, BDT ve Ortadoğu ülkelerine Merter'den toptan hazır giyim gönderiminde "
            "A.TR, EUR.1 dolaşım belgeleri, mikro ihracat (ETGB) ve lojistik acente seçimi."
        ),
        "meta_title": "Yurtdışına Toptan Hazır Giyim İhracatı & Kargo | Merter Vitrini",
        "meta_description": (
            "Türkiye'den Avrupa, Rusya ve Ortadoğu'ya toptan hazır giyim ihracatı: ETGB mikro ihracat, "
            "A.TR belgesi ve Merter kargo lojistik süreçleri."
        ),
        "cover_image": DEFAULT_COVER,
        "content": """
<p>Türk tekstil ürünleri kalite-fiyat dengesi ve hızlı teslimat avantajı sayesinde Avrupa'dan Balkanlara, Rusya'dan Körfez ülkelerine kadar yoğun talep görür. <strong>Toptan hazır giyim ihracatı</strong> yaparken hedef ülkeye göre doğru gümrük ve kargo yöntemini seçmek teslimat süresini günlerce kısaltır.</p>

<h2>Başlıca İhracat ve Kargo Yöntemleri</h2>
<ul>
  <li><strong>Mikro İhracat (ETGB):</strong> 300 kg ve 15.000 EUR sınırına kadar hızlı kurye firmaları üzerinden gümrük müşaviri gerektirmeden resmi KDV iadeli ihracat yapılabilir.</li>
  <li><strong>A.TR / EUR.1 Dolaşım Belgeleri:</strong> Avrupa Birliği ve serbest ticaret anlaşmalı ülkelere yapılacak ticari sevkiyatlarda alıcının gümrük vergisi avantajı sağlaması için menşe ve dolaşım belgeleri hazırlanır.</li>
  <li><strong>Merter Bölgesel Kargo Acenteleri:</strong> Merter çevresindeki uzman tekstil kargo firmaları Balkanlar, Avrupa ve BDT hattında koli/çuval bazlı kapıdan kapıya teslimat sunar.</li>
</ul>

<p>Çok dilli ihracat desteği ve uluslararası alıcı profilleri hakkında daha fazla tedarikçi detayına <a href="/ureticiler">Merter Üretici Rehberi</a> üzerinden ulaşabilirsiniz.</p>
""",
    },
    {
        "slug": "toptan-giyimde-kumas-sozlugu-iki-iplik-krep-viskon-aerobin",
        "title": "Toptan Hazır Giyimde Kumaş Sözlüğü: İki İplik, Süprem, Krep, Viskon ve Aerobin",
        "summary": (
            "Satın alma kararında kaliteyi ilk bakışta anlamanızı sağlayan temel tekstil kumaş türleri, "
            "mevsim uygunluğu ve kullanım alanları."
        ),
        "meta_title": "Toptan Giyim Kumaş Sözlüğü: İki İplik, Krep, Viskon | Merter Vitrini",
        "meta_description": (
            "Toptan hazır giyim satın alırken bilinmesi gereken kumaş türleri: iki iplik, üç iplik şardon, "
            "süprem, krep, viskon ve aerobin özellikleri."
        ),
        "cover_image": DEFAULT_COVER,
        "content": """
<p>Toptan alımda aynı fiyata görünen iki ürün arasındaki uzun ömür ve müşteri memnuniyeti farkını belirleyen en kritik unsur kumaş kalitesidir. Doğru kumaş bilgisini bilmek, tedarikçilerle daha profesyonel pazarlık yapmanızı sağlar.</p>

<h2>En Çok Kullanılan Hazır Giyim Kumaşları</h2>
<table>
  <thead>
    <tr><th>Kumaş Adı</th><th>Yapısı</th><th>En İyi Kullanım Alanı</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>Süprem (Penye)</strong></td><td>İnce, esnek, nefes alan tek kat örgü</td><td>Tişört, yazlık basic üst ve günlük bluz</td></tr>
    <tr><td><strong>İki İplik / Üç İplik</strong></td><td>Tok duruşlu, iç yüzü ilmekli veya şardonlu</td><td>Sweatshirt, eşofman takımı, oversize hoodie</td></tr>
    <tr><td><strong>Krep / Sandy</strong></td><td>Dökümlü, az kırışan, hafif pütürlü doku</td><td>Elbise, ceket, ofis pantolonu, tulum</td></tr>
    <tr><td><strong>Viskon &amp; Aerobin</strong></td><td>Doğal selüloz kökenli, serin ve hafif dokuma</td><td>Yazlık elbise, gömlek, tesettür tunik</td></tr>
  </tbody>
</table>

<p>Kumaş ve model detaylarını karşılaştırmak için <a href="/toptan-hazir-giyim">Toptan Hazır Giyim Kataloğu</a> içindeki filtreleri kullanabilirsiniz.</p>
""",
    },
    {
        "slug": "toptan-hazir-giyim-fiyatlari-kar-marji-ve-stok-devir-hizi",
        "title": "Toptan Hazır Giyim Fiyatlandırma, Kâr Marjı ve Stok Devir Hızı Yönetimi",
        "summary": (
            "Perakende fiyat belirleme formülleri, sezon sonu indiriminde zarar etmeme matematiği "
            "ve nakit akışını hızlandıran seri alım modeli."
        ),
        "meta_title": "Toptan Hazır Giyim Fiyatları & Kâr Marjı Hesabı | Merter Vitrini",
        "meta_description": (
            "Toptan hazır giyimde perakende fiyatlandırma, brüt/net kâr marjı hesaplama ve "
            "stok devir hızını artıran tedarik teknikleri."
        ),
        "cover_image": DEFAULT_COVER,
        "content": """
<p><strong>Toptan hazır giyim fiyatları</strong> tek başına ucuz olduğu için değil, vitrinde hızlı dönüp nakde çevrilebildiği ölçüde kârlıdır. Düşük alış fiyatıyla alınan ama elde kalan tek bir seri, doğru fiyattan hızlı dönen bir modelden çok daha maliyetlidir.</p>

<h2>Sağlıklı Butik Kârlılık Formülü</h2>
<ul>
  <li><strong>Fiziksel Mağaza Çarpanı:</strong> Kira, personel, poşet ve KDV dahil net kâr için ortalama 2.3x – 2.8x çarpan hedeflenir.</li>
  <li><strong>E-Ticaret &amp; Pazaryeri Çarpanı:</strong> Kargo, komisyon ve ortalama %12 iade maliyeti eklenerek net marj korunmalıdır.</li>
  <li><strong>Stok Devir Hızı:</strong> Bir serideki 4 bedenin tamamını 21 gün içinde %75+ satış oranına ulaştırmak nakit döngüsünü güçlendirir.</li>
</ul>

<p>Güncel fabrika çıkış fiyatlarını kıyaslamak ve yüksek devir potansiyelli modelleri keşfetmek için <a href="/toptan-hazir-giyim">Toptan Hazır Giyim</a> sayfamızı ve <a href="/tr/tum-urunler">Tüm Toptan Ürünler</a> kataloğumuzu ziyaret edin.</p>
""",
    },
]


def get_db_connection():
    import psycopg

    db_host = os.environ.get("DB_HOST", "localhost")
    db_port = int(os.environ.get("DB_PORT", 5432))
    db_user = os.environ.get("DB_USER", "postgres")
    db_password = os.environ.get("DB_PASSWORD", resolve_default_db_password())
    db_name = os.environ.get("DB_NAME", "merterdevdb")
    conninfo = f"host={db_host} port={db_port} user={db_user} password={db_password} dbname={db_name}"
    return psycopg.connect(conninfo)


def seed_guides(dry_run: bool) -> int:
    if dry_run:
        for idx, guide in enumerate(GUIDES, start=1):
            word_count = len(guide["content"].split())
            print(f"[DRY-RUN] {idx:02d}. {guide['slug']} ({word_count} HTML tokens) -> {guide['title']}")
        print(f"Toplam {len(GUIDES)} Türkçe B2B SEO rehberi doğrulandı.")
        return 0

    conn = get_db_connection()
    try:
        with conn, conn.cursor() as cur:
            for guide in GUIDES:
                cur.execute(
                    """
                    INSERT INTO catalog.blog_posts (slug, cover_image, is_active)
                    VALUES (%s, %s, true)
                    ON CONFLICT (slug) DO UPDATE SET
                        cover_image = COALESCE(EXCLUDED.cover_image, catalog.blog_posts.cover_image),
                        is_active = EXCLUDED.is_active,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING id
                    """,
                    (guide["slug"], guide["cover_image"]),
                )
                row = cur.fetchone()
                if not row:
                    raise RuntimeError(f"Failed to upsert blog_posts row for {guide['slug']}")
                post_id = row[0]

                cur.execute(
                    """
                    INSERT INTO catalog.blog_post_translations
                        (post_id, language_code, slug, title, summary, content, meta_title, meta_description)
                    VALUES
                        (%s, 'tr', %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (post_id, language_code) DO UPDATE SET
                        slug = EXCLUDED.slug,
                        title = EXCLUDED.title,
                        summary = EXCLUDED.summary,
                        content = EXCLUDED.content,
                        meta_title = EXCLUDED.meta_title,
                        meta_description = EXCLUDED.meta_description
                    """,
                    (
                        post_id,
                        guide["slug"],
                        guide["title"],
                        guide["summary"],
                        guide["content"].strip(),
                        guide["meta_title"],
                        guide["meta_description"],
                    ),
                )
        print(f"Başarıyla {len(GUIDES)} B2B SEO rehberi catalog.blog_posts tablosuna yazıldı.")
        return 0
    finally:
        conn.close()


def main() -> int:
    load_env()
    parser = argparse.ArgumentParser(description="Seed 10 Turkish B2B SEO blog guides.")
    parser.add_argument("--dry-run", action="store_true", help="Print guides without writing to DB.")
    args = parser.parse_args()
    return seed_guides(dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
