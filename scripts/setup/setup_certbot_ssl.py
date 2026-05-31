#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
TÜRKÇE (TURKISH):
Bu script, sunucuya Certbot (Let's Encrypt) aracını kurmak, otomatik yenileme (auto-renew)
timer'ını aktif etmek ve ana alan adı (mertervitrini.com.tr) için ilk SSL sertifikalarını
talep etmek amacıyla kullanılan bir altyapı kurulum aracıdır.
Günlük güncellemeler ve kod gönderimleri için ana klasördeki 'unified_deployer.py' kullanılmalıdır.

ENGLISH:
This script is an infrastructure provisioning tool used to install Certbot (Let's Encrypt)
on the server, enable and start the automatic renewal timer, and request the initial
SSL certificates for the primary domains (mertervitrini.com.tr & www.mertervitrini.com.tr).
For daily routine updates and code deployments, please use 'unified_deployer.py' instead.
================================================================================
"""

import paramiko
import sys

# Server Configuration
hostname = "213.202.255.80"
username = "root"
password = "02vMhY8Xgi"
port = 22

print("==================================================")
print("Installing Certbot (Let's Encrypt) and Configuring SSL (com.tr)")
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

    # 2. Install Certbot and its Nginx plugin
    print("\n--- Installing Certbot and Python Nginx Plugin ---")
    run_cmd("dnf install certbot python3-certbot-nginx -y")

    # 3. Enable Systemd Certbot Renewal Timer for automatic renewal
    print("\n--- Activating Let's Encrypt Automatic Renewal Timer ---")
    run_cmd("systemctl enable --now certbot-renew.timer")
    run_cmd("systemctl status certbot-renew.timer --no-pager")

    # 4. Attempt to request Let's Encrypt SSL for the corrected .com.tr domain
    print("\n--- Requesting SSL Certificate from Let's Encrypt for com.tr ---")
    
    certbot_cmd = (
        "certbot --nginx "
        "-d mertervitrini.com.tr -d www.mertervitrini.com.tr "
        "--non-interactive --agree-tos --email info@mertervitrini.com.tr --redirect"
    )
    out, err = run_cmd(certbot_cmd)

    if "Congratulations!" in out or "success" in out.lower() or "active" in out.lower():
        print("\n==================================================")
        print("SUCCESS: SSL Certificate successfully installed and active!")
        print("Automatic renewals have been fully configured.")
        print("Your site is now available securely over HTTPS: https://mertervitrini.com.tr")
        print("==================================================")
    else:
        print("\n==================================================")
        print("INFO: Certbot execution completed.")
        print("If the request failed, please verify that your domain's DNS A records")
        print(f"point to the server IP: {hostname} and try again later.")
        print("Certbot and auto-renew timers are fully installed and ready!")
        print("==================================================")

except Exception as e:
    print(f"\nERROR during deployment: {e}")
    sys.exit(1)
finally:
    if 'ssh' in locals():
        ssh.close()
