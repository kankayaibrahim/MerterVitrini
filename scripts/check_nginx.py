import paramiko

def run_remote_commands():
    hostname = "213.202.255.80"
    port = 22
    username = "root"
    password = "02vMhY8Xgi"

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Connecting to {hostname}...")
        ssh.connect(hostname, port, username, password)
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
            stdin, stdout, stderr = ssh.exec_command(cmd)
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
