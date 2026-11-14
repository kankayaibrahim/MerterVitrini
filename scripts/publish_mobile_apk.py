#!/usr/bin/env python3
"""
Merter Vitrini B2B — Android Release APK & OTA Manifest Publisher
Computes SHA-256 checksum, writes local/remote version.json, and atomically uploads
the signed APK to /var/www/media/releases/ on the production server via SFTP.
"""

import argparse
import datetime
import hashlib
import json
import os
import re
import shutil
import sys
import time

import paramiko

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, ".."))
sys.path.insert(0, SCRIPT_DIR)

import unified_deployer as deployer  # noqa: E402

REMOTE_RELEASES_DIR = "/var/www/media/releases"


def parse_pubspec_version(pubspec_path: str) -> tuple[str, int]:
    with open(pubspec_path, "r", encoding="utf-8") as fh:
        content = fh.read()
    match = re.search(r"^version:\s*(\d+\.\d+\.\d+)(?:\+(\d+))?", content, re.MULTILINE)
    if not match:
        raise RuntimeError(f"version satiri okunamadi: {pubspec_path}")
    version_name = match.group(1)
    build_num = int(match.group(2)) if match.group(2) else 1
    return version_name, build_num


def compute_sha256(file_path: str) -> str:
    digest = hashlib.sha256()
    with open(file_path, "rb") as fh:
        while True:
            chunk = fh.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def ensure_remote_dir(ssh: paramiko.SSHClient, remote_dir: str) -> None:
    _, out, err = ssh.exec_command(f"mkdir -p {remote_dir} && chmod 755 {remote_dir}")
    exit_status = out.channel.recv_exit_status()
    if exit_status != 0:
        raise RuntimeError(f"Uzak klasor olusturulamadi ({remote_dir}): {err.read().decode()}")


