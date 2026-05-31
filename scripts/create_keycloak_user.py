import paramiko

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

    # 1. Login to kcadm.sh
    print("\nLogging into kcadm.sh...")
    ssh.exec_command("/opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8082 --realm master --user admin --password KcAdminPassword02vMhY8")

    # 2. Check if role 'admin' exists, create if not
    print("Checking/creating realm role 'admin' inside realm 'merter'...")
    stdin, stdout, stderr = ssh.exec_command("/opt/keycloak/bin/kcadm.sh get roles/admin -r merter")
    role_out = stdout.read().decode('utf-8', errors='ignore')
    if "admin" not in role_out:
        ssh.exec_command("/opt/keycloak/bin/kcadm.sh create roles -r merter -s name=admin -s description='Administrator role'")
        print("Created realm role 'admin'.")
    else:
        print("Realm role 'admin' already exists.")

    # 3. Create default admin user in realm 'merter'
    print("Checking if user 'admin' exists in realm 'merter'...")
    stdin, stdout, stderr = ssh.exec_command("/opt/keycloak/bin/kcadm.sh get users -r merter -q username=admin")
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
        print("Setting user password to 'KcAdminPassword02vMhY8'...")
        ssh.exec_command("/opt/keycloak/bin/kcadm.sh set-password -r merter --username admin --new-password KcAdminPassword02vMhY8")
        
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
