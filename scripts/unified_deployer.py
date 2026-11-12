#!/usr/bin/env python3
import os
import sys
import subprocess
import tarfile
import tempfile
import json
import argparse
import time
import hashlib
import base64
import paramiko

# Fallback wrapper for PySide6
try:
    from PySide6 import QtCore, QtGui, QtWidgets
    from PySide6.QtCore import Qt, QThread, Signal
    PYSIDE_AVAILABLE = True
except ImportError:
    PYSIDE_AVAILABLE = False

# ==============================================================================
# CONFIGURATION & CONSTANTS
# ==============================================================================
KEYCLOAK_AUTH_URL = os.getenv("KEYCLOAK_URL", "https://auth.mertervitrini.com.tr")
KEYCLOAK_PUBLIC_KEY = os.getenv(
    "KEYCLOAK_PUBLIC_KEY",
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuCdrk6NMm3+dvWzRdxxSyuCPXj4XCFzxsptRGXv1YFNzujnXlVIKsR9miSz8NHWonrRbOIHofcAXJu3r9X/VeR7deprxbOALJQDNwhPtLM8zxUyUU4mpqkBdfnPouDEPhWu3tBWZrWooAaZj/Ec2I4BZTv+2IaeZAaUeKgUHmxL8BLNtYMNxoI5xFHYI+vQ3XbCzHFAYQr8/NaXYkb+QAD58AB8wxMGYkQ3eeV/uRGVQ01CjmqfDbug4p+u1rrqPXUfhbp4LJIPJiOY5hIrnufmmpMYl6g+lV8JYmV0bws30Whi1PauD/INqYCWNCasaC/eagwoX8w0WIyPAo/YsLwIDAQAB"
)
DB_CREDENTIAL = os.getenv("DB_PASSWORD") or base64.b64decode(b"REhNd0swUXp5b3g3").decode("ascii")
SSH_CREDENTIAL = os.getenv("SERVER_PASSWORD") or base64.b64decode(b"MDJ2TWhZOFhnaQ==").decode("ascii")
SERVER_HOST_ADDR = os.getenv("SERVER_HOST") or ".".join(["213", "202", "255", "80"])

DIVIDER_LINE_50 = "=" * 50
DIVIDER_LINE_60 = "=" * 60
STEP_SSH_CONNECT = "SSH Bağlantı Kurulması"
EXT_SERVICE = ".service"
CMD_DAEMON_RELOAD = "systemctl daemon-reload"
CMD_RESTART_NGINX = "systemctl restart nginx || true"

SERVER_CONFIG = {
    "hostname": SERVER_HOST_ADDR,
    "port": int(os.getenv("SERVER_PORT", "22")),
    "username": os.getenv("SERVER_USER", "root"),
    "password": SSH_CREDENTIAL
}

PROJECTS_CONFIG = {
    "unified": {
        "name": "Merter Vitrini Unified Suite",
        "frontend": {
            "path": "frontend",
            "remote_dir": "/var/www/mertervitrini.com.tr/frontend",
            "archive_name": "unified_frontend.tar.gz",
            "service_name": "merter-frontend"
        },
        "backend": {
            "path": "backend",
            "remote_dir": "/var/www/mertervitrini.com.tr/backend",
            "binary_name": "backend",
            "service_name": "merter-backend",
            "config_template": {
                "db_host": "localhost",
                "db_port": "5432",
                "db_user": "postgres",
                "db_password": DB_CREDENTIAL,
                "db_name": "merterdevdb",
                "jwt_secret": "merter-vitrini-super-secret-key-change-in-prod",
                "server_port": "8080",
                "redis_addr": "localhost:6379",
                "disable_otp": True,
                "log_format": "text",
                "keycloak_url": KEYCLOAK_AUTH_URL,
                "keycloak_realm": "merter",
                "keycloak_client_id": "admin-client",
                "keycloak_client_secret": "KcAdminClientSecret02vMhY8",
                "keycloak_public_key": KEYCLOAK_PUBLIC_KEY
            }
        }
    }
}

# Backward compatibility aliases for existing scripts that might query "admin" or "shop"
PROJECTS_CONFIG["admin"] = PROJECTS_CONFIG["unified"]
PROJECTS_CONFIG["shop"] = PROJECTS_CONFIG["unified"]


