#!/usr/bin/env python3
import os
import sys
import subprocess
import tarfile
import tempfile
import json
import argparse
import threading
import time
import paramiko

# Fallback wrapper for PySide6
try:
    from PySide6 import QtCore, QtGui, QtWidgets
    from PySide6.QtCore import Qt, QThread, Signal
    PYSIDE_AVAILABLE = True
except ImportError:
    PYSIDE_AVAILABLE = False

# ==============================================================================
# CONFIGURATION
# ==============================================================================
SERVER_CONFIG = {
    "hostname": "213.202.255.80",
    "port": 22,
    "username": "root",
    "password": "02vMhY8Xgi"
}

PROJECTS_CONFIG = {
    "admin": {
        "name": "Admin Suite",
        "frontend": {
            "path": "admin/frontend",
            "remote_dir": "/var/www/admin.mertervitrini.com.tr/frontend",
            "archive_name": "admin_frontend.tar.gz"
        },
        "backend": {
            "path": "admin/backend",
            "remote_dir": "/var/www/admin.mertervitrini.com.tr/backend",
            "binary_name": "admin-backend",
            "service_name": "admin-backend",
            "config_template": {
                "db_host": "localhost",
                "db_port": "5432",
                "db_user": "postgres",
                "db_password": "DHMwK0Qzyox7",
                "db_name": "merterdevdb",
                "jwt_secret": "merter-vitrini-super-secret-key-change-in-prod",
                "server_port": "8085",
                "disable_otp": True,
                "log_format": "text",
                "keycloak_url": "https://auth.mertervitrini.com.tr",
                "keycloak_realm": "merter",
                "keycloak_client_id": "admin-client",
                "keycloak_client_secret": "KcAdminClientSecret02vMhY8",
                "keycloak_public_key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuCdrk6NMm3+dvWzRdxxSyuCPXj4XCFzxsptRGXv1YFNzujnXlVIKsR9miSz8NHWonrRbOIHofcAXJu3r9X/VeR7deprxbOALJQDNwhPtLM8zxUyUU4mpqkBdfnPouDEPhWu3tBWZrWooAaZj/Ec2I4BZTv+2IaeZAaUeKgUHmxL8BLNtYMNxoI5xFHYI+vQ3XbCzHFAYQr8/NaXYkb+QAD58AB8wxMGYkQ3eeV/uRGVQ01CjmqfDbug4p+u1rrqPXUfhbp4LJIPJiOY5hIrnufmmpMYl6g+lV8JYmV0bws30Whi1PauD/INqYCWNCasaC/eagwoX8w0WIyPAo/YsLwIDAQAB"
            }
        }
    },
    "shop": {
        "name": "Shop Storefront",
        "frontend": {
            "path": "shop/frontend",
            "remote_dir": "/var/www/mertervitrini.com.tr/frontend",
            "archive_name": "shop_frontend.tar.gz"
        },
        "backend": {
            "path": "shop/backend",
            "remote_dir": "/var/www/mertervitrini.com.tr/backend",
            "binary_name": "shop-backend",
            "service_name": "shop-backend",
            "config_template": {
                "db_host": "localhost",
                "db_port": "5432",
                "db_user": "postgres",
                "db_password": "DHMwK0Qzyox7",
                "db_name": "merterdevdb",
                "server_port": "8081",
                "log_format": "text",
                "keycloak_url": "https://auth.mertervitrini.com.tr",
                "keycloak_realm": "merter",
                "keycloak_client_id": "admin-client",
                "keycloak_client_secret": "KcAdminClientSecret02vMhY8",
                "keycloak_public_key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuCdrk6NMm3+dvWzRdxxSyuCPXj4XCFzxsptRGXv1YFNzujnXlVIKsR9miSz8NHWonrRbOIHofcAXJu3r9X/VeR7deprxbOALJQDNwhPtLM8zxUyUU4mpqkBdfnPouDEPhWu3tBWZrWooAaZj/Ec2I4BZTv+2IaeZAaUeKgUHmxL8BLNtYMNxoI5xFHYI+vQ3XbCzHFAYQr8/NaXYkb+QAD58AB8wxMGYkQ3eeV/uRGVQ01CjmqfDbug4p+u1rrqPXUfhbp4LJIPJiOY5hIrnufmmpMYl6g+lV8JYmV0bws30Whi1PauD/INqYCWNCasaC/eagwoX8w0WIyPAo/YsLwIDAQAB"
            }
        }
    }
}

