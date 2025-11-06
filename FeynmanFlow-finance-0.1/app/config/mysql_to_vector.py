import logging
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

import mysql.connector
import nltk
# Use the available classes from your astrapy version
from astrapy import DataAPIClient
from dotenv import load_dotenv
from mysql.connector import Error, pooling
from nltk.corpus import wordnet
from sentence_transformers import SentenceTransformer

from app.config.database import get_collection

# Replace the current import
# from astrapy.db import AstraDB, AstraDBCollection


# Define compatibility classes to maintain the existing code structure
class AstraDB:
    def __init__(self, api_endpoint, token, namespace):
        self.client = DataAPIClient()
        self.database = self.client.get_database(
            api_endpoint,
            token=token
        )
        self.namespace = namespace
        
    def get_collection(self, collection_name, vector_dimension=None):
        return AstraDBCollection(self.database, collection_name)

class AstraDBCollection:
    def __init__(self, database, collection_name):
        self.database = database
        self.collection_name = collection_name
        # Use get_collection instead of collection
        self.collection = database.get_collection(collection_name)
        
    def insert_one(self, document, id=None, if_not_exists=False):
        if id:
            document["_id"] = id
        return self.collection.insert_one(document)
        
    def insert_many(self, documents, ids=None, upsert=False):
        # Handle ids if provided
        if ids:
            for i, doc in enumerate(documents):
                doc["_id"] = ids[i]
        return self.collection.insert_many(documents)
        
    def delete_one(self, filter):
        if "_id" in filter:
            return self.collection.delete_one({"_id": filter["_id"]})
        return self.collection.delete_one(filter)

# Try to import astrapy and its components.
# If it fails, print an informative error and exit.


# Load environment variables
load_dotenv()

# Download the WordNet corpus if not already present
try:
    nltk.data.find('corpora/wordnet')