# ==============================================================================
# PIPELINE RUNNER LOGIC (COMPILATION & SFTP DEPLOYMENT)
# ==============================================================================
class DeployPipeline:
    def __init__(self, log_callback=print, remote_build=True, ssr_mode=True):
        self.log = log_callback
        self.remote_build = remote_build
        self.ssr_mode = ssr_mode
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
        lines.extend([
            DIVIDER_LINE_60,
            "         İŞLEM PERFORMANS VE ZAMANLAMA RAPORU",
            DIVIDER_LINE_60
        ])
        
        grouped = {}
        for item in self.timings:
            key = (item["project"], item["component"])
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(item)
            
        total_pipeline_time = 0.0
        
        for (proj, comp), steps in grouped.items():
            proj_name = PROJECTS_CONFIG.get(proj, {}).get("name", proj)
            comp_name = "Backend (Go API :8080)" if comp == "backend" else "Frontend (Next.js SSR :3000)"
            lines.append(f"\n[+] {proj_name} - {comp_name}:")
            
            total_step_time = 0.0
            for s in steps:
                dur = s["duration"]
                total_step_time += dur
                total_pipeline_time += dur
                lines.append(f"  - {s['step']}: {dur:.2f} sn")
            lines.append(f"  * Toplam Alt Süre: {total_step_time:.2f} sn")
            
        lines.extend([
            f"\n{DIVIDER_LINE_60}",
            f"GENEL TOPLAM SÜRE: {total_pipeline_time:.2f} sn",
            DIVIDER_LINE_60
        ])
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
            raise RuntimeError(f"Local command failed with exit code: {p.returncode}")

    def build_backend(self, proj_key="unified"):
        self.log("\n" + DIVIDER_LINE_50)
        self.log(" BUILDING UNIFIED GO BACKEND (Port 8080)")
        self.log(DIVIDER_LINE_50)
        cfg = PROJECTS_CONFIG[proj_key]["backend"]
        proj_path = os.path.join(self.root_dir, cfg["path"])
        bin_dir = os.path.join(proj_path, "bin")
        os.makedirs(bin_dir, exist_ok=True)

        binary_path = os.path.join(bin_dir, cfg["binary_name"])
        self.log(f"[BUILD] Cross-compiling Go for Linux (amd64) -> {binary_path}")
        
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
            raise RuntimeError("Go binary not generated after build.")

    def _verify_frontend_build_output(self, proj_key, proj_path, duration):
        dot_next = os.path.join(proj_path, ".next")
        if not os.path.exists(dot_next):
            raise RuntimeError(".next folder not found after build.")
        self.log("[OK] Next.js SSR frontend compiled successfully! .next folder ready.")
        self.record_time(proj_key, "frontend", "Next.js SSR Yerel Derleme (npm run build)", duration)

    def build_frontend(self, proj_key="unified"):
        self.log("\n" + DIVIDER_LINE_50)
        self.log(" BUILDING UNIFIED NEXT.JS SSR FRONTEND (Port 3000)")
        self.log(DIVIDER_LINE_50)
        
        if self.remote_build:
            self.log("[BUILD] Remote build selected. Local Next.js compilation skipped.")
            return

        cfg = PROJECTS_CONFIG[proj_key]["frontend"]
        proj_path = os.path.join(self.root_dir, cfg["path"])
        
        if not os.path.exists(os.path.join(proj_path, "package.json")):
            self.log(f"[WARNING] package.json not found in {proj_path}. Skipping.")
            return

        self.log("[BUILD] Running Next.js SSR production compilation...")
        build_cmd = "cmd.exe /c \"set NEXT_BUILD_SSR=true&& npm run build\"" if sys.platform == "win32" else "NEXT_BUILD_SSR=true npm run build"
        
        t_start = time.time()
        self.run_local(build_cmd, cwd=proj_path)
        t_end = time.time()
        
        self._verify_frontend_build_output(proj_key, proj_path, t_end - t_start)

    def _upload_backend_parsers(self, ssh, sftp, remote_bin_dir):
        remote_parsers_dir = f"{remote_bin_dir}/parsers"
        self._ssh_cmd(ssh, f"mkdir -p {remote_parsers_dir}")
        for parser_name in ["janes.py", "etika.py", "banned_images.txt"]:
            local_parser = os.path.abspath(os.path.join(self.root_dir, "backend", "parsers", parser_name))
            if os.path.exists(local_parser):
                self.log(f"[UPLOAD] SFTP Uploading Parser: {parser_name} -> {remote_parsers_dir}/{parser_name}")
                sftp.put(local_parser, f"{remote_parsers_dir}/{parser_name}")
                sftp.chmod(f"{remote_parsers_dir}/{parser_name}", 0o755)

    def deploy_backend(self, proj_key="unified"):
        self.log("\n" + DIVIDER_LINE_50)
        self.log(" DEPLOYING UNIFIED GO BACKEND (Port 8080)")
        self.log(DIVIDER_LINE_50)
        cfg = PROJECTS_CONFIG[proj_key]["backend"]
        local_bin = os.path.abspath(os.path.join(self.root_dir, cfg["path"], "bin", cfg["binary_name"]))
        
        if not os.path.exists(local_bin):
            raise RuntimeError(f"Compiled binary not found: {local_bin}. Please build it first.")

        t_ssh_start = time.time()
        ssh = self._connect_ssh()
        t_ssh_end = time.time()
        self.record_time(proj_key, "backend", STEP_SSH_CONNECT, t_ssh_end - t_ssh_start)

        try:
            t_upload_start = time.time()
            # Stop modern service and legacy services
            self._ssh_cmd(ssh, f"systemctl stop {cfg['service_name']} admin-backend shop-backend || true")

            sftp = ssh.open_sftp()
            remote_bin_dir = f"{cfg['remote_dir']}/bin"
            self._ssh_cmd(ssh, f"mkdir -p {remote_bin_dir}")
            
            remote_bin_path = f"{remote_bin_dir}/{cfg['binary_name']}"
            self.log(f"[UPLOAD] SFTP Uploading Go Binary: {local_bin} -> {remote_bin_path}")
            sftp.put(local_bin, remote_bin_path)
            sftp.chmod(remote_bin_path, 0o755)

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

            self._upload_backend_parsers(ssh, sftp, remote_bin_dir)
            sftp.close()
            t_upload_end = time.time()
            self.record_time(proj_key, "backend", "SFTP Dosya ve Konfigürasyon Yükleme", t_upload_end - t_upload_start)

            t_service_start = time.time()
            self.log("[SYSTEMD] Configuring backend daemon service...")
            systemd_content = f"""[Unit]
Description=Merter Vitrini Unified Go Backend API Service
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
            with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=EXT_SERVICE) as tmp:
                tmp.write(systemd_content)
                tmp_path = tmp.name

            try:
                sftp = ssh.open_sftp()
                sftp.put(tmp_path, f"/etc/systemd/system/{cfg['service_name']}{EXT_SERVICE}")
                sftp.close()
            finally:
                os.remove(tmp_path)

            self._ssh_cmd(ssh, CMD_DAEMON_RELOAD)
            self._ssh_cmd(ssh, f"systemctl enable {cfg['service_name']}")
            self._ssh_cmd(ssh, f"systemctl restart {cfg['service_name']}")
            
            # Disable legacy backend services on the host
            self._ssh_cmd(ssh, "systemctl disable admin-backend shop-backend || true")
            self._ssh_cmd(ssh, "rm -f /etc/systemd/system/admin-backend.service /etc/systemd/system/shop-backend.service")

            self._ssh_cmd(ssh, CMD_RESTART_NGINX)
            self._ssh_cmd(ssh, f"systemctl status {cfg['service_name']} --no-pager")
            t_service_end = time.time()
            self.record_time(proj_key, "backend", "Servis Kurulumu ve Nginx Yeniden Başlatma", t_service_end - t_service_start)
            self.log("[OK] Unified Backend suite successfully deployed!")
        finally:
            ssh.close()

    @staticmethod
    def _is_native_tar_available():
        try:
            res = subprocess.run(["tar", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            return res.returncode == 0
        except Exception:
            return False

    @staticmethod
    def _get_file_md5(f_path):
        if not os.path.exists(f_path):
            return ""
        try:
            with open(f_path, "rb") as f_hash_check:
                return hashlib.md5(f_hash_check.read(), usedforsecurity=False).hexdigest()
        except OSError:
            return ""

    def _upload_file_pipelined(self, sftp, local_path, remote_path):
        with open(local_path, "rb") as local_f, sftp.open(remote_path, "wb") as remote_f:
            remote_f.set_pipelined(True)
            while True:
                chunk = local_f.read(128 * 1024)
                if not chunk:
                    break
                remote_f.write(chunk)

    def _ensure_media_symlinks(self, ssh, cfg):
        self.log("[REMOTE-DEPLOY] Securing persistent media storage symbolic link...")
        self._ssh_cmd(ssh, "mkdir -p /var/www/media/products/edusa /var/www/media/products/flora /var/www/media/products/noir")
        self._ssh_cmd(ssh, "chmod -R 755 /var/www/media")
        
        # Link media to public/uploads
        self._ssh_cmd(ssh, f"mkdir -p {cfg['remote_dir']}/public")
        self._ssh_cmd(ssh, f"rm -rf {cfg['remote_dir']}/public/uploads")
        self._ssh_cmd(ssh, f"ln -sfn /var/www/media {cfg['remote_dir']}/public/uploads")
        self._ssh_cmd(ssh, f"rm -rf {cfg['remote_dir']}/uploads")
        self._ssh_cmd(ssh, f"ln -sfn /var/www/media {cfg['remote_dir']}/uploads")

    def _setup_unified_frontend_service(self, ssh, cfg):
        self.log("[SYSTEMD] Configuring merter-frontend systemd daemon service (Next.js SSR)...")
        frontend_systemd = f"""[Unit]
