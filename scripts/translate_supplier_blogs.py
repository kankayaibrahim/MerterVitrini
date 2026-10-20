# -*- coding: utf-8 -*-
"""
Merter Vitrini - Tedarikçi Blog Yazıları Otomatik Çok Dilli Çeviri Motoru
Sunucudaki yerel LibreTranslate motorunu kullanarak Türkçe yazılan tedarikçi
makalelerini diğer 7 aktif dile (en, ru, ar, de, fr, pl, bg) otomatik olarak çevirir ve DB'ye yazar.
"""

import os
import sys
import json
import time
from pathlib import Path
import paramiko

scripts_dir = Path(__file__).resolve().parent
from unified_deployer import SERVER_CONFIG, PROJECTS_CONFIG


def run_translation_on_server(target_languages=None):
    """Sunucu üzerinde doğrudan Python çeviri scripti çalıştırır."""
    if target_languages is None:
        target_languages = ["en", "ru", "ar", "de", "fr", "pl", "bg"]

    hostname = SERVER_CONFIG.get("hostname", "")
    port = SERVER_CONFIG.get("port", 22)
    username = SERVER_CONFIG.get("username", "root")
    auth_secret = SERVER_CONFIG.get("password", "")
    db_password = os.environ.get("DB_PASSWORD") or PROJECTS_CONFIG.get("unified", {}).get("backend", {}).get("config_template", {}).get("db_password", "DHMwK0Qzyox7")

    remote_base_dir = "/root/.merter_deploy"
    remote_worker_script = f"{remote_base_dir}/supplier_blog_translator.py"

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(hostname, port=port, username=username, password=auth_secret)

    langs_json = json.dumps(target_languages)

    remote_code = f"""# -*- coding: utf-8 -*-
import json
import time
import urllib.request
import psycopg2

TARGET_LANGS = {langs_json}
LIBRE_URL = "http://127.0.0.1:5000/translate"

def translate_text(text, target_lang, source_lang="tr"):
    if not text:
        return ""
    try:
        payload = json.dumps({{"q": text, "source": source_lang, "target": target_lang}}).encode('utf-8')
        req = urllib.request.Request(LIBRE_URL, data=payload, headers={{"Content-Type": "application/json"}})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get("translatedText", text)
    except Exception as e:
        print(f"[WARN] Translation error for lang {{target_lang}}: {{e}}")
        return text

def translate_markdown(content, target_lang):
    if not content:
        return ""
    paragraphs = content.split("\\n\\n")
    translated_paras = []
    for p in paragraphs:
        if not p.strip():
            translated_paras.append(p)
            continue
        # Başlıkları ve listeleri koruyarak çevir
        is_h1 = p.startswith("# ")
        is_h2 = p.startswith("## ")
        is_h3 = p.startswith("### ")
        is_quote = p.startswith("> ")
        is_hr = p.strip() == "---"

        if is_hr:
            translated_paras.append("---")
            continue

        raw = p
        prefix = ""
        if is_h1:
            prefix = "# "
            raw = p[2:]
        elif is_h2:
            prefix = "## "
            raw = p[3:]
        elif is_h3:
            prefix = "### "
            raw = p[4:]
        elif is_quote:
            prefix = "> "
            raw = p[2:]

        trans = translate_text(raw, target_lang)
        translated_paras.append(prefix + trans)
        time.sleep(0.05)
    return "\\n\\n".join(translated_paras)

conn = psycopg2.connect(
    dbname="merterdevdb",
    user="postgres",
    password="{db_password}",
    host="127.0.0.1",
    port=5432
)
conn.set_client_encoding('UTF8')
cur = conn.cursor()

# Henüz hedef dillerde çevirisi eksik olan tedarikçi bloglarını bul
query = '''
    SELECT b.id, b.slug, t.title, t.summary, t.content, t.meta_title, t.meta_description
    FROM catalog.blog_posts b
    JOIN catalog.blog_post_translations t ON b.id = t.post_id
    WHERE t.language_code = 'tr'
'''
cur.execute(query)
posts = cur.fetchall()

print(f"Toplam {{len(posts)}} Türkçe blog yazısı inceleniyor...")

completed_translations = 0
for post in posts:
    post_id, slug, title, summary, content, meta_title, meta_description = post
    
    for lang in TARGET_LANGS:
        # Bu dilde zaten çeviri var mı?
        cur.execute("SELECT 1 FROM catalog.blog_post_translations WHERE post_id = %s AND language_code = %s", (post_id, lang))
        if cur.fetchone():
            continue

        # Çevirileri yap
        trans_title = translate_text(title, lang)
        trans_meta_title = translate_text(meta_title, lang) if meta_title else trans_title
        trans_meta_desc = translate_text(meta_description, lang) if meta_description else ""
        trans_summary = translate_text(summary, lang) if summary else ""
        trans_content = translate_markdown(content, lang)

        # Veritabanına ekle
        cur.execute('''
            INSERT INTO catalog.blog_post_translations (
                post_id, language_code, slug, title, summary, content, meta_title, meta_description
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (post_id, language_code) DO UPDATE
            SET slug = EXCLUDED.slug,
                title = EXCLUDED.title,
                summary = EXCLUDED.summary,
                content = EXCLUDED.content,
                meta_title = EXCLUDED.meta_title,
                meta_description = EXCLUDED.meta_description;
        ''', (post_id, lang, slug, trans_title, trans_summary, trans_content, trans_meta_title, trans_meta_desc))
        conn.commit()

        completed_translations += 1
        print("[+] Translated " + str(completed_translations) + " | " + slug + " to " + lang + ": " + trans_title, flush=True)

cur.close()
conn.close()
print("DONE: " + str(completed_translations) + " translations added.", flush=True)
"""

    ssh.exec_command(f"mkdir -p {remote_base_dir}")
    remote_log_path = f"{remote_base_dir}/translator.log"

    sftp = ssh.open_sftp()
    with sftp.file(remote_worker_script, "w") as f:
        f.write(remote_code)
    sftp.close()

    print("[*] Eski çeviri process'leri temizleniyor...")
    ssh.exec_command("pkill -f supplier_blog_translator.py || true")
    time.sleep(1)

    print("[*] Sunucuda çeviri worker'ı unbuffered modda (nohup python3 -u) başlatılıyor...")
    cmd = f"nohup python3 -u {remote_worker_script} > {remote_log_path} 2>&1 &"
    ssh.exec_command(cmd)
    ssh.close()
    print("[+] Çeviri motoru sunucu arka planında başarıyla başlatıldı!")
    print(f"[*] Log takibi için: {remote_log_path}")


if __name__ == "__main__":
    run_translation_on_server()
