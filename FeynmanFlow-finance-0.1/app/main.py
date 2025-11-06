import asyncio
import io
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List

import mysql.connector
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from fastapi import APIRouter, Body, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mysql.connector import Error
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from app.config.data_processor import DataProcessor
from app.config.database import get_collection
from app.config.header_vector_matcher import (
    add_user_defined_alias, detect_best_table_for_headers,
    map_excel_headers_to_canonical,
    map_excel_headers_to_canonical_with_suggestions_by_table)
from app.core.database import db_handler
# Lazy import for scheduler to avoid import errors if FileTracker/FileProcessingDB are missing
# from app.core.scheduler import FileProcessingScheduler

load_dotenv()
# Base MySQL configuration (database will be set dynamically based on client)
BASE_MYSQL_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "NewStrongPassword123!",  # your password here
}

# Database mapping: client name -> database name
CLIENT_DATABASE_MAPPING = {
    "devyani": "devyani",
    "bercos": "bercos",
    "subway": "subway"
}

def get_mysql_config(client: str = None) -> dict:
    """
    Get MySQL configuration based on client selection.
    Defaults to 'devyani' if client is not provided or not found.
    """
    if not client:
        client = "devyani"  # Default
    
    client_lower = client.lower().strip()
    database = CLIENT_DATABASE_MAPPING.get(client_lower, "devyani")
    
    config = BASE_MYSQL_CONFIG.copy()
    config["database"] = database
    return config


def copy_column_data_for_orders(table_name: str, mysql_config: dict):
    """
    Copy data from source columns to target columns in orders table.
    Handles: store_no -> store_name, net_amount -> net_sale, transaction_no -> transaction_number
    Copies data where source has data and target is empty or NULL.
    """
    conn = None
    try:
        print(f"[COPY] Starting column copy for table: {table_name}")
        logger.info(f"[COPY] Starting column copy for table: {table_name}")
        
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor()
        db_name = mysql_config.get('database', 'devyani')
        
        # Column mappings: (source_column, target_column)
        column_mappings = [
            ('store_no', 'store_name'),
            ('net_amount', 'net_sale'),
            ('transaction_no', 'transaction_number')
        ]
        
        updated_count = 0
        for source_col, target_col in column_mappings:
            print(f"[COPY] Checking mapping: {source_col} -> {target_col}")
            logger.info(f"[COPY] Checking mapping: {source_col} -> {target_col}")
            
            # Check if both columns exist in the table
            check_query = """
                SELECT COUNT(*) 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = %s 
                AND TABLE_NAME = %s 
                AND COLUMN_NAME IN (%s, %s)
            """
            cursor.execute(check_query, (db_name, table_name, source_col, target_col))
            col_count = cursor.fetchone()[0]
            
            print(f"[COPY] Column check result: {col_count} columns found")
            logger.info(f"[COPY] Column check result: {col_count} columns found for {source_col} and {target_col}")
            
            if col_count != 2:
                logger.warning(f"[COPY] Skipping {source_col} -> {target_col}: columns don't both exist (found {col_count})")
                print(f"[COPY] WARNING: Skipping {source_col} -> {target_col}: columns don't both exist")
                continue
            
            # Check how many rows have data in source column (including empty strings)
            source_count_query = f"""
                SELECT COUNT(*) 
                FROM `{db_name}`.`{table_name}`
                WHERE `{source_col}` IS NOT NULL
            """
            cursor.execute(source_count_query)
            source_count = cursor.fetchone()[0]
            print(f"[COPY] Found {source_count} rows with non-NULL data in source column '{source_col}'")
            logger.info(f"[COPY] Found {source_count} rows with non-NULL data in source column '{source_col}'")
            
            # Check how many rows have empty target
            # For DECIMAL columns, avoid string comparisons - only check NULL or 0
            if target_type in ['DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL']:
                target_empty_query = f"""
                    SELECT COUNT(*) 
                    FROM `{db_name}`.`{table_name}`
                    WHERE (`{target_col}` IS NULL OR `{target_col}` = 0)
                """
            else:
                target_empty_query = f"""
                    SELECT COUNT(*) 
                    FROM `{db_name}`.`{table_name}`
                    WHERE (`{target_col}` IS NULL OR `{target_col}` = '' OR `{target_col}` = '-')
                """
            
            try:
                cursor.execute(target_empty_query)
                target_empty_count = cursor.fetchone()[0]
                print(f"[COPY] Found {target_empty_count} rows with empty target column '{target_col}'")
                logger.info(f"[COPY] Found {target_empty_count} rows with empty target column '{target_col}'")
            except Exception as e:
                logger.warning(f"[COPY] Could not count empty target rows: {e}. Continuing...")
                target_empty_count = 0
            
            # Check how many rows would be affected (target empty AND source has any value)
            if target_type in ['DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL']:
                count_query = f"""
                    SELECT COUNT(*) 
                    FROM `{db_name}`.`{table_name}`
                    WHERE (`{target_col}` IS NULL OR `{target_col}` = 0)
                    AND `{source_col}` IS NOT NULL
                """
            else:
                count_query = f"""
                    SELECT COUNT(*) 
                    FROM `{db_name}`.`{table_name}`
                    WHERE (`{target_col}` IS NULL OR `{target_col}` = '' OR `{target_col}` = '-')
                    AND `{source_col}` IS NOT NULL
                """
            
            try:
                cursor.execute(count_query)
                count_before = cursor.fetchone()[0]
                print(f"[COPY] Found {count_before} rows matching both conditions for {source_col} -> {target_col}")
                logger.info(f"[COPY] Found {count_before} rows matching both conditions for {source_col} -> {target_col}")
            except Exception as e:
                logger.warning(f"[COPY] Could not count matching rows: {e}. Will try to proceed...")
                count_before = 0
            
            # Get column data types to handle type conversion properly
            type_query = """
                SELECT 
                    COLUMN_NAME,
                    DATA_TYPE,
                    IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = %s
                AND TABLE_NAME = %s
                AND COLUMN_NAME IN (%s, %s)
            """
            cursor.execute(type_query, (db_name, table_name, source_col, target_col))
            type_info = {row[0]: {'type': row[1], 'nullable': row[2]} for row in cursor.fetchall()}
            
            source_type = type_info.get(source_col, {}).get('type', '').upper()
            target_type = type_info.get(target_col, {}).get('type', '').upper()
            
            print(f"[COPY] Column types: {source_col}={source_type}, {target_col}={target_type}")
            logger.info(f"[COPY] Column types: {source_col}={source_type}, {target_col}={target_type}")
            
            if count_before == 0:
                print(f"[COPY] No rows to update for {source_col} -> {target_col}")
                logger.warning(f"[COPY] No rows to update for {source_col} -> {target_col} (source_count={source_count}, target_empty_count={target_empty_count})")
                continue
            
            # Build update query with proper type handling
            # For DECIMAL columns, we need to handle empty strings differently
            # MySQL strict mode doesn't allow empty strings in DECIMAL, so we use row-by-row updates
            if target_type in ['DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL']:
                # For DECIMAL targets, update row-by-row to handle empty strings safely
                # CRITICAL: Cannot compare DECIMAL columns with strings ('', '-') as MySQL tries to convert
                # the string to DECIMAL, which causes errors. Only use NULL and numeric comparisons.
                
                # First, get all row IDs that need updating
                # For DECIMAL columns, only check for NULL or 0 (avoid string comparisons)
                id_query = f"""
                    SELECT id
                    FROM `{db_name}`.`{table_name}`
                    WHERE (`{target_col}` IS NULL OR `{target_col}` = 0)
                """
                try:
                    cursor.execute(id_query)
                    row_ids = [row[0] for row in cursor.fetchall()]
                except Exception as id_error:
                    # If even this fails, try to get all row IDs and filter in Python
                    logger.warning(f"[COPY] ID query failed: {id_error}. Trying to get all IDs...")
                    id_query_alt = f"SELECT id FROM `{db_name}`.`{table_name}`"
                    cursor.execute(id_query_alt)
                    all_ids = [row[0] for row in cursor.fetchall()]
                    # Filter in Python by checking target column values
                    row_ids = []
                    for row_id in all_ids:
                        try:
                            check_query = f"SELECT `{target_col}` FROM `{db_name}`.`{table_name}` WHERE id = %s"
                            cursor.execute(check_query, (row_id,))
                            result = cursor.fetchone()
                            if result and (result[0] is None or result[0] == 0):
                                row_ids.append(row_id)
                        except:
                            # If checking fails, assume it needs updating
                            row_ids.append(row_id)
                
                print(f"[COPY] Found {len(row_ids)} row IDs to check for {source_col} -> {target_col}")
                logger.info(f"[COPY] Found {len(row_ids)} row IDs to check for {source_col} -> {target_col}")
                
                # Now fetch source values one by one with error handling
                rows_to_update = []
                for row_id in row_ids:
                    try:
                        # Try to fetch the source value using CAST to avoid DECIMAL validation issues
                        fetch_query = f"""
                            SELECT CAST(COALESCE(`{source_col}`, '') AS CHAR) as source_val
                            FROM `{db_name}`.`{table_name}`
                            WHERE id = %s
                        """
                        cursor.execute(fetch_query, (row_id,))
                        result = cursor.fetchone()
                        if result and result[0]:
                            source_val = result[0].strip()
                            if source_val and source_val != '' and source_val != '-':
                                rows_to_update.append((row_id, source_val))
                    except Exception as fetch_error:
                        # If fetching fails for this row, skip it
                        logger.warning(f"[COPY] Could not fetch source value for row {row_id}: {fetch_error}")
                        continue
                
                print(f"[COPY] Found {len(rows_to_update)} rows to update for {source_col} -> {target_col}")
                logger.info(f"[COPY] Found {len(rows_to_update)} rows to update for {source_col} -> {target_col}")
                
                if rows_to_update:
                    updated_rows = 0
                    for idx, row in enumerate(rows_to_update):
                        row_id = row[0]
                        source_value = row[1]
                        
                        # Convert empty strings to NULL, otherwise try to convert to decimal
                        try:
                            if source_value is None:
                                target_value = None
                            else:
                                source_str = str(source_value).strip()
                                if source_str == '' or source_str == '-':
                                    target_value = None
                                else:
                                    # Try to convert to decimal
                                    target_value = float(source_str)
                        except (ValueError, TypeError) as e:
                            # If conversion fails, set to NULL
                            target_value = None
                            logger.warning(f"[COPY] Could not convert value '{source_value}' for row {row_id}: {e}")
                        
                        # Update this row
                        update_query = f"""
                            UPDATE `{db_name}`.`{table_name}`
                            SET `{target_col}` = %s
                            WHERE id = %s
                        """
                        cursor.execute(update_query, (target_value, row_id))
                        updated_rows += 1
                        
                        # Log every 50 rows for progress
                        if (idx + 1) % 50 == 0:
                            print(f"[COPY] Progress: {idx + 1}/{len(rows_to_update)} rows processed")
                    
                    rows_affected = updated_rows
                    print(f"[COPY] Row-by-row UPDATE completed. Rows affected: {rows_affected}")
                    logger.info(f"[COPY] Row-by-row UPDATE completed. Rows affected: {rows_affected}")
                else:
                    rows_affected = 0
                    print(f"[COPY] No rows to update for {source_col} -> {target_col}")
                    logger.info(f"[COPY] No rows to update for {source_col} -> {target_col}")
            else:
                # For VARCHAR/STRING targets, direct copy without filtering
                update_query = f"""
                    UPDATE `{db_name}`.`{table_name}`
                    SET `{target_col}` = `{source_col}`
                    WHERE (`{target_col}` IS NULL OR `{target_col}` = '' OR `{target_col}` = '-')
                    AND `{source_col}` IS NOT NULL
                """
                cursor.execute(update_query)
                rows_affected = cursor.rowcount
                print(f"[COPY] UPDATE query executed. Rows affected: {rows_affected}")
                logger.info(f"[COPY] UPDATE query executed. Rows affected: {rows_affected}")
            
            if rows_affected > 0:
                updated_count += rows_affected
                logger.info(f"[COPY] ✓ Updated {rows_affected} rows: {source_col} -> {target_col}")
                print(f"[COPY] ✓ Updated {rows_affected} rows: {source_col} -> {target_col}")
            else:
                logger.warning(f"[COPY] No rows updated for {source_col} -> {target_col}")
                print(f"[COPY] WARNING: No rows updated for {source_col} -> {target_col}")
        
        conn.commit()
        cursor.close()
        
        print(f"[COPY] Commit completed. Total rows updated: {updated_count}")
        logger.info(f"[COPY] Commit completed. Total rows updated: {updated_count}")
        
        if updated_count > 0:
            logger.info(f"[COPY] ✓ Total rows updated: {updated_count}")
            print(f"[COPY] ✓ Total rows updated: {updated_count}")
        else:
            logger.warning("[COPY] No rows were updated. Check if source columns have data.")
            print("[COPY] WARNING: No rows were updated. Check if source columns have data.")
            
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"[COPY] Error copying column data: {str(e)}", exc_info=True)
        print(f"[COPY] ERROR: {str(e)}")
        import traceback
        print(f"[COPY] Traceback: {traceback.format_exc()}")
        raise
    finally:
        if conn:
            conn.close()
            print("[COPY] Connection closed")

