import paramiko
import json

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
        
        # We will insert major German cities.
        # Munich, Frankfurt, Cologne, Stuttgart, Düsseldorf, Dortmund, Essen, Leipzig, Dresden, Hannover, Nürnberg, Duisburg, Bochum, Wuppertal, Bielefeld, Bonn, Münster, Karlsruhe, Mannheim, Augsburg, Wiesbaden, Gelsenkirchen, Mönchengladbach, Braunschweig, Chemnitz, Kiel, Aachen, Halle, Magdeburg, Freiburg, Krefeld, Lübeck, Oberhausen, Erfurt, Mainz, Rostock, Kassel, Hagen, Hamm, Saarbrücken, Mülheim, Ludwigshafen, Osnabrück, Solingen, Leverkusen, Heidelberg, Neuss, Darmstadt, Paderborn, Regensburg, Ingolstadt, Würzburg, Wolfsburg, Ulm, Heilbronn, Pforzheim, Göttingen, Bottrop, Recklinghausen, Koblenz, Bremerhaven, Remscheid, Jena, Trier, Erlangen, Moers, Siegen, Hildesheim, Cottbus, Salzgitter
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
            # Escape single quotes in names
            escaped_name = name.replace("'", "''")
            sql_vals.append(f"((SELECT id FROM catalog.countries WHERE code = 'DE'), '{code}', '{escaped_name}')")
            
        insert_query = f"""
        INSERT INTO catalog.country_states (country_id, code, state_name)
        VALUES {', '.join(sql_vals)}
        ON CONFLICT DO NOTHING;
        """
        
        # We run the insertion via psql
        cmd = f'PGPASSWORD="DHMwK0Qzyox7" psql -h 127.0.0.1 -U postgres -d merterdevdb -c "{insert_query}"'
        print("Executing bulk insertion of German cities...")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        print(stdout.read().decode('utf-8'))
        print(stderr.read().decode('utf-8'))
        
        # Verify state counts for Germany again
        verify_cmd = 'PGPASSWORD="DHMwK0Qzyox7" psql -h 127.0.0.1 -U postgres -d merterdevdb -c "SELECT COUNT(*) FROM catalog.country_states WHERE country_id IN (SELECT id FROM catalog.countries WHERE code = \'DE\');"'
        stdin, stdout, stderr = ssh.exec_command(verify_cmd)
        print("Verified count for Germany states/cities:", stdout.read().decode('utf-8').strip())

    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    run_remote_commands()
