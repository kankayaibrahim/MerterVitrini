import sys
from pathlib import Path
import paramiko

# Ensure scripts directory is available for importing unified_deployer config
scripts_dir = Path(__file__).resolve().parent
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

from unified_deployer import SERVER_CONFIG


def run_remote_commands():
    hostname = SERVER_CONFIG.get("hostname", "")
    port = SERVER_CONFIG.get("port", 22)
    username = SERVER_CONFIG.get("username", "root")
    auth_secret = SERVER_CONFIG.get("password", "")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, port, username, auth_secret)
        print("Connected to SSH.")
        
        _, stdout, stderr = ssh.exec_command("ls -la /var/www/mertervitrini.com.tr/frontend/")
        print("=== /var/www/mertervitrini.com.tr/frontend/ ===")
        print(stdout.read().decode('utf-8'))
        print(stderr.read().decode('utf-8'))
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()


if __name__ == "__main__":
    run_remote_commands()
