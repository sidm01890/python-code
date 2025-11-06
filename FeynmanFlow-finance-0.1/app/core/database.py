import mysql.connector
from mysql.connector import pooling
import pandas as pd
from typing import Tuple, List, Any, Optional
from app.config.database import db_config
import logging

logger = logging.getLogger(__name__)

class DatabaseHandler:
    def __init__(self):
        self.file_pool = None
        self.sales_pool = None
        self.initialize_pools()
        
    def initialize_pools(self) -> None:
        """Initialize database connection pools for both databases"""
        try:
            self.file_pool = mysql.connector.pooling.MySQLConnectionPool(
                **db_config.get_file_db_config()
            )
            logger.info("File processing database connection pool initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize file database pool: {str(e)}")
            # Decide how to handle this error - maybe raise it or handle it downstream
            raise

        try:
            self.sales_pool = mysql.connector.pooling.MySQLConnectionPool(
                **db_config.get_sales_db_config()
            )
            logger.info("Sales data database connection pool initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize sales database pool: {str(e)}")
            # Decide how to handle this error - maybe raise it or handle it downstream
            raise

    def get_file_db_connection(self):
        """Get a connection from the file database pool"""
        try:
            return self.file_pool.get_connection()
        except Exception as e:
            logger.error(f"Failed to get connection from file pool: {str(e)}")
            raise

    def get_sales_db_connection(self):
        """Get a connection from the sales database pool"""
        try:
            return self.sales_pool.get_connection()
        except Exception as e:
            logger.error(f"Failed to get connection from sales pool: {str(e)}")
            raise
            
    def execute_query(self, query: str, values: Optional[Tuple] = None, fetch: bool = False, is_file_db: bool = True) -> Tuple[bool, Any]:
        """Execute a general query on either database"""
        conn = None
        cursor = None
        try:
            if is_file_db:
                conn = self.get_file_db_connection()
            else:
                conn = self.get_sales_db_connection()

            cursor = conn.cursor(dictionary=True) # Use dictionary=True for easier access to results

            if values:
                cursor.execute(query, values)
            else:
                cursor.execute(query)

            if query.strip().upper().startswith("INSERT"):
                conn.commit()
                return True, cursor.lastrowid
            elif fetch:
                results = cursor.fetchall()
                return True, results
            else:
                conn.commit() # Commit for UPDATE, DELETE, CREATE, etc.
                return True, None

        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database query failed: {str(e)}\nQuery: {query}\nValues: {values}")
            return False, str(e)

        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    def insert_chunk(self, chunk: pd.DataFrame, table_name: str) -> Tuple[bool, Optional[str]]:
        """Inserts a chunk of data into the sales database"""
        conn = None
        cursor = None
        try:
            conn = self.get_sales_db_connection() # Use sales database connection
            cursor = conn.cursor()

            # Prepare the insert query
            columns = ', '.join(chunk.columns)
            placeholders = ', '.join(['%s'] * len(chunk.columns))
            insert_query = f"INSERT INTO {table_name} ({columns}) VALUES ({placeholders})"

            # Prepare batch insert
            values = [tuple(row) for row in chunk.values]

            # Execute batch insert
            cursor.executemany(insert_query, values)
            conn.commit()

            logger.info(f"Successfully inserted {len(chunk)} rows into {table_name} in sales database")
            return True, None

        except Exception as e:
            if conn:
                conn.rollback()
            error_msg = f"Failed to insert chunk into {table_name} in sales database: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    def validate_table_exists(self, table_name: str, is_file_db: bool = True) -> bool:
        """Check if the table exists in the specified database"""
        conn = None
        cursor = None
        try:
            if is_file_db:
                conn = self.get_file_db_connection()
            else:
                conn = self.get_sales_db_connection()

            cursor = conn.cursor()

            cursor.execute(f"SHOW TABLES LIKE '{table_name}'")
            result = cursor.fetchone()

            return bool(result)

        except Exception as e:
            logger.error(f"Failed to validate table existence in {'file' if is_file_db else 'sales'} database: {str(e)}")
            return False

        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    def create_table_if_not_exists(self, table_name: str, columns: List[str], is_file_db: bool = True) -> bool:
        """Create table if it doesn't exist in the specified database"""
        conn = None
        cursor = None
        try:
            if is_file_db:
                conn = self.get_file_db_connection()
            else:
                conn = self.get_sales_db_connection()

            cursor = conn.cursor()

            # Create table query
            create_table_query = f"""
            CREATE TABLE IF NOT EXISTS {conn.database}.{table_name} (
                id INT AUTO_INCREMENT PRIMARY KEY,
                {', '.join(columns)}
            )
            """

            cursor.execute(create_table_query)
            conn.commit()

            logger.info(f"Table {table_name} created or already exists in {'file' if is_file_db else 'sales'} database")
            return True

        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Failed to create table in {'file' if is_file_db else 'sales'} database: {str(e)}")
            return False

        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()

    # Removed get_last_insert_id as it's handled by execute_query now

# Create a singleton instance
db_handler = DatabaseHandler() 