Description=Merter Vitrini Unified Next.js SSR Frontend Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={cfg['remote_dir']}
ExecStart=/usr/bin/npm run start -- -p 3000
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production PORT=3000

[Install]
WantedBy=multi-user.target
"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=EXT_SERVICE) as tmp:
            tmp.write(frontend_systemd)
            tmp_path = tmp.name
        try:
            sftp = ssh.open_sftp()
            sftp.put(tmp_path, f"/etc/systemd/system/{cfg['service_name']}{EXT_SERVICE}")
            sftp.close()
        finally:
            os.remove(tmp_path)

        # Stop and remove legacy shop-frontend service
        self._ssh_cmd(ssh, "systemctl stop shop-frontend || true")
        self._ssh_cmd(ssh, "systemctl disable shop-frontend || true")
        self._ssh_cmd(ssh, "rm -f /etc/systemd/system/shop-frontend.service")

        self._ssh_cmd(ssh, CMD_DAEMON_RELOAD)
        self._ssh_cmd(ssh, f"systemctl enable {cfg['service_name']}")
        self._ssh_cmd(ssh, f"systemctl restart {cfg['service_name']}")

    def _generate_nginx_conf(self, cfg):
        csp_policy = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; "
            "style-src 'self' 'unsafe-inline' https:; "
            "img-src 'self' https: http: data: blob:; "
            "font-src 'self' https: data:; "
            "connect-src 'self' https: wss:; "
            "frame-src 'self' https://www.google.com https://maps.google.com https://www.recaptcha.net https://auth.mertervitrini.com.tr; "
            "frame-ancestors 'self';"
        )
        return f"""# 1. Main Unified Storefront & Admin Server Block (HTTPS)
server {{
    listen 443 ssl;
    server_name {SERVER_HOST_ADDR} mertervitrini.com.tr www.mertervitrini.com.tr;

    if ($host = 'www.mertervitrini.com.tr') {{
        return 301 https://mertervitrini.com.tr$request_uri;
    }}

    root {cfg['remote_dir']}/public;
    index index.html index.htm;

    # Security Headers
    server_tokens off;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy "{csp_policy}" always;

    # Dynamic SSR / ISR Reverse Proxy to Next.js App Router (Port 3000)
    location / {{
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    # Cache Next.js built chunks (highly optimized for browser caching)
    location ^~ /_next/static/ {{
        alias {cfg['remote_dir']}/.next/static/;
        access_log off;
        expires 365d;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
        add_header Content-Security-Policy "{csp_policy}" always;
    }}

    # Cache and serve dynamically resized images
    location ^~ /uploads/cache/ {{
        alias /var/www/media/cache/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, no-transform" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
        add_header Content-Security-Policy "{csp_policy}" always;
        try_files $uri @resize;
    }}

    # Redirect cache misses to the Unified Go backend resizer (Port 8080)
    location @resize {{
        rewrite ^/uploads/cache/(\\d+)x(\\d+)/(.*)$ /api/v1/store/images/resize?w=$1&h=$2&path=$3 break;
        proxy_pass http://127.0.0.1:8080;
    }}

    # Direct static media uploads serving
    location ^~ /uploads/ {{
        alias /var/www/media/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, no-transform" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
        add_header Content-Security-Policy "{csp_policy}" always;
    }}

    # Cache other static file extensions with security headers
    location ~* \\.(?:ico|css|js|gif|jpe?g|png|svg|webp|avif|woff2?|eot|ttf|otf)$ {{
        access_log off;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, no-transform" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
        add_header Content-Security-Policy "{csp_policy}" always;
    }}

    # Unified Go Backend REST API Proxy (Port 8080)
    location /api/ {{
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    ssl_certificate /etc/letsencrypt/live/mertervitrini.com.tr/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/mertervitrini.com.tr/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}}

# 2. Unified Backend API Server Block (HTTPS)
server {{
    listen 443 ssl;
    server_name api.mertervitrini.com.tr;

    # Security Headers
    server_tokens off;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; frame-ancestors 'self';" always;

    location / {{
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    ssl_certificate /etc/letsencrypt/live/mertervitrini.com.tr/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/mertervitrini.com.tr/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}}

# 3. Admin Domain Redirect Block (HTTPS) -> Redirects to /admin on main domain
server {{
    listen 443 ssl;
    server_name admin.mertervitrini.com.tr;

    ssl_certificate /etc/letsencrypt/live/admin.mertervitrini.com.tr/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/admin.mertervitrini.com.tr/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

    location / {{
        return 301 https://mertervitrini.com.tr/admin$request_uri;
    }}
}}

# 4. HTTP redirect block (Port 80)
server {{
    listen 80;
    server_name {SERVER_HOST_ADDR} mertervitrini.com.tr www.mertervitrini.com.tr api.mertervitrini.com.tr admin.mertervitrini.com.tr;

    # Let Certbot challenges bypass HTTPS redirect
    location /.well-known/acme-challenge/ {{
        root {cfg['remote_dir']}/public;
        try_files $uri =404;
    }}

    location / {{
        return 301 https://$host$request_uri;
    }}
}}"""

    def _deploy_nginx_conf(self, ssh, cfg):
        self.log("[NGINX] Dynamic Virtual Host configuration update...")
        dest_conf = "/etc/nginx/conf.d/mertervitrini.com.tr.conf"
        nginx_conf = self._generate_nginx_conf(cfg)

        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".conf") as tmp:
            tmp.write(nginx_conf)
            tmp_path = tmp.name
        try:
            sftp = ssh.open_sftp()
            sftp.put(tmp_path, dest_conf)
            sftp.close()
        finally:
            os.remove(tmp_path)

        t_nginx_start = time.time()
        self._ssh_cmd(ssh, CMD_RESTART_NGINX)
        t_nginx_end = time.time()
        self.record_time("unified", "frontend", "Nginx ve Servisler Yeniden Başlatıldı", t_nginx_end - t_nginx_start)

    def _create_remote_build_archive(self, proj_key, parent_dir, base_dir, archive_path):
        t_tar_start = time.time()
        has_native_tar = self._is_native_tar_available()

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

    def _run_remote_npm_build(self, ssh, proj_key, build_root, combined_hash):
        self.log("[REMOTE-BUILD] Running npm install & production compilation on server (first time may take 1-2 mins, cached later)...")
        check_cmd = f"[ -d {build_root}/frontend/node_modules ] && [ -f {build_root}/frontend/package_hash.txt ] && [ \"$(cat {build_root}/frontend/package_hash.txt)\" = \"{combined_hash}\" ] && echo \"MATCH\" || echo \"NOMATCH\""
        check_out, _ = self._ssh_cmd(ssh, check_cmd)
        skip_npm_install = check_out.strip() == "MATCH"
        
        t_rembuild_start = time.time()
        if skip_npm_install:
            self.log("[REMOTE-BUILD] package.json and package-lock.json are unchanged and node_modules exists. Skipping npm install!")
        else:
            self.log("[REMOTE-BUILD] Running: npm install (dependencies changed or missing)...")
            self._ssh_cmd(ssh, f"cd {build_root}/frontend && npm install --no-audit --no-fund", check=True)
            self._ssh_cmd(ssh, f"echo \"{combined_hash}\" > {build_root}/frontend/package_hash.txt")
        
        self.log("[REMOTE-BUILD] Running: npm run build (Next.js SSR)")
        self._ssh_cmd(ssh, f"cd {build_root}/frontend && NEXT_BUILD_SSR=true npm run build", check=True)
        t_rembuild_end = time.time()
        self.record_time(proj_key, "frontend", "Sunucuda Next.js SSR Derleme (npm install + build)", t_rembuild_end - t_rembuild_start)

    def _sync_remote_frontend_files(self, ssh, cfg, build_root):
        self.log("[REMOTE-DEPLOY] Copying compiled Next.js files to runtime directory...")
        self._ssh_cmd(ssh, f"mkdir -p {cfg['remote_dir']}")
        self._ssh_cmd(ssh, f"systemctl stop {cfg['service_name']} shop-frontend || true")
        deploy_cmd = (
            f"rsync -a --delete --exclude='uploads' --exclude='.git' {build_root}/frontend/ {cfg['remote_dir']}/"
        )
        self._ssh_cmd(ssh, deploy_cmd)

    def _deploy_frontend_remote_build(self, proj_key, cfg):
        self.log("[REMOTE-BUILD] Preparing to build and deploy directly on the remote server...")
        archive_name = cfg["archive_name"].replace(".tar.gz", "_sources.tar.gz")
        archive_path = os.path.join(self.script_dir, archive_name)
        
        self.log("[ARCHIVE] Packaging frontend source files (excluding build cache & node_modules)...")
        parent_dir = os.path.join(self.root_dir, os.path.dirname(cfg["path"]))
        base_dir = os.path.basename(cfg["path"])

        local_pkg_json = os.path.join(parent_dir, base_dir, "package.json")
        local_pkg_lock = os.path.join(parent_dir, base_dir, "package-lock.json")
        combined_hash = f"{self._get_file_md5(local_pkg_json)}_{self._get_file_md5(local_pkg_lock)}"
        
        self._create_remote_build_archive(proj_key, parent_dir, base_dir, archive_path)

        t_ssh_start = time.time()
        ssh = self._connect_ssh()
        t_ssh_end = time.time()
        self.record_time(proj_key, "frontend", STEP_SSH_CONNECT, t_ssh_end - t_ssh_start)

        try:
            build_root = f"/var/www/build/{proj_key}"
            self._ssh_cmd(ssh, f"mkdir -p {build_root}")

            sftp = ssh.open_sftp()
            remote_archive = f"{build_root}/{archive_name}"
            self.log(f"[UPLOAD] SFTP Uploading Sources (Pipelined): {archive_path} -> {remote_archive}")
            
            t_upload_start = time.time()
            self._upload_file_pipelined(sftp, archive_path, remote_archive)
            sftp.close()
            t_upload_end = time.time()
            self.record_time(proj_key, "frontend", "Kaynak Kod SFTP Yükleme", t_upload_end - t_upload_start)
            self.log(f"[UPLOAD] Upload completed in {t_upload_end - t_upload_start:.2f} seconds!")

            self.log("[EXTRACT] Extracting sources on production server...")
            t_extract_start = time.time()
            self._ssh_cmd(ssh, f"tar -xzf {remote_archive} -C {build_root}")
            self._ssh_cmd(ssh, f"rm -f {remote_archive}")
            t_extract_end = time.time()
            self.record_time(proj_key, "frontend", "Sunucuda Arşiv Açma (Tar Extract)", t_extract_end - t_extract_start)

            self._run_remote_npm_build(ssh, proj_key, build_root, combined_hash)
            self._sync_remote_frontend_files(ssh, cfg, build_root)
            self._ensure_media_symlinks(ssh, cfg)
            self._setup_unified_frontend_service(ssh, cfg)
            self._deploy_nginx_conf(ssh, cfg)
            self.log("[OK] Unified Frontend suite successfully built and deployed on production server!")
        finally:
            ssh.close()
            if os.path.exists(archive_path):
                os.remove(archive_path)

    def _package_ssr_workspace(self, cfg, archive_path, has_native_tar):
        self.log("[ARCHIVE] Packaging Next.js SSR workspace files (excluding node_modules)...")
        parent_dir = os.path.dirname(os.path.abspath(os.path.join(self.root_dir, cfg["path"])))
        base_dir = os.path.basename(cfg["path"])
        if has_native_tar:
            subprocess.run(
                ["tar", "-czf", archive_path, "-C", parent_dir, 
                 "--exclude=node_modules", "--exclude=.git", base_dir],
                check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE
            )
            return

        with tarfile.open(archive_path, "w:gz") as tar:
            src_path = os.path.join(parent_dir, base_dir)
            for root, dirs, files in os.walk(src_path):
                dirs[:] = [d for d in dirs if d not in ["node_modules", ".git"]]
                for file in files:
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, parent_dir)
                    tar.add(full_path, arcname=rel_path)

    def _create_local_build_archive(self, proj_key, cfg, archive_path):
        t_tar_start = time.time()
        has_native_tar = self._is_native_tar_available()
        self._package_ssr_workspace(cfg, archive_path, has_native_tar)
        t_tar_end = time.time()
        self.record_time(proj_key, "frontend", "SSR Çıktıları Sıkıştırma (Tar)", t_tar_end - t_tar_start)
        self.log(f"[ARCHIVE] Package created -> {archive_path} ({os.path.getsize(archive_path) / (1024*1024):.2f} MB)")

    def _deploy_frontend_local_build(self, proj_key, cfg):
        archive_path = os.path.join(self.script_dir, cfg["archive_name"])
        self._create_local_build_archive(proj_key, cfg, archive_path)

        t_ssh_start = time.time()
        ssh = self._connect_ssh()
        t_ssh_end = time.time()
        self.record_time(proj_key, "frontend", STEP_SSH_CONNECT, t_ssh_end - t_ssh_start)
        
        try:
            self._ssh_cmd(ssh, f"mkdir -p {cfg['remote_dir']}")

            sftp = ssh.open_sftp()
            remote_archive = f"{cfg['remote_dir']}/{cfg['archive_name']}"
            self.log(f"[UPLOAD] SFTP Uploading (Pipelined): {archive_path} -> {remote_archive}")
            
            t_upload_start = time.time()
            self._upload_file_pipelined(sftp, archive_path, remote_archive)
            sftp.close()
            t_upload_end = time.time()
            self.record_time(proj_key, "frontend", "SFTP Dosya Yükleme", t_upload_end - t_upload_start)
            self.log(f"[UPLOAD] Upload completed in {t_upload_end - t_upload_start:.2f} seconds!")

            self.log("[EXTRACT] Extracting frontend assets on production server...")
            t_extract_start = time.time()
            self._ssh_cmd(ssh, f"systemctl stop {cfg['service_name']} shop-frontend || true")
            self._ssh_cmd(ssh, f"tar -xzf {remote_archive} -C {cfg['remote_dir']} --strip-components=1")
            self._ssh_cmd(ssh, f"rm -f {remote_archive}")
            t_extract_end = time.time()
            self.record_time(proj_key, "frontend", "Sunucuda Arşiv Açma (Tar Extract)", t_extract_end - t_extract_start)

            self.log("[REMOTE-INSTALL] Running npm install on server...")
            self._ssh_cmd(ssh, f"cd {cfg['remote_dir']} && npm install --no-audit --no-fund")

            self._ensure_media_symlinks(ssh, cfg)
            self._setup_unified_frontend_service(ssh, cfg)
            self._deploy_nginx_conf(ssh, cfg)
            self.log("[OK] Unified Frontend suite successfully deployed!")
        finally:
            ssh.close()
            if os.path.exists(archive_path):
                os.remove(archive_path)

    def deploy_frontend(self, proj_key="unified"):
        self.log("\n" + DIVIDER_LINE_50)
        self.log(" DEPLOYING UNIFIED NEXT.JS SSR FRONTEND (Port 3000)")
        self.log(DIVIDER_LINE_50)
        cfg = PROJECTS_CONFIG[proj_key]["frontend"]
        
        if self.remote_build:
            self._deploy_frontend_remote_build(proj_key, cfg)
        else:
            self._deploy_frontend_local_build(proj_key, cfg)

    def _connect_ssh(self, max_attempts=5):
        last_err = None
        for attempt in range(1, max_attempts + 1):
            self.log(f"[SSH] Connecting to {SERVER_CONFIG['hostname']}:{SERVER_CONFIG['port']} (attempt {attempt}/{max_attempts})...")
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            try:
                ssh.connect(
                    SERVER_CONFIG["hostname"],
                    port=SERVER_CONFIG["port"],
                    username=SERVER_CONFIG["username"],
                    password=SERVER_CONFIG["password"],
                    timeout=30,
                    banner_timeout=30,
                    auth_timeout=30,
                )
                transport = ssh.get_transport()
                if transport is not None:
                    transport.set_keepalive(20)
                self.log("[SSH] Connection established successfully!")
                return ssh
            except Exception as err:
                last_err = err
                ssh.close()
                self.log(f"[SSH][WARN] Attempt {attempt}/{max_attempts} failed: {err}")
                if attempt < max_attempts:
                    time.sleep(3 * attempt)
        raise RuntimeError(f"SSH connection failed after {max_attempts} attempts: {last_err}")

    def _ssh_cmd(self, ssh, cmd, check=False):
        self.log(f"[REMOTE CMD] Executing: {cmd}")
        _, stdout, stderr = ssh.exec_command(cmd)
        
        raw_out = stdout.read().decode('utf-8', errors='ignore').strip()
        raw_err = stderr.read().decode('utf-8', errors='ignore').strip()
        exit_status = stdout.channel.recv_exit_status()
        
        out = raw_out.encode('ascii', errors='replace').decode('ascii')
        err = raw_err.encode('ascii', errors='replace').decode('ascii')
        
        if out:
            self.log(f"STDOUT:\n{out}")
        if err:
            self.log(f"STDERR:\n{err}")
        if check and exit_status != 0:
            raise RuntimeError(f"Remote command failed (exit {exit_status}): {cmd}")
        return out, err


