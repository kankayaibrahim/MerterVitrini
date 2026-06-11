import paramiko

def run_remote_commands():
    hostname = "213.202.255.80"
    port = 22
    username = "root"
    password = "02vMhY8Xgi"

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, port, username, password)
        print("Connected to SSH.")
        
        # Check Germany country row
        cmd = 'PGPASSWORD="DHMwK0Qzyox7" psql -h 127.0.0.1 -U postgres -d merterdevdb -c "SELECT * FROM catalog.countries WHERE code = \'DE\';"'
        print(f"Running: {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print(stdout.read().decode('utf-8'))
        
        # Check state counts by country
        cmd_states = 'PGPASSWORD="DHMwK0Qzyox7" psql -h 127.0.0.1 -U postgres -d merterdevdb -c "SELECT c.code, COUNT(s.id) FROM catalog.countries c LEFT JOIN catalog.country_states s ON c.id = s.country_id GROUP BY c.code ORDER BY COUNT(s.id) DESC;"'
        print(f"Running: {cmd_states}")
        stdin, stdout, stderr = ssh.exec_command(cmd_states)
        print(stdout.read().decode('utf-8'))
        print(stderr.read().decode('utf-8'))
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    run_remote_commands()
