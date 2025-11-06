#!/usr/bin/env python3
"""
Script to apply POS orders column mappings to the column_vectors collection in AstraDB.
This ensures that Excel column names are correctly mapped to database column names when uploading POS data.

Usage:
    python scripts/apply_pos_orders_mapping.py [--client devyani|bercos|subway]
"""

import json
import os
import sys
import logging
from pathlib import Path
from typing import List, Dict

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config.database import get_collection
from sentence_transformers import SentenceTransformer
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load the embedding model
model = SentenceTransformer('all-MiniLM-L6-v2')
VECTOR_DIMENSION = 384

def load_mapping_file() -> List[Dict]:
    """Load the POS orders column mapping from JSON file."""
    mapping_file = Path(__file__).parent.parent / "pos_orders_column_mapping.json"
    if not mapping_file.exists():
        raise FileNotFoundError(f"Mapping file not found: {mapping_file}")
    
    with open(mapping_file, 'r') as f:
        mappings = json.load(f)
    
    logger.info(f"Loaded {len(mappings)} column mappings from {mapping_file}")
    return mappings

def ensure_column_vector_exists(collection, db_column_name: str, table_name: str, database_name: str = None):
    """
    Ensure a column vector exists in the collection. If it doesn't exist, create it.
    Returns True if created, False if already existed.
    """
    # Check if column already exists
    existing = collection.find_one({
        "column_name": db_column_name,
        "table_name": table_name
    })
    
    if existing:
        logger.debug(f"Column vector already exists: {table_name}.{db_column_name}")
        return False
    
    # Create vector for the column name
    vector = model.encode(db_column_name)
    vector_list = vector.tolist()
    
    # Create new document
    doc = {
        "column_name": db_column_name,
        "table_name": table_name,
        "$vector": vector_list,
        "user_defined_aliases": [],
        "wordnet_synonyms": []
    }
    
    if database_name:
        doc["database_name"] = database_name
    
    collection.insert_one(doc)
    logger.info(f"Created column vector for: {table_name}.{db_column_name}")
    return True

def apply_mappings(mappings: List[Dict], table_name: str = "orders", database_name: str = None):
    """
    Apply the mappings to the column_vectors collection in AstraDB.
    
    Args:
        mappings: List of mapping dictionaries with 'db_column_name' and 'excel_column_name'
        table_name: Target table name (default: 'orders')
        database_name: Optional database name filter
    """
    collection = get_collection("column_vectors")
    
    logger.info(f"Applying {len(mappings)} mappings for table '{table_name}'" + 
                (f" in database '{database_name}'" if database_name else ""))
    
    created_count = 0
    updated_count = 0
    skipped_count = 0
    
    for mapping in mappings:
        db_column = mapping.get("db_column_name")
        excel_column = mapping.get("excel_column_name")
        
        if not db_column or not excel_column:
            logger.warning(f"Skipping invalid mapping: {mapping}")
            skipped_count += 1
            continue
        
        # Ensure column vector exists
        was_created = ensure_column_vector_exists(collection, db_column, table_name, database_name)
        if was_created:
            created_count += 1
        
        # Add Excel column name as user-defined alias
        query_filter = {
            "column_name": db_column,
            "table_name": table_name
        }
        
        if database_name:
            query_filter["database_name"] = database_name
        
        result = collection.update_one(
            query_filter,
            {"$addToSet": {"user_defined_aliases": excel_column.lower()}}
        )
        
        if result.modified_count > 0:
            updated_count += 1
            logger.info(f"✓ Added alias '{excel_column}' -> '{db_column}'")
        elif result.matched_count > 0:
            logger.debug(f"  Alias '{excel_column}' already exists for '{db_column}'")
        else:
            logger.warning(f"  No column found for '{db_column}' in table '{table_name}'")
    
    logger.info(f"\n=== Summary ===")
    logger.info(f"Created column vectors: {created_count}")
    logger.info(f"Updated with aliases: {updated_count}")
    logger.info(f"Skipped: {skipped_count}")
    logger.info(f"Total mappings: {len(mappings)}")

def validate_mappings(mappings: List[Dict]) -> bool:
    """Validate that all mappings have required fields."""
    required_fields = ["db_column_name", "excel_column_name"]
    valid = True
    
    for i, mapping in enumerate(mappings):
        for field in required_fields:
            if field not in mapping or not mapping[field]:
                logger.error(f"Mapping {i+1} missing required field: {field}")
                valid = False
    
    return valid

def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Apply POS orders column mappings to AstraDB")
    parser.add_argument(
        "--client",
        choices=["devyani", "bercos", "subway"],
        default="devyani",
        help="Client name (determines database_name filter)"
    )
    parser.add_argument(
        "--table",
        default="orders",
        help="Target table name (default: orders)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate mappings without applying them"
    )
    
    args = parser.parse_args()
    
    try:
        # Load mappings
        mappings = load_mapping_file()
        
        # Validate mappings
        if not validate_mappings(mappings):
            logger.error("Validation failed. Please fix the mapping file.")
            sys.exit(1)
        
        logger.info(f"✓ Validation passed: {len(mappings)} mappings are valid")
        
        if args.dry_run:
            logger.info("Dry run mode - not applying mappings")
            logger.info("\nMappings to be applied:")
            for mapping in mappings:
                logger.info(f"  '{mapping['excel_column_name']}' -> '{mapping['db_column_name']}'")
            return
        
        # Apply mappings
        database_name = args.client if args.client else None
        apply_mappings(mappings, table_name=args.table, database_name=database_name)
        
        logger.info("\n✓ Mappings applied successfully!")
        
    except Exception as e:
        logger.error(f"Error: {str(e)}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    main()

