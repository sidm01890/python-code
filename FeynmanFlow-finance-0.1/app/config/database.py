from astrapy import DataAPIClient
from typing import Dict, Any
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get credentials and config from environment variables
token = os.getenv("ASTRA_DB_APPLICATION_TOKEN")
api_endpoint = os.getenv("ASTRA_DB_API_ENDPOINT")
keyspace = os.getenv("ASTRA_DB_KEYSPACE")

# Initialize Astra DB client and database
# Note: Timeout configuration may vary by astrapy version
# Processing cursors iteratively in the code helps avoid timeout issues
client = DataAPIClient(token)
try:
    # Try with timeout parameter (if supported by astrapy version)
    db = client.get_database_by_api_endpoint(
        api_endpoint,
        timeout=60000  # 60 seconds timeout in milliseconds
    )
except TypeError:
    # Fallback if timeout parameter not supported
    db = client.get_database_by_api_endpoint(api_endpoint)

def get_collection(collection_name):
    """
    Returns a collection object for the given collection name.
    """
    return db.get_collection(collection_name)

load_dotenv()

class DatabaseConfig:
    def __init__(self):
        self.file_db_config: Dict[str, Any] = {
            "host": os.getenv("DB_HOST", "localhost"),
            "port": int(os.getenv("DB_PORT", "3306")),
            "user": os.getenv("DB_USER", "root"),
            "password": os.getenv("DB_PASSWORD", "NewStrongPassword123!"),
            "database": os.getenv("FILE_DB_NAME", "file_processing_db"),
            "pool_name": "file_pool",
            "pool_size": int(os.getenv("DB_POOL_SIZE", "5")),
            "pool_reset_session": True
        }
        self.sales_db_config: Dict[str, Any] = {
            "host": os.getenv("DB_HOST", "localhost"),
            "port": int(os.getenv("DB_PORT", "3306")),
            "user": os.getenv("DB_USER", "root"),
            "password": os.getenv("DB_PASSWORD", "NewStrongPassword123!"),
            "database": os.getenv("SALES_DB_NAME", "devyani"),
            "pool_name": "sales_pool",
            "pool_size": int(os.getenv("DB_POOL_SIZE", "5")),
            "pool_reset_session": True
        }
    
    def get_file_db_config(self) -> Dict[str, Any]:
        return self.file_db_config

    def get_sales_db_config(self) -> Dict[str, Any]:
        return self.sales_db_config

# Create a singleton instance
db_config = DatabaseConfig() 