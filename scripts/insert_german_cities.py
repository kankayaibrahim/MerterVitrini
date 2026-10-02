import os
import sys
from pathlib import Path
import paramiko

# Ensure scripts directory is available for importing unified_deployer config
scripts_dir = Path(__file__).resolve().parent
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

from unified_deployer import SERVER_CONFIG, PROJECTS_CONFIG


def run_remote_commands():
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
        
        # We will insert major German cities.
        cities = [
            ("DE-MUN", "München (Munich)"),
            ("DE-KOL", "Köln (Cologne)"),
            ("DE-FRA", "Frankfurt am Main"),
            ("DE-STU", "Stuttgart"),
            ("DE-DUS", "Düsseldorf"),
            ("DE-DOR", "Dortmund"),
            ("DE-ESS", "Essen"),
            ("DE-LEI", "Leipzig"),
            ("DE-DRE", "Dresden"),
            ("DE-HAN", "Hannover (Hanover)"),
            ("DE-NUR", "Nürnberg (Nuremberg)"),
            ("DE-DUI", "Duisburg"),
            ("DE-BOC", "Bochum"),
            ("DE-WUP", "Wuppertal"),
            ("DE-BIE", "Bielefeld"),
            ("DE-BON", "Bonn"),
            ("DE-MUN2", "Münster"),
            ("DE-KAR", "Karlsruhe"),
            ("DE-MAN", "Mannheim"),
            ("DE-AUG", "Augsburg"),
            ("DE-WIE", "Wiesbaden"),
            ("DE-GEL", "Gelsenkirchen"),
            ("DE-MON", "Mönchengladbach"),
            ("DE-BRA", "Braunschweig"),
            ("DE-CHE", "Chemnitz"),
            ("DE-KIE", "Kiel"),
            ("DE-AAC", "Aachen"),
            ("DE-HAL", "Halle (Saale)"),
            ("DE-MAG", "Magdeburg"),
            ("DE-FRE", "Freiburg im Breisgau"),
            ("DE-KRE", "Krefeld"),
            ("DE-LUB", "Lübeck"),
            ("DE-OBE", "Oberhausen"),
            ("DE-ERF", "Erfurt"),
            ("DE-MAI", "Mainz"),
            ("DE-ROS", "Rostock"),
            ("DE-KAS", "Kassel"),
            ("DE-HAG", "Hagen"),
            ("DE-HAM", "Hamm"),
            ("DE-SAA", "Saarbrücken"),
            ("DE-MUL", "Mülheim an der Ruhr"),
            ("DE-POT", "Potsdam"),
            ("DE-LUD", "Ludwigshafen am Rhein"),
            ("DE-OLD", "Oldenburg"),
            ("DE-LEV", "Leverkusen"),
            ("DE-OSN", "Osnabrück"),
            ("DE-SOL", "Solingen"),
            ("DE-HEI", "Heidelberg"),
            ("DE-HER", "Herne"),
            ("DE-NEU", "Neuss"),
            ("DE-DAR", "Darmstadt"),
            ("DE-PAD", "Paderborn"),
            ("DE-REG", "Regensburg"),
            ("DE-ING", "Ingolstadt"),
            ("DE-WUR", "Würzburg"),
            ("DE-FUR", "Fürth"),
            ("DE-WOL", "Wolfsburg"),
            ("DE-OFF", "Offenbach am Main"),
            ("DE-ULM", "Ulm"),
            ("DE-HEI2", "Heilbronn"),
            ("DE-PFO", "Pforzheim"),
            ("DE-GOT", "Göttingen"),
            ("DE-BOT", "Bottrop"),
            ("DE-REC", "Recklinghausen"),
            ("DE-REU", "Reutlingen"),
            ("DE-KOB", "Koblenz"),
            ("DE-BER", "Bergisch Gladbach"),
            ("DE-BRE", "Bremerhaven"),
            ("DE-REM", "Remscheid"),
            ("DE-JEN", "Jena"),
            ("DE-TRI", "Trier"),
            ("DE-ERL", "Erlangen"),
            ("DE-MOE", "Moers"),
            ("DE-SIE", "Siegen"),
            ("DE-HIL", "Hildesheim"),
            ("DE-COT", "Cottbus"),
            ("DE-SAL", "Salzgitter")
        ]
        
        # Build multi-insert query dynamically
        sql_vals = []
        for code, name in cities:
            escaped_name = name.replace("'", "''")
            sql_vals.append(f"((SELECT id FROM catalog.countries WHERE code = 'DE'), '{code}', '{escaped_name}')")
            
        insert_query = f"""
        INSERT INTO catalog.country_states (country_id, code, state_name)
        VALUES {', '.join(sql_vals)}
        ON CONFLICT DO NOTHING;
        """
        
        # We run the insertion via psql
        cmd = f'PGPASSWORD="{db_password}" psql -h 127.0.0.1 -U postgres -d merterdevdb -c "{insert_query}"'
        print("Executing bulk insertion of German cities...")
        _, stdout, stderr = ssh.exec_command(cmd)
        print(stdout.read().decode('utf-8'))
        print(stderr.read().decode('utf-8'))
        
        # Verify state counts for Germany again
        verify_cmd = f'PGPASSWORD="{db_password}" psql -h 127.0.0.1 -U postgres -d merterdevdb -c "SELECT COUNT(*) FROM catalog.country_states WHERE country_id IN (SELECT id FROM catalog.countries WHERE code = \'DE\');"'
        _, stdout, _ = ssh.exec_command(verify_cmd)
        print("Verified count for Germany states/cities:", stdout.read().decode('utf-8').strip())

    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()


if __name__ == "__main__":
    run_remote_commands()
