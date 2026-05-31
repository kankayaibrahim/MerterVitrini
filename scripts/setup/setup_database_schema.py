#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
================================================================================
TÜRKÇE (TURKISH):
Bu script, uzaktaki PostgreSQL veritabanı sunucusuna bağlanarak 'merterdevdb'
veritabanını oluşturmak ve veritabanı şemasını kurmak/güncellemek için kullanılır.
Localdeki 'database/DB_DDL.sql' dosyasını okuyarak veritabanındaki tüm tabloları,
indeksleri, stored procedure'leri, trigger'ları ve ilişkileri sunucuda oluşturur.
Veritabanı yapısı sıfırlanırken veya güncellenirken kullanılır.

ENGLISH:
This script is used to connect to the remote PostgreSQL database server, create the
'merterdevdb' database with proper Turkish locales, and construct/update the database schema.
It reads the local 'database/DB_DDL.sql' file and provisions all tables, constraints,
indexes, stored procedures, and triggers on the remote instance.
Use this when resetting or upgrading the database structure.
================================================================================
"""

import pg8000
import sys
import os

# Connection details
db_host = "213.202.255.80"
db_user = "postgres"
db_pass = "DHMwK0Qzyox7"

print("==================================================")
print("Connecting to remote database to execute DDL...")
print("==================================================")

# 1. Connect to default 'postgres' database to create 'merterdevdb'
try:
    print(f"Connecting to 'postgres' database on {db_host}...")
    conn = pg8000.connect(
        host=db_host,
        user=db_user,
        password=db_pass,
        database="postgres",
        timeout=15
    )
    # Enable autocommit for database creation
    conn.autocommit = True
    cursor = conn.cursor()
    
    print("Attempting to create database 'merterdevdb'...")
    try:
        cursor.execute("CREATE DATABASE merterdevdb ENCODING='UTF-8' LC_COLLATE='tr_TR.UTF-8' TEMPLATE=template0")
        print("Database 'merterdevdb' created successfully with Turkish locale!")
    except Exception as db_err:
        err_msg = str(db_err)
        if "already exists" in err_msg:
            print("Database 'merterdevdb' already exists, proceeding...")
        else:
            print(f"Turkish locale creation failed ({db_err}), trying standard UTF-8 database fallback...")
            try:
                cursor.execute("CREATE DATABASE merterdevdb ENCODING='UTF-8'")
                print("Database 'merterdevdb' created successfully with default UTF-8 encoding!")
            except Exception as fb_err:
                if "already exists" in str(fb_err):
                    print("Database 'merterdevdb' already exists, proceeding...")
                else:
                    print(f"Error during database creation fallback: {fb_err}")
                    raise fb_err
            
    cursor.close()
    conn.close()

except Exception as e:
    print(f"Failed to connect or verify default 'postgres' database: {e}")
    sys.exit(1)

# 2. Connect to 'merterdevdb' to execute DDL schema
try:
    print(f"\nConnecting directly to 'merterdevdb' on {db_host}...")
    conn = pg8000.connect(
        host=db_host,
        user=db_user,
        password=db_pass,
        database="merterdevdb",
        timeout=15
    )
    conn.autocommit = True  # Autocommit is safer for running multiple DDLs and stored procedures
    cursor = conn.cursor()
    
    print("Reading DB_DDL.sql...")
    # Modified relative path search to support nested scripts/setup/ folder
    sql_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "database", "DB_DDL.sql"))
    with open(sql_path, "r", encoding="utf-8") as f:
        sql_content = f.read()
        
    # Strip out the first CREATE DATABASE line to prevent errors
    lines = sql_content.split('\n')
    filtered_lines = [line for line in lines if "CREATE DATABASE merterdevdb" not in line]
    ddl_sql = '\n'.join(filtered_lines)
    
    print("Executing DDL statements (schemas, extensions, tables, indices, stored procedures, triggers)...")
    
    # pg8000 supports executing multi-statements natively in a single call
    cursor.execute(ddl_sql)
    print("DDL Execution completed successfully!")
    
    cursor.close()
    conn.close()
    
    print("\n==================================================")
    print("SUCCESS: Database schema fully created and updated!")
    print("==================================================")

except Exception as e:
    print(f"\nERROR during DDL execution: {e}")
    sys.exit(1)