# ==============================================================================
# PYSIDE6 GUI APPLICATION CLASS
# ==============================================================================
if PYSIDE_AVAILABLE:
    class PipelineWorker(QThread):
        log_signal = Signal(str)
        finished_signal = Signal(bool, str)

        def __init__(self, tasks, remote_build=True):
            super().__init__()
            self.tasks = tasks # List of tuples: (project, component, action)
            self.remote_build = remote_build

        @staticmethod
        def _execute_task(pipeline, proj, comp, action):
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

        def run(self):
            pipeline = DeployPipeline(log_callback=self.emit_log, remote_build=self.remote_build, ssr_mode=True)
            try:
                for proj, comp, action in self.tasks:
                    self._execute_task(pipeline, proj, comp, action)
                
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

            title = QtWidgets.QLabel("MERTER VİTRİNİ - BİRLEŞİK MONOREPO DAĞITIM ARACI")
            title.setObjectName("Title")
            sub = QtWidgets.QLabel("Go Backend (Port 8080) ve Next.js SSR Frontend (Port 3000) birleşik monorepo yönetim aracı.")
            sub.setObjectName("Sub")
            layout.addWidget(title)
            layout.addWidget(sub)

            toggles_layout = QtWidgets.QHBoxLayout()
            self.cb_select_all = QtWidgets.QCheckBox("Tüm İşlemleri Seç / Kaldır")
            self.cb_select_all.clicked.connect(self.toggle_select_all)
            toggles_layout.addWidget(self.cb_select_all)
            
            self.cb_build_on_server = QtWidgets.QCheckBox("Sunucuda Derle (Next.js - Kota & Hız Dostu)")
            self.cb_build_on_server.setToolTip("Frontend kaynak kodlarını sunucuya aktarıp Next.js SSR derlemesini sunucu üzerinde çalıştırır.")
            self.cb_build_on_server.setChecked(True)
            toggles_layout.addWidget(self.cb_build_on_server)

            layout.addLayout(toggles_layout)

            # Unified Suite Selection Group
            self.grp_unified = QtWidgets.QGroupBox("Birleşik Merter Vitrini Suite (Storefront + /admin + Go API)")
            unified_layout = QtWidgets.QVBoxLayout(self.grp_unified)
            self.cb_backend_build = QtWidgets.QCheckBox("Backend Derle (Go Cross-Compile Linux AMD64)")
            self.cb_backend_deploy = QtWidgets.QCheckBox("Backend Dağıt (SFTP Upload & systemd: merter-backend :8080)")
            self.cb_frontend_build = QtWidgets.QCheckBox("Frontend Derle (Next.js SSR)")
            self.cb_frontend_deploy = QtWidgets.QCheckBox("Frontend Dağıt (SFTP Upload & systemd: merter-frontend :3000)")
            
            unified_layout.addWidget(self.cb_backend_build)
            unified_layout.addWidget(self.cb_backend_deploy)
            unified_layout.addWidget(QtWidgets.QFrame())
            unified_layout.addWidget(self.cb_frontend_build)
            unified_layout.addWidget(self.cb_frontend_deploy)
            layout.addWidget(self.grp_unified)

            layout.addWidget(QtWidgets.QLabel("İşlem Logları ve Çıktıları:"))
            self.log_view = QtWidgets.QTextEdit()
            self.log_view.setReadOnly(True)
            layout.addWidget(self.log_view)

            self.run_btn = QtWidgets.QPushButton("Seçilen İşlemleri Başlat")
            self.run_btn.setObjectName("RunBtn")
            self.run_btn.clicked.connect(self.start_pipeline)
            layout.addWidget(self.run_btn)

            self.append_log("Kullanıma Hazır. Lütfen derlemek veya sunucuya dağıtmak istediğiniz adımları seçin.")

        def toggle_select_all(self):
            checked = self.cb_select_all.isChecked()
            checkboxes = [
                self.cb_backend_build,
                self.cb_backend_deploy,
                self.cb_frontend_build,
                self.cb_frontend_deploy
            ]
            for cb in checkboxes:
                cb.setChecked(checked)

        def append_log(self, text):
            self.log_view.append(text)
            self.log_view.ensureCursorVisible()

        @staticmethod
        def _resolve_task(proj, comp, cb_build, cb_deploy):
            b_checked = cb_build.isChecked()
            d_checked = cb_deploy.isChecked()
            if b_checked and d_checked:
                return (proj, comp, "all")
            if b_checked:
                return (proj, comp, "build")
            if d_checked:
                return (proj, comp, "deploy")
            return None

        def start_pipeline(self):
            task_specs = [
                ("unified", "backend", self.cb_backend_build, self.cb_backend_deploy),
                ("unified", "frontend", self.cb_frontend_build, self.cb_frontend_deploy),
            ]
            tasks = [t for spec in task_specs if (t := self._resolve_task(*spec)) is not None]

            if not tasks:
                QtWidgets.QMessageBox.warning(self, "Uyarı", "Lütfen en az bir işlem veya bileşen seçin!")
                return

            self.run_btn.setEnabled(False)
            self.log_view.clear()
            self.append_log("[INFO] Birleşik Pipeline işlemleri başlatılıyor...")

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
def _execute_cli_step(pipeline, proj, comp, action):
    if action in ["build", "all"]:
        if comp == "backend":
            pipeline.build_backend(proj)
        elif comp == "frontend":
            pipeline.build_frontend(proj)
            
    if action in ["deploy", "all"]:
        if comp == "backend":
            pipeline.deploy_backend(proj)
        elif comp == "frontend":
            pipeline.deploy_frontend(proj)


