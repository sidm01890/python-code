#!/usr/bin/env python3
"""
Diagnostic script to help identify POS orders parsing issues.
This script checks:
1. If column mappings are loaded in AstraDB
2. If Excel columns match database columns
3. Data type compatibility
4. Missing required columns

Usage:
    python scripts/diagnose_pos_orders_parsing.py [--client devyani|bercos|subway] [--table orders]
"""

import json
import sys
import logging
from pathlib import Path
from typing import Dict, List, Set

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config.database import get_collection
from app.config.header_vector_matcher import get_canonical_data_by_table
import mysql.connector
from dotenv import load_dotenv
import os

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MySQL configuration
BASE_MYSQL_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": os.getenv("MYSQL_PASSWORD", "NewStrongPassword123!"),
}

CLIENT_DATABASE_MAPPING = {
    "devyani": "devyani",
    "bercos": "bercos",
    "subway": "subway"
}

def get_mysql_config(client: str = None):
    """Get MySQL configuration based on client."""
    if not client:
        client = "devyani"
    client_lower = client.lower().strip()
    database = CLIENT_DATABASE_MAPPING.get(client_lower, "devyani")
    config = BASE_MYSQL_CONFIG.copy()
    config["database"] = database
    return config

def load_mapping_file() -> List[Dict]:
    """Load POS orders column mapping from JSON file."""
    mapping_file = Path(__file__).parent.parent / "pos_orders_column_mapping.json"
    if not mapping_file.exists():
        logger.error(f"Mapping file not found: {mapping_file}")
        return []
    
    with open(mapping_file, 'r') as f:
        mappings = json.load(f)
    
    logger.info(f"Loaded {len(mappings)} column mappings from {mapping_file}")
    return mappings

def check_astradb_mappings(table_name: str = "orders", database_name: str = None):
    """Check if column mappings exist in AstraDB."""
    logger.info(f"\n{'='*60}")
    logger.info(f"Checking AstraDB mappings for table: '{table_name}'")
    logger.info(f"{'='*60}")
    
    try:
        table_to_columns = get_canonical_data_by_table(database_name=database_name)
        canonical_data = table_to_columns.get(table_name, {})
        
        if not canonical_data:
            logger.warning(f"⚠️  No canonical columns found for table '{table_name}' in AstraDB")
            logger.info(f"Available tables: {list(table_to_columns.keys())}")
            return False, []
        
        # Check for user-defined aliases
        columns_with_aliases = []
        for col_name, data in canonical_data.items():
            aliases = data.get('user_defined_aliases', [])
            if aliases:
                columns_with_aliases.append({
                    'column': col_name,
                    'aliases': aliases
                })
        
        logger.info(f"✓ Found {len(canonical_data)} columns for table '{table_name}'")
        logger.info(f"✓ {len(columns_with_aliases)} columns have user-defined aliases")
        
        if columns_with_aliases:
            logger.info("\nColumns with aliases:")
            for item in columns_with_aliases[:10]:  # Show first 10
                logger.info(f"  - {item['column']}: {', '.join(item['aliases'][:3])}")
            if len(columns_with_aliases) > 10:
                logger.info(f"  ... and {len(columns_with_aliases) - 10} more")
        
        return True, list(canonical_data.keys())
    
    except Exception as e:
        logger.error(f"Error checking AstraDB mappings: {str(e)}", exc_info=True)
        return False, []

def check_mysql_table_schema(table_name: str, mysql_config: dict):
    """Check MySQL table schema."""
    logger.info(f"\n{'='*60}")
    logger.info(f"Checking MySQL table schema: '{table_name}'")
    logger.info(f"{'='*60}")
    
    try:
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor(dictionary=True)
        
        db_name = mysql_config.get('database', 'devyani')
        query = """
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION
        """
        cursor.execute(query, (db_name, table_name))
        columns = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        if not columns:
            logger.error(f"⚠️  Table '{table_name}' not found in database '{db_name}'")
            return []
        
        logger.info(f"✓ Found {len(columns)} columns in table '{table_name}'")
        logger.info("\nCore columns:")
        core_columns = ['id', 'date', 'store_name', 'instance_id', 'online_order_taker', 
                        'payment', 'bill_number', 'transaction_number', 'gross_amount', 
                        'net_sale', 'subtotal', 'discount']
        for col in columns:
            col_name = col['COLUMN_NAME']
            if col_name in core_columns:
                logger.info(f"  - {col_name} ({col['DATA_TYPE']})")
        
        return [col['COLUMN_NAME'] for col in columns]
    
    except Exception as e:
        logger.error(f"Error checking MySQL schema: {str(e)}", exc_info=True)
        return []

