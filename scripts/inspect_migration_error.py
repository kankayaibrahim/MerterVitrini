import os
import sys
from pathlib import Path
import paramiko

# Ensure scripts directory is available for importing unified_deployer config
scripts_dir = Path(__file__).resolve().parent
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

from unified_deployer import SERVER_CONFIG, PROJECTS_CONFIG


def run():
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
        
        # Run the DDL part of the SQL script in a transaction and print output
        sql = """
        BEGIN;
        CREATE TABLE IF NOT EXISTS catalog.country_cities (
            id uuid PRIMARY KEY DEFAULT uuidv7(),
            state_id uuid NOT NULL REFERENCES catalog.country_states(id) ON DELETE CASCADE,
            code varchar(50) NOT NULL,
            name varchar(150) NOT NULL,
            created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE identity.user_addresses ADD COLUMN IF NOT EXISTS city_id uuid REFERENCES catalog.country_cities(id);
        ROLLBACK;
        """
        
        cmd = f'PGPASSWORD="{db_password}" psql -h 127.0.0.1 -U postgres -d merterdevdb'
        stdin, stdout, stderr = ssh.exec_command(cmd)
        stdin.write(sql)
        stdin.flush()
        stdin.channel.shutdown_write()
        
        print("Stdout:")
        print(stdout.read().decode('utf-8'))
        print("Stderr:")
        print(stderr.read().decode('utf-8'))
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()


if __name__ == "__main__":
    run()
