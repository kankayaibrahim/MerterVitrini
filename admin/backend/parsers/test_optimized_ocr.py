import os
import re
import sys
import time
import pytesseract
from PIL import Image, ImageFilter, ImageOps

# Exact path to Tesseract in Windows
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

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

def scan_image_smart(f_path):
    """
    Executes the 7-step multi-strategy high-performance OCR scan on an image path.
    Returns: (is_banned, strategy_used, raw_text, matched_substrings)
    """
    try:
        img = Image.open(f_path)
        w, h = img.size
        
        # 1. Target Crop Top 28% and Resize 2.5x using LANCZOS
        crop_h = int(h * 0.28)
        cropped = img.crop((0, 0, w, crop_h)).convert('L')
        resized = cropped.resize((int(w * 2.5), int(crop_h * 2.5)), Image.Resampling.LANCZOS)
        
        # Strategy 1: Raw Grayscale PSM 6
        text = pytesseract.image_to_string(resized, lang="tur+eng", config="--psm 6")
        is_banned, matched = is_text_banned(text)
        if is_banned:
            return True, "S1: Grayscale Crop 28% PSM 6", text.strip().replace('\n', ' '), matched
            
        # Strategy 2: Inverted Grayscale PSM 6 (For white text on dark background)
        inverted = ImageOps.invert(resized)
        text = pytesseract.image_to_string(inverted, lang="tur+eng", config="--psm 6")
        is_banned, matched = is_text_banned(text)
        if is_banned:
            return True, "S2: Inverted Grayscale Crop 28% PSM 6", text.strip().replace('\n', ' '), matched
            
        # Strategy 3: Binarized with Threshold 65, PSM 6
        fn_65 = lambda x : 0 if x < 65 else 255
        bin_65 = resized.point(fn_65, '1').filter(ImageFilter.MedianFilter(size=3))
        text = pytesseract.image_to_string(bin_65, lang="tur+eng", config="--psm 6")
        is_banned, matched = is_text_banned(text)
        if is_banned:
            return True, "S3: Binarized 65 Crop 28% PSM 6", text.strip().replace('\n', ' '), matched

        # Strategy 4: Binarized with Threshold 180, PSM 6
        fn_180 = lambda x : 0 if x < 180 else 255
        bin_180 = resized.point(fn_180, '1').filter(ImageFilter.MedianFilter(size=3))
        text = pytesseract.image_to_string(bin_180, lang="tur+eng", config="--psm 6")
        is_banned, matched = is_text_banned(text)
        if is_banned:
            return True, "S4: Binarized 180 Crop 28% PSM 6", text.strip().replace('\n', ' '), matched

        # Strategy 5: Binarized with Threshold 127, PSM 6
        fn_127 = lambda x : 0 if x < 127 else 255
        bin_127 = resized.point(fn_127, '1').filter(ImageFilter.MedianFilter(size=3))
        text = pytesseract.image_to_string(bin_127, lang="tur+eng", config="--psm 6")
        is_banned, matched = is_text_banned(text)
        if is_banned:
            return True, "S5: Binarized 127 Crop 28% PSM 6", text.strip().replace('\n', ' '), matched

        # Strategy 6: Raw Grayscale PSM 3 (Backup segmentation)
        text = pytesseract.image_to_string(resized, lang="tur+eng", config="--psm 3")
        is_banned, matched = is_text_banned(text)
        if is_banned:
            return True, "S6: Grayscale Crop 28% PSM 3", text.strip().replace('\n', ' '), matched

        # Strategy 7: Smaller Grayscale Crop 18% PSM 6 (To eliminate busy background patterns)
        crop_h_18 = int(h * 0.18)
        cropped_18 = img.crop((0, 0, w, crop_h_18)).convert('L')
        resized_18 = cropped_18.resize((int(w * 2.5), int(crop_h_18 * 2.5)), Image.Resampling.LANCZOS)
        text = pytesseract.image_to_string(resized_18, lang="tur+eng", config="--psm 6")
        is_banned, matched = is_text_banned(text)
        if is_banned:
            return True, "S7: Grayscale Crop 18% PSM 6", text.strip().replace('\n', ' '), matched

        return False, None, text.strip().replace('\n', ' '), []
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