def compare_mappings(mappings: List[Dict], mysql_columns: List[str], astradb_columns: List[str]):
    """Compare mapping file with MySQL and AstraDB columns."""
    logger.info(f"\n{'='*60}")
    logger.info("Comparing mappings")
    logger.info(f"{'='*60}")
    
    # Get all unique database column names from mappings
    mapping_db_columns = set(m['db_column_name'] for m in mappings)
    mysql_columns_set = set(mysql_columns)
    astradb_columns_set = set(astradb_columns)
    
    # Check for missing columns in MySQL
    missing_in_mysql = mapping_db_columns - mysql_columns_set
    if missing_in_mysql:
        logger.warning(f"⚠️  {len(missing_in_mysql)} mapping columns not found in MySQL table:")
        for col in sorted(missing_in_mysql)[:10]:
            logger.warning(f"  - {col}")
        if len(missing_in_mysql) > 10:
            logger.warning(f"  ... and {len(missing_in_mysql) - 10} more")
    else:
        logger.info("✓ All mapping columns exist in MySQL table")
    
    # Check for missing columns in AstraDB
    missing_in_astradb = mapping_db_columns - astradb_columns_set
    if missing_in_astradb:
        logger.warning(f"⚠️  {len(missing_in_astradb)} mapping columns not found in AstraDB:")
        for col in sorted(missing_in_astradb)[:10]:
            logger.warning(f"  - {col}")
        if len(missing_in_astradb) > 10:
            logger.warning(f"  ... and {len(missing_in_astradb) - 10} more")
        logger.info("\n💡 Solution: Run 'python scripts/apply_pos_orders_mapping.py --client <client>' to load mappings")
    else:
        logger.info("✓ All mapping columns exist in AstraDB")
    
    # Check for core columns
    core_columns = ['instance_id', 'store_name', 'date', 'payment', 'online_order_taker', 
                   'transaction_number', 'gross_amount', 'bill_number']
    missing_core = [col for col in core_columns if col not in mysql_columns_set]
    if missing_core:
        logger.error(f"❌ Missing core columns in MySQL table: {', '.join(missing_core)}")
    else:
        logger.info("✓ All core columns present in MySQL table")
    
    # Check Excel column mappings
    excel_columns = set(m['excel_column_name'] for m in mappings)
    logger.info(f"\n📊 Summary:")
    logger.info(f"  - Total mappings in JSON: {len(mappings)}")
    logger.info(f"  - Unique Excel columns: {len(excel_columns)}")
    logger.info(f"  - Unique DB columns: {len(mapping_db_columns)}")
    logger.info(f"  - MySQL columns: {len(mysql_columns)}")
    logger.info(f"  - AstraDB columns: {len(astradb_columns)}")

def main():
    """Main diagnostic function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Diagnose POS orders parsing issues")
    parser.add_argument(
        "--client",
        choices=["devyani", "bercos", "subway"],
        default="devyani",
        help="Client name"
    )
    parser.add_argument(
        "--table",
        default="orders",
        help="Table name (default: orders)"
    )
    
    args = parser.parse_args()
    
    logger.info("="*60)
    logger.info("POS Orders Parsing Diagnostic Tool")
    logger.info("="*60)
    
    # Load mapping file
    mappings = load_mapping_file()
    if not mappings:
        logger.error("Failed to load mapping file. Exiting.")
        return
    
    # Get MySQL config
    mysql_config = get_mysql_config(args.client)
    database_name = mysql_config.get('database')
    
    # Check AstraDB mappings
    astradb_ok, astradb_columns = check_astradb_mappings(
        table_name=args.table,
        database_name=database_name
    )
    
    # Check MySQL schema
    mysql_columns = check_mysql_table_schema(args.table, mysql_config)
    if not mysql_columns:
        logger.error("Failed to retrieve MySQL schema. Exiting.")
        return
    
    # Compare everything
    compare_mappings(mappings, mysql_columns, astradb_columns)
    
    # Provide recommendations
    logger.info(f"\n{'='*60}")
    logger.info("Recommendations")
    logger.info(f"{'='*60}")
    
    if not astradb_ok or len(astradb_columns) == 0:
        logger.info("1. ⚠️  Run: python scripts/apply_pos_orders_mapping.py --client " + args.client)
        logger.info("   This will load the column mappings into AstraDB")
    
    logger.info("2. ✓ Verify your Excel file has columns that match the mappings")
    logger.info("3. ✓ Use /analyze-columns endpoint to test column mapping before upload")
    logger.info("4. ✓ Check logs during upload for unmapped columns")
    
    logger.info("\n" + "="*60)
    logger.info("Diagnostic complete!")
    logger.info("="*60)

if __name__ == "__main__":
    main()

