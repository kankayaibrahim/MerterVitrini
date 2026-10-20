# -*- coding: utf-8 -*-
"""
Blog slug çakışma kontrol aracı.
"""

import json
import re
import paramiko
from unified_deployer import SERVER_CONFIG


def slugify(text: str) -> str:
    text = (
        text.replace("İ", "i")
        .replace("I", "i")
        .replace("ı", "i")
        .replace("Ğ", "g")
        .replace("ğ", "g")
        .replace("Ü", "u")
        .replace("ü", "u")
        .replace("Ş", "s")
        .replace("ş", "s")
        .replace("Ö", "o")
        .replace("ö", "o")
        .replace("Ç", "c")
        .replace("ç", "c")
        .lower()
    )
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def check_slug_overlaps() -> None:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(
        SERVER_CONFIG["hostname"],
        port=SERVER_CONFIG["port"],
        username=SERVER_CONFIG["username"],
        password=SERVER_CONFIG["password"],
    )
    _, stdout, _ = ssh.exec_command(
        "sudo -u postgres psql -d merterdevdb -t -c 'SELECT slug FROM catalog.blog_posts;'"
    )
    # Set comprehension kullanımı (Linter uyarısı çözümü)
    existing_slugs = {
        line.strip()
        for line in stdout.read().decode("utf-8").splitlines()
        if line.strip()
    }
    ssh.close()

    with open("docs/tedarikciler.json", encoding="utf-8") as f:
        suppliers = json.load(f)

    overlaps = []
    for s in suppliers:
        name = re.sub(r"XML$", "", s["name"], flags=re.IGNORECASE).strip()
        slug = slugify(name)
        if slug in existing_slugs:
            overlaps.append((name, slug))

    print(f"Existing slugs count: {len(existing_slugs)}")
    print(f"Overlaps count: {len(overlaps)}")
    if overlaps:
        print("Overlaps:", overlaps)


if __name__ == "__main__":
    check_slug_overlaps()
