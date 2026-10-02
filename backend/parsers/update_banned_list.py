#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Yasaklı Görseller Listesi Güncelleyici (banned_images.txt Compiler)
-------------------------------------------------------------------
Bu script, "etika_yasakli_listesi" klasörüne yeni attığınız yasaklı kapak 
görsellerinin dosya adlarını okur, mevcut "banned_images.txt" dosyasındakilerle 
akıllıca birleştirir, alfabetik olarak sıralar ve "banned_images.txt" dosyasını günceller.
"""

import os
import sys

def _load_existing_banned(banned_txt_path):
    banned_filenames = set()
    if not os.path.exists(banned_txt_path):
        return banned_filenames
    try:
        with open(banned_txt_path, "r", encoding="utf-8") as f:
            for line in f:
                name = line.strip().lower()
                if name and not name.startswith("#"):
                    banned_filenames.add(name)
        print(f"[*] Mevcut banned_images.txt dosyasından {len(banned_filenames)} kayıt yüklendi.")
    except Exception as e:
        print(f"[!] Warning: banned_images.txt okunurken hata oluştu: {e}")
    return banned_filenames

def _collect_banned_from_dir(yasakli_dir, banned_filenames):
    if not os.path.exists(yasakli_dir):
        print("[!] etika_yasakli_listesi klasörü bulunamadı, oluşturuluyor...")
        os.makedirs(yasakli_dir, exist_ok=True)
        return
        
    new_files_count = 0
    valid_exts = ('.jpg', '.jpeg', '.png', '.webp')
    try:
        for filename in os.listdir(yasakli_dir):
            filename_clean = filename.strip().lower()
            if filename_clean.endswith(valid_exts) and filename_clean not in banned_filenames:
                banned_filenames.add(filename_clean)
                new_files_count += 1
        print(f"[*] etika_yasakli_listesi klasöründen {new_files_count} yeni görsel eklendi.")
    except Exception as e:
        print(f"[!] Hata: etika_yasakli_listesi klasörü okunurken hata oluştu: {e}")

def _save_banned_list(banned_txt_path, banned_filenames):
    sorted_list = sorted(banned_filenames)
    try:
        with open(banned_txt_path, "w", encoding="utf-8") as f:
            for item in sorted_list:
                f.write(f"{item}\n")
        print(f"[+] Başarılı: banned_images.txt güncellendi! Toplam benzersiz kayıt: {len(sorted_list)}")
    except Exception as e:
        print(f"[!] Hata: Güncel banned_images.txt yazılırken hata oluştu: {e}")

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    yasakli_dir = os.path.join(script_dir, "etika_yasakli_listesi")
    banned_txt_path = os.path.join(script_dir, "banned_images.txt")
    
    banned_filenames = _load_existing_banned(banned_txt_path)
    _collect_banned_from_dir(yasakli_dir, banned_filenames)
    _save_banned_list(banned_txt_path, banned_filenames)
        
if __name__ == "__main__":
    main()
