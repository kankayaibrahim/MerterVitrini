import paramiko
import time

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

    print("\nPolling Keycloak local port 8082 (waiting for bootstrap)...")
    for i in range(15):
        time.sleep(2)
        stdin, stdout, stderr = ssh.exec_command("curl -s -I http://localhost:8082")
        resp = stdout.read().decode('utf-8', errors='ignore').strip()
        if "HTTP/1.1 302" in resp or "HTTP/1.1 200" in resp:
            print(f"Keycloak is READY after {i*2+2} seconds!")
            print(resp.encode('ascii', errors='replace').decode('ascii'))
            break
        else:
            print(f"Attempt {i+1}/15: Keycloak is still booting...")
    else:
        print("ERROR: Keycloak boot timeout reached.")

    ssh.close()

if __name__ == '__main__':
    main()
