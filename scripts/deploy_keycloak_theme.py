import paramiko
import os
import sys

# Server connection details from configuration
hostname = "213.202.255.80"
port = 22
username = "root"
password = "02vMhY8Xgi"

local_css_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "keycloak-theme", "merter", "login", "resources", "css", "merter-v2.css"))
remote_css_path = "/opt/keycloak/themes/merter/login/resources/css/merter-v2.css"

local_props_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "keycloak-theme", "merter", "login", "theme.properties"))
remote_props_path = "/opt/keycloak/themes/merter/login/theme.properties"

print("==================================================")
print("Deploying updated Keycloak theme...")
print("==================================================")

if not os.path.exists(local_css_path):
    print(f"Error: Local stylesheet not found at {local_css_path}")
    sys.exit(1)

try:
    print(f"Connecting to SSH at {hostname}:{port}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(hostname, port=port, username=username, password=password, timeout=15)
    
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
    stdin, stdout, stderr = ssh.exec_command("systemctl restart keycloak")
    exit_status = stdout.channel.recv_exit_status()
    
    if exit_status == 0:
        print("[OK] Keycloak service restarted successfully!")
    else:
        print(f"Warning: systemctl restart keycloak returned code {exit_status}")
        error_msg = stderr.read().decode('utf-8')
        if error_msg:
            print(f"Error details: {error_msg}")
            
    ssh.close()
    print("\n==================================================")
    print("SUCCESS: Keycloak login page theme deployed!")
    print("==================================================")

except Exception as e:
    print(f"\nERROR during Keycloak deployment: {e}")
    sys.exit(1)