# Datasource to table name mapping
# Maps datasource names (as provided by frontend) to actual MySQL table names
DATASOURCE_TO_TABLE_MAPPING = {
    "pos_orders": "orders",
    "POS_ORDERS": "orders",
    "orders": "orders",  # Direct mapping for consistency
}
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Define the lifespan event handler using asynccontextmanager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan event handler.
    Runs startup logic (like creating database tables) before the app starts
    and potential shutdown logic after the app stops.
    """
    logger.info("Starting FastAPI lifespan: Running startup logic...")

    # --- Startup Logic (moved from startup_event) ---
    # Dynamically create tables based on TABLE_CANONICAL_COLUMNS
    # for table_name, canonical_columns in TABLE_CANONICAL_COLUMNS.items():
    #     # Generate column definitions with appropriate data types
    #     column_definitions = []
    #     for col in canonical_columns:
    #         # Default data type mapping - can be customized per table if needed
    #         if any(keyword in col.lower() for keyword in ['date', 'time']):
    #             col_def = f"{col} DATE"
    #         elif any(keyword in col.lower() for keyword in ['price', 'amount', 'sales', 'cost', 'profit', 'units']):
    #             col_def = f"{col} DECIMAL(10, 2)"
    #         elif any(keyword in col.lower() for keyword in ['number', 'id', 'year', 'month_number']):
    #             col_def = f"{col} INT"
    #         else:
    #             col_def = f"{col} VARCHAR(255)"
    #         column_definitions.append(col_def)
    
    #     try:
    #         db_handler.create_table_if_not_exists(table_name, column_definitions, is_file_db=False)
    #         logger.info(f"Checked/Created '{table_name}' table with {len(canonical_columns)} columns.")
    #     except Exception as e:
    #         logger.error(f"Failed to create table '{table_name}': {str(e)}")

    logger.info("FastAPI startup complete. Application starting...")
    yield # The application runs here
    logger.info("FastAPI shutdown initiated. Running shutdown logic (if any)...")

    # --- Shutdown Logic (add cleanup here if needed) ---
    # ---------------------------------------------------

    logger.info("FastAPI shutdown complete.")


# Create a FastAPI application instance, passing the lifespan handler
app = FastAPI(title="Data Processing API", lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Health check endpoint"""
    try:
        # Test database connections
        db_status = "connected"
        table_status_detail = {}
        health_details = {
            "mysql_sales_db": "unknown",
            "mysql_file_db": "unknown",
            "astradb": "unknown"
        }

        # Test MySQL Sales DB connection (using default devyani for health check)
        try:
            default_config = get_mysql_config("devyani")
            test_conn = mysql.connector.connect(**default_config)
            test_conn.close()
            health_details["mysql_sales_db"] = "connected"
            
            # Get tables from sales database
            try:
                conn = mysql.connector.connect(**default_config)
                cursor = conn.cursor()
                cursor.execute("SHOW TABLES")
                tables = [table[0] for table in cursor.fetchall()]
                table_status_detail["sales_db_tables"] = tables
                cursor.close()
                conn.close()
            except Exception as e:
                logger.warning(f"Could not list sales DB tables: {str(e)}")
        except Exception as e:
            health_details["mysql_sales_db"] = f"error: {str(e)}"
            db_status = "error"

        # Test MySQL File DB connection
        try:
            file_db_config = db_handler.get_file_db_connection()
            file_db_config.close()
            health_details["mysql_file_db"] = "connected"
        except Exception as e:
            health_details["mysql_file_db"] = f"error: {str(e)}"

        # Test AstraDB connection
        try:
            collection = get_collection("column_vectors")
            count = collection.count_documents({})
            health_details["astradb"] = f"connected (collection has {count} documents)"
        except Exception as e:
            health_details["astradb"] = f"error: {str(e)}"

        return JSONResponse(content={
            "message": "Welcome to the Data Processing API",
            "status": "healthy" if db_status == "connected" else "degraded",
            "database_status": db_status,
            "health_details": health_details,
            "table_status": table_status_detail,
            "endpoints": {
                "health_check": "/",
                "upload_excel": "/upload/vector-match-excel",
                "analyze_columns": "/analyze-columns",
                "add_alias": "/api/column-alias",
                "canonical_sets": "/admin/canonical-sets",
                "debug_columns": "/debug/canonical-columns",
                "diagnose": "/diagnose-upload-api",
                "docs": "/docs"
            }
        })

    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(content={
            "message": "Welcome to the Data Processing API",
            "status": "error",
            "database_status": "error",
            "error": str(e)
        }, status_code=500)

