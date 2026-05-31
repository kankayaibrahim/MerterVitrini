#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
TÜRKÇE (TURKISH):
Bu script, Admin Panel (Suite) uygulamasının uzak sunucuda ilk kez barındırılması
(initial provisioning) amacıyla kullanılır. Nginx sanal sunucu bloklarını (Virtual Hosts)
HTTP-only olarak yapılandırır, gerekli ilk dizin yetkilendirmelerini yapar, Next.js static out
dosyaları ile Go backend binary dosyasını yükler, bir systemd servisi tanımlar ve en sonunda
Certbot üzerinden SSL (HTTPS) sertifikası talep ederek sistemi güvenli hale getirir.
Günlük rutin güncellemeler ve kod gönderimleri için ana klasördeki 'unified_deployer.py' kullanılmalıdır.

ENGLISH:
This script is used for the initial provisioning of the Admin Panel (Suite) on the remote server.
It configures Nginx virtual host blocks for HTTP-only, prepares required folders and permissions,
uploads the initial Next.js static build and the compiled Go backend binary, creates a systemd service,
and finally provisions Let's Encrypt SSL certificates via Certbot.
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

local_frontend_out = os.path.join(root_dir, "admin", "frontend", "out")
local_backend_bin = os.path.join(root_dir, "admin", "backend", "bin", "admin-backend")
local_config_example = os.path.join(root_dir, "admin", "backend", "bin", "config.json.example")

remote_root_dir = "/var/www/admin.mertervitrini.com.tr"
remote_frontend_dir = f"{remote_root_dir}/frontend"
remote_backend_dir = f"{remote_root_dir}/backend"
remote_bin_dir = f"{remote_backend_dir}/bin"

nginx_conf_path = "/etc/nginx/conf.d/admin.mertervitrini.com.tr.conf"
systemd_service_path = "/etc/systemd/system/admin-backend.service"

print("==================================================")
print("Deploying Admin Suite (Frontend + Backend) to Server")
print("==================================================")

# Verify local build files exist
if not os.path.exists(local_frontend_out):
    print("ERROR: Compiled Next.js admin frontend not found! Run 'npm run build' inside admin/frontend first.")
    sys.exit(1)

if not os.path.exists(local_backend_bin):
    print("ERROR: Compiled Go admin-backend binary not found! Run build.ps1 first.")
    sys.exit(1)

