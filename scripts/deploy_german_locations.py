import json
import os
import sys
import urllib.request
from pathlib import Path
import paramiko

# Ensure scripts directory is available for importing unified_deployer config
scripts_dir = Path(__file__).resolve().parent
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

from unified_deployer import SERVER_CONFIG, PROJECTS_CONFIG

GERMAN_STATES = [
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

CITY_STATE_NAMES = {"berlin", "hamburg", "bremen"}
UMLAUT_REPLACEMENTS = {
    'ä': 'AE', 'ö': 'OE', 'ü': 'UE', 'ß': 'SS',
    'Ä': 'AE', 'Ö': 'OE', 'Ü': 'UE'
}


def fetch_germany_cities() -> list:
    url = "https://raw.githubusercontent.com/pensnarik/german-cities/master/germany.json"
    try:
        print("Fetching Germany cities json...")
        with urllib.request.urlopen(url) as response:
            cities_data = json.loads(response.read().decode('utf-8'))
        print(f"Fetched {len(cities_data)} cities.")
        return cities_data
    except Exception as e:
        print("Failed to fetch cities from github:", e)
        return []


def normalize_code(name: str) -> str:
    res = name
    for old, new in UMLAUT_REPLACEMENTS.items():
        res = res.replace(old, new)
    
    clean = [char for char in res if char.isalnum() or char in (' ', '-')]
    res = "".join(clean).replace(' ', '-').upper()
    while '--' in res:
        res = res.replace('--', '-')
    res = res.strip('-')
    return f"DE-{res}"[:50]


def resolve_unique_city_code(name: str, city: dict, inserted_codes: set) -> str:
    code = normalize_code(name)
    if code not in inserted_codes:
        return code
    district = city.get("district", "").strip()
    if district:
        code = normalize_code(f"{name}-{district}")
    if code in inserted_codes:
        counter = 2
        base = code[:46]
        while f"{base}-{counter}" in inserted_codes:
            counter += 1
        code = f"{base}-{counter}"
    return code


def generate_germany_sql(cities_data: list) -> str:
    sql_lines = [
        "BEGIN;",
        "-- Delete existing German states/cities",
        "DELETE FROM catalog.country_states WHERE country_id = (SELECT id FROM catalog.countries WHERE code = 'DE');",
        "\n-- Insert 16 Federal States"
    ]
    
    for code, name in GERMAN_STATES:
        escaped_name = name.replace("'", "''")
        sql_lines.append(f"INSERT INTO catalog.country_states (country_id, code, state_name) VALUES ((SELECT id FROM catalog.countries WHERE code = 'DE'), '{code}', '{escaped_name}');")

    sql_lines.append("\n-- Insert Cities and Towns")
    inserted_codes = {code for code, _ in GERMAN_STATES}

    for city in cities_data:
        name = city.get("name", "").strip()
        if not name or name.lower() in CITY_STATE_NAMES:
            continue
        code = resolve_unique_city_code(name, city, inserted_codes)
        inserted_codes.add(code)
        escaped_name = name.replace("'", "''")
        sql_lines.append(f"INSERT INTO catalog.country_states (country_id, code, state_name) VALUES ((SELECT id FROM catalog.countries WHERE code = 'DE'), '{code}', '{escaped_name}');")

    sql_lines.append("COMMIT;")
    return "\n".join(sql_lines)


def deploy_sql_remotely(sql_content: str):
    hostname = SERVER_CONFIG.get("hostname", "")
    port = SERVER_CONFIG.get("port", 22)
    username = SERVER_CONFIG.get("username", "root")
    auth_secret = SERVER_CONFIG.get("password", "")
    db_password = os.environ.get("DB_PASSWORD") or PROJECTS_CONFIG.get("unified", {}).get("backend", {}).get("config_template", {}).get("db_password", "")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(hostname, port=port, username=username, password=auth_secret)
        print("Connected to SSH.")
        
        print("Executing SQL query directly on production database via stdin stream...")
        cmd = f'PGPASSWORD="{db_password}" psql -h 127.0.0.1 -U postgres -d merterdevdb'
        stdin, stdout, stderr = ssh.exec_command(cmd)
        stdin.write(sql_content)
        stdin.flush()
        stdin.channel.shutdown_write()
        
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        
        print("Command output:")
        print(out.encode('ascii', errors='replace').decode('ascii'))
        if err:
            print("Command error:")
            print(err.encode('ascii', errors='replace').decode('ascii'))
            
        print("Verifying locations count for DE:")
        verify_cmd = f'PGPASSWORD="{db_password}" psql -h 127.0.0.1 -U postgres -d merterdevdb -c "SELECT COUNT(*) FROM catalog.country_states WHERE country_id = (SELECT id FROM catalog.countries WHERE code = \'DE\');"'
        _, verify_out, _ = ssh.exec_command(verify_cmd)
        print(verify_out.read().decode('utf-8', errors='replace').strip())
        
    except Exception as e:
        print("Error during SSH/SQL deployment:", e)
    finally:
        ssh.close()


def run_deployment():
    cities_data = fetch_germany_cities()
    if not cities_data:
        return
    sql_content = generate_germany_sql(cities_data)
    deploy_sql_remotely(sql_content)


if __name__ == "__main__":
    run_deployment()
