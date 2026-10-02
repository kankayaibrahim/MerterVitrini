import sys
import time
from pathlib import Path
import paramiko

# Ensure scripts directory is available for importing unified_deployer config
scripts_dir = Path(__file__).resolve().parent
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

from unified_deployer import SERVER_CONFIG


def main():
    hostname = SERVER_CONFIG.get("hostname", "")
    port = SERVER_CONFIG.get("port", 22)
    username = SERVER_CONFIG.get("username", "root")
    auth_secret = SERVER_CONFIG.get("password", "")

    print("Connecting to SSH...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(hostname, port=port, username=username, password=auth_secret)
    print("Connected.")

    print("\nPolling Keycloak local port 8082 (waiting for bootstrap)...")
    for i in range(15):
        time.sleep(2)
        _, stdout, _ = ssh.exec_command("curl -s -I http://localhost:8082")
        resp = stdout.read().decode('utf-8', errors='ignore').strip()
        if "HTTP/1.1 302" in resp or "HTTP/1.1 200" in resp:
            print(f"Keycloak is READY after {i*2+2} seconds!")
            print(resp.encode('ascii', errors='replace').decode('ascii'))
            break
        else:
            print(f"Attempt {i+1}/15: Keycloak is still booting...")
    else:
        print("ERROR: Keycloak boot timeout reached.")

    ssh.close()


if __name__ == '__main__':
    main()
