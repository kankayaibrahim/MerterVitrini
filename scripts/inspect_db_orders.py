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
        
        # We can execute psql directly on the remote server
        cmd = f'PGPASSWORD="{db_password}" psql -h 127.0.0.1 -U postgres -d merterdevdb -c "SELECT id, order_number, total_amount FROM catalog.orders ORDER BY created_at DESC LIMIT 5;"'
        print(f"Running: {cmd}")
        _, stdout, stderr = ssh.exec_command(cmd)
        print(stdout.read().decode('utf-8'))
        print(stderr.read().decode('utf-8'))
        
        cmd_items = f'PGPASSWORD="{db_password}" psql -h 127.0.0.1 -U postgres -d merterdevdb -c "SELECT order_id, product_name, product_sku, image_url_at_purchase FROM catalog.order_items WHERE order_id = \'019eaef6-efc7-75f3-9373-0bc7153c1b78\';"'
        print(f"Running: {cmd_items}")
        _, stdout, stderr = ssh.exec_command(cmd_items)
        print(stdout.read().decode('utf-8'))
        print(stderr.read().decode('utf-8'))
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()


if __name__ == "__main__":
    run_remote_commands()
