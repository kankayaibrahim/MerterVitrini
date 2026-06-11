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
        
        # We can execute psql directly on the remote server
        cmd = 'PGPASSWORD="DHMwK0Qzyox7" psql -h 127.0.0.1 -U postgres -d merterdevdb -c "SELECT id, order_number, total_amount FROM catalog.orders ORDER BY created_at DESC LIMIT 5;"'
        print(f"Running: {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print(stdout.read().decode('utf-8'))
        print(stderr.read().decode('utf-8'))
        
        cmd_items = 'PGPASSWORD="DHMwK0Qzyox7" psql -h 127.0.0.1 -U postgres -d merterdevdb -c "SELECT order_id, product_name, product_sku, image_url_at_purchase FROM catalog.order_items WHERE order_id = \'019eaef6-efc7-75f3-9373-0bc7153c1b78\';"'
        print(f"Running: {cmd_items}")
        stdin, stdout, stderr = ssh.exec_command(cmd_items)
        print(stdout.read().decode('utf-8'))
        print(stderr.read().decode('utf-8'))
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    run_remote_commands()
