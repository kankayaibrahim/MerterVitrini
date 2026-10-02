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
        ssh.connect(hostname, port=port, username=username, password=auth_secret)
        print("Connected to SSH.")
        
        print("\nChecking if rsync exists:")
        _, stdout, _ = ssh.exec_command("which rsync")
        print("rsync path:", stdout.read().decode('utf-8').strip())
        
        print("\nRunning deploy commands manually to see stdout/stderr:")
        # Try running the rsync command directly
        cmd = "rsync -a --delete --exclude='uploads' /var/www/build/admin/frontend/out/ /var/www/admin.mertervitrini.com.tr/frontend/"
        print(f"Running: {cmd}")
        _, stdout, stderr = ssh.exec_command(cmd)
        print("STDOUT:", stdout.read().decode('utf-8'))
        print("STDERR:", stderr.read().decode('utf-8'))
        
        print("\nChecking files again:")
        _, stdout, _ = ssh.exec_command("ls -la /var/www/admin.mertervitrini.com.tr/frontend")
        print(stdout.read().decode('utf-8'))
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()


if __name__ == "__main__":
    run_remote_commands()