except LookupError:
    print("Downloading NLTK 'wordnet' corpus...")
    nltk.download('wordnet')
    print("NLTK 'wordnet' corpus downloaded.")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('mysql_to_vector.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Constants
VECTOR_DIMENSION = 384  # Match the MiniLM-L6-v2 model output dimension
BATCH_SIZE = 50  # Number of columns to process in each batch

class MySQLConnectionPool:
    """Manages a pool of MySQL connections."""
    
    def __init__(self, config: Dict[str, Any], pool_size: int = 5):
        """Initialize the connection pool."""
        self.config = config
        self.pool_size = pool_size
        self.pool = None
        self._initialize_pool()
    
    def _initialize_pool(self) -> None:
        """Initialize the connection pool."""
        try:
            self.pool = pooling.MySQLConnectionPool(
                pool_name="mysql_pool",
                pool_size=self.pool_size,
                **self.config
            )
            logger.info(f"MySQL connection pool initialized with {self.pool_size} connections")
        except Error as e:
            logger.error(f"Error initializing MySQL connection pool: {e}")
            raise
    
    @contextmanager
    def get_connection(self):
        """Get a connection from the pool with context manager."""
        conn = None
        try:
            conn = self.pool.get_connection()
            yield conn
        except Error as e:
            logger.error(f"Error getting connection from pool: {e}")
            raise
        finally:
            if conn and conn.is_connected():
                conn.close()
    
    def close_all_connections(self) -> None:
        """Close all connections in the pool."""
        if self.pool:
            self.pool._remove_connections()
            logger.info("All MySQL connections closed")

class MySQLToVector:
    """Converts MySQL database schema to vector representations in AstraDB."""
    
    def __init__(self, db_config: Dict[str, Any], auto_init_vector_db: bool = False):
        """
        Initialize the MySQL to Vector converter.
        
        Args:
            db_config: Dictionary containing MySQL database connection parameters
            auto_init_vector_db: If True, automatically initializes the vector database connection
        """
        self.db_config = db_config
        self.database_name = db_config.get('database', 'unknown')
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self._table_schemas: Dict[str, List[Dict[str, Any]]] = {}
        self.collection: Optional[AstraDBCollection] = None
        self.astra_db: Optional[AstraDB] = None
        self.connection_pool = None
        
        # Initialize connection pool
        try:
            self.connection_pool = MySQLConnectionPool(
                config=db_config,
                pool_size=int(os.getenv("DB_POOL_SIZE", "5"))
            )
        except Exception as e:
            logger.error(f"Failed to initialize MySQL connection pool: {e}")
            raise
            
        # Only initialize vector DB if explicitly requested
        if auto_init_vector_db:
            self._init_vector_db()

    def _init_vector_db(self) -> None:
        """Initialize the vector database connection and ensure the index exists."""
        try:
            logger.info("Initializing Astra DB connection...")
            
            astra_db_id = os.getenv("ASTRA_DB_ID")
            astra_db_region = os.getenv("ASTRA_DB_REGION", "us-east2")
            astra_db_keyspace = os.getenv("ASTRA_DB_KEYSPACE", "default_keyspace")
            astra_db_token = os.getenv("ASTRA_DB_APPLICATION_TOKEN")
            
            if not all([astra_db_id, astra_db_region, astra_db_token]):
                raise ValueError(
                    "Missing required Astra DB environment variables. "
                    "Please set ASTRA_DB_ID, ASTRA_DB_REGION, and ASTRA_DB_APPLICATION_TOKEN."
                )
            
            astra_db_endpoint = f"https://{astra_db_id}-{astra_db_region}.apps.astra.datastax.com"
            
            self.astra_db = AstraDB(
                api_endpoint=astra_db_endpoint,
                token=astra_db_token,
                namespace=astra_db_keyspace,
            )
            
            # Use `get_collection` to create the collection if it doesn't exist.
            # This is the recommended astrapy method.
            self.collection = self.astra_db.get_collection(
                collection_name="column_vectors",
                vector_dimension=VECTOR_DIMENSION
            )
            
            logger.info(f"Successfully connected to Astra DB collection: {self.collection.collection_name}")
            
            # Test the connection with a simple operation
            self._test_astra_connection()
            
        except Exception as e:
            logger.error(f"Failed to initialize Astra DB connection: {e}", exc_info=True)
            raise
    
    def _test_astra_connection(self) -> None:
        """Test the Astra DB connection with a simple operation."""
        if not self.collection:
            raise ValueError("Astra DB collection is not initialized.")
            
        test_doc_id = "test_doc_id"
        test_vector = [0.1] * VECTOR_DIMENSION
        test_doc = {
            "test": "connection_test",
            "vector": test_vector,  # No dollar sign
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            self.collection.insert_one(document=test_doc, id=test_doc_id, if_not_exists=True)
            logger.info("Astra DB connection test successful")
        except Exception as e:
            logger.error(f"Astra DB test insert failed: {e}")
            raise
        finally:
            try:
                self.collection.delete_one(filter={"_id": test_doc_id})
                logger.info("Test document cleaned up")
            except Exception as e:
                logger.warning(f"Failed to clean up test document: {e}")

    # Removed the get_connection method from the class as it's not needed.
    # The pool's get_connection context manager is used directly.

    def get_all_table_names(self) -> List[str]:
        """Fetch all table names from the database."""
        query = "SHOW TABLES"
        
        with self.connection_pool.get_connection() as conn:
            with conn.cursor(dictionary=True) as cursor:
                try:
                    cursor.execute(query)
                    tables = [row[f'Tables_in_{self.db_config["database"]}']
                            for row in cursor.fetchall()]
                    logger.info(f"Found {len(tables)} tables in database")
                    return tables
                except Error as e:
                    logger.error(f"Error fetching tables: {e}")
                    raise

    def get_table_columns(self, table_name: str) -> List[str]:
        """
        Fetch column names for a specific table.
        
        Args:
            table_name: Name of the table to get columns for
            
        Returns:
            List of column names
        """
        query = f"SHOW COLUMNS FROM `{table_name}`"
        
        with self.connection_pool.get_connection() as conn:
            with conn.cursor(dictionary=True) as cursor:
                try:
                    cursor.execute(query)
                    columns = [row['Field'] for row in cursor.fetchall()]
                    logger.debug(f"Found {len(columns)} columns in table '{table_name}'")
                    return columns
                except Error as e:
                    logger.error(f"Error fetching columns for table '{table_name}': {e}")
                    raise

    def get_table_schema(self, table_name: str) -> List[Dict[str, Any]]:
        """
        Get detailed schema information for a table.
        
        Returns a list of dictionaries with column information including:
        - column_name
        - data_type
        - is_nullable
        - column_key
        - column_default
        - extra
        """
        if table_name in self._table_schemas:
            return self._table_schemas[table_name]
            
        query = """
            SELECT
                COLUMN_NAME as column_name,
                DATA_TYPE as data_type,
                IS_NULLABLE as is_nullable,
                COLUMN_KEY as column_key,
                COLUMN_DEFAULT as column_default,
                EXTRA as extra
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = %s
            AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION
        """
        
        with self.connection_pool.get_connection() as conn:
            with conn.cursor(dictionary=True) as cursor:
                try:
                    cursor.execute(query, (self.db_config['database'], table_name))
                    schema = cursor.fetchall()
                    self._table_schemas[table_name] = schema
                    return schema
                except Error as e:
                    logger.error(f"Error fetching schema for table '{table_name}': {e}")
                    raise

    @staticmethod
    def clean_header(header: str) -> str:
        """
        Clean and normalize a header string.
        
        Args:
            header: The header string to clean
            
        Returns:
            str: Cleaned header
        """
        if not isinstance(header, str):
            header = str(header)
        # Only strip and lowercase, do NOT replace underscores with spaces
        return header.strip().lower()

    @staticmethod
    def get_wordnet_synonyms(word: str) -> List[str]:
        """
        Get synonyms for a word using WordNet.
        
        Args:
            word: The word to find synonyms for
            
        Returns:
            List of synonyms (including the original word)
        """
        synonyms = set()
        try:
            for syn in wordnet.synsets(word):
                for lemma in syn.lemmas():
                    lemma_name = lemma.name().replace('_', ' ').lower()
                    synonyms.add(lemma_name)
        except Exception as e:
            logger.warning(f"Error getting synonyms for '{word}': {e}")
            
        return list(synonyms)

    def generate_embeddings(self, text: str) -> List[float]:
        """
        Generate embeddings for the given text.
        
        Args:
            text: Text to generate embeddings for
            
        Returns:
            List of floats representing the embedding
        """
        try:
            if not text or not str(text).strip():
                logger.warning("Empty or None text provided for embedding")
                return [0.0] * VECTOR_DIMENSION
                
            embedding = self.model.encode(text, show_progress_bar=False)
            
            if embedding is None or embedding.size == 0:
                logger.warning("Generated empty or None embedding")
                return [0.0] * VECTOR_DIMENSION
                
            embedding_list = embedding.tolist()
            
            if len(embedding_list) != VECTOR_DIMENSION:
                logger.warning(
                    f"Unexpected embedding dimension: {len(embedding_list)}. "
                    f"Expected: {VECTOR_DIMENSION}. Adjusting..."
                )
                if len(embedding_list) < VECTOR_DIMENSION:
                    embedding_list += [0.0] * (VECTOR_DIMENSION - len(embedding_list))
                else:
                    embedding_list = embedding_list[:VECTOR_DIMENSION]
                    
            return embedding_list
            
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return [0.0] * VECTOR_DIMENSION

    def process_table_columns(self, table_name: str, columns: List[str]) -> None:
        """
        Process all columns in a table and store their vector representations.
        
        Args:
            table_name: Name of the table
            columns: List of column names to process
        """
        if not columns or not self.collection:
            logger.warning(f"No columns or Astra DB collection provided for table '{table_name}'")
            return
            
        logger.info(f"Processing {len(columns)} columns for table '{table_name}'")
        
        schema = self.get_table_schema(table_name)
        schema_map = {col['column_name']: col for col in schema}
        
        batch = []
        
        for col_name in columns:
            try:
                if not col_name or not str(col_name).strip():
                    logger.warning(f"Skipping empty column name in table '{table_name}'")
                    continue
                    
                cleaned_name = self.clean_header(col_name)
                # Only keep required fields
                embedding = self.generate_embeddings(cleaned_name)
                # Include database_name in doc_id to prevent conflicts across databases
                doc_id = f"{self.database_name}_{table_name}_{cleaned_name}"
                doc = {
                    "_id": doc_id,
                    "database_name": self.database_name,
                    "column_name": cleaned_name,
                    "table_name": table_name,
                    "original_name": col_name,
                    "last_updated": datetime.now(timezone.utc).isoformat(),
                    "vector": embedding  # No dollar sign, only this field for vector
                }
                batch.append(doc)
                
                if len(batch) >= BATCH_SIZE:
                    self._process_batch(batch)
                    batch = []
                    
            except Exception as e:
                logger.error(
                    f"Error processing column '{col_name}' in table '{table_name}': {e}",
                    exc_info=True
                )
        
        if batch:
            self._process_batch(batch)
    
    def _process_batch(self, batch: List[Dict[str, Any]]) -> None:
        """Process a batch of documents using insert_many with upsert."""
        if not batch or not self.collection:
            return
            
        try:
            # Use insert_many with upsert=True for efficient insert-or-update
            # The Data API client will use the '_id' field to determine if it's an update or insert
            result = self.collection.insert_many(
                documents=batch
            )
            
            # The result structure might vary, so log with caution
            if result:
                logger.info(f"Batch processed. Inserted/Updated: {result}")
            else:
                logger.warning("Batch insert_many returned an unexpected result.")
                
        except Exception as e:
            logger.error(f"Error processing batch with insert_many: {e}", exc_info=True)
            raise

    def process_all_tables(self) -> None:
        """Process all tables in the database."""
        try:
            logger.info("Starting to process all tables")
            
            tables = self.get_all_table_names()
            if not tables:
                logger.warning("No tables found in the database")
                return
                
            logger.info(f"Found {len(tables)} tables to process")
            
            for table_name in tables:
                try:
                    logger.info(f"Processing table: {table_name}")
                    columns = self.get_table_columns(table_name)
                    
                    if not columns:
                        logger.warning(f"No columns found for table '{table_name}'. Skipping.")
                        continue
                        
                    logger.info(f"Found {len(columns)} columns in table '{table_name}'")
                    self.process_table_columns(table_name, columns)
                    
                except Exception as e:
                    logger.error(f"Error processing table '{table_name}': {e}", exc_info=True)
                    continue  # Continue with next table if one fails
                    
            logger.info("Finished processing all tables")
            
        except Exception as e:
            logger.error(f"Fatal error in process_all_tables: {e}", exc_info=True)
            raise
    
    def close(self) -> None:
        """Clean up resources."""
        try:
            if self.connection_pool:
                self.connection_pool.close_all_connections()
                logger.info("Closed all database connections")
        except Exception as e:
            logger.warning(f"Error during cleanup: {e}")

    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()




def main() -> None:
    """Main entry point for command-line usage."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Convert MySQL schema to vector representations.')
    parser.add_argument('--table', type=str, help='Process a specific table')
    parser.add_argument('--database', type=str, help='Process a specific database (overrides default list)')
    args = parser.parse_args()
    
    # Base MySQL configuration
    base_config = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', 3306)),
        'user': os.getenv('DB_USER', 'root'),
        'password': os.getenv('DB_PASSWORD', 'NewStrongPassword123!'),
    }
    
    # Determine which databases to process
    if args.database:
        # Single database mode
        databases_to_process = [args.database]
    else:
        # Training mode: process devyani first, then bercos
        databases_to_process = ['devyani', 'bercos']
    
    logger.info(f"Processing databases in order: {databases_to_process}")
    
    # Process each database sequentially
    for db_name in databases_to_process:
        logger.info(f"\n{'='*80}")
        logger.info(f"Starting processing for database: {db_name}")
        logger.info(f"{'='*80}")
        
        db_config = base_config.copy()
        db_config['database'] = db_name
        
        # Validate configuration
        missing = [k for k, v in db_config.items() if v is None]
        if missing:
            logger.error(f"Missing required database configuration for {db_name}: {', '.join(missing)}")
            continue
        
        try:
            with MySQLToVector(db_config, auto_init_vector_db=True) as processor:
                if args.table:
                    logger.info(f"Processing specific table '{args.table}' in database '{db_name}'")
                    columns = processor.get_table_columns(args.table)
                    if columns:
                        processor.process_table_columns(args.table, columns)
                    else:
                        logger.warning(f"No columns found for table '{args.table}' in database '{db_name}'")
                else:
                    logger.info(f"Processing all tables in database '{db_name}'")
                    processor.process_all_tables()
            
            logger.info(f"Successfully completed processing for database: {db_name}")
            
        except Exception as e:
            logger.error(f"Error processing database '{db_name}': {e}", exc_info=True)
            logger.warning(f"Continuing with next database...")
            continue
    
    logger.info("\n" + "="*80)
    logger.info("All databases processing completed")
    logger.info("="*80)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        raise SystemExit(1)