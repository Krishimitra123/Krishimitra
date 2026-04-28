"""
Verify Supabase document_chunks table exists with correct schema
"""

import os
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Extract host from Supabase URL
# Format: https://projectid.supabase.co
supabase_host = SUPABASE_URL.replace("https://", "").split(".")[0]
db_host = f"{supabase_host}.supabase.co"

# Connection parameters
conn_params = {
    "host": db_host,
    "database": "postgres",
    "user": "postgres",
    "password": SUPABASE_SERVICE_KEY,
    "port": 5432,
}

REQUIRED_COLUMNS = {
    "id": "uuid",
    "source_doc": "text",
    "source_page": "integer",
    "chunk_index": "integer",
    "content": "text",
    "embedding": "vector",
    "category": "text",
    "crop_tag": "text",
    "zone_tag": "integer",
    "language": "text",
    "tier": "integer",
}

def verify_table():
    """Verify document_chunks table and schema"""
    try:
        conn = psycopg2.connect(**conn_params)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'document_chunks'
            );
        """)
        
        table_exists = cur.fetchone()['exists']
        
        if not table_exists:
            print("❌ Table 'document_chunks' does NOT exist")
            cur.close()
            conn.close()
            return False
        
        print("✅ Table 'document_chunks' exists")
        
        # Get table columns and their types
        cur.execute("""
            SELECT column_name, udt_name, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'document_chunks'
            ORDER BY ordinal_position;
        """)
        
        columns = cur.fetchall()
        
        if not columns:
            print("❌ No columns found in document_chunks table")
            cur.close()
            conn.close()
            return False
        
        print("\nTable Schema:")
        print("-" * 60)
        
        all_correct = True
        for col in columns:
            col_name = col['column_name']
            col_type = col['udt_name']
            is_nullable = col['is_nullable']
            
            if col_name in REQUIRED_COLUMNS:
                expected_type = REQUIRED_COLUMNS[col_name]
                
                # Handle vector type (stored as USER-DEFINED in PostgreSQL)
                if expected_type == "vector":
                    type_match = col_type == "vector" or col['column_name'] == "embedding"
                else:
                    type_match = col_type == expected_type or expected_type in col_type
                
                status = "✅" if type_match else "⚠️"
                print(f"{status} {col_name:20} {col_type:20} nullable={is_nullable}")
                
                if not type_match:
                    all_correct = False
            else:
                print(f"❓ {col_name:20} {col_type:20} (not in requirements)")
        
        print("-" * 60)
        
        # Check for required columns
        found_columns = {col['column_name'] for col in columns}
        missing_columns = set(REQUIRED_COLUMNS.keys()) - found_columns
        
        if missing_columns:
            print(f"\n❌ Missing columns: {missing_columns}")
            all_correct = False
        else:
            print("\n✅ All required columns present")
        
        cur.close()
        conn.close()
        
        return all_correct
        
    except Exception as e:
        print(f"❌ Error connecting to Supabase: {e}")
        print("\nMake sure:")
        print("1. SUPABASE_URL is set correctly in .env")
        print("2. SUPABASE_SERVICE_KEY is set correctly in .env")
        print("3. You have internet connectivity")
        return False

if __name__ == "__main__":
    print("Verifying Supabase document_chunks table schema...\n")
    success = verify_table()
    
    if success:
        print("\n✅ Schema verification PASSED")
    else:
        print("\n❌ Schema verification FAILED")
        print("\nTo create the table, run:")
        print("  python scripts/setup_supabase.sql")
