import os
from PIL import Image

def convert_png_to_webp():
    banners_dir = r"c:\Projects\mertervitrini.com.tr\shop\frontend\public\banners"
    print(f"Scanning directory: {banners_dir}")
    
    for filename in os.listdir(banners_dir):
        if filename.endswith(".png"):
            png_path = os.path.join(banners_dir, filename)
            
            # 1. Save standard desktop version
            webp_filename = filename.replace(".png", ".webp")
            webp_path = os.path.join(banners_dir, webp_filename)
            
            print(f"Converting {filename} to standard WebP...")
            try:
                with Image.open(png_path) as img:
                    img.save(webp_path, "WEBP", quality=80)
                print(f"Saved standard: {webp_filename} ({os.path.getsize(webp_path) / 1024:.1f} KB)")
            except Exception as e:
                print(f"Error standard: {filename}: {e}")
            
            # 2. Save mobile version (resized to width 640, keeping aspect ratio)
            mobile_filename = filename.replace(".png", "_mobile.webp")
            mobile_path = os.path.join(banners_dir, mobile_filename)
            
            print(f"Converting {filename} to mobile WebP...")
            try:
                with Image.open(png_path) as img:
                    w, h = img.size
                    mobile_w = 640
                    mobile_h = int(h * (mobile_w / w))
                    
                    img_resized = img.resize((mobile_w, mobile_h), Image.Resampling.LANCZOS)
                    img_resized.save(mobile_path, "WEBP", quality=80)
                print(f"Saved mobile: {mobile_filename} ({os.path.getsize(mobile_path) / 1024:.1f} KB)")
            except Exception as e:
                print(f"Error mobile: {filename}: {e}")

if __name__ == "__main__":
    convert_png_to_webp()