try:
    # 1. Archive frontend files for fast single-file SFTP transfer
    print("\n--- Archiving Frontend Static Assets ---")
    archive_name = "admin_frontend.tar.gz"
    local_archive_path = os.path.join(script_dir, archive_name)
    
    with tarfile.open(local_archive_path, "w:gz") as tar:
        tar.add(local_frontend_out, arcname=os.path.basename(local_frontend_out))
    print(f"Created archive: {local_archive_path}")

    # 2. Establish SSH connection
    print(f"\nConnecting to {hostname} via SSH...")
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
        err = raw_err.encode('ascii', errors='replace').decode('ascii')
        
        if out:
            print(f"STDOUT:\n{out}")
        if err:
            print(f"STDERR:\n{err}")
        return out, err

    # 3. Create requested frontend and backend folder structure on AlmaLinux
    print("\n--- Preparing Remote Server Directory Structure ---")
    run_cmd(f"mkdir -p {remote_frontend_dir}")
    run_cmd(f"mkdir -p {remote_bin_dir}")
    run_cmd(f"mkdir -p {remote_bin_dir}/logs")
    run_cmd(f"chmod -R 755 {remote_root_dir}")

    # 4. Upload archived frontend static assets
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

    # 5. Upload Go Backend Binary & Example Config
    print("\n--- Uploading Go Backend Binary ---")
    
    # Stop backend systemd service if running to release file locks on executable
    print("Checking and stopping existing systemd service...")
    run_cmd("systemctl stop admin-backend || true")
    
    sftp = ssh.open_sftp()
    remote_bin_path = f"{remote_bin_dir}/admin-backend"
    print(f"SFTP Uploading Go Binary {local_backend_bin} -> {remote_bin_path}")
    sftp.put(local_backend_bin, remote_bin_path)
    sftp.chmod(remote_bin_path, 0o755) # Make executable
    
    # Upload config.json.example
    remote_config_example = f"{remote_bin_dir}/config.json.example"
    print(f"SFTP Uploading example config -> {remote_config_example}")
    sftp.put(local_config_example, remote_config_example)
    
    # Generate and upload correct production config.json
    remote_config_path = f"{remote_bin_dir}/config.json"
    print(f"SFTP Uploading production config.json -> {remote_config_path}")
    prod_config = {
        "db_host": "localhost",
        "db_port": "5432",
        "db_user": "postgres",
        "db_password": "DHMwK0Qzyox7",
        "db_name": "merterdevdb",
        "jwt_secret": "merter-vitrini-super-secret-key-change-in-prod",
        "server_port": "8080",
        "disable_otp": True,
        "log_format": "text"
    }
    temp_config_local = os.path.join(script_dir, "temp_config.json")
    with open(temp_config_local, "w", encoding="utf-8") as f:
        json.dump(prod_config, f, indent=4)
    sftp.put(temp_config_local, remote_config_path)

    # Upload custom python parsers
    remote_parsers_dir = f"{remote_bin_dir}/parsers"
    run_cmd(f"mkdir -p {remote_parsers_dir}")
    local_janes_parser = os.path.join(root_dir, "admin", "backend", "parsers", "janes.py")
    remote_janes_parser = f"{remote_parsers_dir}/janes.py"
    print(f"SFTP Uploading custom parser -> {remote_janes_parser}")
    sftp.put(local_janes_parser, remote_janes_parser)
    sftp.chmod(remote_janes_parser, 0o755)

    sftp.close()
    
    if os.path.exists(temp_config_local):
        os.remove(temp_config_local)
        
    print("Backend binary and config uploaded successfully!")

    # 6. Configure systemd Service for Go Backend
    print("\n--- Provisioning systemd Service ---")
    systemd_content = f"""[Unit]
Description=Merter Vitrini Admin Backend Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={remote_bin_dir}
ExecStart={remote_bin_dir}/admin-backend
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
    temp_service_local = os.path.join(script_dir, "admin-backend.service")
    with open(temp_service_local, "w", encoding="utf-8") as f:
        f.write(systemd_content)
        
    sftp = ssh.open_sftp()
    print(f"SFTP Uploading systemd service config -> {systemd_service_path}")
    sftp.put(temp_service_local, systemd_service_path)
    sftp.close()
    
    if os.path.exists(temp_service_local):
        os.remove(temp_service_local)

    # 7. Configure Nginx Server Block with reverse proxy
    print("\n--- Provisioning Nginx Virtual Host Configuration ---")
    
    # Check if Nginx config already exists and has SSL configured
    check_ssl_cmd = f"[ -f {nginx_conf_path} ] && grep -q 'listen 443 ssl' {nginx_conf_path} && echo 'yes' || echo 'no'"
    ssl_status_out, _ = run_cmd(check_ssl_cmd)
    has_ssl = ssl_status_out.strip() == "yes"
    
    if has_ssl:
        print("Nginx configuration with active SSL already exists. Skipping Nginx config overwrite to preserve SSL blocks.")
    else:
        print("No active SSL block found in Nginx configuration. Provisioning HTTP-only virtual host config...")
        nginx_conf_content = f"""# 1. Frontend Server Block
server {{
    listen 80;
    server_name admin.mertervitrini.com.tr;

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

    location / {{
        try_files $uri $uri/ /index.html =404;
    }}
}}

# 2. Backend API Server Block
server {{
    listen 80;
    server_name adminapi.mertervitrini.com.tr;

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
}}
"""
        temp_conf_local = os.path.join(script_dir, "admin.mertervitrini.com.tr.conf")
        with open(temp_conf_local, "w", encoding="utf-8") as f:
            f.write(nginx_conf_content)
            
        sftp = ssh.open_sftp()
        print(f"SFTP Uploading Nginx config -> {nginx_conf_path}")
        sftp.put(temp_conf_local, nginx_conf_path)
        sftp.close()
        
        if os.path.exists(temp_conf_local):
            os.remove(temp_conf_local)

    # 8. Start and Enable systemd service & Nginx reload
    print("\n--- Reloading Services & Daemons ---")
    run_cmd("systemctl daemon-reload")
    run_cmd("systemctl enable admin-backend")
    run_cmd("systemctl restart admin-backend")
    run_cmd("systemctl restart nginx")

    # 9. Request SSL (Certbot) for both subdomains only if not already configured
    print("\n--- Checking SSL Configuration Status ---")
    if has_ssl:
        print("SSL is already active and configured in Nginx. Skipping Certbot request to protect API rate limits.")
    else:
        print("SSL not detected. Requesting SSL Certificate via Certbot...")
        certbot_cmd = (
            "certbot --nginx "
            "-d admin.mertervitrini.com.tr -d adminapi.mertervitrini.com.tr --expand "
            "--non-interactive --agree-tos --email info@mertervitrini.com.tr --redirect"
        )
        run_cmd(certbot_cmd)

    # 10. Verify Deployment Status
    print("\n--- Verifying Services Status ---")
    run_cmd("systemctl status admin-backend --no-pager")
    run_cmd("systemctl status nginx --no-pager")

    print("\n==================================================")
    print("SUCCESS: Admin Suite fully deployed to http://admin.mertervitrini.com.tr")
    print("==================================================")

except Exception as e:
    print(f"\nERROR during admin deployment: {e}")
    sys.exit(1)
finally:
    if 'ssh' in locals():
        ssh.close()
