#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
TÜRKÇE (TURKISH):
Bu script, Shop Storefront (Mağaza) uygulamasının uzak sunucuda ilk kez barındırılması
(initial provisioning) amacıyla kullanılır. Nginx sanal sunucu bloklarını (Virtual Hosts)
SSL ve HTTP yönlendirmeleriyle yapılandırır, statik uploads klasörü eşlemelerini (/uploads)
ve backend proxy yönlendirmelerini (/api) tanımlar, Next.js static out dosyaları ile compiled
Go backend binary dosyasını sunucuya taşır, systemd servisi oluşturur ve Certbot üzerinden
gerekli SSL (HTTPS) sertifikalarını genişleterek sistemi aktif eder.
Günlük rutin güncellemeler ve kod gönderimleri için ana klasördeki 'unified_deployer.py' kullanılmalıdır.

ENGLISH:
This script is used for the initial provisioning of the Shop Storefront on the remote server.
It configures Nginx virtual host blocks with SSL redirects, mapping static uploads (/uploads)
and backend reverse proxies (/api), uploads the initial static Next.js export alongside the Go binary,
registers the systemd backend service, and secures everything by acquiring SSL certs via Certbot.
For daily routine updates and code deployments, please use 'unified_deployer.py' instead.
================================================================================
"""

import paramiko
import os
import sys
import tarfile
import json

# Server Configuration
hostname = "213.202.255.80"
username = "root"
password = "02vMhY8Xgi"
port = 22

# Paths (Adjusted for scripts/setup/ subdirectory nesting)
script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(script_dir, "..", ".."))

local_frontend_out = os.path.join(root_dir, "shop", "frontend", "out")
local_backend_bin = os.path.join(root_dir, "shop", "backend", "bin", "shop-backend")

remote_root_dir = "/var/www/mertervitrini.com.tr"
remote_frontend_dir = f"{remote_root_dir}/frontend"
remote_backend_dir = f"{remote_root_dir}/backend"
remote_bin_dir = f"{remote_backend_dir}/bin"

nginx_conf_path = "/etc/nginx/conf.d/mertervitrini.com.tr.conf"
systemd_service_path = "/etc/systemd/system/shop-backend.service"

print("==================================================")
print("Deploying Shop Suite (Frontend + Backend) to Server")
print("==================================================")

# Verify local files
if not os.path.exists(local_frontend_out):
    print("ERROR: Compiled Next.js shop frontend not found! Run 'npm run build' inside shop/frontend first.")
    sys.exit(1)

if not os.path.exists(local_backend_bin):
    print("ERROR: Compiled Go shop-backend binary not found! Run build.ps1 first.")
    sys.exit(1)

try:
    # 1. Establish SSH connection
    print(f"Connecting to {hostname} via SSH...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(hostname, port, username, password, timeout=15)
    print("SSH connection successful!")

    # Helper function to run commands and print outputs safely
    def run_cmd(cmd):
        print(f"Executing: {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        raw_out = stdout.read().decode('utf-8', errors='ignore').strip()
        raw_err = stderr.read().decode('utf-8', errors='ignore').strip()
        
        out = raw_out.encode('ascii', errors='replace').decode('ascii')
        if out:
            print(f"STDOUT:\n{out}")
        
        err = raw_err.encode('ascii', errors='replace').decode('ascii')
        if err:
            print(f"STDERR:\n{err}")
        return out, err

    # 2. Create remote folder structure
    print("\n--- Preparing Remote Server Directory Structure ---")
    run_cmd(f"mkdir -p {remote_frontend_dir}")
    run_cmd(f"mkdir -p {remote_bin_dir}")
    run_cmd(f"mkdir -p {remote_bin_dir}/logs")
    run_cmd(f"chmod -R 755 {remote_root_dir}")

    # Remove the old com config if it exists
    run_cmd("rm -f /etc/nginx/conf.d/mertervitrini.com.conf")

    # Try setting SELinux context
    print("Applying SELinux contexts (if supported)...")
    run_cmd(f"chcon -Rt httpd_sys_content_t {remote_root_dir} || true")

    # 3. Archive & Upload Frontend Assets
    print("\n--- Archiving Frontend Static Assets ---")
    archive_name = "shop_frontend.tar.gz"
    local_archive_path = os.path.join(script_dir, archive_name)
    
    with tarfile.open(local_archive_path, "w:gz") as tar:
        tar.add(local_frontend_out, arcname=os.path.basename(local_frontend_out))
    print(f"Created archive: {local_archive_path}")

    print("\n--- Uploading Frontend Assets ---")
    sftp = ssh.open_sftp()
    remote_archive_path = f"{remote_root_dir}/{archive_name}"
    print(f"SFTP Uploading {local_archive_path} -> {remote_archive_path}")
    sftp.put(local_archive_path, remote_archive_path)
    sftp.close()

    # Extract frontend files remotely and clean up archive
    print("Extracting frontend assets remotely...")
    run_cmd(f"tar -xzf {remote_archive_path} -C {remote_frontend_dir} --strip-components=1")
    run_cmd(f"rm -f {remote_archive_path}")
    
    # Remove local temp archive
    if os.path.exists(local_archive_path):
        os.remove(local_archive_path)
        
    print("Frontend assets deployed successfully!")

    # 4. Upload Go Backend Binary & Config
    print("\n--- Uploading Go Backend Binary ---")
    
    # Stop backend service if running to release locks
    print("Stopping active shop-backend systemd service...")
    run_cmd("systemctl stop shop-backend || true")
    
    sftp = ssh.open_sftp()
    remote_bin_path = f"{remote_bin_dir}/shop-backend"
    print(f"SFTP Uploading Go Binary {local_backend_bin} -> {remote_bin_path}")
    sftp.put(local_backend_bin, remote_bin_path)
    sftp.chmod(remote_bin_path, 0o755) # Make executable
    
    # Generate and upload correct production config.json
    remote_config_path = f"{remote_bin_dir}/config.json"
    print(f"SFTP Uploading production config.json -> {remote_config_path}")
    prod_config = {
        "db_host": "localhost",
        "db_port": "5432",
        "db_user": "postgres",
        "db_password": "DHMwK0Qzyox7",
        "db_name": "merterdevdb",
        "server_port": "8081",
        "log_format": "text"
    }
    temp_config_local = os.path.join(script_dir, "temp_shop_config.json")
    with open(temp_config_local, "w", encoding="utf-8") as f:
        json.dump(prod_config, f, indent=4)
    sftp.put(temp_config_local, remote_config_path)
    sftp.close()
    
    if os.path.exists(temp_config_local):
        os.remove(temp_config_local)
        
    print("Backend binary and config uploaded successfully!")

    # 5. Configure systemd Service for Go Shop Backend
    print("\n--- Provisioning systemd Service ---")
    systemd_content = f"""[Unit]
