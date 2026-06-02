import os
from PIL import Image

def convert_png_to_webp():
    banners_dir = r"c:\Projects\mertervitrini.com.tr\shop\frontend\public\banners"
    print(f"Scanning directory: {banners_dir}")
    
    for filename in os.listdir(banners_dir):
        if filename.endswith(".png"):
            png_path = os.path.join(banners_dir, filename)
            webp_filename = filename.replace(".png", ".webp")
            webp_path = os.path.join(banners_dir, webp_filename)
            
            print(f"Converting {filename} ({os.path.getsize(png_path) / 1024:.1f} KB) to WebP...")
            try:
                with Image.open(png_path) as img:
                    # Convert transparent background to RGB if necessary, although these seem to be full photos
                    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                        # Keep alpha channel since WebP supports transparency
                        img.save(webp_path, "WEBP", quality=85)
                    else:
                        img.save(webp_path, "WEBP", quality=85)
                print(f"Successfully saved {webp_filename} ({os.path.getsize(webp_path) / 1024:.1f} KB)")
            except Exception as e:
                print(f"Error converting {filename}: {e}")

if __name__ == "__main__":
    convert_png_to_webp()
