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
        print(f"Connecting to {hostname}...")
        ssh.connect(hostname, port, username, auth_secret)
        print("Connected successfully!")
        
        commands = [
            "echo '=== Permissions ==='",
            "ls -ld /var/www",
            "ls -ld /var/www/admin.mertervitrini.com.tr",
            "ls -ld /var/www/admin.mertervitrini.com.tr/frontend",
            "ls -la /var/www/admin.mertervitrini.com.tr/frontend",
            "echo '=== Nginx Error Logs ==='",
            "tail -n 20 /var/log/nginx/error.log",
            "echo '=== Nginx Configs ==='",
            "ls -la /etc/nginx/sites-enabled",
            "cat /etc/nginx/sites-enabled/admin.mertervitrini.com.tr || cat /etc/nginx/conf.d/admin.mertervitrini.com.tr.conf || cat /etc/nginx/nginx.conf"
        ]
        
        for cmd in commands:
            print(f"\n$ {cmd}")
            _, stdout, stderr = ssh.exec_command(cmd)
            out = stdout.read().decode('utf-8')
            err = stderr.read().decode('utf-8')
            if out:
                print(out.strip())
            if err:
                print(f"STDERR: {err.strip()}")
                
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()


if __name__ == "__main__":
    run_remote_commands()