# ==============================================================================
# PIPELINE RUNNER LOGIC (COMPILATION & SFTP DEPLOYMENT)
# ==============================================================================
class DeployPipeline:
    def __init__(self, log_callback=print, remote_build=False):
        self.log = log_callback
        self.remote_build = remote_build
        # Find repo root dir
        self.script_dir = os.path.dirname(os.path.abspath(__file__))
        self.root_dir = os.path.abspath(os.path.join(self.script_dir, ".."))
        self.timings = []

    def record_time(self, project, component, step, duration):
        self.timings.append({
            "project": project,
            "component": component,
            "step": step,
            "duration": duration
        })

    def get_summary_report_str(self):
        if not self.timings:
            return "Ölçülen işlem adımı bulunamadı."
            
        lines = []
        lines.append("="*60)
        lines.append("         İŞLEM PERFORMANS VE ZAMANLAMA RAPORU")
        lines.append("="*60)
        
        # Group by project & component
        grouped = {}
        for item in self.timings:
            key = (item["project"], item["component"])
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(item)
            
        total_pipeline_time = 0.0
        
        for (proj, comp), steps in grouped.items():
            proj_name = PROJECTS_CONFIG.get(proj, {}).get("name", proj)
            comp_name = "Backend (Go)" if comp == "backend" else "Frontend (Next.js)"
            lines.append(f"\n[+] {proj_name} - {comp_name}:")
            
            total_step_time = 0.0
            for s in steps:
                dur = s["duration"]
                total_step_time += dur
                total_pipeline_time += dur
                lines.append(f"  - {s['step']}: {dur:.2f} sn")
            lines.append(f"  * Toplam Alt Süre: {total_step_time:.2f} sn")
            
        lines.append("\n" + "="*60)
        lines.append(f"GENEL TOPLAM SÜRE: {total_pipeline_time:.2f} sn")
        lines.append("="*60)
        return "\n".join(lines)

    def log_summary_report(self):
        self.log(self.get_summary_report_str())

    def run_local(self, cmd, cwd=None):
        self.log(f"[RUNNING LOCAL] {cmd} in {cwd or 'root'}")
        p = subprocess.Popen(
            cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=cwd,
            text=True,
            encoding="utf-8",
            bufsize=1
        )
        for line in p.stdout:
            self.log(line.strip())
        p.wait()
        if p.returncode != 0:
            raise Exception(f"Local command failed with exit code: {p.returncode}")

    def build_backend(self, proj_key):
        self.log(f"\n==================================================")
        self.log(f" BUILDING BACKEND FOR: {proj_key.upper()}")
        self.log(f"==================================================")
        cfg = PROJECTS_CONFIG[proj_key]["backend"]
        proj_path = os.path.join(self.root_dir, cfg["path"])
        bin_dir = os.path.join(proj_path, "bin")
        os.makedirs(bin_dir, exist_ok=True)

        # Cross-compile for Linux (amd64)
        binary_path = os.path.join(bin_dir, cfg["binary_name"])
        self.log(f"[BUILD] Cross-compiling Go for Linux (amd64) -> {binary_path}")
        
        # Build environments
        env_vars = "set GOOS=linux&& set GOARCH=amd64&& " if sys.platform == "win32" else "export GOOS=linux && export GOARCH=amd64 && "
        build_cmd = f"{env_vars}go build -o bin/{cfg['binary_name']} ."
        
        t_start = time.time()
        self.run_local(build_cmd, cwd=proj_path)
        t_end = time.time()
        
        if os.path.exists(binary_path):
            size_mb = os.path.getsize(binary_path) / (1024 * 1024)
            self.log(f"[OK] Backend compilation completed successfully! ({size_mb:.2f} MB)")
            self.record_time(proj_key, "backend", "Go Derleme (Cross-Compile)", t_end - t_start)
        else:
            raise Exception("Go binary not generated after build.")

    def build_frontend(self, proj_key):
        self.log(f"\n==================================================")
        self.log(f" BUILDING FRONTEND FOR: {proj_key.upper()}")
        self.log(f"==================================================")
        
        if self.remote_build:
            self.log("[BUILD] Remote build selected. Local Next.js compilation skipped.")
            return

        cfg = PROJECTS_CONFIG[proj_key]["frontend"]
        proj_path = os.path.join(self.root_dir, cfg["path"])
        
        # Check npm directory
        if not os.path.exists(os.path.join(proj_path, "package.json")):
            self.log(f"[WARNING] package.json not found in {proj_path}. Skipping.")
            return

        self.log("[BUILD] Running Next.js production compilation...")
        build_cmd = "cmd.exe /c npm run build" if sys.platform == "win32" else "npm run build"
        
        t_start = time.time()
        self.run_local(build_cmd, cwd=proj_path)
        t_end = time.time()
        
        out_dir = os.path.join(proj_path, "out")
        if os.path.exists(out_dir):
            self.log(f"[OK] Next.js frontend compiled successfully! Static out folder ready.")
            self.record_time(proj_key, "frontend", "Next.js Yerel Derleme (npm run build)", t_end - t_start)
        else:
            raise Exception("Static 'out' folder not found after build.")

    def deploy_backend(self, proj_key):
        self.log(f"\n==================================================")
        self.log(f" DEPLOYING BACKEND FOR: {proj_key.upper()}")
        self.log(f"==================================================")
        cfg = PROJECTS_CONFIG[proj_key]["backend"]
        local_bin = os.path.abspath(os.path.join(self.root_dir, cfg["path"], "bin", cfg["binary_name"]))
        
        if not os.path.exists(local_bin):
            raise Exception(f"Compiled binary not found: {local_bin}. Please build it first.")

        t_ssh_start = time.time()
        ssh = self._connect_ssh()
        t_ssh_end = time.time()
        self.record_time(proj_key, "backend", "SSH Bağlantı Kurulması", t_ssh_end - t_ssh_start)

        try:
            t_upload_start = time.time()
            # 1. Stop service
            self._ssh_cmd(ssh, f"systemctl stop {cfg['service_name']} || true")

            # 2. Upload Binary & Config
            sftp = ssh.open_sftp()
            remote_bin_dir = f"{cfg['remote_dir']}/bin"
            self._ssh_cmd(ssh, f"mkdir -p {remote_bin_dir}")
            
            remote_bin_path = f"{remote_bin_dir}/{cfg['binary_name']}"
            self.log(f"[UPLOAD] SFTP Uploading Go Binary: {local_bin} -> {remote_bin_path}")
            sftp.put(local_bin, remote_bin_path)
            sftp.chmod(remote_bin_path, 0o755)

            # Upload example config
            local_example = os.path.abspath(os.path.join(self.root_dir, cfg["path"], "bin", "config.json.example"))
            if os.path.exists(local_example):
                sftp.put(local_example, f"{remote_bin_dir}/config.json.example")

            # Generate and upload production config
            prod_config_path = f"{remote_bin_dir}/config.json"
            self.log(f"[CONFIG] Generation for Remote Production -> {prod_config_path}")
            
            with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".json") as tmp:
                json.dump(cfg["config_template"], tmp, indent=4)
                tmp_path = tmp.name

            try:
                sftp.put(tmp_path, prod_config_path)
            finally:
                os.remove(tmp_path)

            # For admin, upload custom parsers
            if proj_key == "admin":
                remote_parsers_dir = f"{remote_bin_dir}/parsers"
                self._ssh_cmd(ssh, f"mkdir -p {remote_parsers_dir}")
                for parser_name in ["janes.py", "blackfashion.py", "etika.py", "banned_images.txt"]:
                    local_parser = os.path.abspath(os.path.join(self.root_dir, "admin", "backend", "parsers", parser_name))
                    if os.path.exists(local_parser):
                        self.log(f"[UPLOAD] SFTP Uploading Custom {parser_name} -> {remote_parsers_dir}/{parser_name}")
                        sftp.put(local_parser, f"{remote_parsers_dir}/{parser_name}")
                        sftp.chmod(f"{remote_parsers_dir}/{parser_name}", 0o755)

            sftp.close()
            t_upload_end = time.time()
            self.record_time(proj_key, "backend", "SFTP Dosya ve Konfigürasyon Yükleme", t_upload_end - t_upload_start)

            t_service_start = time.time()
            # 3. Provision systemd service
            self.log("[SYSTEMD] Configuring backend daemon service...")
            systemd_content = f"""[Unit]
Description=Merter Vitrini {PROJECTS_CONFIG[proj_key]['name']} Backend Service
After=network.target
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory={remote_bin_dir}
ExecStart={remote_bin_dir}/{cfg['binary_name']}
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"""
            with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".service") as tmp:
                tmp.write(systemd_content)
                tmp_path = tmp.name

            try:
                sftp = ssh.open_sftp()
                sftp.put(tmp_path, f"/etc/systemd/system/{cfg['service_name']}.service")
                sftp.close()
            finally:
                os.remove(tmp_path)

            # 4. Daemon reload and restart
            self._ssh_cmd(ssh, "systemctl daemon-reload")
            self._ssh_cmd(ssh, f"systemctl enable {cfg['service_name']}")
            self._ssh_cmd(ssh, f"systemctl restart {cfg['service_name']}")
            self._ssh_cmd(ssh, "systemctl restart nginx || true")

            # 5. Status check
            self._ssh_cmd(ssh, f"systemctl status {cfg['service_name']} --no-pager")
            t_service_end = time.time()
            self.record_time(proj_key, "backend", "Servis Kurulumu ve Nginx Yeniden Başlatma", t_service_end - t_service_start)
            self.log(f"[OK] Backend suite successfully deployed!")

        finally:
            ssh.close()

    def deploy_frontend(self, proj_key):
        self.log(f"\n==================================================")
        self.log(f" DEPLOYING FRONTEND FOR: {proj_key.upper()}")
        self.log(f"==================================================")
        cfg = PROJECTS_CONFIG[proj_key]["frontend"]
        
        if self.remote_build:
            # REMOTE BUILD & DEPLOY FLOW (Saves bandwidth: uploads ~5MB sources, builds on server)
            self.log("[REMOTE-BUILD] Preparing to build and deploy directly on the remote server...")
            archive_name = cfg["archive_name"].replace(".tar.gz", "_sources.tar.gz")
            archive_path = os.path.join(self.script_dir, archive_name)
            
            # Archive source code
            self.log("[ARCHIVE] Packaging frontend source files (excluding build cache & node_modules)...")
            parent_dir = os.path.join(self.root_dir, os.path.dirname(cfg["path"]))
            base_dir = os.path.basename(cfg["path"]) # "frontend"
            
            t_tar_start = time.time()
            has_native_tar = True
            try:
                res = subprocess.run(["tar", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                if res.returncode != 0:
                    has_native_tar = False
            except Exception:
                has_native_tar = False

            if has_native_tar:
                self.log("[ARCHIVE] Using high-performance native tar to package sources...")
                try:
                    subprocess.run(
                        ["tar", "-czf", archive_path, "-C", parent_dir, 
                         "--exclude=node_modules", "--exclude=.next", "--exclude=out", "--exclude=.git", base_dir],
                        check=True,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE
                    )
                except Exception as e:
                    self.log(f"[ARCHIVE][WARNING] Native tar failed ({e}), falling back to Python tarfile...")
                    has_native_tar = False

            if not has_native_tar:
                self.log("[ARCHIVE] Using Python tarfile module to package sources (slow)...")
                with tarfile.open(archive_path, "w:gz") as tar:
                    src_path = os.path.join(parent_dir, base_dir)
                    for root, dirs, files in os.walk(src_path):
                        dirs[:] = [d for d in dirs if d not in ["node_modules", ".next", "out", ".git"]]
                        for file in files:
                            full_path = os.path.join(root, file)
                            rel_path = os.path.relpath(full_path, parent_dir)
                            tar.add(full_path, arcname=rel_path)

            t_tar_end = time.time()
            self.record_time(proj_key, "frontend", "Kaynak Kodları Sıkıştırma (Tar)", t_tar_end - t_tar_start)
            self.log(f"[ARCHIVE] Package created -> {archive_path} ({os.path.getsize(archive_path) / (1024*1024):.2f} MB)")

            t_ssh_start = time.time()
            ssh = self._connect_ssh()
            t_ssh_end = time.time()
            self.record_time(proj_key, "frontend", "SSH Bağlantı Kurulması", t_ssh_end - t_ssh_start)

            try:
                # 1. Ensure remote build root
                build_root = f"/var/www/build/{proj_key}"
                self._ssh_cmd(ssh, f"mkdir -p {build_root}")

                # 2. Upload Sources (Pipelined)
                sftp = ssh.open_sftp()
                remote_archive = f"{build_root}/{archive_name}"
                self.log(f"[UPLOAD] SFTP Uploading Sources (Pipelined): {archive_path} -> {remote_archive}")
                
                t_upload_start = time.time()
                with open(archive_path, "rb") as local_f:
                    with sftp.open(remote_archive, "wb") as remote_f:
                        remote_f.set_pipelined(True)
                        while True:
                            chunk = local_f.read(128 * 1024)
                            if not chunk:
                                break
                            remote_f.write(chunk)
                sftp.close()
                t_upload_end = time.time()
                self.record_time(proj_key, "frontend", "Kaynak Kod SFTP Yükleme", t_upload_end - t_upload_start)
                self.log(f"[UPLOAD] Upload completed in {t_upload_end - t_upload_start:.2f} seconds!")

                # 3. Extract remotely
                self.log("[EXTRACT] Extracting sources on production server...")
                t_extract_start = time.time()
                self._ssh_cmd(ssh, f"tar -xzf {remote_archive} -C {build_root}")
                self._ssh_cmd(ssh, f"rm -f {remote_archive}")
                t_extract_end = time.time()
                self.record_time(proj_key, "frontend", "Sunucuda Arşiv Açma (Tar Extract)", t_extract_end - t_extract_start)

                # 4. Run Build on Server
                self.log("[REMOTE-BUILD] Running npm install & production compilation on server (first time may take 1-2 mins, cached later)...")
                self.log("[REMOTE-BUILD] Running: npm install")
                t_rembuild_start = time.time()
                self._ssh_cmd(ssh, f"cd {build_root}/frontend && npm install --no-audit --no-fund")
                self.log("[REMOTE-BUILD] Running: npm run build")
                self._ssh_cmd(ssh, f"cd {build_root}/frontend && npm run build")
                t_rembuild_end = time.time()
                self.record_time(proj_key, "frontend", "Sunucuda Next.js Derleme (npm install + build)", t_rembuild_end - t_rembuild_start)

                # 5. Sync to final Nginx directory
                self.log("[REMOTE-DEPLOY] Copying compiled static pages to Nginx directory...")
                t_sync_start = time.time()
                self._ssh_cmd(ssh, f"mkdir -p {cfg['remote_dir']}")
                deploy_cmd = (
                    f"rsync -a --delete --exclude='uploads' {build_root}/frontend/out/ {cfg['remote_dir']}/ "
                    f"|| (find {cfg['remote_dir']}/ -mindepth 1 -maxdepth 1 ! -name 'uploads' -exec rm -rf {{}} + && cp -r {build_root}/frontend/out/* {cfg['remote_dir']}/)"
                )
                self._ssh_cmd(ssh, deploy_cmd)

                # 6. Secure symlinks for persistent media storage
                self.log("[REMOTE-DEPLOY] Securing persistent media storage symbolic link...")
                self._ssh_cmd(ssh, f"mkdir -p /var/www/media/products/edusa /var/www/media/products/flora /var/www/media/products/noir")
                self._ssh_cmd(ssh, f"chmod -R 755 /var/www/media")
                self._ssh_cmd(ssh, f"rm -rf {cfg['remote_dir']}/uploads")
                self._ssh_cmd(ssh, f"ln -sfn /var/www/media {cfg['remote_dir']}/uploads")

                # 7. Nginx Reload
                self._ssh_cmd(ssh, "systemctl restart nginx || true")
                t_sync_end = time.time()
                self.record_time(proj_key, "frontend", "Nginx Klasörüne Senkronizasyon & Restart", t_sync_end - t_sync_start)
                self.log(f"[OK] Frontend suite successfully built and deployed on production server!")

            finally:
                ssh.close()
                if os.path.exists(archive_path):
                    os.remove(archive_path)
            return

        # LOCAL BUILD & DEPLOY FLOW (Compiles locally, uploads full compiled 'out' directory)
        local_out = os.path.abspath(os.path.join(self.root_dir, cfg["path"], "out"))
        
        if not os.path.exists(local_out):
            raise Exception(f"Compiled Next.js assets not found: {local_out}. Please build it first.")

        # Archive files
        self.log("[ARCHIVE] Packaging static out files for SFTP upload...")
        archive_path = os.path.join(self.script_dir, cfg["archive_name"])
        
        t_tar_start = time.time()
        # Check if native high-performance tar is available
        has_native_tar = True
        try:
            res = subprocess.run(["tar", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if res.returncode != 0:
                has_native_tar = False
        except Exception:
            has_native_tar = False

        if has_native_tar:
            self.log("[ARCHIVE] Using high-performance native tar for packaging...")
            parent_dir = os.path.dirname(local_out)
            base_dir = os.path.basename(local_out)
            try:
                subprocess.run(
                    ["tar", "-czf", archive_path, "-C", parent_dir, base_dir],
                    check=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
            except Exception as e:
                self.log(f"[ARCHIVE][WARNING] Native tar failed ({e}), falling back to Python tarfile...")
                has_native_tar = False

        if not has_native_tar:
            self.log("[ARCHIVE] Using standard Python tarfile module (slow)...")
            with tarfile.open(archive_path, "w:gz") as tar:
                tar.add(local_out, arcname=os.path.basename(local_out))
                
        t_tar_end = time.time()
        self.record_time(proj_key, "frontend", "Statik Çıktıları Sıkıştırma (Tar)", t_tar_end - t_tar_start)
        self.log(f"[ARCHIVE] Package created -> {archive_path} ({os.path.getsize(archive_path) / (1024*1024):.2f} MB)")

        t_ssh_start = time.time()
        ssh = self._connect_ssh()
        t_ssh_end = time.time()
        self.record_time(proj_key, "frontend", "SSH Bağlantı Kurulması", t_ssh_end - t_ssh_start)
        
        try:
            # 1. Ensure directory
            self._ssh_cmd(ssh, f"mkdir -p {cfg['remote_dir']}")

            # 2. Upload with high-performance pipelined stream
            sftp = ssh.open_sftp()
            remote_archive = f"{cfg['remote_dir']}/{cfg['archive_name']}"
            self.log(f"[UPLOAD] SFTP Uploading (Pipelined): {archive_path} -> {remote_archive}")
            
            t_upload_start = time.time()
            with open(archive_path, "rb") as local_f:
                with sftp.open(remote_archive, "wb") as remote_f:
                    remote_f.set_pipelined(True)
                    # Stream in 128KB chunks
                    while True:
                        chunk = local_f.read(128 * 1024)
                        if not chunk:
                            break
                        remote_f.write(chunk)
            sftp.close()
            t_upload_end = time.time()
            self.record_time(proj_key, "frontend", "SFTP Dosya Yükleme", t_upload_end - t_upload_start)
            self.log(f"[UPLOAD] Upload completed in {t_upload_end - t_upload_start:.2f} seconds!")

            # 3. Extract remotely
            self.log("[EXTRACT] Extracting frontend assets on production server...")
            t_extract_start = time.time()
            self._ssh_cmd(ssh, f"tar -xzf {remote_archive} -C {cfg['remote_dir']} --strip-components=1")
            self._ssh_cmd(ssh, f"rm -f {remote_archive}")
            t_extract_end = time.time()
            self.record_time(proj_key, "frontend", "Sunucuda Arşiv Açma (Tar Extract)", t_extract_end - t_extract_start)

            # 4. Secure symlinks for persistent media storage
            self.log("[REMOTE-DEPLOY] Securing persistent media storage symbolic link...")
            self._ssh_cmd(ssh, f"mkdir -p /var/www/media/products/edusa /var/www/media/products/flora /var/www/media/products/noir")
            self._ssh_cmd(ssh, f"chmod -R 755 /var/www/media")
            self._ssh_cmd(ssh, f"rm -rf {cfg['remote_dir']}/uploads")
            self._ssh_cmd(ssh, f"ln -sfn /var/www/media {cfg['remote_dir']}/uploads")

            # 5. Nginx Reload
            t_nginx_start = time.time()
            self._ssh_cmd(ssh, "systemctl restart nginx || true")
            t_nginx_end = time.time()
            self.record_time(proj_key, "frontend", "Nginx Yeniden Başlatma", t_nginx_end - t_nginx_start)
            
            self.log(f"[OK] Frontend suite successfully deployed!")
        finally:
            ssh.close()
            if os.path.exists(archive_path):
                os.remove(archive_path)

    def _connect_ssh(self):
        self.log(f"[SSH] Connecting to {SERVER_CONFIG['hostname']}:{SERVER_CONFIG['port']}...")
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(
            SERVER_CONFIG["hostname"],
            port=SERVER_CONFIG["port"],
            username=SERVER_CONFIG["username"],
            password=SERVER_CONFIG["password"],
            timeout=15
        )
        self.log("[SSH] Connection established successfully!")
        return ssh

    def _ssh_cmd(self, ssh, cmd):
        self.log(f"[REMOTE CMD] Executing: {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        raw_out = stdout.read().decode('utf-8', errors='ignore').strip()
        raw_err = stderr.read().decode('utf-8', errors='ignore').strip()
        
        out = raw_out.encode('ascii', errors='replace').decode('ascii')
        err = raw_err.encode('ascii', errors='replace').decode('ascii')
        
        if out:
            self.log(f"STDOUT:\n{out}")
        if err:
            self.log(f"STDERR:\n{err}")
        return out, err


# ==============================================================================
# PYSIDE6 GUI APPLICATION CLASS
# ==============================================================================
if PYSIDE_AVAILABLE:
    class PipelineWorker(QThread):
        log_signal = Signal(str)
        finished_signal = Signal(bool, str)

        def __init__(self, tasks, remote_build=False):
            super().__init__()
            self.tasks = tasks # List of tuples: (project, component, action)
            self.remote_build = remote_build

        def run(self):
            pipeline = DeployPipeline(log_callback=self.emit_log, remote_build=self.remote_build)
            try:
                for proj, comp, action in self.tasks:
                    if action in ["build", "all"]:
                        if comp in ["backend", "all"]:
                            pipeline.build_backend(proj)
                        if comp in ["frontend", "all"]:
                            pipeline.build_frontend(proj)
                            
                    if action in ["deploy", "all"]:
                        if comp in ["backend", "all"]:
                            pipeline.deploy_backend(proj)
                        if comp in ["frontend", "all"]:
                            pipeline.deploy_frontend(proj)
                
                pipeline.log_summary_report()
                report_str = pipeline.get_summary_report_str()
                self.finished_signal.emit(True, f"Tüm işlemler başarıyla tamamlandı!\n\n{report_str}")
            except Exception as e:
                self.emit_log(f"\n[ERROR] Pipeline FAILED: {str(e)}")
                self.finished_signal.emit(False, str(e))

        def emit_log(self, text):
            self.log_signal.emit(text)

    class MainWindow(QtWidgets.QMainWindow):
        def __init__(self):
            super().__init__()
            self.setWindowTitle("Merter Vitrini - Unified Build & Deploy Toolbox")
            self.resize(750, 600)
            self.setup_ui()

        def setup_ui(self):
            # Styling definitions
            self.setStyleSheet("""
                QMainWindow {
                    background-color: #0c0a0f;
                }
                QWidget {
                    font-family: 'Segoe UI', Inter, sans-serif;
                    color: #f4f4f5;
                }
                QLabel#Title {
                    font-size: 18px;
                    font-weight: 800;
                    color: #ffffff;
                    margin-bottom: 5px;
                }
                QLabel#Sub {
                    font-size: 11px;
                    font-weight: 600;
                    color: #a1a1aa;
                    margin-bottom: 15px;
                }
                QGroupBox {
                    border: 1px solid #1f1a24;
                    border-radius: 12px;
                    margin-top: 10px;
                    padding-top: 14px;
                    font-weight: bold;
                    color: #d8b4fe;
                    background-color: #110e16;
                }
                QGroupBox::title {
                    subcontrol-origin: margin;
                    left: 12px;
                    padding: 0 5px;
                }
                QCheckBox {
                    spacing: 8px;
                    font-size: 12px;
                    font-weight: 600;
                }
                QCheckBox::indicator {
                    width: 16px;
                    height: 16px;
                    border: 1px solid #3f3f46;
                    border-radius: 4px;
                    background-color: #1c191f;
                }
                QCheckBox::indicator:checked {
                    background-color: #a855f7;
                    border: 1px solid #a855f7;
                }
                QPushButton#RunBtn {
                    background-color: #a855f7;
                    color: #ffffff;
                    font-size: 12px;
                    font-weight: bold;
                    border: none;
                    border-radius: 8px;
                    padding: 10px 15px;
                }
                QPushButton#RunBtn:hover {
                    background-color: #c084fc;
                }
                QPushButton#RunBtn:disabled {
                    background-color: #4b375b;
                    color: #a1a1aa;
                }
                QTextEdit {
                    background-color: #060508;
                    border: 1px solid #1f1a24;
                    border-radius: 8px;
                    font-family: 'Consolas', 'Courier New', monospace;
                    font-size: 11px;
                    color: #e9d5ff;
                    padding: 8px;
                }
                QMessageBox {
                    background-color: #0c0a0f;
                    border: 1px solid #a855f7;
                }
                QMessageBox QLabel {
                    color: #f4f4f5;
                    font-size: 12px;
                    font-weight: 600;
                }
                QMessageBox QPushButton {
                    background-color: #a855f7;
                    color: #ffffff;
                    border-radius: 6px;
                    padding: 5px 15px;
                    font-weight: bold;
                    min-width: 65px;
                }
                QMessageBox QPushButton:hover {
                    background-color: #c084fc;
                }
            """)

            central = QtWidgets.QWidget()
            self.setCentralWidget(central)
            layout = QtWidgets.QVBoxLayout(central)
            layout.setContentsMargins(20, 20, 20, 20)

            # Header Titles
            title = QtWidgets.QLabel("MERTER VİTRİNİ - UNIFIED PIPELINE")
            title.setObjectName("Title")
            sub = QtWidgets.QLabel("Aşağıdan derlemek ve sunucuya yüklemek istediğiniz bileşenleri seçip işlemi başlatın.")
            sub.setObjectName("Sub")
            layout.addWidget(title)
            layout.addWidget(sub)

            # Select All Toggle
            # Select All Toggle & Build on Server Toggle
            toggles_layout = QtWidgets.QHBoxLayout()
            self.cb_select_all = QtWidgets.QCheckBox("Tüm İşlemleri Seç / Kaldır")
            self.cb_select_all.clicked.connect(self.toggle_select_all)
            toggles_layout.addWidget(self.cb_select_all)
            
            self.cb_build_on_server = QtWidgets.QCheckBox("Sunucuda Derle (Next.js - Kota Dostu)")
            self.cb_build_on_server.setToolTip("İşlemleri kendi bilgisayarınız yerine sunucu üzerinde derler. 898MB yerine sadece kaynak dosyaları (~5MB) yükler.")
            self.cb_build_on_server.setChecked(True) # Enabled by default for massive speedup!
            toggles_layout.addWidget(self.cb_build_on_server)
            layout.addLayout(toggles_layout)

            # Selection Grids
            grids_layout = QtWidgets.QHBoxLayout()
            
            # Admin Suite Selection
            self.grp_admin = QtWidgets.QGroupBox("1. Admin Suite (Panel)")
            admin_layout = QtWidgets.QVBoxLayout(self.grp_admin)
            self.cb_admin_b_build = QtWidgets.QCheckBox("Backend Derle (Build Go)")
            self.cb_admin_b_deploy = QtWidgets.QCheckBox("Backend Yükle (Deploy SSH)")
            self.cb_admin_f_build = QtWidgets.QCheckBox("Frontend Derle (Next.js)")
            self.cb_admin_f_deploy = QtWidgets.QCheckBox("Frontend Yükle (Deploy SSH)")
            admin_layout.addWidget(self.cb_admin_b_build)
            admin_layout.addWidget(self.cb_admin_b_deploy)
            admin_layout.addWidget(QtWidgets.QFrame())
            admin_layout.addWidget(self.cb_admin_f_build)
            admin_layout.addWidget(self.cb_admin_f_deploy)
            grids_layout.addWidget(self.grp_admin)

            # Shop Suite Selection
            self.grp_shop = QtWidgets.QGroupBox("2. Shop Suite (Storefront)")
            shop_layout = QtWidgets.QVBoxLayout(self.grp_shop)
            self.cb_shop_b_build = QtWidgets.QCheckBox("Backend Derle (Build Go)")
            self.cb_shop_b_deploy = QtWidgets.QCheckBox("Backend Yükle (Deploy SSH)")
            self.cb_shop_f_build = QtWidgets.QCheckBox("Frontend Derle (Next.js)")
            self.cb_shop_f_deploy = QtWidgets.QCheckBox("Frontend Yükle (Deploy SSH)")
            shop_layout.addWidget(self.cb_shop_b_build)
            shop_layout.addWidget(self.cb_shop_b_deploy)
            shop_layout.addWidget(QtWidgets.QFrame())
            shop_layout.addWidget(self.cb_shop_f_build)
            shop_layout.addWidget(self.cb_shop_f_deploy)
            grids_layout.addWidget(self.grp_shop)

            layout.addLayout(grids_layout)

            # Log Area
            layout.addWidget(QtWidgets.QLabel("İşlem Logları ve Çıktıları:"))
            self.log_view = QtWidgets.QTextEdit()
            self.log_view.setReadOnly(True)
            layout.addWidget(self.log_view)

            # Run Button
            self.run_btn = QtWidgets.QPushButton("Seçilen İşlemleri Başlat")
            self.run_btn.setObjectName("RunBtn")
            self.run_btn.clicked.connect(self.start_pipeline)
            layout.addWidget(self.run_btn)

            # Log initial instructions
            self.append_log("Kullanıma Hazır. Lütfen yukarıdan yapmak istediğiniz işlemleri seçip butona basın.")

        def toggle_select_all(self):
            checked = self.cb_select_all.isChecked()
            checkboxes = [
                self.cb_admin_b_build,
                self.cb_admin_b_deploy,
                self.cb_admin_f_build,
                self.cb_admin_f_deploy,
                self.cb_shop_b_build,
                self.cb_shop_b_deploy,
                self.cb_shop_f_build,
                self.cb_shop_f_deploy
            ]
            for cb in checkboxes:
                cb.setChecked(checked)

        def append_log(self, text):
            self.log_view.append(text)
            # Scroll to bottom
            self.log_view.ensureCursorVisible()

        def start_pipeline(self):
            tasks = []
            
            # 1. Admin BE
            if self.cb_admin_b_build.isChecked() and self.cb_admin_b_deploy.isChecked():
                tasks.append(("admin", "backend", "all"))
            elif self.cb_admin_b_build.isChecked():
                tasks.append(("admin", "backend", "build"))
            elif self.cb_admin_b_deploy.isChecked():
                tasks.append(("admin", "backend", "deploy"))

            # 2. Admin FE
            if self.cb_admin_f_build.isChecked() and self.cb_admin_f_deploy.isChecked():
                tasks.append(("admin", "frontend", "all"))
            elif self.cb_admin_f_build.isChecked():
                tasks.append(("admin", "frontend", "build"))
            elif self.cb_admin_f_deploy.isChecked():
                tasks.append(("admin", "frontend", "deploy"))

            # 3. Shop BE
            if self.cb_shop_b_build.isChecked() and self.cb_shop_b_deploy.isChecked():
                tasks.append(("shop", "backend", "all"))
            elif self.cb_shop_b_build.isChecked():
                tasks.append(("shop", "backend", "build"))
            elif self.cb_shop_b_deploy.isChecked():
                tasks.append(("shop", "backend", "deploy"))

            # 4. Shop FE
            if self.cb_shop_f_build.isChecked() and self.cb_shop_f_deploy.isChecked():
                tasks.append(("shop", "frontend", "all"))
            elif self.cb_shop_f_build.isChecked():
                tasks.append(("shop", "frontend", "build"))
            elif self.cb_shop_f_deploy.isChecked():
                tasks.append(("shop", "frontend", "deploy"))

            if not tasks:
                QtWidgets.QMessageBox.warning(self, "Uyarı", "Lütfen en az bir işlem veya bileşen seçin!")
                return

            self.run_btn.setEnabled(False)
            self.log_view.clear()
            self.append_log("[INFO] Pipeline işlemleri başlatılıyor...")

            # Run in QThread
            self.worker = PipelineWorker(tasks, remote_build=self.cb_build_on_server.isChecked())
            self.worker.log_signal.connect(self.append_log)
            self.worker.finished_signal.connect(self.pipeline_finished)
            self.worker.start()

        def pipeline_finished(self, success, message):
            self.run_btn.setEnabled(True)
            if success:
                QtWidgets.QMessageBox.information(self, "Başarılı", message)
            else:
                QtWidgets.QMessageBox.critical(self, "Hata", f"İşlem başarısız oldu:\n{message}")


# ==============================================================================
# CLI EXECUTION ENTRY POINT
# ==============================================================================
def run_cli_headless(args):
    print("==================================================")
    print("  MERTER VİTRİNİ - HEADLESS COMMAND LINE PIPELINE")
    print("==================================================")
    
    # Map arguments
    projects = [args.project] if args.project != "all" else ["admin", "shop"]
    components = [args.component] if args.component != "all" else ["backend", "frontend"]
    action = args.action
    remote_build = getattr(args, "remote_build", False)
    
    pipeline = DeployPipeline(log_callback=print, remote_build=remote_build)
    
    try:
        for proj in projects:
            for comp in components:
                # 1. Build actions
                if action in ["build", "all"]:
                    if comp == "backend":
                        pipeline.build_backend(proj)
                    elif comp == "frontend":
                        pipeline.build_frontend(proj)
                        
                # 2. Deploy actions
                if action in ["deploy", "all"]:
                    if comp == "backend":
                        pipeline.deploy_backend(proj)
                    elif comp == "frontend":
                        pipeline.deploy_frontend(proj)
                        
        pipeline.log_summary_report()
        print("\n==================================================")
        print("SUCCESS: Headless CLI Pipeline fully completed!")
        print("==================================================")
    except Exception as e:
        print(f"\n[ERROR] Headless CLI execution failed: {str(e)}")
        sys.exit(1)


# ==============================================================================
# MAIN FUNCTION (RESOLVES GUI VS HEADLESS)
# ==============================================================================
def main():
    if sys.platform == "win32":
        import io
        try:
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
        except Exception:
            pass
            
    # If parameters are supplied, or PySide6 is completely missing, fall back to CLI mode
    has_args = len(sys.argv) > 1
    
    if has_args or not PYSIDE_AVAILABLE:
        if not PYSIDE_AVAILABLE and not has_args:
            print("[WARNING] PySide6 library is not installed locally. Falling back to Command Line Interface (CLI) mode.")
            
        parser = argparse.ArgumentParser(
            description="Merter Vitrini Unified Compiler & SSH Deployer Suite."
        )
        parser.add_argument(
            "-p", "--project",
            choices=["admin", "shop", "all"],
            default="all",
            help="Choose target project environment (admin, shop, or all)."
        )
        parser.add_argument(
            "-c", "--component",
            choices=["backend", "frontend", "all"],
            default="all",
            help="Choose target build layer (backend, frontend, or all)."
        )
        parser.add_argument(
            "-a", "--action",
            choices=["build", "deploy", "all"],
            default="all",
            help="Choose pipeline execution step (build, deploy, or all)."
        )
        parser.add_argument(
            "--remote-build",
            action="store_true",
            help="Build the frontend on the remote server via SSH (saves upload bandwidth)."
        )
        args = parser.parse_args()
        run_cli_headless(args)
    else:
        # Launch beautiful GUI
        app = QtWidgets.QApplication(sys.argv)
        window = MainWindow()
        window.show()
        sys.exit(app.exec())

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