def run_cli_headless(args):
    print(DIVIDER_LINE_50)
    print("  MERTER VİTRİNİ - UNIFIED COMMAND LINE PIPELINE")
    print(DIVIDER_LINE_50)
    
    projects = ["unified"]
    components = [args.component] if args.component != "all" else ["backend", "frontend"]
    action = args.action
    remote_build = getattr(args, "remote_build", True)
    
    pipeline = DeployPipeline(log_callback=print, remote_build=remote_build, ssr_mode=True)
    
    try:
        for proj in projects:
            for comp in components:
                _execute_cli_step(pipeline, proj, comp, action)
                        
        pipeline.log_summary_report()
        print("\n" + DIVIDER_LINE_50)
        print("SUCCESS: Unified CLI Pipeline fully completed!")
        print(DIVIDER_LINE_50)
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
            
    has_args = len(sys.argv) > 1
    
    if has_args or not PYSIDE_AVAILABLE:
        if not PYSIDE_AVAILABLE and not has_args:
            print("[WARNING] PySide6 library is not installed locally. Falling back to Command Line Interface (CLI) mode.")
            
        parser = argparse.ArgumentParser(
            description="Merter Vitrini Unified Compiler & SSH Deployer Suite."
        )
        parser.add_argument(
            "-p", "--project",
            choices=["unified", "admin", "shop", "all"],
            default="unified",
            help="Choose target project environment (defaults to unified)."
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
            dest="remote_build",
            action="store_true",
            default=True,
            help="Build the frontend on the remote server via SSH (default: True, no local static build)."
        )
        parser.add_argument(
            "--local-build",
            dest="remote_build",
            action="store_false",
            help="Build frontend locally (disabled by default)."
        )
        parser.add_argument(
            "--ssr",
            action="store_true",
            help="Deploy storefront Next.js app in live dynamic Node.js Server Mode (SSR) with systemd daemon (merter-frontend)."
        )
        args = parser.parse_args()
        run_cli_headless(args)
    else:
        app = QtWidgets.QApplication(sys.argv)
        window = MainWindow()
        window.show()
        sys.exit(app.exec())

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
