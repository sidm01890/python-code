#!/usr/bin/env python3
"""
Script to validate POS orders column mappings.
Checks for:
1. Required fields in each mapping
2. Duplicate Excel column names
3. Duplicate database column names
4. Column name format consistency

Usage:
    python scripts/validate_pos_orders_mapping.py
"""

import json
import sys
import logging
from pathlib import Path
from collections import Counter
from typing import List, Dict, Set

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def load_mapping_file() -> List[Dict]:
    """Load the POS orders column mapping from JSON file."""
    mapping_file = Path(__file__).parent.parent / "pos_orders_column_mapping.json"
    if not mapping_file.exists():
        raise FileNotFoundError(f"Mapping file not found: {mapping_file}")
    
    with open(mapping_file, 'r') as f:
        mappings = json.load(f)
    
    return mappings

def validate_mapping_structure(mappings: List[Dict]) -> bool:
    """Validate that all mappings have required fields."""
    required_fields = ["db_column_name", "excel_column_name"]
    valid = True
    errors = []
    
    for i, mapping in enumerate(mappings, 1):
        for field in required_fields:
            if field not in mapping:
                errors.append(f"Mapping #{i}: Missing field '{field}'")
                valid = False
            elif not mapping[field] or not str(mapping[field]).strip():
                errors.append(f"Mapping #{i}: Empty field '{field}'")
                valid = False
    
    if errors:
        logger.error("Structure validation errors:")
        for error in errors:
            logger.error(f"  ✗ {error}")
    else:
        logger.info("✓ All mappings have required fields")
    
    return valid

def check_duplicates(mappings: List[Dict]) -> bool:
    """Check for duplicate Excel or database column names."""
    excel_columns = [m["excel_column_name"].strip() for m in mappings]
    db_columns = [m["db_column_name"].strip() for m in mappings]
    
    excel_duplicates = [item for item, count in Counter(excel_columns).items() if count > 1]
    db_duplicates = [item for item, count in Counter(db_columns).items() if count > 1]
    
    valid = True
    
    if excel_duplicates:
        logger.warning(f"⚠ Found {len(excel_duplicates)} duplicate Excel column names:")
        for dup in excel_duplicates:
            logger.warning(f"  - '{dup}'")
        valid = False
    else:
        logger.info("✓ No duplicate Excel column names")
    
    if db_duplicates:
        logger.warning(f"⚠ Found {len(db_duplicates)} duplicate database column names:")
        for dup in db_duplicates:
            logger.warning(f"  - '{dup}'")
        valid = False
    else:
        logger.info("✓ No duplicate database column names")
    
    return valid

def validate_column_name_format(mappings: List[Dict]) -> bool:
    """Check that database column names follow snake_case convention."""
    valid = True
    issues = []
    
    for i, mapping in enumerate(mappings, 1):
        db_col = mapping["db_column_name"].strip()
        # Check for snake_case format (lowercase, underscores, numbers)
        if not db_col.islower():
            issues.append((i, db_col, "Contains uppercase letters"))
        if ' ' in db_col:
            issues.append((i, db_col, "Contains spaces"))
        if not all(c.isalnum() or c == '_' for c in db_col):
            issues.append((i, db_col, "Contains invalid characters"))
    
    if issues:
        logger.warning(f"⚠ Found {len(issues)} column name format issues:")
        for idx, col, issue in issues:
            logger.warning(f"  Mapping #{idx}: '{col}' - {issue}")
        valid = False
    else:
        logger.info("✓ All database column names follow snake_case format")
    
    return valid

def generate_summary(mappings: List[Dict]):
    """Generate a summary of the mappings."""
    logger.info("\n" + "="*60)
    logger.info("MAPPING SUMMARY")
    logger.info("="*60)
    logger.info(f"Total mappings: {len(mappings)}")
    
    # Group by pattern
    date_time_cols = [m for m in mappings if any(kw in m["db_column_name"].lower() 
                                                  for kw in ["date", "time"])]
    amount_cols = [m for m in mappings if any(kw in m["db_column_name"].lower() 
                                              for kw in ["amount", "charge", "discount", "total"])]
    tax_cols = [m for m in mappings if any(kw in m["db_column_name"].lower() 
                                           for kw in ["gst", "cgst", "sgst", "igst", "tax"])]
    status_cols = [m for m in mappings if any(kw in m["db_column_name"].lower() 
                                               for kw in ["status", "type", "reason"])]
    
    logger.info(f"\nBy category:")
    logger.info(f"  Date/Time columns: {len(date_time_cols)}")
    logger.info(f"  Amount/Charge columns: {len(amount_cols)}")
    logger.info(f"  Tax columns: {len(tax_cols)}")
    logger.info(f"  Status/Type columns: {len(status_cols)}")
    
    logger.info(f"\nSample mappings:")
    for i, mapping in enumerate(mappings[:5], 1):
        logger.info(f"  {i}. '{mapping['excel_column_name']}' -> '{mapping['db_column_name']}'")
    if len(mappings) > 5:
        logger.info(f"  ... and {len(mappings) - 5} more")

def main():
    """Main validation function."""
    try:
        logger.info("Loading POS orders column mapping...")
        mappings = load_mapping_file()
        
        logger.info(f"\nValidating {len(mappings)} mappings...\n")
        
        all_valid = True
        
        # Run validations
        if not validate_mapping_structure(mappings):
            all_valid = False
        
        if not check_duplicates(mappings):
            all_valid = False
        
        if not validate_column_name_format(mappings):
            all_valid = False
        
        # Generate summary
        generate_summary(mappings)
        
        logger.info("\n" + "="*60)
        if all_valid:
            logger.info("✓ VALIDATION PASSED - All checks passed!")
            logger.info("="*60)
            return 0
        else:
            logger.warning("⚠ VALIDATION COMPLETED WITH WARNINGS")
            logger.warning("="*60)
            logger.warning("Please review the warnings above before applying mappings.")
            return 1
        
    except Exception as e:
        logger.error(f"Error during validation: {str(e)}", exc_info=True)
        return 1

if __name__ == "__main__":
    sys.exit(main())

