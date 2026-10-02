import os
import sys
from pathlib import Path
import paramiko

# Ensure scripts directory is available for importing unified_deployer config
scripts_dir = Path(__file__).resolve().parent
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

from unified_deployer import SERVER_CONFIG

DIVIDER = "=" * 50

# Server connection details from centralized configuration
hostname = SERVER_CONFIG.get("hostname", "")
port = SERVER_CONFIG.get("port", 22)
username = SERVER_CONFIG.get("username", "root")
auth_secret = SERVER_CONFIG.get("password", "")

local_css_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "keycloak-theme", "merter", "login", "resources", "css", "merter-v2.css"))
remote_css_path = "/opt/keycloak/themes/merter/login/resources/css/merter-v2.css"

local_props_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "keycloak-theme", "merter", "login", "theme.properties"))
remote_props_path = "/opt/keycloak/themes/merter/login/theme.properties"

print(DIVIDER)
print("Deploying updated Keycloak theme...")
print(DIVIDER)

if not os.path.exists(local_css_path):
    print(f"Error: Local stylesheet not found at {local_css_path}")
    sys.exit(1)

try:
    print(f"Connecting to SSH at {hostname}:{port}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(hostname, port=port, username=username, password=auth_secret, timeout=15)
    
    sftp = ssh.open_sftp()
    
    print("Uploading merter-v2.css via SFTP...")
    sftp.put(local_css_path, remote_css_path)
    print("[OK] Stylesheet uploaded successfully!")
    
    if os.path.exists(local_props_path):
        print("Uploading theme.properties via SFTP...")
        sftp.put(local_props_path, remote_props_path)
        print("[OK] theme.properties uploaded successfully!")
    
    sftp.close()
    
    print("Restarting Keycloak service to clear cache and apply changes...")
    _, stdout, stderr = ssh.exec_command("systemctl restart keycloak")
    exit_status = stdout.channel.recv_exit_status()
    
    if exit_status == 0:
        print("[OK] Keycloak service restarted successfully!")
    else:
        print(f"Warning: systemctl restart keycloak returned code {exit_status}")
        error_msg = stderr.read().decode('utf-8')
        if error_msg:
            print(f"Error details: {error_msg}")
            
    ssh.close()
    print(f"\n{DIVIDER}")
    print("SUCCESS: Keycloak login page theme deployed!")
    print(DIVIDER)

except Exception as e:
    print(f"\nERROR during Keycloak deployment: {e}")
    sys.exit(1)
