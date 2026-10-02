import os
import sys
from pathlib import Path
import paramiko

# Ensure scripts directory is available for importing unified_deployer config
scripts_dir = Path(__file__).resolve().parent
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

from unified_deployer import SERVER_CONFIG, PROJECTS_CONFIG


def run_remote_commands():
    hostname = SERVER_CONFIG.get("hostname", "")
    port = SERVER_CONFIG.get("port", 22)
    username = SERVER_CONFIG.get("username", "root")
    auth_secret = SERVER_CONFIG.get("password", "")
    db_password = os.environ.get("DB_PASSWORD") or PROJECTS_CONFIG.get("unified", {}).get("backend", {}).get("config_template", {}).get("db_password", "")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, port=port, username=username, password=auth_secret)
        print("Connected to SSH.")
        
        # Check Germany country row
        cmd = f'PGPASSWORD="{db_password}" psql -h 127.0.0.1 -U postgres -d merterdevdb -c "SELECT * FROM catalog.countries WHERE code = \'DE\';"'
        print(f"Running: {cmd}")
        _, stdout, _ = ssh.exec_command(cmd)
        print(stdout.read().decode('utf-8'))
        
        # Check state counts by country
        cmd_states = f'PGPASSWORD="{db_password}" psql -h 127.0.0.1 -U postgres -d merterdevdb -c "SELECT c.code, COUNT(s.id) FROM catalog.countries c LEFT JOIN catalog.country_states s ON c.id = s.country_id GROUP BY c.code ORDER BY COUNT(s.id) DESC;"'
        print(f"Running: {cmd_states}")
        _, stdout, stderr = ssh.exec_command(cmd_states)
        print(stdout.read().decode('utf-8'))
        print(stderr.read().decode('utf-8'))
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()


if __name__ == "__main__":
    run_remote_commands()
