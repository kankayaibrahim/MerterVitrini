import os
import re
import sys
import time
import importlib
from PIL import Image, ImageFilter, ImageOps

pytesseract = None
try:
    pytesseract = importlib.import_module("pytesseract")
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
except Exception:
    pass

# Normalized substrings for brand text variants (minimum 3 letters)
BANNED_SUBSTRINGS = [
    "etik", "tika", "atika", "atiko", "etiko", "tka", "atk", "etk",
    "fash", "shio", "hion", "ash", "flor", "lora",
    "oat", "oati", "oati", "erica"  # Common Tesseract OCR garbles for atika & etika
]

def normalize_text(text):
    if not text:
        return ""
    text = text.lower()
    # Normalize Turkish specific characters to english
    text = text.replace('ı', 'i').replace('ö', 'o').replace('ü', 'u').replace('ş', 's').replace('ç', 'c').replace('ğ', 'g')
    # Remove all spaces, punctuation, and symbols
    text = re.sub(r'[^a-z0-9]', '', text)
    return text

def is_text_banned(text):
    norm = normalize_text(text)
    if not norm:
        return False, []
    
    matched = []
    for sub in BANNED_SUBSTRINGS:
        if sub in norm:
            matched.append(sub)
            
    # Capture spaced-out/stylized fuzzy combinations
    if "fas" in norm and "on" in norm:
        matched.append("fas...on")
    if "eti" in norm and "a" in norm:
        matched.append("eti...a")
        
    return len(matched) > 0, matched

def _binarize_and_filter(img, threshold):
    fn = lambda x: 0 if x < threshold else 255
    return img.point(fn, '1').filter(ImageFilter.MedianFilter(size=3))

def _test_ocr_strategy(img_variant, config, strategy_name):
    text = pytesseract.image_to_string(img_variant, lang="tur+eng", config=config)
    is_banned, matched = is_text_banned(text)
    if is_banned:
        return True, strategy_name, text.strip().replace('\n', ' '), matched
    return False, strategy_name, text.strip().replace('\n', ' '), []

def scan_image_smart(f_path):
    """
    Executes the 7-step multi-strategy high-performance OCR scan on an image path.
    Returns: (is_banned, strategy_used, raw_text, matched_substrings)
    """
    if not pytesseract:
        return False, "Error", "pytesseract module is not installed or available", []
        
    try:
        img = Image.open(f_path)
        w, h = img.size
        
        # 1. Target Crop Top 28% and Resize 2.5x using LANCZOS
        crop_h = int(h * 0.28)
        cropped = img.crop((0, 0, w, crop_h)).convert('L')
        resized = cropped.resize((int(w * 2.5), int(crop_h * 2.5)), Image.Resampling.LANCZOS)
        
        crop_h_18 = int(h * 0.18)
        cropped_18 = img.crop((0, 0, w, crop_h_18)).convert('L')
        resized_18 = cropped_18.resize((int(w * 2.5), int(crop_h_18 * 2.5)), Image.Resampling.LANCZOS)
        
        strategies = [
            (resized, "--psm 6", "S1: Grayscale Crop 28% PSM 6"),
            (ImageOps.invert(resized), "--psm 6", "S2: Inverted Grayscale Crop 28% PSM 6"),
            (_binarize_and_filter(resized, 65), "--psm 6", "S3: Binarized 65 Crop 28% PSM 6"),
            (_binarize_and_filter(resized, 180), "--psm 6", "S4: Binarized 180 Crop 28% PSM 6"),
            (_binarize_and_filter(resized, 127), "--psm 6", "S5: Binarized 127 Crop 28% PSM 6"),
            (resized, "--psm 3", "S6: Grayscale Crop 28% PSM 3"),
            (resized_18, "--psm 6", "S7: Grayscale Crop 18% PSM 6"),
        ]
        
        last_text = ""
        for img_variant, config, strategy_name in strategies:
            is_hit, strat, text, matched = _test_ocr_strategy(img_variant, config, strategy_name)
            last_text = text
            if is_hit:
                return True, strat, text, matched
                
        return False, None, last_text, []
    except Exception as e:
        return False, "Error", str(e), []

def main():
    folder_path = r"c:\Projects\mertervitrini.com.tr\admin\backend\parsers\etika_yasakli_listesi"
    if not os.path.exists(folder_path):
        print("Folder not found!")
        return
        
    files = [f for f in os.listdir(folder_path) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    print(f"Running Flawless Multi-Strategy OCR on {len(files)} banned images...")
    sys.stdout.flush()
    
    start_time = time.time()
    flagged = 0
    failures = 0
    missed_files = []
    
    for idx, f in enumerate(files):
        f_path = os.path.join(folder_path, f)
        success, strategy, text, matched = scan_image_smart(f_path)
        if success:
            flagged += 1
            print(f"[{idx+1}/{len(files)}] [FLAGGED] {f} -> Strategy: {strategy} | Text: \"{text[:60]}\" | Matched: {matched}")
        else:
            if strategy == "Error":
                failures += 1
                print(f"[{idx+1}/{len(files)}] [ERROR] {f} -> {text}")
            else:
                missed_files.append((f, text))
                print(f"[{idx+1}/{len(files)}] [MISSED] {f} -> Read text: \"{text[:60]}\"")
        sys.stdout.flush()
                
    end_time = time.time()
    
    print("\n" + "="*50)
    print("ULTIMATE SMART OCR RESULTS:")
    print("="*50)
    print(f"- Total Analyzed: {len(files)}")
    print(f"- Flagged (Banned): {flagged} ({flagged/len(files)*100:.2f}%)")
    print(f"- Missed: {len(files) - flagged} ({(len(files)-flagged)/len(files)*100:.2f}%)")
    print(f"- Failures: {failures}")
    print(f"- Total Time: {end_time - start_time:.2f} seconds")
    print(f"- Avg Time per Image: {(end_time - start_time)/len(files):.4f} seconds")
    print("="*50)

if __name__ == "__main__":
    main()
