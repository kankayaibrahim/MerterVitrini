import paramiko
import urllib.request
import json
import os

def run_deployment():
    # 1. Fetch Germany cities JSON from GitHub
    url = "https://raw.githubusercontent.com/pensnarik/german-cities/master/germany.json"
    try:
        print("Fetching Germany cities json...")
        with urllib.request.urlopen(url) as response:
            cities_data = json.loads(response.read().decode('utf-8'))
        print(f"Fetched {len(cities_data)} cities.")
    except Exception as e:
        print("Failed to fetch cities from github:", e)
        return

    # 2. Define the 16 federal states
    states = [
        ("DE-BW", "Baden-Württemberg"),
        ("DE-BY", "Bayern"),
        ("DE-BE", "Berlin"),
        ("DE-BB", "Brandenburg"),
        ("DE-HB", "Bremen"),
        ("DE-HH", "Hamburg"),
        ("DE-HE", "Hessen"),
        ("DE-MV", "Mecklenburg-Vorpommern"),
        ("DE-NI", "Niedersachsen"),
        ("DE-NW", "Nordrhein-Westfalen"),
        ("DE-RP", "Rheinland-Pfalz"),
        ("DE-SL", "Saarland"),
        ("DE-SN", "Sachsen"),
        ("DE-ST", "Sachsen-Anhalt"),
        ("DE-SH", "Schleswig-Holstein"),
        ("DE-TH", "Thüringen")
    ]

    # Deduplicate set for names (case-insensitive) to prevent inserting city-states twice
    state_names_lower = {"berlin", "hamburg", "bremen"}
    
    # 3. Process cities and generate SQL
    sql_lines = []
    sql_lines.append("BEGIN;")
    sql_lines.append("-- Delete existing German states/cities")
    sql_lines.append("DELETE FROM catalog.country_states WHERE country_id = (SELECT id FROM catalog.countries WHERE code = 'DE');")
    
    sql_lines.append("\n-- Insert 16 Federal States")
    for code, name in states:
        escaped_name = name.replace("'", "''")
        sql_lines.append(f"INSERT INTO catalog.country_states (country_id, code, state_name) VALUES ((SELECT id FROM catalog.countries WHERE code = 'DE'), '{code}', '{escaped_name}');")

    # Function to normalize city names into a clean uppercase code slug
    def normalize_code(name):
        # Umlaut replacements
        replacements = {
            'ä': 'AE', 'ö': 'OE', 'ü': 'UE', 'ß': 'SS',
            'Ä': 'AE', 'Ö': 'OE', 'Ü': 'UE'
        }
        res = name
        for old, new in replacements.items():
            res = res.replace(old, new)
        
        # Keep alphanumeric, space and hyphen
        clean = []
        for char in res:
            if char.isalnum() or char in (' ', '-'):
                clean.append(char)
        res = "".join(clean)
        
        # Replace spaces with hyphens, convert to uppercase, strip extra hyphens
        res = res.replace(' ', '-').upper()
        while '--' in res:
            res = res.replace('--', '-')
        res = res.strip('-')
        
        # Prepend DE-
        code = f"DE-{res}"
        return code[:50]  # limit to 50 chars max

    sql_lines.append("\n-- Insert 2054 Cities and Towns")
    inserted_codes = set(code for code, _ in states)
    
    for city in cities_data:
        name = city.get("name", "").strip()
        if not name:
            continue
            
        # Skip city states already added at state-level
        if name.lower() in state_names_lower:
            continue
            
        code = normalize_code(name)
        # Ensure we don't insert duplicate codes
        if code in inserted_codes:
            # Append district name or count to distinguish
            district = city.get("district", "").strip()
            if district:
                code = normalize_code(f"{name}-{district}")
            else:
                counter = 2
                base_code = code
                while code in inserted_codes:
                    code = f"{base_code[:46]}-{counter}"
                    counter += 1
                    
        inserted_codes.add(code)
        escaped_name = name.replace("'", "''")
        sql_lines.append(f"INSERT INTO catalog.country_states (country_id, code, state_name) VALUES ((SELECT id FROM catalog.countries WHERE code = 'DE'), '{code}', '{escaped_name}');")

    sql_lines.append("COMMIT;")
    sql_content = "\n".join(sql_lines)

    # 4. SSH to server and deploy SQL
    hostname = "213.202.255.80"
    port = 22
    username = "root"
    password = "02vMhY8Xgi"

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, port, username, password)
        print("Connected to SSH.")
        
        # Write SQL content to a remote file /tmp/populate_germany.sql
        print("Writing SQL file to remote server...")
        sftp = ssh.open_sftp()
        with sftp.file('/tmp/populate_germany.sql', 'w') as f:
            f.write(sql_content)
        sftp.close()
        print("Remote SQL file written successfully.")
        
        # Execute the SQL file using psql
        print("Executing SQL query on production database...")
        cmd = 'PGPASSWORD="DHMwK0Qzyox7" psql -h 127.0.0.1 -U postgres -d merterdevdb -f /tmp/populate_germany.sql'
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        
        print("Command output:")
        print(out.encode('ascii', errors='replace').decode('ascii'))
        if err:
            print("Command error:")
            print(err.encode('ascii', errors='replace').decode('ascii'))
            
        # Verify and count
        print("Verifying locations count for DE:")
        verify_cmd = 'PGPASSWORD="DHMwK0Qzyox7" psql -h 127.0.0.1 -U postgres -d merterdevdb -c "SELECT COUNT(*) FROM catalog.country_states WHERE country_id = (SELECT id FROM catalog.countries WHERE code = \'DE\');"'
        stdin, stdout, stderr = ssh.exec_command(verify_cmd)
        print(stdout.read().decode('utf-8', errors='replace').strip())
        
        # Clean up remote file
        ssh.exec_command("rm -f /tmp/populate_germany.sql")
        print("Cleaned up temporary remote SQL file.")
        
    except Exception as e:
        print("Error during SSH/SQL deployment:", e)
    finally:
        ssh.close()

if __name__ == "__main__":
    run_deployment()
