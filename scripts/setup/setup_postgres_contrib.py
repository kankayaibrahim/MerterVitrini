#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
TÜRKÇE (TURKISH):
Bu script, uzaktaki veritabanı sunucusuna PostgreSQL 'contrib' kütüphanelerini kurmak
için tasarlanmış bir altyapı hazırlık aracıdır. Bu kütüphaneler; pgcrypto (veri şifreleme)
ve ltree (kategori hiyerarşisi) gibi gelişmiş SQL eklentilerinin çalışabilmesini sağlar.
Sunucu ilk kez kurulurken veya veritabanı taşınırken bir kez çalıştırılması yeterlidir.

ENGLISH:
This script is an infrastructure provisioning tool designed to install PostgreSQL 'contrib'
libraries on the remote database server. These packages are required to execute advanced
SQL extensions like pgcrypto (cryptographic functions) and ltree (hierarchical tree structures).
It should be run once during initial server setup or database migration.
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
print("Installing PostgreSQL Contrib Packages on Server...")
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

    # 2. Try to install postgresql-contrib to enable extensions (pgcrypto, ltree, etc.)
    # In AlmaLinux 9, standard postgresql is PostgreSQL 13 or 15 depending on enabled module streams.
    # dnf install postgresql-contrib installs the matching contrib packages automatically!
    print("\n--- Installing PostgreSQL Contrib package ---")
    run_cmd("dnf install postgresql-contrib -y")

    # If they are using PostgreSQL community repository instead of AppStream:
    # We can try to list installed postgresql packages and install the matching contrib
    print("\n--- Checking installed postgresql versions ---")
    out, err = run_cmd("rpm -qa | grep postgres")
    
    # If standard postgresql-contrib did not install, check if postgresql15-contrib or similar is needed
    if "postgresql18" in out:
        print("Detected PostgreSQL 18, installing matching contrib...")
        run_cmd("dnf install postgresql18-contrib -y")
    elif "postgresql17" in out:
        print("Detected PostgreSQL 17, installing matching contrib...")
        run_cmd("dnf install postgresql17-contrib -y")
    elif "postgresql16" in out:
        print("Detected PostgreSQL 16, installing matching contrib...")
        run_cmd("dnf install postgresql16-contrib -y")
    elif "postgresql15" in out:
        print("Detected PostgreSQL 15, installing matching contrib...")
        run_cmd("dnf install postgresql15-contrib -y")
    elif "postgresql14" in out:
        print("Detected PostgreSQL 14, installing matching contrib...")
        run_cmd("dnf install postgresql14-contrib -y")
    elif "postgresql13" in out:
        print("Detected PostgreSQL 13, installing matching contrib...")
        run_cmd("dnf install postgresql13-contrib -y")

    print("\n==================================================")
    print("SUCCESS: Contrib installation run completed!")
    print("==================================================")

except Exception as e:
    print(f"\nERROR: {e}")
    sys.exit(1)
finally:
    if 'ssh' in locals():
        ssh.close()
