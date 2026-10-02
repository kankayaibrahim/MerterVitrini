import os
import sys
from pathlib import Path
import paramiko

# Ensure scripts directory is available for importing unified_deployer config
scripts_dir = Path(__file__).resolve().parent
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

from unified_deployer import SERVER_CONFIG


def main():
    hostname = SERVER_CONFIG.get("hostname", "")
    port = SERVER_CONFIG.get("port", 22)
    username = SERVER_CONFIG.get("username", "root")
    auth_secret = SERVER_CONFIG.get("password", "")
    kc_admin_pw = os.environ.get("KEYCLOAK_ADMIN_PASSWORD", "KcAdminPassword02vMhY8")

    print("Connecting to SSH...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(hostname, port=port, username=username, password=auth_secret)
    print("Connected.")

    # 1. Login to kcadm.sh
    print("\nLogging into kcadm.sh...")
    ssh.exec_command(f"/opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8082 --realm master --user admin --password {kc_admin_pw}")

    # 2. Check if role 'admin' exists, create if not
    print("Checking/creating realm role 'admin' inside realm 'merter'...")
    _, stdout, _ = ssh.exec_command("/opt/keycloak/bin/kcadm.sh get roles/admin -r merter")
    role_out = stdout.read().decode('utf-8', errors='ignore')
    if "admin" not in role_out:
        ssh.exec_command("/opt/keycloak/bin/kcadm.sh create roles -r merter -s name=admin -s description='Administrator role'")
        print("Created realm role 'admin'.")
    else:
        print("Realm role 'admin' already exists.")

    # 3. Create default admin user in realm 'merter'
    print("Checking if user 'admin' exists in realm 'merter'...")
    _, stdout, _ = ssh.exec_command("/opt/keycloak/bin/kcadm.sh get users -r merter -q username=admin")
    user_out = stdout.read().decode('utf-8', errors='ignore')
    
    if "admin" not in user_out:
        print("Creating default user 'admin'...")
        create_user_cmd = (
            "/opt/keycloak/bin/kcadm.sh create users -r merter "
            "-s username=admin "
            "-s email=admin@mertervitrini.com.tr "
            "-s firstName=Halil "
            "-s lastName=Admin "
            "-s enabled=true "
            "-s emailVerified=true"
        )
        ssh.exec_command(create_user_cmd)
        
        # Set password
        print("Setting user password...")
        ssh.exec_command(f"/opt/keycloak/bin/kcadm.sh set-password -r merter --username admin --new-password {kc_admin_pw}")
        
        # Assign role
        print("Assigning 'admin' role to user...")
        ssh.exec_command("/opt/keycloak/bin/kcadm.sh add-roles -r merter --uusername admin --cnames admin")
        print("User successfully provisioned and role assigned!")
    else:
        print("User 'admin' already exists in realm 'merter'.")

    ssh.close()
    print("\nKeycloak user provisioning completed!")


if __name__ == '__main__':
    main()
