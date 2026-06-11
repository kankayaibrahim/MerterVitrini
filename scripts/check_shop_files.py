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
        
        stdin, stdout, stderr = ssh.exec_command("ls -la /var/www/mertervitrini.com.tr/frontend/")
        print("=== /var/www/mertervitrini.com.tr/frontend/ ===")
        print(stdout.read().decode('utf-8'))
        print(stderr.read().decode('utf-8'))
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    run_remote_commands()
