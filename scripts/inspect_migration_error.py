import paramiko

def run():
    hostname = "213.202.255.80"
    port = 22
    username = "root"
    password = "02vMhY8Xgi"

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, port, username, password)
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
        
        sftp = ssh.open_sftp()
        with sftp.file('/tmp/test_ddl.sql', 'w') as f:
            f.write(sql)
        sftp.close()
        
        cmd = 'PGPASSWORD="DHMwK0Qzyox7" psql -h 127.0.0.1 -U postgres -d merterdevdb -f /tmp/test_ddl.sql'
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        print("Stdout:")
        print(stdout.read().decode('utf-8'))
        print("Stderr:")
        print(stderr.read().decode('utf-8'))
        
        ssh.exec_command("rm -f /tmp/test_ddl.sql")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    run()
