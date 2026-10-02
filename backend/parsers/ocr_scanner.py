#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Flora Önbellek Görsel OCR (Optik Karakter Tanıma) Tarayıcı Scripti
-----------------------------------------------------------------
Bu script, Flora ürün resimleri önbelleğini (cache klasörünü) tarar ve
görsellerin üzerinde "etika", "fashion", "flora" gibi marka metinleri veya 
reklam yazıları olup olmadığını gelişmiş OCR teknolojisiyle tespit eder.

Gelişmiş Görüntü Ön İşleme (Pre-processing) & Kırpma Teknolojisi:
1. Akıllı Kırpma (Targeted Cropping): Tesseract'ın tüm görseli tarayıp küçük metinleri gürültü olarak algılamasını (noise filtering)
   önlemek için sadece reklam yazısının bulunduğu en üst %16'lık alan kırpılır.
2. Nötrleştirme & Binarizasyon: Görsel gri tona dönüştürülür ve 65 sınır eşiğinde (binarization) ikili siyah-beyaz sisteme aktarılır.
   Böylece beyaz/altın renkli dairesel mozaik arka plan çizgileri tamamen yok edilir, geriye sadece saf siyah harf konturları kalır.
3. Medyan Filtresi (Median Filter): Kalan ufak piksel gürültüleri temizlenerek Tesseract'a pürüzsüz bir girdi verilir.
"""

import os
import sys
import time
import importlib
from datetime import datetime
from PIL import Image, ImageFilter

# ==================== CONFIGURATION (AYARLAR) ====================
CACHE_DIR_PATH = r"C:\Projects\mertervitrini.com.tr\admin\backend\parsers\etika_yasakli_listesi"
REPORT_OUTPUT_PATH = r"c:\Projects\mertervitrini.com.tr\admin\backend\parsers\ocr_scan_results.txt"

# OCR'da yakalanacak yasaklı marka/reklam kelimeleri (Fuzzy matching için varyasyonları içerir)
BANNED_WORDS = ["etika", "fashion", "flora", "atika", "atıka", "etıka", "tika"]

# Tesseract-OCR kullanacaksanız ve PATH'e ekli değilse tesseract.exe yolunu buraya yazabilirsiniz:
# Örn: r"C:\Program Files\Tesseract-OCR\tesseract.exe"
TESSERACT_CMD_PATH = r"C:\Program Files\Tesseract-OCR\tesseract.exe" 
# =================================================================

# Global OCR Okuyucu Değişkenleri
easyocr_reader = None
pytesseract_module = None
pytesseract_available = False

def initialize_ocr():
    """
    Kullanılabilir OCR kütüphanelerini dinamik olarak yükler ve yapılandırır.
    """
    global easyocr_reader, pytesseract_module, pytesseract_available
    
    print("[*] Kullanılabilir OCR motorları kontrol ediliyor...")
    sys.stdout.flush()
    
    # 1. PyTesseract Kontrolü (Sunucuda yüklü olan öncelikli motor)
    try:
        pytesseract_module = importlib.import_module("pytesseract")
        if TESSERACT_CMD_PATH:
            pytesseract_module.pytesseract.tesseract_cmd = TESSERACT_CMD_PATH
        
        # Basit bir versiyon kontrolü ile tesseract.exe'nin çalışıp çalışmadığını doğrula
        pytesseract_module.get_tesseract_version()
        pytesseract_available = True
        print("[+] PyTesseract ve Tesseract-OCR motoru bulundu ve aktif!")
        sys.stdout.flush()
        return "pytesseract"
    except Exception:
        print("[-] PyTesseract/Tesseract-OCR kullanılamıyor, EasyOCR kontrol ediliyor...")
        sys.stdout.flush()

    # 2. EasyOCR Kontrolü (Alternatif)
    try:
        easyocr_module = importlib.import_module("easyocr")
        print("[+] EasyOCR kütüphanesi bulundu! Yükleniyor...")
        sys.stdout.flush()
        easyocr_reader = easyocr_module.Reader(['tr', 'en'], gpu=False)
        print("[+] EasyOCR başarıyla başlatıldı.")
        sys.stdout.flush()
        return "easyocr"
    except Exception:
        print("[-] EasyOCR kütüphanesi bulunamadı.")
        sys.stdout.flush()

    return None

def preprocess_and_extract(img_path, engine_name):
    """
    Görseli akıllıca kırpar, altın dairesel mozaik arka planı temizler ve metni okur.
    """
    try:
        # 1. Görseli gri tonda aç
        img = Image.open(img_path).convert('L')
        w, h = img.size
        
        # 2. Sadece en üst %16'lık reklam/logo alanını kırp (Tesseract'ın gürültü filtresine takılmaması için)
        cropped = img.crop((0, 0, w, int(h * 0.16)))
        
        # 3. Görseli 2 kat büyüterek harf kenarlarını belirginleştir
        resized = cropped.resize((w * 2, int(h * 0.16) * 2), Image.Resampling.LANCZOS)
        
        # 4. Altın mozaik çizgilerini yok etmek için düşük eşikli binarizasyon (Sınır: 65)
        # Sadece saf siyaha yakın kalın harf pikselleri siyah (0) kalır, mozaik arka plan bembeyaz (255) olur.
        fn = lambda x : 0 if x < 65 else 255
        binarized = resized.point(fn, '1')
        
        # 5. Ufak gürültü noktalarını temizlemek için Medyan Filtresi uygula
        cleaned = binarized.filter(ImageFilter.MedianFilter(size=3))
        
        # 6. OCR motoru ile oku
        text = ""
        if engine_name == "pytesseract" and pytesseract_module:
            # Tek bir düz metin satırı gibi okuması için PSM 6 ve PSM 3 kombinasyonu veya varsayılan kullanılır
            text = pytesseract_module.image_to_string(cleaned, lang="tur+eng", config="--psm 3")
        elif engine_name == "easyocr" and easyocr_reader:
            # EasyOCR için binarize edilmiş görseli geçici kaydetmek veya PIL Image olarak beslemek
            temp_path = img_path + ".ocr_temp.png"
            cleaned.save(temp_path)
            results = easyocr_reader.readtext(temp_path)
            text = " ".join([res[1] for res in results])
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
        return text.strip()
    except Exception as e:
        sys.stderr.write(f"HATA: {img_path} görseli işlenirken hata oluştu: {e}\n")
        sys.stderr.flush()
        return ""

def analyze_text(text):
    """
    Okunan metinde yasaklı marka/firma kelimelerini arar.
    """
    if not text:
        return False, []
        
    text_lower = text.lower()
    found_words = []
    
    for word in BANNED_WORDS:
        if word.lower() in text_lower:
            found_words.append(word)
            
    return len(found_words) > 0, found_words

def _scan_image_files(all_files, engine_name):
    results = []
    banned_count = 0
    clean_count = 0
    total_files = len(all_files)
    
    for idx, filename in enumerate(all_files):
        file_path = os.path.join(CACHE_DIR_PATH, filename)
        
        # Gelişmiş ön işleme ve OCR okuma
        extracted_text = preprocess_and_extract(file_path, engine_name)
        
        # Yasaklı kelime analizi yap
        is_banned, detected_keywords = analyze_text(extracted_text)
        
        if is_banned:
            banned_count += 1
            status = "MARKA REKLAMI / YASAKLI METİN 🚫"
        else:
            clean_count += 1
            status = "TEMİZ ✅"
            
        results.append({
            "filename": filename,
            "extracted_text": extracted_text.replace("\n", " "),
            "is_banned": is_banned,
            "detected_keywords": detected_keywords,
            "status": status
        })
        
        # Gelişimi konsola yazdır
        if (idx + 1) % 50 == 0 or (idx + 1) == total_files:
            print(f"-> {idx + 1}/{total_files} görsel OCR ile taranıyor... (Engellenen/Reklamlı: {banned_count}, Temiz: {clean_count})")
            sys.stdout.flush()
            
    return results, banned_count, clean_count

def _write_banned_results(f, results):
    f.write("🚫 ÜZERİNDE YASAKLI MARKA METNİ TESPİT EDİLEN AFİŞ VEYA REKLAM GÖRSELLERİ:\n")
    f.write("-" * 80 + "\n")
    bad_idx = 0
    for r in results:
        if r["is_banned"]:
            bad_idx += 1
            f.write(f"{bad_idx:3d}. [DOSYA] {r['filename']}\n")
            f.write(f"     [DURUM]   Yasaklı Kelimeler Bulundu: {r['detected_keywords']}\n")
            f.write(f"     [METİN]   Görselde Okunan Ham Metin: \"{r['extracted_text']}\"\n")
            f.write("-" * 80 + "\n")
            
    if bad_idx == 0:
        f.write("Mükemmel! Üzerinde yasaklı marka metni bulunan hiçbir görsel tespit edilmedi.\n")
        f.write("-" * 80 + "\n")

def _write_clean_results(f, results):
    f.write("\n\n" + "=" * 80 + "\n")
    f.write("✅ TEMİZ KABUL EDİLEN (ÜZERİNDE MARKA METNİ OLMAYAN) ÜRÜN GÖRSELLERİ:\n")
    f.write("=" * 80 + "\n")
    clean_idx = 0
    for r in results:
        if not r["is_banned"]:
            clean_idx += 1
            read_txt = f" (Okunan Metin: \"{r['extracted_text']}\")" if r['extracted_text'] else ""
            f.write(f"{clean_idx:4d}. Dosya: {r['filename']} | Durum: TEMİZ{read_txt}\n")

def _write_scan_report(results, engine_name, total_files, clean_count, banned_count, start_time):
    # Sonuçları engellenenler en üstte olacak şekilde sırala
    results.sort(key=lambda r: r["is_banned"], reverse=True)
    
    with open(REPORT_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("=" * 80 + "\n")
        f.write("FLORA GÖRSELLERİ ADVANCED OCR TARAMA VE METİN AUDİT SONUÇLARI\n")
        f.write("=" * 80 + "\n")
        f.write(f"Tarih             : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Taranan Klasör    : {CACHE_DIR_PATH}\n")
        f.write(f"Kullanılan OCR    : {engine_name.upper()}\n")
        f.write(f"Yasaklı Kelimeler : {BANNED_WORDS}\n")
        f.write(f"Toplam Görsel     : {total_files}\n")
        f.write(f"Temiz Görseller   : {clean_count} (%{clean_count*100/total_files:.2f})\n")
        f.write(f"Engellenen Görsel : {banned_count} (%{banned_count*100/total_files:.2f})\n")
        f.write(f"Toplam Süre       : {time.time() - start_time:.2f} saniye\n")
        f.write("=" * 80 + "\n\n")
        
        _write_banned_results(f, results)
        _write_clean_results(f, results)

def run_ocr_scan():
    print("=" * 70)
    print("FLORA ÖNBELLEK GÖRSEL ADVANCED OCR TARAMA VE YASAKLI METİN AUDİTİ")
    print("=" * 70)
    sys.stdout.flush()
    
    start_time = time.time()
    
    # OCR Motorunu Başlat
    engine_name = initialize_ocr()
    if not engine_name:
        print("\n[!] HATA: Sisteminizde ne EasyOCR ne de Tesseract-OCR motoru bulunamadı!")
        print("    Lütfen taramaya başlamadan önce Tesseract veya EasyOCR kurulumunu yapın.")
        print("=" * 70)
        sys.stdout.flush()
        return

    # Klasör kontrolü
    if not os.path.exists(CACHE_DIR_PATH):
        print(f"[!] HATA: Tarama yapılacak önbellek klasörü bulunamadı: {CACHE_DIR_PATH}")
        return
        
    all_files = [f for f in os.listdir(CACHE_DIR_PATH) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
    total_files = len(all_files)
    print(f"\n[*] Tarama Başlıyor: Toplam {total_files} adet görsel taranacak.")
    print(f"[*] Seçilen OCR Motoru: {engine_name.upper()}")
    print(f"[*] Engellenecek Marka Kelimeleri: {BANNED_WORDS}")
    sys.stdout.flush()
    
    if total_files == 0:
        print("[!] Taranacak görsel bulunamadı.")
        return
        
    results, banned_count, clean_count = _scan_image_files(all_files, engine_name)
    _write_scan_report(results, engine_name, total_files, clean_count, banned_count, start_time)
        
    print("\n" + "=" * 70)
    print("[+] ADVANCED OCR TARAMASI VE RAPORLAMA TAMAMLANDI!")
    print("=" * 70)
    print(f"- Toplam Önbellek Görseli : {total_files}")
    print(f"- Temiz Ürün Görselleri   : {clean_count} (%{clean_count*100/total_files:.1f})")
    print(f"- Engellenen Reklamlar    : {banned_count} (%{banned_count*100/total_files:.1f})")
    print(f"- Rapor Dosyası Kaydedildi: {REPORT_OUTPUT_PATH}")
    print("=" * 70)
    sys.stdout.flush()

if __name__ == "__main__":
    run_ocr_scan()
