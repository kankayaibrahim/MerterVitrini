import os
import sys
from pathlib import Path
import paramiko

scripts_dir = Path(__file__).resolve().parent
from unified_deployer import SERVER_CONFIG, PROJECTS_CONFIG

def publish_full():
    hostname = SERVER_CONFIG.get("hostname", "")
    port = SERVER_CONFIG.get("port", 22)
    username = SERVER_CONFIG.get("username", "root")
    auth_secret = SERVER_CONFIG.get("password", "")
    db_password = os.environ.get("DB_PASSWORD") or PROJECTS_CONFIG.get("unified", {}).get("backend", {}).get("config_template", {}).get("db_password", "DHMwK0Qzyox7")

    slug = "butik-acacaklar-icin-merter-toptan-kadin-giyim-rehberi"
    cover_image = "/banners/hero_women_collection.webp"
    title = "Butik Açacaklar İçin Merter Toptan Kadın Giyim Satın Alma Rehberi"
    meta_title = "Butik Açacaklar İçin Merter Toptan Kadın Giyim Rehberi"
    meta_description = "Butik veya e-ticaret mağazası açmak isteyenler için Merter'den toptan kadın giyim alım rehberi. İmalatçı bulma, seri mantığı, kar marjları ve B2B tüyoları."
    summary = "Yeni bir kadın giyim butiği veya e-ticaret mağazası açarken Merter tekstil piyasasından doğrudan üretici fiyatlarıyla toptan alım yapma, seri mantığı ve kar marjlarını yönetme rehberi."

    article_path = Path(__file__).resolve().parent.parent / "docs" / "makale_01_butik_acacaklar_icin_merter_toptan_rehberi.txt"
    with open(article_path, "r", encoding="utf-8") as f:
        full_text = f.read()

    content_idx = full_text.find("# Butik Açacaklar")
    if content_idx != -1:
        content = full_text[content_idx:].strip()
    else:
        content = full_text.strip()

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(hostname, port=port, username=username, password=auth_secret)

    # Use parameterized SQL via python script on remote server or safely escaped heredoc
    remote_script = "/tmp/insert_article.py"
    sftp = ssh.open_sftp()
    
    remote_python_code = f"""# -*- coding: utf-8 -*-
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

slug = {repr(slug)}
cover_image = {repr(cover_image)}
title = {repr(title)}
meta_title = {repr(meta_title)}
meta_description = {repr(meta_description)}
summary = {repr(summary)}
content = {repr(content)}

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

# 2. Upsert translation
cur.execute('''
    INSERT INTO catalog.blog_post_translations (post_id, language_code, title, summary, content, meta_title, meta_description)
    VALUES (%s, 'tr', %s, %s, %s, %s, %s)
    ON CONFLICT (post_id, language_code) DO UPDATE
    SET title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        content = EXCLUDED.content,
        meta_title = EXCLUDED.meta_title,
        meta_description = EXCLUDED.meta_description;
''', (post_id, title, summary, content, meta_title, meta_description))

conn.commit()
print("SUCCESS: Post ID", post_id)
cur.close()
conn.close()
"""
    with sftp.file(remote_script, "wb") as f:
        f.write(remote_python_code.encode("utf-8"))
    sftp.close()

    _, stdout, stderr = ssh.exec_command(f"python3 {remote_script}")
    out = stdout.read().decode("utf-8")
    err = stderr.read().decode("utf-8")
    print("Execution output:", out)
    if err:
        print("Execution stderr:", err)

    ssh.exec_command(f"rm -f {remote_script}")
    ssh.close()

if __name__ == "__main__":
    publish_full()