@app.post("/upload/vector-match-excel")
async def upload_vector_match_excel(
    file: UploadFile = File(...),
    datasource: str = None,
    chunk_size: int = 1000,
    client: str = None
):
    """
    Upload an Excel file to a specified datasource table, map headers, clean/process data,
    insert into MySQL in chunks, and return mapping info and processing stats.
    
    Args:
        file: Excel file to upload
        datasource: Name of the target table (e.g., 'zomato', 'swiggy', 'zomato_history'). 
                    If not provided, will attempt auto-detection.
        chunk_size: Number of rows to process in each chunk (default: 1000)
        client: Client name (devyani, bercos, subway) to determine which database to use
    """
    print("=" * 80)
    print("[UPLOAD] ========== UPLOAD REQUEST STARTED ==========")
    print(f"[UPLOAD] Datasource: {datasource}")
    print(f"[UPLOAD] Client: {client}")
    print(f"[UPLOAD] Chunk size: {chunk_size}")
    print(f"[UPLOAD] File: {file.filename if file else 'None'}")
    print(f"[UPLOAD] Content type: {file.content_type if file else 'None'}")
    logger.info(f"=== UPLOAD REQUEST STARTED ===")
    logger.info(f"Datasource: {datasource}, Client: {client}, Chunk size: {chunk_size}, File: {file.filename if file else 'None'}")
    
    # Get MySQL config based on client selection
    MYSQL_CONFIG = get_mysql_config(client)
    logger.info(f"[UPLOAD] Using database: {MYSQL_CONFIG.get('database')} for client: {client}")
    print(f"[UPLOAD] Using database: {MYSQL_CONFIG.get('database')} for client: {client}")
    
    try:
        # Define helper functions FIRST (before any other code that might raise exceptions)
        def table_exists(table_name, mysql_config):
            """Check if a table exists in MySQL"""
            print(f"[TABLE_CHECK] Checking if table '{table_name}' exists")
            logger.info(f"[TABLE_CHECK] Checking if table '{table_name}' exists")
            try:
                db_name = mysql_config.get('database', 'devyani')
                print(f"[TABLE_CHECK] Database: '{db_name}'")
                logger.info(f"[TABLE_CHECK] Database: '{db_name}'")
                
                conn = mysql.connector.connect(**mysql_config)
                cursor = conn.cursor()
                # Use the database from config and check with proper escaping
                query = f"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = %s AND table_name = %s"
                print(f"[TABLE_CHECK] Executing query: {query} with params: ('{db_name}', '{table_name}')")
                logger.info(f"[TABLE_CHECK] Executing query with params: ('{db_name}', '{table_name}')")
                
                cursor.execute(query, (db_name, table_name))
                result = cursor.fetchone()
                exists = result[0] > 0
                cursor.close()
                conn.close()
                
                print(f"[TABLE_CHECK] Table '{table_name}' exists: {exists}")
                logger.info(f"[TABLE_CHECK] Table existence check for '{table_name}' in database '{db_name}': {exists}")
                return exists
            except Exception as e:
                print(f"[TABLE_CHECK] ERROR: {str(e)}")
                logger.error(f"[TABLE_CHECK] Error checking table existence: {str(e)}")
                logger.error(f"[TABLE_CHECK] Exception type: {type(e).__name__}")
                import traceback
                logger.error(f"[TABLE_CHECK] Traceback: {traceback.format_exc()}")
                return False
        
        # Now proceed with file validation and processing
        print("[UPLOAD] Step 1: File validation")
        logger.info("[UPLOAD] Step 1: File validation")
        
        if not file:
            print("[UPLOAD] ERROR: No file uploaded")
            logger.error("[UPLOAD] ERROR: No file uploaded")
            raise HTTPException(status_code=400, detail="No file uploaded.")
        
        print(f"[UPLOAD] File received: {file.filename}")
        logger.info(f"[UPLOAD] File received: {file.filename}")
        
        if not file.filename.endswith(('.xlsx', '.xls')):
            print(f"[UPLOAD] ERROR: Invalid file type: {file.filename}")
            logger.error(f"[UPLOAD] ERROR: Invalid file type: {file.filename}")
            raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported.")
        
        print(f"[UPLOAD] File type validated: {file.filename}")
        logger.info(f"[UPLOAD] File type validated: {file.filename}")
        print("[UPLOAD] Step 2: Saving file to temp location")
        logger.info("[UPLOAD] Step 2: Saving file to temp location")
        
        temp_file_path = f"temp_{file.filename}"
        print(f"[UPLOAD] Temp file path: {temp_file_path}")
        logger.info(f"[UPLOAD] Temp file path: {temp_file_path}")
        
        with open(temp_file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
            print(f"[UPLOAD] File saved, size: {len(content)} bytes")
            logger.info(f"[UPLOAD] File saved, size: {len(content)} bytes")
        
        print("[UPLOAD] Step 3: Reading Excel file")
        logger.info("[UPLOAD] Step 3: Reading Excel file")
        
        try:
            df = pd.read_excel(temp_file_path)
            logger.info(f"Loaded Excel file: {df.shape[0]} rows, {df.shape[1]} columns")
            print(f"[UPLOAD] ========== EXCEL FILE LOADED ==========")
            print(f"[UPLOAD] Rows: {df.shape[0]}, Columns: {df.shape[1]}")
            print(f"[UPLOAD] =======================================")
        except Exception as e:
            print(f"[UPLOAD] ERROR: Failed to read Excel file: {str(e)}")
            logger.error(f"[UPLOAD] ERROR: Failed to read Excel file: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {str(e)}")
        print("[UPLOAD] Step 4: Extracting headers")
        logger.info("[UPLOAD] Step 4: Extracting headers")
        
        excel_headers = list(df.columns)
        print(f"[UPLOAD] Excel headers found: {len(excel_headers)} columns")
        print(f"[UPLOAD] Headers: {excel_headers}")
        logger.info(f"[UPLOAD] Excel headers found: {len(excel_headers)} columns: {excel_headers}")
        
        if not excel_headers:
            print("[UPLOAD] ERROR: No columns found in Excel file")
            logger.error("[UPLOAD] ERROR: No columns found in Excel file")
            raise HTTPException(status_code=400, detail="No columns found in the uploaded Excel file.")
        
        if len(df) == 0:
            logger.warning(f"Excel file loaded but contains no data rows!")
            print(f"[UPLOAD] WARNING: Excel file has NO DATA ROWS!")

        # --- Store headers in local JSON file ---
        import json
        from pathlib import Path
        header_store_dir = Path(__file__).parent / "header store"
        header_store_dir.mkdir(parents=True, exist_ok=True)
        header_store_path = header_store_dir / "header_store.json"
        # Load existing data or start new list
        if header_store_path.exists():
            try:
                with open(header_store_path, "r", encoding="utf-8") as f:
                    header_data = json.load(f)
            except Exception:
                header_data = []
        else:
            header_data = []
        # Append new entry
        header_data.append({
            "filename": file.filename,
            "timestamp": datetime.now().isoformat(),
            "headers": excel_headers
        })
        # Save back
        with open(header_store_path, "w", encoding="utf-8") as f:
            json.dump(header_data, f, indent=2)
        
        # 1. Get table name from datasource parameter or detect it
        print("[UPLOAD] Step 5: Processing datasource parameter")
        logger.info("[UPLOAD] Step 5: Processing datasource parameter")
        print(f"[UPLOAD] Raw datasource value: '{datasource}'")
        logger.info(f"[UPLOAD] Raw datasource value: '{datasource}'")
        print(f"[UPLOAD] Available mappings: {list(DATASOURCE_TO_TABLE_MAPPING.keys())}")
        logger.info(f"[UPLOAD] Available mappings: {list(DATASOURCE_TO_TABLE_MAPPING.keys())}")
        
        if datasource:
            # Check datasource mapping first, then use provided datasource as table name - skip detection entirely
            datasource_clean = datasource.strip()
            datasource_lower = datasource_clean.lower()
            
            print(f"[UPLOAD] Cleaned datasource: '{datasource_clean}'")
            print(f"[UPLOAD] Lowercase datasource: '{datasource_lower}'")
            logger.info(f"[UPLOAD] Cleaned datasource: '{datasource_clean}', Lowercase: '{datasource_lower}'")
            
            # Check mapping (try both original and lowercase versions)
            if datasource_clean in DATASOURCE_TO_TABLE_MAPPING:
                best_table = DATASOURCE_TO_TABLE_MAPPING[datasource_clean]
                print(f"[UPLOAD] ✓ Found mapping for '{datasource_clean}' -> '{best_table}'")
                logger.info(f"[UPLOAD] Using mapped table name from datasource '{datasource_clean}': '{best_table}'")
            elif datasource_lower in DATASOURCE_TO_TABLE_MAPPING:
                best_table = DATASOURCE_TO_TABLE_MAPPING[datasource_lower]
                print(f"[UPLOAD] ✓ Found mapping for '{datasource_lower}' -> '{best_table}'")
                logger.info(f"[UPLOAD] Using mapped table name from datasource '{datasource_lower}': '{best_table}'")
            else:
                # No mapping found, use datasource as-is (lowercased)
                best_table = datasource_lower
                print(f"[UPLOAD] ⚠ No mapping found, using datasource as-is: '{best_table}'")
                logger.info(f"[UPLOAD] Using provided datasource as table name: '{best_table}' (no mapping found, skipping table detection)")
            
            table_scores = {best_table: 1.0}  # Set score since we're using provided datasource
            print(f"[UPLOAD] Selected table name: '{best_table}'")
            logger.info(f"[UPLOAD] Selected table name: '{best_table}'")
        else:
            # Fallback to auto-detection if datasource not provided
            logger.warning("No datasource parameter provided, falling back to auto-detection")
            best_table, table_scores = detect_best_table_for_headers(excel_headers, database_name=MYSQL_CONFIG.get('database'))
            
            # Validate that best_table is a valid table name (not database name or None)
            if not best_table or best_table == MYSQL_CONFIG.get('database', 'devyani'):
                # Get list of actual tables in database
                try:
                    conn = mysql.connector.connect(**MYSQL_CONFIG)
                    cursor = conn.cursor()
                    cursor.execute("SHOW TABLES")
                    available_tables = [row[0] for row in cursor.fetchall()]
                    cursor.close()
                    conn.close()
                    
                    error_msg = f"Invalid table detected: '{best_table}'. "
                    if available_tables:
                        error_msg += f"Available tables in database '{MYSQL_CONFIG.get('database', 'devyani')}': {', '.join(available_tables[:10])}"
                        if len(available_tables) > 10:
                            error_msg += f" ... and {len(available_tables) - 10} more"
                    else:
                        error_msg += f"No tables found in database '{MYSQL_CONFIG.get('database', 'devyani')}'."
                    
                    logger.error(error_msg)
                    raise HTTPException(
                        status_code=400,
                        detail=error_msg
                    )
                except mysql.connector.Error as e:
                    logger.error(f"Error checking available tables: {str(e)}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Could not validate table name. Detected table: '{best_table}'. Error: {str(e)}"
                    )
        
        # Validate that the specified table exists in database
        print("[UPLOAD] Step 6: Validating table existence")
        logger.info("[UPLOAD] Step 6: Validating table existence")
        print(f"[UPLOAD] Checking if table '{best_table}' exists in database")
        logger.info(f"[UPLOAD] Checking if table '{best_table}' exists in database")
        
        if not table_exists(best_table, MYSQL_CONFIG):
            print(f"[UPLOAD] ERROR: Table '{best_table}' does not exist")
            logger.error(f"[UPLOAD] ERROR: Table '{best_table}' does not exist")
            
            # Get list of available tables for better error message
            try:
                print("[UPLOAD] Fetching list of available tables...")
                logger.info("[UPLOAD] Fetching list of available tables...")
                
                conn = mysql.connector.connect(**MYSQL_CONFIG)
                cursor = conn.cursor()
                cursor.execute("SHOW TABLES")
                available_tables = [row[0] for row in cursor.fetchall()]
                cursor.close()
                conn.close()
                
                print(f"[UPLOAD] Found {len(available_tables)} tables in database")
                logger.info(f"[UPLOAD] Found {len(available_tables)} tables in database")
                
                error_msg = f"Table '{best_table}' does not exist in database '{MYSQL_CONFIG.get('database', 'devyani')}'. "
                if available_tables:
                    print(f"[UPLOAD] Available tables (first 15): {available_tables[:15]}")
                    logger.info(f"[UPLOAD] Available tables (first 15): {available_tables[:15]}")
                    error_msg += f"Available tables: {', '.join(available_tables[:15])}"
                    if len(available_tables) > 15:
                        error_msg += f" ... and {len(available_tables) - 15} more"
                else:
                    error_msg += "No tables found in the database."
                
                print(f"[UPLOAD] Error message: {error_msg}")
                logger.error(f"[UPLOAD] Error message: {error_msg}")
                raise HTTPException(
                    status_code=404,
                    detail=error_msg
                )
            except mysql.connector.Error as e:
                print(f"[UPLOAD] ERROR: Database error while checking tables: {str(e)}")
                logger.error(f"[UPLOAD] Error checking table existence: {str(e)}")
                import traceback
                logger.error(f"[UPLOAD] Traceback: {traceback.format_exc()}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Table '{best_table}' does not exist and could not verify available tables. Error: {str(e)}"
                )
        
        print(f"[UPLOAD] ✓ Table '{best_table}' exists")
        logger.info(f"[UPLOAD] ✓ Table '{best_table}' exists")
        
        # 2. Map headers using only that table's canonical columns
        print("[UPLOAD] Step 7: Mapping headers to canonical columns")
        logger.info("[UPLOAD] Step 7: Mapping headers to canonical columns")
        print(f"[UPLOAD] Mapping headers for table: '{best_table}' in database: '{MYSQL_CONFIG.get('database')}'")
        logger.info(f"[UPLOAD] Mapping headers for table: '{best_table}' in database: '{MYSQL_CONFIG.get('database')}'")
        
        try:
            mapping, unmapped, canonical_options = map_excel_headers_to_canonical_with_suggestions_by_table(
                excel_headers, best_table, database_name=MYSQL_CONFIG.get('database')
            )
            print(f"[UPLOAD] Mapping complete. Mapped: {len(mapping)}, Unmapped: {len(unmapped)}")
            logger.info(f"[UPLOAD] Mapping complete. Mapped: {len(mapping)}, Unmapped: {len(unmapped)}")
            print(f"[UPLOAD] Mapping: {mapping}")
            logger.info(f"[UPLOAD] Mapping: {mapping}")
        except Exception as e:
            print(f"[UPLOAD] ERROR during header mapping: {str(e)}")
            logger.error(f"[UPLOAD] ERROR during header mapping: {str(e)}")
            import traceback
            logger.error(f"[UPLOAD] Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Error mapping headers: {str(e)}")
        df = df.rename(columns=mapping)
        print(f"[UPLOAD] DataFrame columns after rename: {df.columns.tolist()}")
        logger.info(f"[UPLOAD] DataFrame columns after rename: {df.columns.tolist()}")
        
        # Clean column names FIRST (before table operations)
        df.columns = (
            df.columns
            .str.strip()
            .str.replace(r'[^\w]', '_', regex=True)
            .str.replace(r'_+', '_', regex=True)
            .str.strip('_')
            .str.lower()
        )
        
        # Handle duplicate column names by adding suffixes
        # This prevents errors when accessing df[col] where col is duplicated
        seen = {}
        new_columns = []
        for col in df.columns:
            if col in seen:
                seen[col] += 1
                new_col = f"{col}_{seen[col]}"
                new_columns.append(new_col)
            else:
                seen[col] = 0
                new_columns.append(col)
        df.columns = new_columns
        
        # Log if duplicates were found
        if any(count > 0 for count in seen.values()):
            duplicates = {col: count + 1 for col, count in seen.items() if count > 0}
            logger.warning(f"Found duplicate column names after mapping. Renamed duplicates: {duplicates}")
            print(f"[UPLOAD] WARNING: Found duplicate columns renamed: {duplicates}")
        
        # Only keep columns up to the first empty header (after the first column)
        keep_cols = [df.columns[0]]  # Always keep the first column
        for col in df.columns[1:]:
            if col == '':
                break
            keep_cols.append(col)
        df = df[keep_cols]

        def create_table_from_dataframe(table_name, df, mysql_config):
            """Create a MySQL table based on DataFrame structure"""
            try:
                conn = mysql.connector.connect(**mysql_config)
                cursor = conn.cursor()
                
                # Generate column definitions
                column_definitions = []
                for col in df.columns:
                    # Infer SQL type from DataFrame column
                    col_series = df[col].dropna()
                    if len(col_series) == 0:
                        col_type = "VARCHAR(255)"
                    else:
                        # Convert to string first to check for alphanumeric content
                        col_str = col_series.astype(str)
                        
                        # Check if column contains ANY letters (indicates alphanumeric/string)
                        has_letters = col_str.str.contains(r'[A-Za-z]', regex=True, na=False).any()
                        
                        if has_letters:
                            # Contains letters - must be VARCHAR/TEXT
                            max_len = col_str.str.len().max()
                            if pd.isna(max_len) or max_len > 500:
                                col_type = "TEXT"
                            else:
                                col_type = f"VARCHAR({max(255, int(max_len) + 50)})"
                        else:
                            # No letters - could be numeric or date
                            # Try to infer type from the data
                            try:
                                numeric_series = pd.to_numeric(col_series, errors='coerce')
                                # Only treat as numeric if ALL non-null values are numeric
                                numeric_count = numeric_series.notna().sum()
                                total_count = len(col_series)
                                
                                if numeric_count == total_count and numeric_count > 0:
                                    # All values are numeric
                                    if (numeric_series % 1 == 0).all():
                                        col_type = "INT"
                                    else:
                                        col_type = "DECIMAL(15, 2)"
                                elif numeric_count > total_count * 0.8:
                                    # Most values are numeric, but some aren't - treat as VARCHAR
                                    max_len = col_str.str.len().max()
                                    if pd.isna(max_len) or max_len > 500:
                                        col_type = "TEXT"
                                    else:
                                        col_type = f"VARCHAR({max(255, int(max_len) + 50)})"
                                else:
                                    # Mostly non-numeric - check if it's a date
                                    try:
                                        # Try parsing as date with multiple formats
                                        date_series = pd.to_datetime(col_series, errors='coerce')
                                        if date_series.notna().sum() > total_count * 0.8:
                                            # Most values are valid dates - use DATETIME for flexibility
                                            col_type = "DATETIME"
                                        else:
                                            # Not a date - treat as VARCHAR
                                            max_len = col_str.str.len().max()
                                            if pd.isna(max_len) or max_len > 500:
                                                col_type = "TEXT"
                                            else:
                                                col_type = f"VARCHAR({max(255, int(max_len) + 50)})"
                                    except:
                                        # Date parsing failed - treat as VARCHAR
                                        max_len = col_str.str.len().max()
                                        if pd.isna(max_len) or max_len > 500:
                                            col_type = "TEXT"
                                        else:
                                            col_type = f"VARCHAR({max(255, int(max_len) + 50)})"
                            except:
                                # Fallback - check if it looks like a date
                                try:
                                    date_series = pd.to_datetime(col_series, errors='coerce')
                                    if date_series.notna().sum() > len(col_series) * 0.8:
                                        col_type = "DATETIME"
                                    else:
                                        max_len = col_str.str.len().max()
                                        if pd.isna(max_len) or max_len > 500:
                                            col_type = "TEXT"
                                        else:
                                            col_type = f"VARCHAR({max(255, int(max_len) + 50)})"
                                except:
                                    # Ultimate fallback to string type
                                    max_len = col_str.str.len().max()
                                    if pd.isna(max_len) or max_len > 500:
                                        col_type = "TEXT"
                                    else:
                                        col_type = f"VARCHAR({max(255, int(max_len) + 50)})"
                    
                    column_definitions.append(f"`{col}` {col_type}")
                
                # Create table SQL - explicitly use the database from config
                db_name = mysql_config.get('database', 'devyani')
                create_sql = f"""
                CREATE TABLE IF NOT EXISTS `{db_name}`.`{table_name}` (
                    `id` INT AUTO_INCREMENT PRIMARY KEY,
                    {', '.join(column_definitions)}
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
                """
                logger.info(f"Creating table with SQL: CREATE TABLE IF NOT EXISTS `{db_name}`.`{table_name}` ...")
                cursor.execute(create_sql)
                conn.commit()
                cursor.close()
                conn.close()
                logger.info(f"Created table '{table_name}' with {len(column_definitions)} columns")
                return True
            except Exception as e:
                logger.error(f"Error creating table '{table_name}': {str(e)}")
                if 'conn' in locals():
                    conn.close()
                return False

        def get_mysql_table_columns(table_name, mysql_config):
            """Get column names from an existing MySQL table"""
            try:
                conn = mysql.connector.connect(**mysql_config)
                cursor = conn.cursor()
                # Use backticks to properly escape table name
                cursor.execute(f"DESCRIBE `{table_name}`")
                columns = [row[0] for row in cursor.fetchall()]
                cursor.close()
                conn.close()
                return columns
            except Exception as e:
                logger.error(f"Error getting table columns for '{table_name}': {str(e)}")
                logger.error(f"Exception details: {type(e).__name__}: {str(e)}")
                return []

        def get_mysql_table_schema(table_name, mysql_config):
            """Get column schema with data types from MySQL table"""
            try:
                conn = mysql.connector.connect(**mysql_config)
                cursor = conn.cursor(dictionary=True)
                db_name = mysql_config.get('database', 'devyani')
                query = """
                    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, 
                           IS_NULLABLE, COLUMN_DEFAULT, NUMERIC_PRECISION, NUMERIC_SCALE, EXTRA
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
                    ORDER BY ORDINAL_POSITION
                """
                cursor.execute(query, (db_name, table_name))
                schema = cursor.fetchall()
                cursor.close()
                conn.close()
                return {col['COLUMN_NAME']: col for col in schema}
            except Exception as e:
                logger.error(f"Error getting table schema for '{table_name}': {str(e)}")
                return {}

        def convert_dataframe_to_match_schema(df, table_schema):
            """Convert DataFrame columns to match MySQL table schema data types"""
            import numpy as np
            
            for col_name, col_info in table_schema.items():
                if col_name not in df.columns:
                    continue
                
                data_type = col_info.get('DATA_TYPE', '').upper()
                is_nullable = col_info.get('IS_NULLABLE', 'YES') == 'YES'
                
                # Handle date/time columns
                if data_type in ['DATE', 'DATETIME', 'TIMESTAMP', 'TIME']:
                    try:
                        # Convert to datetime, handling various input formats
                        df[col_name] = pd.to_datetime(df[col_name], errors='coerce')
                        
                        # Convert to string format MySQL expects based on column type
                        if data_type == 'DATE':
                            # DATE format: YYYY-MM-DD
                            df[col_name] = df[col_name].apply(
                                lambda x: x.strftime('%Y-%m-%d') if pd.notna(x) and hasattr(x, 'strftime') else None
                            )
                        else:
                            # DATETIME/TIMESTAMP format: YYYY-MM-DD HH:MM:SS (max 19 chars)
                            df[col_name] = df[col_name].apply(
                                lambda x: x.strftime('%Y-%m-%d %H:%M:%S')[:19] if pd.notna(x) and hasattr(x, 'strftime') else None
                            )
                        
                        # Replace NaT with None
                        df[col_name] = df[col_name].replace({pd.NaT: None, 'NaT': None, 'nat': None, np.nan: None})
                    except Exception as e:
                        logger.warning(f"Error converting date column '{col_name}': {str(e)}")
                        # Fallback: try to clean existing string values
                        if is_nullable:
                            def clean_date_string(x):
                                if pd.isna(x) or str(x).lower() in ['nat', 'none', 'nan', 'null', '']:
                                    return None
                                x_str = str(x).strip()
                                # Truncate to appropriate length based on type
                                max_len = 10 if data_type == 'DATE' else 19
                                return x_str[:max_len] if len(x_str) > max_len else x_str
                            df[col_name] = df[col_name].apply(clean_date_string)
                        else:
                            df[col_name] = df[col_name].apply(lambda x: str(x)[:19] if pd.notna(x) else '1970-01-01 00:00:00')
                
                # Handle numeric types - but convert to string if non-numeric data is present
                elif data_type in ['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT']:
                    # Check if column contains non-numeric strings
                    non_numeric = df[col_name].apply(lambda x: not pd.isna(x) and isinstance(x, str) and not str(x).strip().replace('-', '').replace('.', '').isdigit())
                    if non_numeric.any():
                        # If non-numeric values exist, keep as string (might be a VARCHAR misdefined as INT)
                        logger.warning(f"Column '{col_name}' is {data_type} but contains non-numeric values. Keeping as string.")
                        df[col_name] = df[col_name].astype(str).replace('nan', None if is_nullable else '')
                    else:
                        df[col_name] = pd.to_numeric(df[col_name], errors='coerce')
                        if is_nullable:
                            df[col_name] = df[col_name].replace({np.nan: None, pd.NA: None})
                        else:
                            df[col_name] = df[col_name].fillna(0).astype('Int64' if is_nullable else int)
                
                # Handle DECIMAL - check if it contains non-numeric values
                elif data_type in ['DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL']:
                    # Check if column contains alphabetic characters (like 'P772', '20K')
                    has_alphabetic = df[col_name].apply(
                        lambda x: not pd.isna(x) and isinstance(x, str) and any(c.isalpha() for c in str(x).strip())
                    ).any()
                    
                    if has_alphabetic:
                        # If contains alphabetic characters, convert to string (likely VARCHAR misdefined as DECIMAL)
                        logger.warning(f"Column '{col_name}' is {data_type} but contains alphabetic characters (e.g., 'P772', '20K'). Converting to string.")
                        df[col_name] = df[col_name].astype(str).replace({'nan': None, 'None': None, 'NaN': None} if is_nullable else {'nan': '', 'None': '', 'NaN': ''})
                    else:
                        # Try to convert to numeric
                        df[col_name] = pd.to_numeric(df[col_name], errors='coerce')
                        if is_nullable:
                            df[col_name] = df[col_name].replace({np.nan: None, pd.NA: None})
                        else:
                            df[col_name] = df[col_name].fillna(0.0)
                
                # Handle string types
                elif data_type in ['VARCHAR', 'CHAR', 'TEXT', 'TINYTEXT', 'MEDIUMTEXT', 'LONGTEXT']:
                    df[col_name] = df[col_name].astype(str).str.strip()
                    if is_nullable:
                        df[col_name] = df[col_name].replace({'nan': None, 'None': None, '': None, 'NULL': None})
                    else:
                        df[col_name] = df[col_name].replace({'nan': '', 'None': '', 'NULL': ''})
                
                # Handle boolean types
                elif data_type in ['BOOLEAN', 'BOOL', 'BIT', 'TINYINT']:
                    df[col_name] = df[col_name].apply(lambda x: 1 if str(x).lower() in ['true', '1', 'yes'] else 0 if str(x).lower() in ['false', '0', 'no', 'nan', 'none'] else None if pd.isna(x) else int(bool(x)))
            
            return df

        # After all cleaning and before chunked processing:
        # Get MySQL table columns (table existence already validated earlier)
        mysql_columns = get_mysql_table_columns(best_table, MYSQL_CONFIG)
        if not mysql_columns:
            logger.error(f"Could not retrieve columns for table '{best_table}'. Table might not exist.")
            raise HTTPException(
                status_code=500,
                detail=f"Could not retrieve columns for table '{best_table}'. Please verify the table exists in database '{MYSQL_CONFIG['database']}'."
            )
        logger.info(f"Retrieved {len(mysql_columns)} columns from table '{best_table}'")
        print(f"[DEBUG] Retrieved {len(mysql_columns)} columns from table '{best_table}'")
        print(f"[DEBUG] DataFrame BEFORE column filtering: {len(df)} rows, {len(df.columns)} columns")
        
        # Filter DataFrame to only include columns that exist in the MySQL table (excluding 'id')
        # Make MySQL column comparison case-insensitive by lowercasing both
        mysql_columns_filtered = [col for col in mysql_columns if col.lower() != 'id']
        mysql_columns_lower = [col.lower() for col in mysql_columns_filtered]
        df_columns_lower = [col.lower() for col in df.columns]
        
        # Create mapping: lowercase df column -> original MySQL column name
        mysql_column_map = {col.lower(): col for col in mysql_columns_filtered}
        
        # Find matching columns (case-insensitive)
        # Track which MySQL columns have already been matched to avoid duplicates
        matching_df_columns = []
        matching_mysql_columns = []
        matched_mysql_cols = set()  # Track lowercase MySQL column names already matched
        for df_col in df.columns:
            df_col_lower = df_col.lower()
            if df_col_lower in mysql_column_map:
                mysql_col = mysql_column_map[df_col_lower]
                mysql_col_lower = mysql_col.lower()
                # Only add if this MySQL column hasn't been matched yet
                if mysql_col_lower not in matched_mysql_cols:
                    matching_df_columns.append(df_col)
                    matching_mysql_columns.append(mysql_col)
                    matched_mysql_cols.add(mysql_col_lower)
                else:
                    logger.warning(f"Skipping duplicate match: DataFrame column '{df_col}' matches MySQL column '{mysql_col}' which was already matched")
        
        logger.info(f"Columns matching MySQL table: {len(matching_df_columns)} out of {len(df.columns)} DataFrame columns")
        print(f"[DEBUG] Columns matching MySQL table: {len(matching_df_columns)} out of {len(df.columns)} DataFrame columns")
        logger.info(f"Matching columns: {matching_df_columns[:10]}...")  # Show first 10
        if len(matching_df_columns) == 0:
            logger.error(f"No matching columns found! DataFrame columns: {df.columns.tolist()}")
            logger.error(f"MySQL columns (excluding 'id'): {mysql_columns_filtered[:20]}...")  # Show first 20
            print(f"[ERROR] No matching columns! DataFrame: {df.columns.tolist()[:10]}")
            print(f"[ERROR] MySQL columns: {mysql_columns_filtered[:20]}")
            raise HTTPException(
                status_code=400,
                detail=f"No matching columns found between DataFrame and MySQL table '{best_table}'. Check column mappings."
            )
        df = df[matching_df_columns]
        print(f"[DEBUG] DataFrame AFTER column filtering: {len(df)} rows, {len(df.columns)} columns")
        
        # CRITICAL: Check for and fix any remaining duplicate column names after filtering
        # This can happen if multiple source columns map to the same MySQL column
        if df.columns.duplicated().any():
            logger.warning(f"Found duplicate column names after filtering! Columns: {df.columns.tolist()}")
            print(f"[UPLOAD] WARNING: Duplicate columns detected after filtering: {df.columns[df.columns.duplicated()].tolist()}")
            # Rename duplicates with suffixes
            seen = {}
            new_columns = []
            for col in df.columns:
                if col in seen:
                    seen[col] += 1
                    new_col = f"{col}_{seen[col]}"
                    new_columns.append(new_col)
                    logger.warning(f"Renaming duplicate column '{col}' to '{new_col}'")
                else:
                    seen[col] = 0
                    new_columns.append(col)
            df.columns = new_columns
            logger.info(f"Columns after duplicate fix: {df.columns.tolist()[:20]}...")

        # Get table schema with data types and convert DataFrame to match
        table_schema = get_mysql_table_schema(best_table, MYSQL_CONFIG)
        if table_schema:
            logger.info(f"Converting DataFrame columns to match MySQL table schema for '{best_table}'")
            # First clean cell values
            for col in df.columns:
                # Ensure we're working with a Series, not a DataFrame (in case of duplicate column names)
                col_data = df[col]
                if isinstance(col_data, pd.DataFrame):
                    # If duplicate column names somehow still exist, take the first one
                    logger.warning(f"Column '{col}' returned DataFrame instead of Series. Taking first column.")
                    col_data = col_data.iloc[:, 0]
                    df[col] = col_data
                df[col] = df[col].apply(clean_cell_value)
            # Then convert to match schema
            df = convert_dataframe_to_match_schema(df, table_schema)
        else:
            # Fallback to original type inference if schema retrieval fails
            logger.warning(f"Could not retrieve schema for '{best_table}', using fallback type inference")
            for col in df.columns:
                # Ensure we're working with a Series, not a DataFrame (in case of duplicate column names)
                col_data = df[col]
                if isinstance(col_data, pd.DataFrame):
                    # If duplicate column names somehow still exist, take the first one
                    logger.warning(f"Column '{col}' returned DataFrame instead of Series. Taking first column.")
                    col_data = col_data.iloc[:, 0]
                    df[col] = col_data
                df[col] = df[col].apply(clean_cell_value)
                col_type = infer_column_type(df[col])
                if col_type == 'int':
                    df[col] = pd.to_numeric(df[col], errors='coerce')
                    df[col] = df[col].fillna(0).astype(int)
                elif col_type == 'float':
                    df[col] = pd.to_numeric(df[col], errors='coerce')
                    df[col] = df[col].fillna(0.0).astype(float)
                else:
                    df[col] = df[col].astype(str).str.strip()
                    df[col] = df[col].replace('nan', '-').replace('', '-')

        # Fill any remaining all-NaN columns with appropriate default
        for col in df.columns:
            if df[col].isnull().all():
                if table_schema and col in table_schema:
                    data_type = table_schema[col].get('DATA_TYPE', '').upper()
                    is_nullable = table_schema[col].get('IS_NULLABLE', 'YES') == 'YES'
                    if data_type in ['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT']:
                        df[col] = None if is_nullable else 0
                    elif data_type in ['DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL']:
                        df[col] = None if is_nullable else 0.0
                    else:
                        df[col] = None if is_nullable else '-'
                else:
                    col_type = infer_column_type(df[col])
                    if col_type == 'int':
                        df[col] = 0
                    elif col_type == 'float':
                        df[col] = 0.0
                    else:
                        df[col] = '-'
        # OPTIMIZED: Dynamic primary key detection and efficient duplicate filtering
        def get_primary_key_columns_dynamic(table_name, mysql_config):
            """Dynamically detect primary key column(s) from table schema"""
            conn = mysql.connector.connect(**mysql_config)
            cursor = conn.cursor(dictionary=True)
            db_name = mysql_config.get('database', 'devyani')
            
            pk_query = """
                SELECT COLUMN_NAME, ORDINAL_POSITION
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = %s 
                AND TABLE_NAME = %s 
                AND CONSTRAINT_NAME = 'PRIMARY'
                ORDER BY ORDINAL_POSITION
            """
            cursor.execute(pk_query, (db_name, table_name))
            pk_columns = [row['COLUMN_NAME'] for row in cursor.fetchall()]
            cursor.close()
            conn.close()
            return pk_columns

        def get_existing_keys_efficient(table_name, pk_columns, df, mysql_config, batch_size=10000):
            """
            Efficiently check for existing keys using batch IN queries instead of loading all keys.
            This is much faster for large tables.
            """
            if not pk_columns:
                return set()
            
            # For single PK column
            if len(pk_columns) == 1:
                pk_col = pk_columns[0]
                # Find matching column in DataFrame (case-insensitive)
                df_pk_col = next((c for c in df.columns if c.lower() == pk_col.lower()), None)
                if df_pk_col is None:
                    logger.warning(f"Primary key column '{pk_col}' not found in DataFrame columns")
                    return set()
                
                # Get unique values from DataFrame
                df_pk_values = df[df_pk_col].dropna().unique()
                if len(df_pk_values) == 0:
                    return set()
                
                conn = mysql.connector.connect(**mysql_config)
                cursor = conn.cursor()
                db_name = mysql_config.get('database', 'devyani')
                
                existing = set()
                # Process in batches to avoid query size limits
                for i in range(0, len(df_pk_values), batch_size):
                    batch = df_pk_values[i:i + batch_size]
                    placeholders = ','.join(['%s'] * len(batch))
                    query = f"SELECT `{pk_col}` FROM `{db_name}`.`{table_name}` WHERE `{pk_col}` IN ({placeholders})"
                    cursor.execute(query, tuple(batch))
                    existing.update(row[0] for row in cursor.fetchall())
                
                cursor.close()
                conn.close()
                return existing
            else:
                # Composite key - use temporary table approach for efficiency
                logger.info(f"Composite primary key detected: {pk_columns}. Using temporary table for duplicate check.")
                conn = mysql.connector.connect(**mysql_config)
                cursor = conn.cursor()
                db_name = mysql_config.get('database', 'devyani')
                
                # Create temporary table with composite key
                temp_table = f"temp_pk_check_{int(time.time())}"
                pk_cols_def = ','.join([f"`{col}` VARCHAR(255)" for col in pk_columns])
                pk_constraint = f"PRIMARY KEY ({','.join([f'`{col}`' for col in pk_columns])})"
                create_temp = f"CREATE TEMPORARY TABLE `{temp_table}` ({pk_cols_def}, {pk_constraint})"
                cursor.execute(create_temp)
                
                # Insert DataFrame PK values into temp table
                df_pk_cols = [next((c for c in df.columns if c.lower() == pk.lower()), None) for pk in pk_columns]
                if None in df_pk_cols:
                    missing = [pk for pk, df_col in zip(pk_columns, df_pk_cols) if df_col is None]
                    logger.warning(f"PK columns not found in DataFrame: {missing}")
                    cursor.execute(f"DROP TEMPORARY TABLE `{temp_table}`")
                    cursor.close()
                    conn.close()
                    return set()
                
                df_pk_data = df[df_pk_cols].dropna()
                if len(df_pk_data) == 0:
                    cursor.execute(f"DROP TEMPORARY TABLE `{temp_table}`")
                    cursor.close()
                    conn.close()
                    return set()
                
                # Insert in batches
                for i in range(0, len(df_pk_data), batch_size):
                    batch = df_pk_data.iloc[i:i + batch_size]
                    values = [tuple(row) for row in batch.values]
                    placeholders = ','.join(['%s'] * len(pk_columns))
                    cols_escaped = [f"`{col}`" for col in pk_columns]
                    insert_temp = f"INSERT IGNORE INTO `{temp_table}` ({','.join(cols_escaped)}) VALUES ({placeholders})"
                    cursor.executemany(insert_temp, values)
                
                # Find which keys already exist by joining with main table
                join_conditions = ' AND '.join([f"t.`{col}` = m.`{col}`" for col in pk_columns])
                existing_query = f"""
                    SELECT {','.join([f"t.`{col}`" for col in pk_columns])}
                    FROM `{temp_table}` t
                    INNER JOIN `{db_name}`.`{table_name}` m ON {join_conditions}
                """
                cursor.execute(existing_query)
                existing_tuples = set(cursor.fetchall())
                
                # Convert to DataFrame filter format
                existing = set()
                for row in existing_tuples:
                    existing.add(row[0] if len(row) == 1 else row)
                
                cursor.execute(f"DROP TEMPORARY TABLE `{temp_table}`")
                cursor.close()
                conn.close()
                return existing

        # Detect primary key dynamically
        pk_columns = get_primary_key_columns_dynamic(best_table, MYSQL_CONFIG)
        rows_before_pk_filter = len(df)
        
        if pk_columns:
            logger.info(f"[OPTIMIZED] Detected primary key columns: {pk_columns}")
            print(f"[OPTIMIZED] Detected PK: {pk_columns}")
            
            # Check which PK columns are present in DataFrame
            df_pk_cols = [next((c for c in df.columns if c.lower() == pk.lower()), None) for pk in pk_columns]
            present_pk_cols = [df_col for df_col, pk in zip(df_pk_cols, pk_columns) if df_col is not None]
            
            if present_pk_cols:
                print(f"[DEBUG] Before PK filtering: {rows_before_pk_filter} rows")
                logger.info(f"Checking for duplicate primary keys using efficient batch queries. DataFrame has {rows_before_pk_filter} rows.")
                
                # Use efficient batch duplicate checking
                existing_keys = get_existing_keys_efficient(best_table, pk_columns, df, MYSQL_CONFIG)
                logger.info(f"Found {len(existing_keys)} existing primary keys in table '{best_table}' (using efficient batch query)")
                print(f"[DEBUG] Found {len(existing_keys)} existing primary keys in table (efficient check)")
                
                # Filter duplicates
                if len(pk_columns) == 1 and present_pk_cols[0]:
                    # Single PK column
                    df = df[~df[present_pk_cols[0]].isin(existing_keys)]
                else:
                    # Composite key - filter rows where all PK columns match
                    mask = df.apply(lambda row: tuple(row[pk_col] for pk_col in present_pk_cols) not in existing_keys, axis=1)
                    df = df[mask]
                
                rows_after_pk_filter = len(df)
                duplicates_removed = rows_before_pk_filter - rows_after_pk_filter
                logger.info(f"After filtering duplicates: {rows_after_pk_filter} rows remaining ({duplicates_removed} duplicates removed)")
                print(f"[DEBUG] After PK filtering: {rows_after_pk_filter} rows remaining (removed {duplicates_removed} duplicates)")
                
                if rows_after_pk_filter == 0 and rows_before_pk_filter > 0:
                    logger.warning(f"All {rows_before_pk_filter} rows were filtered out because they already exist in the table!")
                    print(f"[WARNING] ALL {rows_before_pk_filter} ROWS WERE FILTERED OUT - They already exist in the table!")
            else:
                logger.warning(f"Primary key columns {pk_columns} not found in DataFrame columns")
                print(f"[WARNING] PK columns {pk_columns} NOT FOUND in DataFrame columns!")
        else:
            logger.warning(f"No primary key found for table '{best_table}'. Duplicate checking skipped. Using INSERT with duplicate handling may fail.")
            print(f"[WARNING] No primary key detected for table '{best_table}'")

        # Date columns are already handled by convert_dataframe_to_match_schema based on MySQL schema
        # Additional date validation: ensure date strings are properly formatted
        if table_schema:
            for col_name, col_info in table_schema.items():
                if col_name not in df.columns:
                    continue
                data_type = col_info.get('DATA_TYPE', '').upper()
                if data_type in ['DATE', 'DATETIME', 'TIMESTAMP']:
                    # Final validation pass - truncate to maximum length if needed
                    df[col_name] = df[col_name].apply(
                        lambda x: str(x)[:19] if x is not None and isinstance(x, str) and len(str(x)) > 19 
                        else (None if x is None or str(x).lower() in ['nat', 'none', 'nan', 'null', ''] else x)
                    )

        # 6.5. Handle required MySQL columns that might be missing from DataFrame
        if table_schema:
            import uuid
            required_columns = []
            for col_name, col_info in table_schema.items():
                is_nullable = col_info.get('IS_NULLABLE', 'YES') == 'YES'  # 'YES' means nullable
                is_not_null = not is_nullable  # NOT NULL means required
                has_default = col_info.get('COLUMN_DEFAULT') is not None
                extra = str(col_info.get('EXTRA', '')).upper()
                is_auto_increment = 'AUTO_INCREMENT' in extra
                
                # Column is required if: NOT NULL, no default, not auto_increment, and not 'id' (usually auto-increment)
                if is_not_null and not has_default and not is_auto_increment and col_name.lower() != 'id':
                    required_columns.append((col_name, col_info))
                    logger.info(f"Found required column: '{col_name}' (NOT NULL, no default, not auto-increment)")
                    print(f"[INFO] Required column detected: '{col_name}'")
            
            # Fill in missing required columns
            for col_name, col_info in required_columns:
                if col_name not in df.columns or df[col_name].isnull().all():
                    data_type = col_info.get('DATA_TYPE', '').upper()
                    logger.info(f"Column '{col_name}' is required but missing/NULL. Adding with default value.")
                    print(f"[INFO] Adding required column '{col_name}' with default value (type: {data_type})")
                    
                    # Generate appropriate default based on column type and name
                    if 'uid' in col_name.lower() or 'uuid' in col_name.lower() or data_type in ['VARCHAR', 'CHAR', 'TEXT']:
                        # For uid/uuid-like columns, generate UUIDs
                        df[col_name] = [str(uuid.uuid4()) for _ in range(len(df))]
                    elif data_type in ['INT', 'INTEGER', 'BIGINT', 'BIGINT', 'SMALLINT', 'TINYINT']:
                        # For integer columns, use 0 or generate sequence
                        df[col_name] = range(len(df))
                    elif data_type in ['DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE']:
                        # For decimal columns, use 0.0
                        df[col_name] = 0.0
                    elif data_type in ['DATE', 'DATETIME', 'TIMESTAMP']:
                        # For date columns, use current timestamp (datetime is already imported at top of file)
                        if 'DATETIME' in data_type or 'TIMESTAMP' in data_type:
                            default_val = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        else:  # DATE
                            default_val = datetime.now().strftime('%Y-%m-%d')
                        df[col_name] = default_val
                    else:
                        # Default: empty string or 'N/A'
                        df[col_name] = ''
                elif df[col_name].isnull().any():
                    # Column exists but has NULLs - fill them
                    null_count = df[col_name].isnull().sum()
                    logger.info(f"Column '{col_name}' has {null_count} NULL values. Filling with defaults.")
                    print(f"[INFO] Filling {null_count} NULL values in column '{col_name}'")
                    
                    data_type = col_info.get('DATA_TYPE', '').upper()
                    if 'uid' in col_name.lower() or 'uuid' in col_name.lower():
                        # For uid/uuid columns, generate unique UUIDs for each NULL (uuid is already imported)
                        df.loc[df[col_name].isnull(), col_name] = [str(uuid.uuid4()) for _ in range(null_count)]
                    elif data_type in ['VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT', 'MEDIUMTEXT', 'TINYTEXT']:
                        df[col_name] = df[col_name].fillna('')
                    elif data_type in ['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT']:
                        df[col_name] = df[col_name].fillna(0)
                    elif data_type in ['DECIMAL', 'NUMERIC', 'FLOAT', 'DOUBLE', 'REAL']:
                        df[col_name] = df[col_name].fillna(0.0)
                    elif data_type in ['DATE', 'DATETIME', 'TIMESTAMP']:
                        if 'DATETIME' in data_type or 'TIMESTAMP' in data_type:
                            default_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        else:  # DATE
                            default_date = datetime.now().strftime('%Y-%m-%d')
                        df[col_name] = df[col_name].fillna(default_date)
                    else:
                        df[col_name] = df[col_name].fillna('')
        
        # 6.6. Remove auto-increment columns (like 'id') from DataFrame before insert
        if table_schema:
            auto_increment_cols = []
            for col_name, col_info in table_schema.items():
                extra = str(col_info.get('EXTRA', '')).upper()
                if 'AUTO_INCREMENT' in extra or col_name.lower() == 'id':
                    auto_increment_cols.append(col_name)
            
            if auto_increment_cols:
                cols_to_remove = [col for col in auto_increment_cols if col in df.columns]
                if cols_to_remove:
                    logger.info(f"Removing auto-increment columns from DataFrame before insert: {cols_to_remove}")
                    print(f"[INFO] Removing auto-increment columns: {cols_to_remove}")
                    df = df.drop(columns=cols_to_remove)
        
        # 7. Initialize processor for chunked processing
        # Log DataFrame state before processing
        logger.info(f"DataFrame shape before processing: {df.shape} (rows: {len(df)}, cols: {len(df.columns)})")
        logger.info(f"DataFrame columns: {df.columns.tolist()[:10]}...")  # Show first 10 columns
        print(f"[DEBUG] ========== FINAL DATAFRAME STATE ==========")
        print(f"[DEBUG] Rows: {len(df)}, Columns: {len(df.columns)}")
        print(f"[DEBUG] Columns: {df.columns.tolist()[:15]}")
        if 'uid' in df.columns:
            print(f"[DEBUG] 'uid' column present with {df['uid'].notna().sum()} non-null values")
        else:
            print(f"[DEBUG] 'uid' column NOT PRESENT in DataFrame!")
        print(f"[DEBUG] ===========================================")
        
        processor = DataProcessor(chunk_size=chunk_size)
        processor.start_processing()
        total_rows = len(df)
        inserted_rows = 0
        insert_errors = []  # <-- Collect errors here!
        
        if total_rows == 0:
            logger.warning(f"DataFrame is empty after all processing steps. Original file had data.")
            print(f"[ERROR] DATAFRAME IS EMPTY! Total rows = 0")
        
        # Before chunked processing
        start_time = time.time()

        for start_idx in range(0, total_rows, chunk_size):
            end_idx = min(start_idx + chunk_size, total_rows)
            chunk = df.iloc[start_idx:end_idx]
            try:
                cleaned_chunk = processor.clean_chunk(chunk)
                validation_errors = processor.validate_chunk(cleaned_chunk)
                if validation_errors:
                    processor.save_failed_chunk(cleaned_chunk, start_idx, validation_errors)
                    insert_errors.append({"chunk_start": start_idx, "error": str(validation_errors)})  # <-->
                    continue
                success, error = processor.insert_chunk(cleaned_chunk, best_table, MYSQL_CONFIG)
                if not success:
                    processor.save_failed_chunk(cleaned_chunk, start_idx, [{"error": error}])
                    insert_errors.append({"chunk_start": start_idx, "error": error})  # <-->
                    print(f"Failed to insert chunk {start_idx}: {error}")  # <-->
                    continue
                inserted_rows += len(chunk)
            except Exception as e:
                logger.error(f"Error processing chunk starting at {start_idx}: {str(e)}")
                processor.save_failed_chunk(chunk, start_idx, [{"error": str(e)}])
                insert_errors.append({"chunk_start": start_idx, "error": str(e)})  # <-->
                continue
        
        # Post-insert: Copy data from source columns to target columns for orders table
        print(f"[UPLOAD] Checking if column copy needed: best_table='{best_table}', inserted_rows={inserted_rows}")
        logger.info(f"[UPLOAD] Checking if column copy needed: best_table='{best_table}', inserted_rows={inserted_rows}")
        
        if best_table.lower() == "orders" and inserted_rows > 0:
            print("[UPLOAD] Post-insert: Copying data from source columns to target columns")
            logger.info("[UPLOAD] Post-insert: Copying data from source columns to target columns")
            try:
                copy_column_data_for_orders(best_table, MYSQL_CONFIG)
                print("[UPLOAD] Post-insert column copying completed successfully")
                logger.info("[UPLOAD] Post-insert column copying completed successfully")
            except Exception as e:
                logger.error(f"[UPLOAD] Error during post-insert column copying: {str(e)}", exc_info=True)
                print(f"[UPLOAD] ERROR: Post-insert column copying failed: {str(e)}")
                import traceback
                print(f"[UPLOAD] Traceback: {traceback.format_exc()}")
        else:
            print(f"[UPLOAD] Column copy skipped: best_table='{best_table}' (expected 'orders'), inserted_rows={inserted_rows}")
            logger.info(f"[UPLOAD] Column copy skipped: best_table='{best_table}' (expected 'orders'), inserted_rows={inserted_rows}")
        
        processor.end_processing()
        end_time = time.time()
        processing_duration_seconds = end_time - start_time

        # After processing
        stats = processor.get_processing_stats()
        total_rows_processed = inserted_rows  # or stats.get("total_rows_processed", inserted_rows)

        return {
            "message": "Headers analyzed, columns mapped, cleaned, and data inserted into MySQL.",
            "table_name": best_table,
            "table_scores": table_scores,
            "mapped": mapping,
            "unmapped": unmapped,
            "canonical_options": canonical_options,
            "total_rows": total_rows,
            "inserted_rows": inserted_rows,
            "processing_results": {
                "total_rows_processed": total_rows_processed,
                "failed_chunks": stats.get("failed_chunks", []),
                "processing_duration_seconds": processing_duration_seconds
            },
            "insert_errors": insert_errors
        }
    except HTTPException as e:
        print(f"[UPLOAD] HTTPException raised: {e.status_code} - {e.detail}")
        logger.error(f"[UPLOAD] HTTPException raised: {e.status_code} - {e.detail}")
        raise e
    except Exception as e:
        print(f"[UPLOAD] ========== UNEXPECTED ERROR ==========")
        print(f"[UPLOAD] Error type: {type(e).__name__}")
        print(f"[UPLOAD] Error message: {str(e)}")
        logger.error(f"[UPLOAD] Vector match failed: {str(e)}")
        import traceback
        traceback_str = traceback.format_exc()
        print(f"[UPLOAD] Traceback:\n{traceback_str}")
        logger.error(f"[UPLOAD] Traceback: {traceback_str}")
        print("=" * 80)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


from fastapi import Body


@app.post("/api/column-alias")
async def add_column_alias(
    excel_column: str = Body(...),
    canonical_column: str = Body(...),
    table_name: str = Body(...),
    file_id: int = Body(None),
    filename: str = Body(None)
):
    """
    Add a user-defined alias for a canonical column in a specific table. Optionally resume processing for a file.
    """
    try:
        if not excel_column or not canonical_column or not table_name:
            raise HTTPException(status_code=400, detail="excel_column, canonical_column, and table_name are required.")
        # Add alias in the correct canonical set
        collection = get_collection("column_vectors")
        result = collection.update_one(
            {"column_name": canonical_column, "table_name": table_name},
            {"$addToSet": {"user_defined_aliases": excel_column.lower()}}
        )
        if result.modified_count == 0:
            raise Exception("No canonical column found or alias already exists.")
        # Optionally resume processing for a file
        resumed = False
        if file_id is not None or filename is not None:
            try:
                from app.core.scheduler import FileProcessingScheduler
                scheduler = FileProcessingScheduler()
                scheduler.process_pending_files()
                resumed = True
            except ImportError as e:
                logger.warning(f"Scheduler not available: {str(e)}. File processing resumption skipped.")
                resumed = False
        return {
            "message": "Alias added successfully.",
            "canonical_column": canonical_column,
            "excel_column": excel_column,
            "table_name": table_name,
            "resumed_processing": resumed
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Failed to add alias: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/admin/canonical-sets")
async def list_canonical_sets():
    """
    List all canonical sets (table names and their canonical columns) in the vector database.
    """
    try:
        collection = get_collection("column_vectors")
        docs = list(collection.find({}))
        table_to_columns = {}
        for doc in docs:
            table = doc.get('table_name', 'default')
            col = doc['column_name']
            if table not in table_to_columns:
                table_to_columns[table] = []
            table_to_columns[table].append(col)
        return {"canonical_sets": table_to_columns}
    except Exception as e:
        logger.error(f"Failed to list canonical sets: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.get("/astra-db-health")
async def astra_db_health():
    try:
        collection = get_collection("column_vectors")
        count = collection.count_documents({})
        return JSONResponse(content={"astra_db_status": "up", "details": f"Collection count: {count}"})
    except Exception as e:
        return JSONResponse(content={"astra_db_status": "down", "error": str(e)}, status_code=500)


@app.post("/analyze-columns")
async def analyze_columns(
    file: UploadFile = File(...),
    datasource: str = Query(None),
    save_mappings: bool = Query(False),
    client: str = Query(None)
):
    """
    Analyze Excel file columns and return mappings to system-understood columns.
    Uses vector similarity matching to find the best matches.
    
    Args:
        file: Excel file to analyze
        datasource: Data source identifier (e.g., ZOMATO, SWIGGY)
        save_mappings: If True, saves mappings to column_mappings table
    
    Returns:
        JSON with Excel columns and their matched system columns
    """
    logger.info(f"[ANALYZE] Starting column analysis for file: {file.filename}, datasource: {datasource}")
    
    try:
        # Validate file
        if not file or not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")
        
        if not file.filename.endswith(('.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="Only Excel files (.xlsx, .xls) are supported")
        
        # Save file temporarily
        temp_file_path = f"temp_{file.filename}"
        with open(temp_file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        try:
            # Read Excel file to get headers
            df = pd.read_excel(temp_file_path)
            excel_headers = [str(col).strip() for col in df.columns.tolist() if pd.notna(col)]
            
            if not excel_headers:
                raise HTTPException(status_code=400, detail="No columns found in Excel file")
            
            logger.info(f"[ANALYZE] Found {len(excel_headers)} columns in Excel file: {excel_headers}")
            
            # Determine table name from datasource
            best_table = None
            if datasource:
                datasource_clean = datasource.strip()
                datasource_lower = datasource_clean.lower()
                
                # Check exact match first
                if datasource_clean in DATASOURCE_TO_TABLE_MAPPING:
                    best_table = DATASOURCE_TO_TABLE_MAPPING[datasource_clean]
                    logger.info(f"[ANALYZE] Using exact mapping: {datasource_clean} -> {best_table}")
                elif datasource_lower in DATASOURCE_TO_TABLE_MAPPING:
                    best_table = DATASOURCE_TO_TABLE_MAPPING[datasource_lower]
                    logger.info(f"[ANALYZE] Using lowercase mapping: {datasource_lower} -> {best_table}")
                else:
                    # Try common patterns
                    if "pos" in datasource_lower and "order" in datasource_lower:
                        best_table = "orders"
                        logger.info(f"[ANALYZE] Detected POS orders pattern, using table: {best_table}")
                    elif datasource_lower in ["zomato", "swiggy", "ubereats"]:
                        best_table = datasource_lower
                        logger.info(f"[ANALYZE] Using datasource as table name: {best_table}")
                    else:
                        best_table = datasource_lower
                        logger.info(f"[ANALYZE] Using datasource (lowercase) as table: {best_table}")
            else:
                # Auto-detect table
                from app.config.header_vector_matcher import detect_best_table_for_headers
                # Use client-based config or default to devyani
                mysql_config = get_mysql_config(client)
                best_table, table_scores = detect_best_table_for_headers(excel_headers, database_name=mysql_config.get('database'))
                logger.info(f"[ANALYZE] Auto-detected table: {best_table} (scores: {table_scores})")
            
            logger.info(f"[ANALYZE] Final target table for filtering: {best_table}")
            
            # Get column mappings using vector matching
            from app.config.header_vector_matcher import map_excel_headers_to_canonical_with_suggestions_by_table
            # Use client-based config or default to devyani
            mysql_config = get_mysql_config(client)
            mapping, unmapped, canonical_options = map_excel_headers_to_canonical_with_suggestions_by_table(
                excel_headers, best_table, database_name=mysql_config.get('database')
            )
            
            # Build response with detailed mapping information
            column_mappings = []
            for excel_col in excel_headers:
                system_col = mapping.get(excel_col)
                is_mapped = excel_col in mapping
                
                column_mappings.append({
                    "excel_column": excel_col,
                    "system_column": system_col if system_col else None,
                    "is_mapped": is_mapped,
                    "status": "mapped" if is_mapped else "unmapped"
                })
            
            # Save mappings to database if requested
            saved_count = 0
            if save_mappings and datasource:
                try:
                    # Use client-based config or default to devyani
                    mysql_config = get_mysql_config(client)
                    conn = mysql.connector.connect(**mysql_config)
                    cursor = conn.cursor()
                    db_name = mysql_config.get('database', 'devyani')
                    
                    # Check if table exists, create if not
                    cursor.execute(f"""
                        SELECT COUNT(*) FROM information_schema.tables 
                        WHERE table_schema = '{db_name}' AND table_name = 'column_mappings'
                    """)
                    table_exists = cursor.fetchone()[0] > 0
                    
                    if not table_exists:
                        logger.warning("[ANALYZE] column_mappings table does not exist. Run migration first.")
                    else:
                        # Generate vectors for Excel columns
                        model = SentenceTransformer('all-MiniLM-L6-v2')
                        excel_vectors = model.encode(excel_headers)
                        
                        # Insert mappings
                        insert_query = """
                            INSERT INTO `column_mappings` 
                            (normalized_column_name, excel_column_name, vector, tender, table_name, match_method)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            ON DUPLICATE KEY UPDATE
                                vector = VALUES(vector),
                                match_method = VALUES(match_method),
                                updated_at = CURRENT_TIMESTAMP
                        """
                        
                        for i, excel_col in enumerate(excel_headers):
                            system_col = mapping.get(excel_col)
                            if system_col:
                                vector_json = json.dumps(excel_vectors[i].tolist())
                                match_method = "vector"  # Could be enhanced to track alias/synonym matches
                                cursor.execute(insert_query, (
                                    system_col,
                                    excel_col,
                                    vector_json,
                                    datasource,
                                    best_table,
                                    match_method
                                ))
                                saved_count += 1
                        
                        conn.commit()
                        cursor.close()
                        conn.close()
                        logger.info(f"[ANALYZE] Saved {saved_count} mappings to column_mappings table")
                
                except Exception as save_error:
                    logger.error(f"[ANALYZE] Failed to save mappings: {str(save_error)}", exc_info=True)
                    # Don't fail the request if saving fails
            
            response = {
                "status": 200,
                "message": "Column analysis completed",
                "data": {
                    "table_name": best_table,
                    "datasource": datasource,
                    "total_excel_columns": len(excel_headers),
                    "mapped_count": len(mapping),
                    "unmapped_count": len(unmapped),
                    "column_mappings": column_mappings,
                    "mappings": mapping,  # Simple dict format
                    "unmapped": unmapped,
                    "canonical_options": canonical_options,
                    "saved_to_db": saved_count if save_mappings else 0
                }
            }
            
            logger.info(f"[ANALYZE] Analysis complete: {len(mapping)} mapped, {len(unmapped)} unmapped")
            return response
        
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_file_path)
            except:
                pass
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[ANALYZE] Error analyzing columns: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error analyzing columns: {str(e)}")


@app.get("/debug/canonical-columns")
async def debug_canonical_columns(headers: List[str] = None):
    """
    Debug endpoint to show canonical columns, matched/unmatched columns, table name, table score, and canonical options.
    Optionally accepts ?headers=col1&headers=col2... as query params.
    """
    import logging
    logger = logging.getLogger("debug.canonical-columns")
    logger.info("Starting /debug/canonical-columns endpoint")

    from app.config.header_vector_matcher import (
        detect_best_table_for_headers, get_canonical_data_by_table,
        map_excel_headers_to_canonical_with_suggestions_by_table)

    try:
        # If no headers provided, just show canonical sets
        if not headers:
            collection = get_collection("column_vectors")
            docs = list(collection.find({}))
            table_to_columns = {}
            for doc in docs:
                table = doc.get('table_name', 'default')
                col = doc['column_name']
                if table not in table_to_columns:
                    table_to_columns[table] = []
                table_to_columns[table].append(col)
            response = {"tables": list(table_to_columns.keys()), "columns": table_to_columns}
            logger.info(f"Response: {response}")
            return response

        # If headers provided, show mapping details
        # Note: debug endpoint doesn't filter by database, shows all available vectors
        best_table, table_scores = detect_best_table_for_headers(headers, database_name=None)
        mapping, unmapped, canonical_options = map_excel_headers_to_canonical_with_suggestions_by_table(headers, best_table, database_name=None)
        matched = {k: v for k, v in mapping.items() if v is not None}

        response = {
            "table_name": best_table,
            "table_score": table_scores.get(best_table, None),
            "matched": matched,
            "unmatched": unmapped,
            "canonical_options": canonical_options,
        }
        logger.info(f"Response: {response}")
        return response

    except Exception as e:
        logger.error(f"Exception in /debug/canonical-columns: {str(e)}", exc_info=True)
        return {"error": str(e)}






model = SentenceTransformer('all-MiniLM-L6-v2')

def map_excel_headers_to_canonical(excel_headers):
    """
    Maps Excel headers to canonical database columns using vector similarity.
    Args:
        excel_headers (list of str): The headers from the Excel file.
    Returns:
        dict: Mapping from Excel header to canonical column name.
    """
    collection = get_collection("column_vectors")
    canonical_docs = list(collection.find({}))
    canonical_columns = [doc['column_name'] for doc in canonical_docs]
    canonical_vectors = np.array([doc['vector'] for doc in canonical_docs])

    excel_vectors = model.encode(excel_headers)

    mapping = {}
    for i, vec in enumerate(excel_vectors):
        sims = cosine_similarity([vec], canonical_vectors)[0]
        best_idx = np.argmax(sims)
        mapping[excel_headers[i]] = canonical_columns[best_idx]
    return mapping



@app.get("/diagnose-upload-api")
def diagnose_upload_api():
    """
    Diagnostic endpoint for your upload/vector-match-excel API.
    Checks MySQL connection, lists all tables, reports their schema,
    and returns common advice on known issues.
    """
    diagnostics = {}

    # Check MySQL connection (using default devyani for diagnostics)
    try:
        default_config = get_mysql_config("devyani")
        conn = mysql.connector.connect(**default_config)
        diagnostics["mysql_connection"] = "SUCCESS"
    except Error as e:
        diagnostics["mysql_connection"] = f"FAILED: {str(e)}"
        raise HTTPException(status_code=500, detail=diagnostics)

    try:
        cursor = conn.cursor()
        # Fetch all tables in the database
        db_name = default_config.get('database', 'devyani')
        cursor.execute("SHOW TABLES")
        tables_result = cursor.fetchall()
        # tables_result is list of tuples: [(tablename1,), (tablename2,), ...]
        table_names = [t[0] for t in tables_result]
        diagnostics["tables_in_database"] = table_names
        diagnostics["database_name"] = db_name

        # For each table, get its schema columns
        tables_schema = {}
        for table in table_names:
            try:
                cursor.execute(f"DESCRIBE {table}")
                columns = cursor.fetchall()
                # Each column is a tuple: (Field, Type, Null, Key, Default, Extra)
                tables_schema[table] = [col[0] for col in columns]
            except Error as e:
                tables_schema[table] = f"Error retrieving schema: {str(e)}"

        diagnostics["tables_schema"] = tables_schema

    except Error as e:
        diagnostics["db_query_error"] = f"Error during querying tables or schema: {str(e)}"
        raise HTTPException(status_code=500, detail=diagnostics)
    finally:
        cursor.close()
        conn.close()

    # Add generic advice (customize as needed)
    diagnostics["common_issues"] = [
        "Ensure DataFrame columns after mapping exactly match these table columns above.",
        "Check that your MySQL connection credentials point to the correct database.",
        "Validate data types in your DataFrame to match the MySQL table schema.",
        "Log and review error messages from db_handler.insert_chunk to identify insertion issues.",
    ]

    diagnostics["summary"] = "Run your upload POST and check 'insert_errors' for detailed insert failure messages."

    return diagnostics

def clean_cell_value(val):
    """
    Cleans a single cell value by removing currency symbols, commas, parentheses, etc.
    """
    if pd.isnull(val):
        return 0
    val = str(val)
    val = val.replace('$', '').replace(',', '').replace('(', '').replace(')', '').strip()
    if val == '' or val == '-':
        return 0
    return val

def infer_column_type(series):
    """
    Infers if a pandas Series is numeric (int/float) or string.
    Returns 'int', 'float', or 'string'.
    """
    # Clean the series first
    cleaned = series.apply(clean_cell_value)
    # Try converting to numeric
    numeric = pd.to_numeric(cleaned, errors='coerce')
    if numeric.notnull().all():
        # If all values are numeric, check if any are floats
        if (numeric % 1 != 0).any():
            return 'float'
        else:
            return 'int'
    return 'string'

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000)