def upload_release_to_server(apk_path: str, apk_filename: str, manifest_bytes: bytes) -> None:
    cfg = deployer.SERVER_CONFIG
    print(f"[OTA] Sunucuya baglaniliyor: {cfg['username']}@{cfg['hostname']}:{cfg['port']} ...")
    pipeline = deployer.DeployPipeline(log_callback=print)
    ssh = pipeline._connect_ssh(max_attempts=6)

    try:
        ensure_remote_dir(ssh, REMOTE_RELEASES_DIR)
        sftp = ssh.open_sftp()
        try:
            total_size = os.path.getsize(apk_path)
            remote_tmp_apk = f"{REMOTE_RELEASES_DIR}/{apk_filename}.tmp"
            remote_final_apk = f"{REMOTE_RELEASES_DIR}/{apk_filename}"
            remote_latest_apk = f"{REMOTE_RELEASES_DIR}/mertervitrini-latest.apk"
            remote_tmp_json = f"{REMOTE_RELEASES_DIR}/version.json.tmp"
            remote_final_json = f"{REMOTE_RELEASES_DIR}/version.json"

            last_pct = -1

            def progress_cb(transferred: int, total: int) -> None:
                nonlocal last_pct
                if total <= 0:
                    return
                pct = int((transferred * 100) / total)
                if pct >= last_pct + 10 or transferred == total:
                    last_pct = pct
                    mb_done = transferred / (1024 * 1024)
                    mb_tot = total / (1024 * 1024)
                    print(f"  -> Yukleniyor: %{pct} ({mb_done:.1f} MB / {mb_tot:.1f} MB)")

            t0 = time.time()
            print(f"[OTA] Imzali APK yukleniyor ({total_size / (1024 * 1024):.2f} MB) -> {remote_final_apk}")
            sftp.put(apk_path, remote_tmp_apk, callback=progress_cb)

            with sftp.file(remote_tmp_json, "wb") as jf:
                jf.write(manifest_bytes)
        finally:
            sftp.close()

        # Atomic move, latest copy, permissions, and keep last 3 versioned APKs
        finalize_cmd = (
            f"mv -f '{remote_tmp_apk}' '{remote_final_apk}' && "
            f"cp -f '{remote_final_apk}' '{remote_latest_apk}' && "
            f"mv -f '{remote_tmp_json}' '{remote_final_json}' && "
            f"chmod 644 '{remote_final_apk}' '{remote_latest_apk}' '{remote_final_json}' && "
            f"ls -1t {REMOTE_RELEASES_DIR}/mertervitrini-v*.apk 2>/dev/null | tail -n +4 | xargs -r rm -f"
        )
        _, out, err = ssh.exec_command(finalize_cmd)
        if out.channel.recv_exit_status() != 0:
            raise RuntimeError(f"Atomik yayinlama hatasi: {err.read().decode()}")

        elapsed = time.time() - t0
        print(f"[OK] APK ve version.json canli sunucuda yayinlandi ({elapsed:.1f} sn).")
    finally:
        ssh.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish signed Android APK & OTA version.json")
    parser.add_argument(
        "--apk",
        default=os.path.join(REPO_ROOT, "mobile", "build", "app", "outputs", "flutter-apk", "app-release.apk"),
        help="Path to built app-release.apk",
    )
    parser.add_argument(
        "--pubspec",
        default=os.path.join(REPO_ROOT, "mobile", "pubspec.yaml"),
        help="Path to mobile/pubspec.yaml",
    )
    parser.add_argument("--base-url", default="https://mertervitrini.com.tr", help="Public base URL")
    parser.add_argument("--notes-tr", default="", help="Turkish release notes")
    parser.add_argument("--notes-en", default="", help="English release notes")
    parser.add_argument("--notes-ru", default="", help="Russian release notes")
    parser.add_argument("--notes-ar", default="", help="Arabic release notes")
    parser.add_argument("--notes-de", default="", help="German release notes")
    parser.add_argument("--notes-fr", default="", help="French release notes")
    parser.add_argument("--notes-pl", default="", help="Polish release notes")
    parser.add_argument("--notes-bg", default="", help="Bulgarian release notes")
    parser.add_argument("--min-build", type=int, default=1, help="Minimum supported build number")
    parser.add_argument("--force", action="store_true", help="Mark update as forced")
    parser.add_argument("--local-only", action="store_true", help="Only generate local manifest without SFTP upload")
    args = parser.parse_args()

    if not os.path.isfile(args.apk):
        print(f"[HATA] Derlenmis APK bulunamadi: {args.apk}", file=sys.stderr)
        return 1

    version_name, build_number = parse_pubspec_version(args.pubspec)
    file_size = os.path.getsize(args.apk)
    sha256_hex = compute_sha256(args.apk)
    apk_filename = f"mertervitrini-v{version_name}+{build_number}.apk"
    base_url = args.base_url.rstrip("/")

    notes_tr = args.notes_tr.strip() or (
        f"Merter Vitrini v{version_name} (Yapı #{build_number}) — "
        "Lüks editoryal vitrin tasarımı, vektörel ülke bayrakları, seri bazlı toptan sipariş, "
        "canlı üretici pazarlık sohbeti ve otomatik uygulama içi güncelleme (OTA) desteği."
    )
    notes_en = args.notes_en.strip() or (
        f"Merter Vitrini v{version_name} (Build #{build_number}) — "
        "Luxury editorial storefront, vector country flags, B2B series ordering, "
        "live supplier chat, and automatic in-app OTA self-update support."
    )
    notes_ru = args.notes_ru.strip() or (
        f"Merter Vitrini v{version_name} (#{build_number}) — "
        "Обновление оптовой B2B-витрины, заказы сериями, живой чат с поставщиком и поддержка автообновления."
    )
    notes_ar = args.notes_ar.strip() or (
        f"Merter Vitrini v{version_name} (#{build_number}) — "
        "تحديث متجر الجملة والطلب بالـسيريا والدردشة المباشرة مع الموردين ودعم التحديث التلقائي."
    )
    notes_de = args.notes_de.strip() or (
        f"Merter Vitrini v{version_name} (#{build_number}) — "
        "B2B-Großhandels-Update mit Serienbestellung, Live-Lieferantenchat und automatischem OTA-Update."
    )
    notes_fr = args.notes_fr.strip() or (
        f"Merter Vitrini v{version_name} (#{build_number}) — "
        "Mise à jour de la boutique B2B, commandes par séries, chat fournisseur en direct et mise à jour OTA."
    )
    notes_pl = args.notes_pl.strip() or (
        f"Merter Vitrini v{version_name} (#{build_number}) — "
        "Aktualizacja hurtowni B2B, zamówienia seriami, czat z dostawcą i automatyczna aktualizacja OTA."
    )
    notes_bg = args.notes_bg.strip() or (
        f"Merter Vitrini v{version_name} (#{build_number}) — "
        "Актуализация на B2B витрината, поръчки на серии, директен чат с доставчици и автоматично OTA обновяване."
    )

    now_iso = datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat(timespec="seconds")

    manifest = {
        "app_name": "Merter Vitrini",
        "package_id": "com.mertervitrini.app",
        "version": version_name,
        "build_number": build_number,
        "min_build_number": max(1, args.min_build),
        "force_update": bool(args.force),
        "apk_filename": apk_filename,
        "download_url": f"{base_url}/api/v1/mobile/apk?v={version_name}.{build_number}",
        "direct_cdn_url": f"{base_url}/uploads/releases/{apk_filename}",
        "web_page_url": f"{base_url}/mobil-uygulama",
        "sha256": sha256_hex,
        "file_size_bytes": file_size,
        "published_at": now_iso,
        "apk_available": True,
        "release_notes": {
            "tr": notes_tr,
            "en": notes_en,
            "ru": notes_ru,
            "ar": notes_ar,
            "de": notes_de,
            "fr": notes_fr,
            "pl": notes_pl,
            "bg": notes_bg,
        },
    }

    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")

    # Save local copy for local Go backend testing
    local_releases_dir = os.path.join(REPO_ROOT, "backend", "uploads", "releases")
    os.makedirs(local_releases_dir, exist_ok=True)
    shutil.copy2(args.apk, os.path.join(local_releases_dir, apk_filename))
    shutil.copy2(args.apk, os.path.join(local_releases_dir, "mertervitrini-latest.apk"))
    with open(os.path.join(local_releases_dir, "version.json"), "wb") as lf:
        lf.write(manifest_bytes)

    print(f"[OTA] Surum     : v{version_name} (Build #{build_number})")
    print(f"[OTA] Dosya     : {apk_filename} ({file_size / (1024 * 1024):.2f} MB)")
    print(f"[OTA] SHA-256   : {sha256_hex}")

    if not args.local_only:
        upload_release_to_server(args.apk, apk_filename, manifest_bytes)
        print(f"[OTA] Indirme Sayfasi : {base_url}/mobil-uygulama")
        print(f"[OTA] Direkt APK Link : {base_url}/api/v1/mobile/apk")
        print(f"[OTA] Versiyon JSON   : {base_url}/api/v1/mobile/version")

    return 0


if __name__ == "__main__":
    sys.exit(main())

