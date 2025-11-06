"""
Script to populate AstraDB column_vectors collection from MySQL tables.
This reads actual table schemas and generates vector embeddings for column matching.
"""
import os
import sys
import logging
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime, timezone
from dotenv import load_dotenv
import mysql.connector
from sentence_transformers import SentenceTransformer
from app.config.database import get_collection

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MySQL Configuration
MYSQL_CONFIG = {
    "host": os.getenv("MYSQL_HOST", "localhost"),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", "NewStrongPassword123!"),
    "database": os.getenv("MYSQL_DATABASE", "devyani")
}

# Vector dimension for the model
VECTOR_DIMENSION = 384  # all-MiniLM-L6-v2 dimension

def clean_column_name(col_name):
    """Clean column name for embedding."""
    if not col_name:
        return ""
    return str(col_name).strip().lower().replace(' ', '_').replace('-', '_')

def get_table_columns(table_name, mysql_config):
    """Get all column names from a MySQL table."""
    try:
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor()
        
        query = f"""
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION
        """
        cursor.execute(query, (mysql_config['database'], table_name))
        columns = [row[0] for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return columns
    except Exception as e:
        logger.error(f"Error fetching columns for table '{table_name}': {e}")
        return []

def get_all_tables(mysql_config):
    """Get all tables from the database."""
    try:
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor()
        
        cursor.execute(f"SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        return tables
    except Exception as e:
        logger.error(f"Error fetching tables: {e}")
        return []

def populate_column_vectors(tables=None):
    """
    Populate AstraDB column_vectors collection from MySQL tables.
    
    Args:
        tables: List of table names to process. If None, processes all tables.
    """
    logger.info("Starting column vector population...")
    
    # Initialize model
    logger.info("Loading sentence transformer model...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # Get collection
    collection = get_collection("column_vectors")
    logger.info("Connected to AstraDB column_vectors collection")
    
    # Get tables to process
    if tables is None:
        tables = get_all_tables(MYSQL_CONFIG)
        logger.info(f"Found {len(tables)} tables to process: {tables}")
    else:
        logger.info(f"Processing specified tables: {tables}")
    
    total_columns = 0
    
    for table_name in tables:
        logger.info(f"\n{'='*60}")
        logger.info(f"Processing table: {table_name}")
        logger.info(f"{'='*60}")
        
        # Get columns from MySQL table
        columns = get_table_columns(table_name, MYSQL_CONFIG)
        
        if not columns:
            logger.warning(f"No columns found for table '{table_name}', skipping...")
            continue
        
        logger.info(f"Found {len(columns)} columns in '{table_name}'")
        
        # Process each column
        documents = []
        for col_name in columns:
            try:
                cleaned_name = clean_column_name(col_name)
                
                if not cleaned_name:
                    continue
                
                # Generate embedding
                embedding = model.encode(cleaned_name).tolist()
                
                # Create document
                doc_id = f"{table_name}_{cleaned_name}"
                doc = {
                    "_id": doc_id,
                    "table_name": table_name,
                    "column_name": cleaned_name,
                    "original_name": col_name,
                    "last_updated": datetime.now(timezone.utc).isoformat(),
                    "$vector": embedding  # AstraDB uses $vector field
                }
                
                documents.append(doc)
                logger.debug(f"  - {col_name} -> {cleaned_name} (embedding generated)")
                
            except Exception as e:
                logger.error(f"Error processing column '{col_name}' in table '{table_name}': {e}")
                continue
        
        # Insert batch into AstraDB
        if documents:
            try:
                logger.info(f"Inserting {len(documents)} column vectors for '{table_name}'...")
                
                # Insert documents one by one (Astrapy handles upsert automatically with _id)
                inserted = 0
                for doc in documents:
                    try:
                        # Astrapy automatically upserts based on _id
                        collection.insert_one(doc)
                        inserted += 1
                    except Exception as e:
                        logger.warning(f"Failed to insert {doc['_id']}, may already exist: {e}")
                        # Try to update if exists
                        try:
                            # Replace if exists
                            result = collection.find_one_and_replace(
                                {"_id": doc["_id"]},
                                doc
                            )
                            if result:
                                inserted += 1
                        except:
                            pass
                
                logger.info(f"✓ Successfully inserted/updated {inserted} columns for '{table_name}'")
                total_columns += inserted
                
            except Exception as e:
                logger.error(f"Error inserting documents for table '{table_name}': {e}")
                continue
    
    logger.info(f"\n{'='*60}")
    logger.info(f"✓ COMPLETE: Processed {total_columns} total columns from {len(tables)} tables")
    logger.info(f"{'='*60}")
    
    return total_columns

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Populate AstraDB column vectors from MySQL tables")
    parser.add_argument(
        "--tables",
        nargs="+",
        help="Specific tables to process (default: all tables)",
        default=None
    )
    parser.add_argument(
        "--table-names",
        nargs="+",
        help="Alias for --tables",
        default=None
    )
    
    args = parser.parse_args()
    
    tables_to_process = args.tables or args.table_names
    
    try:
        populate_column_vectors(tables=tables_to_process)
    except KeyboardInterrupt:
        logger.info("\nInterrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