Description=Merter Vitrini Shop Storefront Backend Service
After=network.target
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory={remote_bin_dir}
ExecStart={remote_bin_dir}/shop-backend
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"""
    temp_service_local = os.path.join(script_dir, "shop-backend.service")
    with open(temp_service_local, "w", encoding="utf-8") as f:
        f.write(systemd_content)
        
    sftp = ssh.open_sftp()
    print(f"SFTP Uploading systemd service config -> {systemd_service_path}")
    sftp.put(temp_service_local, systemd_service_path)
    sftp.close()
    
    if os.path.exists(temp_service_local):
        os.remove(temp_service_local)

    # 6. Configure Nginx Server Block with reverse proxy and SSL
    print("\n--- Provisioning Nginx Virtual Host Configuration ---")
    
    nginx_conf_content = f"""# 1. Main Storefront Server Block (HTTPS)
server {{
    listen 443 ssl;
    server_name 213.202.255.80 mertervitrini.com.tr www.mertervitrini.com.tr;

    root {remote_frontend_dir};
    index index.html index.htm;

    # Security Headers
    server_tokens off;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; frame-ancestors 'self';" always;

    # Support Next.js App Router static exports with clean URLs
    location / {{
        try_files $uri $uri/ $uri.html /index.html =404;
    }}

    # Cache Next.js built chunks (highly optimized for browser caching)
    location /_next/static/ {{
        alias /var/www/mertervitrini.com.tr/frontend/_next/static/;
        access_log off;
        expires 365d;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; frame-ancestors 'self';" always;
    }}

    # Cache and serve dynamically resized images
    location ^~ /uploads/cache/ {{
        alias /var/www/admin.mertervitrini.com.tr/frontend/uploads/cache/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, no-transform" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; frame-ancestors 'self';" always;
        try_files $uri @resize;
    }}

    # Redirect cache misses to the Go backend resizer
    location @resize {{
        rewrite ^/uploads/cache/(\d+)x(\d+)/(.*)$ /api/v1/store/images/resize?w=$1&h=$2&path=$3 break;
        proxy_pass http://127.0.0.1:8081;
    }}

    # Cache static uploads (product cover/variant images) with strict security
    location /uploads/ {{
        alias /var/www/admin.mertervitrini.com.tr/frontend/uploads/;
        access_log off;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, no-transform" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; frame-ancestors 'self';" always;
    }}

    # Cache other static file extensions with security headers
    location ~* \.(?:ico|css|js|gif|jpe?g|png|svg|webp|avif|woff2?|eot|ttf|otf)$ {{
        access_log off;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000, no-transform" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
        add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' https: data: blob:; font-src 'self' https: data:; connect-src 'self' https:; frame-ancestors 'self';" always;
    }}

    location /api/ {{
        proxy_pass http://127.0.0.1:8081/api/;
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

# 2. Storefront Backend API Server Block (HTTPS)
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
        proxy_pass http://127.0.0.1:8081;
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

# 3. HTTP redirect block (Port 80)
server {{
    listen 80;
    server_name 213.202.255.80 mertervitrini.com.tr www.mertervitrini.com.tr api.mertervitrini.com.tr;

    # Let Certbot challenges bypass HTTPS redirect
    location /.well-known/acme-challenge/ {{
        root {remote_frontend_dir};
        try_files $uri =404;
    }}

    location / {{
        return 301 https://$host$request_uri;
    }}
}}
"""
    temp_conf_local = os.path.join(script_dir, "mertervitrini.com.tr.conf")
    with open(temp_conf_local, "w", encoding="utf-8") as f:
        f.write(nginx_conf_content)
        
    sftp = ssh.open_sftp()
    print(f"SFTP Uploading Nginx config -> {nginx_conf_path}")
    sftp.put(temp_conf_local, nginx_conf_path)
    sftp.close()
    
    if os.path.exists(temp_conf_local):
        os.remove(temp_conf_local)

    # 7. Start and Enable systemd service & Nginx reload
    print("\n--- Reloading Services & Daemons ---")
    run_cmd("systemctl daemon-reload")
    run_cmd("systemctl enable shop-backend")
    run_cmd("systemctl restart shop-backend")
    run_cmd("systemctl restart nginx")

    # 8. Request SSL (Certbot) for all subdomains if not already covering api.mertervitrini.com.tr
    print("\n--- Checking SSL Configuration Status ---")
    check_cert_cmd = "[ -f /etc/letsencrypt/live/mertervitrini.com.tr/fullchain.pem ] && openssl x509 -in /etc/letsencrypt/live/mertervitrini.com.tr/fullchain.pem -text -noout | grep -q 'api.mertervitrini.com.tr' && echo 'yes' || echo 'no'"
    cert_status_out, _ = run_cmd(check_cert_cmd)
    covers_api = cert_status_out.strip() == "yes"
    
    if covers_api:
        print("Existing SSL certificate already covers api.mertervitrini.com.tr. Skipping Certbot request.")
    else:
        print("SSL certificate does not cover api.mertervitrini.com.tr yet. Requesting/Expanding SSL Certificate via Certbot...")
        certbot_cmd = (
            "certbot --nginx "
            "-d mertervitrini.com.tr -d www.mertervitrini.com.tr -d api.mertervitrini.com.tr --expand "
            "--non-interactive --agree-tos --email info@mertervitrini.com.tr --redirect"
        )
        run_cmd(certbot_cmd)

    # 9. Verify Deployment Status
    print("\n--- Verifying Services Status ---")
    run_cmd("systemctl status shop-backend --no-pager")
    run_cmd("systemctl status nginx --no-pager")

    print("\n==================================================")
    print("SUCCESS: Shop Storefront Suite fully deployed to http://mertervitrini.com.tr")
    print("==================================================")

except Exception as e:
    print(f"\nERROR during shop deployment: {e}")
    sys.exit(1)
finally:
    if 'ssh' in locals():
        ssh.close()
