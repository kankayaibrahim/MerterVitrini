import paramiko
import sys

def main():
    hostname = "213.202.255.80"
    port = 22
    username = "root"
    password = "02vMhY8Xgi"

    print("Connecting to SSH...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(hostname, port=port, username=username, password=password)
    print("Connected.")

    # 1. Read existing config
    print("Reading /opt/keycloak/conf/keycloak.conf...")
    sftp = ssh.open_sftp()
    with sftp.open("/opt/keycloak/conf/keycloak.conf", "r") as f:
        conf_content = f.read().decode('utf-8')
    print("Current config contents:\n", conf_content)

    # 2. Replace proxy=edge with proxy-headers=xforwarded
    new_content = conf_content.replace("proxy=edge", "proxy-headers=xforwarded")
    if "proxy-headers=" not in new_content:
        new_content += "\nproxy-headers=xforwarded\n"
    
    print("\nWriting new config contents...")
    with sftp.open("/opt/keycloak/conf/keycloak.conf", "w") as f:
        f.write(new_content)
    sftp.close()

    # 3. Perform optimized build for Keycloak
    print("\nRunning Keycloak optimized build (kc.sh build)...")
    stdin, stdout, stderr = ssh.exec_command("/opt/keycloak/bin/kc.sh build")
    
    # Read output
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    print("STDOUT:\n", out.encode('ascii', errors='replace').decode('ascii'))
    print("STDERR:\n", err.encode('ascii', errors='replace').decode('ascii'))

    # 4. Restart Keycloak service
    print("\nRestarting Keycloak service...")
    ssh.exec_command("systemctl restart keycloak")
    print("Keycloak service restarted successfully!")

    ssh.close()
    print("\nKeycloak config fix script completed!")

if __name__ == '__main__':
    main()
