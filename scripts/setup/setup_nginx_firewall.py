#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
TÜRKÇE (TURKISH):
Bu script, sunucuya ilk kez Nginx web sunucusu kurulumu yapmak, firewall portlarını
(HTTP/HTTPS) kalıcı olarak açmak, SELinux politikalarını ayarlamak ve ilk hoş geldiniz
(index.html) sayfasını yayınlamak amacıyla yazılmış bir tek seferlik kurulum (setup) aracıdır.
Günlük güncellemeler ve kod gönderimleri için ana klasördeki 'unified_deployer.py' kullanılmalıdır.

ENGLISH:
This script is a one-time setup (provisioning) tool designed for the initial installation
of the Nginx web server on the remote host, permanently opening firewalls for HTTP & HTTPS,
applying initial SELinux policies, and deploying the base welcome (index.html) page.
For everyday routine updates and deployments, please use 'unified_deployer.py' instead.
================================================================================
"""

import paramiko
import os
import sys

# Server Configuration
hostname = "213.202.255.80"
username = "root"
password = "02vMhY8Xgi"
port = 22

# Path Calculations
script_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(script_dir, "..", ".."))

local_html_path = os.path.join(root_dir, "shop", "frontend", "index.html")
remote_root_dir = "/var/www/mertervitrini.com.tr"
remote_frontend_dir = f"{remote_root_dir}/frontend"
remote_backend_dir = f"{remote_root_dir}/backend"
nginx_conf_path = "/etc/nginx/conf.d/mertervitrini.com.tr.conf"

print("==================================================")
print("Deploying Nginx and Webpage to AlmaLinux 9 Server (com.tr)")
print("==================================================")

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
        
        # Safe ASCII encoding for Windows console printing
        out = raw_out.encode('ascii', errors='replace').decode('ascii')
        err = raw_err.encode('ascii', errors='replace').decode('ascii')
        
        if out:
            print(f"STDOUT:\n{out}")
        if err:
            print(f"STDERR:\n{err}")
        return out, err

    # 2. Update DNF and Install EPEL + Nginx
    print("\n--- Installing Nginx ---")
    run_cmd("dnf install epel-release -y")
    run_cmd("dnf install nginx -y")

    # 3. Create requested frontend and backend folder separation
    print("\n--- Creating Application Folder Structure ---")
    run_cmd(f"mkdir -p {remote_frontend_dir}")
    run_cmd(f"mkdir -p {remote_backend_dir}")
    run_cmd(f"chmod -R 755 {remote_root_dir}")
    
    # Try setting SELinux context, ignore gracefully if SELinux is disabled/unlabeled
    print("Applying SELinux contexts (if supported)...")
    run_cmd(f"chcon -Rt httpd_sys_content_t {remote_root_dir}")

    # Remove the old com config and folder if they exist to keep server clean
    run_cmd("rm -f /etc/nginx/conf.d/mertervitrini.com.conf")

    # 4. Upload index.html Welcoming page
    print("\n--- Uploading Welcome HTML Webpage ---")
    sftp = ssh.open_sftp()
    remote_index_html = f"{remote_frontend_dir}/index.html"
    print(f"SFTP Uploading {local_html_path} -> {remote_index_html}")
    sftp.put(local_html_path, remote_index_html)
    sftp.chmod(remote_index_html, 0o644)
    sftp.close()
    print("HTML Upload completed successfully!")

    # 5. Configure Nginx Virtual Host Configuration
    print("\n--- Creating Nginx Virtual Host Config ---")
    nginx_conf_content = f"""server {{
    listen 80;
    server_name {hostname} mertervitrini.com.tr www.mertervitrini.com.tr;

    root {remote_frontend_dir};
    index index.html index.htm;

    location / {{
        try_files $uri $uri/ =404;
    }}
}}
"""
    # Write temp file locally and upload it
    temp_conf_local = os.path.join(root_dir, "temp_merter.conf")
    with open(temp_conf_local, "w", encoding="utf-8") as f:
        f.write(nginx_conf_content)
    
    sftp = ssh.open_sftp()
    print(f"SFTP Uploading config -> {nginx_conf_path}")
    sftp.put(temp_conf_local, nginx_conf_path)
    sftp.close()
    
    # Remove temp local file
    if os.path.exists(temp_conf_local):
        os.remove(temp_conf_local)

    # 6. Configure Firewall ports for HTTP & HTTPS (Ignore command missing errors)
    print("\n--- Configuring Firewall Services ---")
    run_cmd("firewall-cmd --permanent --zone=public --add-service=http")
    run_cmd("firewall-cmd --permanent --zone=public --add-service=https")
    run_cmd("firewall-cmd --reload")

    # 7. Start and Enable Nginx
    print("\n--- Activating Nginx Web Server ---")
    run_cmd("systemctl enable nginx")
    run_cmd("systemctl restart nginx")

    # 8. Verify service running
    print("\n--- Verifying Deployment Status ---")
    run_cmd("systemctl status nginx --no-pager")

    print("\n==================================================")
    print("SUCCESS: Nginx configured for .com.tr!")
    print("==================================================")

except Exception as e:
    print(f"\nERROR during deployment: {e}")
    sys.exit(1)
finally:
    if 'ssh' in locals():
        ssh.close()
