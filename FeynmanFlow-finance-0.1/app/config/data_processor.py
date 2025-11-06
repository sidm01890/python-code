import logging
from datetime import datetime

import mysql.connector
import pandas as pd

# Setup basic logging config at the top-level (do this once in your main/app entrypoint ideally)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s"
)
logger = logging.getLogger("DataProcessor")

class DataProcessor:
    def __init__(self, chunk_size=1000, required_columns=None):
        self.chunk_size = chunk_size
        self.failed_chunks = []
        self.stats = {"total_rows_processed": 0, "failed_chunks": [], "processing_duration_seconds": None}
        self.required_columns = required_columns or []
        # Cache for table schemas to avoid repeated queries
        self._schema_cache = {}
        self._pk_cache = {}

        logger.info("DataProcessor initialized with chunk_size=%d", chunk_size)

    def start_processing(self):
        self.stats["start_time"] = datetime.now()
        logger.info("Started processing at %s", self.stats["start_time"])

    def clean_chunk(self, chunk):
        logger.debug("Cleaning chunk with %d rows", len(chunk))
        # Optionally add extra cleaning here
        return chunk

    def validate_chunk(self, chunk):
        errors = []
        for idx, row in chunk.iterrows():
            row_errors = []
            for col in self.required_columns:
                if col not in chunk.columns or pd.isnull(row[col]):
                    row_errors.append(f"{col} is required")
            if row_errors:
                errors.append({"row_index": idx, "errors": row_errors, "data": row.to_dict()})
        return errors

    def save_failed_chunk(self, chunk, start_idx, errors):
        logger.warning(
            "Failed to process chunk starting at row %d, %d rows failed. Errors: %s",
            start_idx, len(chunk), errors
        )
        self.failed_chunks.append({"start_idx": start_idx, "errors": errors})

    def end_processing(self):
        elapsed = (datetime.now() - self.stats.get("start_time", datetime.now())).total_seconds()
        self.stats["processing_duration_seconds"] = elapsed
        logger.info("Finished processing in %.2f seconds", elapsed)

    def get_processing_stats(self):
        self.stats["failed_chunks"] = self.failed_chunks
        logger.info("Returning processing stats: %s", self.stats)
        return self.stats

    def get_table_schema(self, table_name, mysql_config):
        """
        Get table schema with caching to avoid repeated queries.
        Returns cached schema if available, otherwise fetches and caches it.
        """
        cache_key = f"{mysql_config.get('database', 'devyani')}.{table_name}"
        if cache_key in self._schema_cache:
            logger.debug(f"[SCHEMA_CACHE] Using cached schema for '{table_name}'")
            return self._schema_cache[cache_key]
        
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor(dictionary=True)
        db_name = mysql_config.get('database', 'devyani')
        
        schema_query = """
            SELECT COLUMN_NAME, DATA_TYPE, EXTRA, COLUMN_KEY, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION
        """
        cursor.execute(schema_query, (db_name, table_name))
        table_columns = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Cache the schema
        self._schema_cache[cache_key] = table_columns
        logger.info(f"[SCHEMA_CACHE] Fetched and cached schema for '{table_name}' ({len(table_columns)} columns)")
        return table_columns

    def get_primary_key_columns(self, table_name, mysql_config):
        """
        Get primary key column(s) for a table with caching.
        Returns list of PK column names (supports composite keys).
        """
        cache_key = f"{mysql_config.get('database', 'devyani')}.{table_name}"
        if cache_key in self._pk_cache:
            logger.debug(f"[PK_CACHE] Using cached PK for '{table_name}'")
            return self._pk_cache[cache_key]
        
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
        
        # Cache the PK columns
        self._pk_cache[cache_key] = pk_columns
        if pk_columns:
            logger.info(f"[PK_CACHE] Detected PK for '{table_name}': {pk_columns}")
        else:
            logger.warning(f"[PK_CACHE] No primary key found for '{table_name}'")
        return pk_columns

    def insert_chunk(self, chunk, table_name, mysql_config, use_duplicate_handling=True):
        """
        Insert a chunk of data into the specified MySQL table.
        Excludes AUTO_INCREMENT columns from the INSERT statement.
        Uses ON DUPLICATE KEY UPDATE to skip duplicates efficiently.
        Returns (success: bool, error: str or None)
        """
        try:
            conn = mysql.connector.connect(**mysql_config)
            cursor = conn.cursor(dictionary=True)
            db_name = mysql_config.get('database', 'devyani')
            
            # Get table schema from cache
            table_columns = self.get_table_schema(table_name, mysql_config)
            
            # Get DataFrame columns early for comparison
            original_cols = list(chunk.columns)
            print(f"[INSERT] DataFrame columns: {original_cols}")
            logger.info(f"[INSERT] DataFrame columns: {original_cols}")
            
            # Identify columns to exclude:
            # 1. AUTO_INCREMENT columns (MySQL will auto-generate)
            # 2. NOT NULL columns without defaults that aren't in our data (typically primary keys)
            auto_increment_cols = set()
            not_null_no_default_cols = set()
            
            print(f"[INSERT] Table schema retrieved: {len(table_columns)} columns")
            logger.info(f"[INSERT] Table schema retrieved: {len(table_columns)} columns")
            
            for col_info in table_columns:
                col_name = col_info['COLUMN_NAME']
                data_type = col_info.get('DATA_TYPE', '').upper()
                extra = col_info.get('EXTRA', '').upper()
                is_nullable = col_info.get('IS_NULLABLE', 'YES').upper()
                col_default = col_info.get('COLUMN_DEFAULT')
                col_key = col_info.get('COLUMN_KEY', '')
                
                print(f"[INSERT] Column '{col_name}': DATA_TYPE='{data_type}', EXTRA='{extra}', IS_NULLABLE='{is_nullable}', DEFAULT={col_default}, KEY='{col_key}'")
                logger.debug(f"[INSERT] Column '{col_name}': DATA_TYPE='{data_type}', EXTRA='{extra}', IS_NULLABLE='{is_nullable}', DEFAULT={col_default}, KEY='{col_key}'")
                
                # Check for AUTO_INCREMENT
                if 'AUTO_INCREMENT' in extra:
                    auto_increment_cols.add(col_name.lower())
                    print(f"[INSERT] ✓ Found AUTO_INCREMENT column: {col_name} (will be excluded)")
                    logger.info(f"[INSERT] Found AUTO_INCREMENT column: {col_name}")
                
                # Check for NOT NULL without default (and not AUTO_INCREMENT)
                # PRIMARY KEY columns that are NOT AUTO_INCREMENT need special handling
                # If they're not in our data, we must exclude them or MySQL will complain
                if is_nullable == 'NO' and col_default is None and 'AUTO_INCREMENT' not in extra:
                    # Only exclude if the column is not in our DataFrame
                    # If it IS in our DataFrame, we'll try to insert it
                    col_in_data = col_name.lower() in [c.lower() for c in original_cols]
                    if not col_in_data:
                        not_null_no_default_cols.add(col_name.lower())
                        print(f"[INSERT] ⚠ Found NOT NULL column '{col_name}' without default (not in data, will exclude from INSERT)")
                        logger.warning(f"[INSERT] Found NOT NULL column '{col_name}' without default (not in data, will exclude from INSERT)")
            
            # Combine all columns to exclude
            cols_to_exclude = auto_increment_cols | not_null_no_default_cols
            
            # Filter out excluded columns from chunk
            cols_to_insert = [col for col in original_cols if col.lower() not in cols_to_exclude]
            
            # CRITICAL: Check if table has required columns (NOT NULL, no default, not AUTO_INCREMENT) 
            # that we're missing. These WILL cause insert failures.
            required_missing_cols = []
            for col_info in table_columns:
                col_name = col_info['COLUMN_NAME']
                extra = col_info.get('EXTRA', '').upper()
                is_nullable = col_info.get('IS_NULLABLE', 'YES').upper()
                col_default = col_info.get('COLUMN_DEFAULT')
                col_in_data = col_name.lower() in [c.lower() for c in original_cols]
                col_will_insert = col_name.lower() in [c.lower() for c in cols_to_insert]
                
                # If column is NOT NULL, no default, not AUTO_INCREMENT, and we're not inserting it
                if (is_nullable == 'NO' and col_default is None and 
                    'AUTO_INCREMENT' not in extra and not col_will_insert):
                    required_missing_cols.append({
                        'column': col_name,
                        'reason': 'NOT NULL without default, not in data'
                    })
            
            # Auto-generate values for required missing columns if they're PRIMARY KEY VARCHAR columns
            # This handles cases where id fields are required but not in the uploaded data
            generated_cols = []
            for col_info in required_missing_cols:
                col_name = col_info['column']
                # Check if it's a VARCHAR PRIMARY KEY (likely an ID field we can auto-generate)
                for table_col in table_columns:
                    if table_col['COLUMN_NAME'].lower() == col_name.lower():
                        data_type = table_col.get('DATA_TYPE', '').upper()
                        col_key = table_col.get('COLUMN_KEY', '')
                        print(f"[INSERT] Checking '{col_name}' for auto-generation: DATA_TYPE='{data_type}', COLUMN_KEY='{col_key}'")
                        logger.debug(f"[INSERT] Checking '{col_name}' for auto-generation: DATA_TYPE='{data_type}', COLUMN_KEY='{col_key}'")
                        if (data_type in ['VARCHAR', 'CHAR', 'TEXT'] and 
                            col_key == 'PRI' and 
                            col_name.lower() not in [c.lower() for c in original_cols]):
                            generated_cols.append(col_name)
                            print(f"[INSERT] ✓ Will auto-generate unique '{col_name}' values (UUID) for {len(chunk)} rows")
                            logger.info(f"[INSERT] Will auto-generate unique '{col_name}' values (UUID) for {len(chunk)} rows")
                            break
                        else:
                            print(f"[INSERT] ✗ Cannot auto-generate '{col_name}': DATA_TYPE='{data_type}' (not VARCHAR/CHAR/TEXT) or COLUMN_KEY='{col_key}' (not PRI)")
                            logger.debug(f"[INSERT] Cannot auto-generate '{col_name}': DATA_TYPE='{data_type}', COLUMN_KEY='{col_key}'")
                        break  # Found the column, exit inner loop
            
            # Add generated columns to the chunk with unique values per row
            if generated_cols:
                import uuid
                # Make a copy to avoid SettingWithCopyWarning
                chunk = chunk.copy()
                for col_name in generated_cols:
                    # Generate unique UUID for each row
                    chunk[col_name] = [str(uuid.uuid4()) for _ in range(len(chunk))]
                    print(f"[INSERT] Added generated column '{col_name}' to DataFrame with {len(chunk)} unique UUIDs")
                    logger.info(f"[INSERT] Added generated column '{col_name}' to DataFrame with {len(chunk)} unique UUIDs")
                
                # Remove generated columns from cols_to_exclude since we're now providing values
                cols_to_exclude = cols_to_exclude - {col.lower() for col in generated_cols}
                print(f"[INSERT] Removed generated columns from exclusion list: {generated_cols}")
                logger.info(f"[INSERT] Removed generated columns from exclusion list: {generated_cols}")
                
                # Update original_cols and cols_to_insert AFTER removing from cols_to_exclude
                original_cols = list(chunk.columns)
                cols_to_insert = [col for col in original_cols if col.lower() not in cols_to_exclude]
            
            # Check again after generating columns
            if required_missing_cols:
                # Filter out columns we've generated
                still_missing = [
                    c for c in required_missing_cols 
                    if c['column'].lower() not in [col.lower() for col in generated_cols]
                ]
                
                if still_missing:
                    missing_col_names = [c['column'] for c in still_missing]
                    error_msg = (
                        f"Table '{table_name}' requires columns that are not in the data and have no default: {missing_col_names}. "
                        f"These columns are NOT NULL and cannot be omitted. "
                        f"Please ensure these columns are included in your data file or modify the table schema."
                    )
                    print(f"[INSERT] ERROR: {error_msg}")
                    logger.error(f"[INSERT] {error_msg}")
                    print(f"[INSERT] Table requires: {missing_col_names}")
                    print(f"[INSERT] DataFrame has: {original_cols}")
                    logger.error(f"[INSERT] Table requires: {missing_col_names}")
                    logger.error(f"[INSERT] DataFrame has: {original_cols}")
                    conn.close()
                    return False, error_msg
                else:
                    print(f"[INSERT] ✓ All required columns have been handled (auto-generated where applicable)")
                    logger.info(f"[INSERT] All required columns have been handled (auto-generated where applicable)")
            
            # Also exclude any table columns that are NOT NULL without defaults and not in our data
            # This handles the case where the table requires a column we don't have in the DataFrame
            for col_lower in cols_to_exclude:
                if col_lower not in [c.lower() for c in original_cols]:
                    print(f"[INSERT] Column '{col_lower}' exists in table but not in DataFrame data (will be excluded from INSERT)")
                    logger.info(f"[INSERT] Column '{col_lower}' exists in table but not in DataFrame data")
            
            if len(cols_to_insert) == 0:
                error_msg = f"No columns to insert. All columns are excluded: {cols_to_exclude}"
                print(f"[INSERT] ERROR: {error_msg}")
                logger.error(f"[INSERT] {error_msg}")
                conn.close()
                return False, error_msg
            
            excluded_cols = set(original_cols) - set(cols_to_insert)
            if excluded_cols:
                print(f"[INSERT] Excluding columns from insert: {excluded_cols}")
                logger.info(f"[INSERT] Excluding columns from insert: {excluded_cols}")
            
            print(f"[INSERT] Columns to insert ({len(cols_to_insert)}): {cols_to_insert}")
            logger.info(f"[INSERT] Columns to insert ({len(cols_to_insert)}): {cols_to_insert}")
            
            # Create filtered chunk
            chunk_filtered = chunk[cols_to_insert]
            values = [tuple(row) for row in chunk_filtered.values]
            placeholders = ','.join(['%s'] * len(cols_to_insert))
            
            # Use backticks for proper escaping
            cols_escaped = [f"`{col}`" for col in cols_to_insert]
            
            # Check if we should use duplicate handling
            pk_columns = self.get_primary_key_columns(table_name, mysql_config)
            has_pk_in_insert = any(pk_col.lower() in [c.lower() for c in cols_to_insert] for pk_col in pk_columns)
            
            if use_duplicate_handling and has_pk_in_insert and pk_columns:
                # Use INSERT ... ON DUPLICATE KEY UPDATE to skip duplicates efficiently
                # This is much faster than checking duplicates before insert
                pk_col_in_insert = [pk for pk in pk_columns if pk.lower() in [c.lower() for c in cols_to_insert]][0]
                # Find the exact column name from cols_to_insert that matches the PK (case-insensitive)
                exact_pk_col = next((c for c in cols_to_insert if c.lower() == pk_col_in_insert.lower()), pk_col_in_insert)
                
                # Create UPDATE clause that does nothing (id = id) to skip duplicates
                update_clause = f"`{exact_pk_col}` = `{exact_pk_col}`"
                sql = f"INSERT INTO `{db_name}`.`{table_name}` ({','.join(cols_escaped)}) VALUES ({placeholders}) ON DUPLICATE KEY UPDATE {update_clause}"
                logger.info(f"[INSERT] Using ON DUPLICATE KEY UPDATE (PK: {exact_pk_col}) to skip duplicates efficiently")
            else:
                # Standard INSERT without duplicate handling
                sql = f"INSERT INTO `{db_name}`.`{table_name}` ({','.join(cols_escaped)}) VALUES ({placeholders})"
                if not has_pk_in_insert:
                    logger.warning(f"[INSERT] No PK in insert columns, using standard INSERT (duplicates may cause errors)")
            
            print(f"[INSERT] Executing INSERT with {len(cols_to_insert)} columns: {cols_to_insert[:5]}...")
            logger.info(f"[INSERT] Executing INSERT: {sql[:200]}...")
            logger.debug(f"[INSERT] Full SQL: {sql}")
            
            cursor = conn.cursor()
            cursor.executemany(sql, values)
            conn.commit()
            cursor.close()
            conn.close()
            
            print(f"[INSERT] ✓ Successfully inserted {len(chunk)} rows into `{db_name}`.`{table_name}`")
            logger.info(f"[INSERT] Successfully inserted {len(chunk)} rows into `{db_name}`.`{table_name}`")
            return True, None
        except Exception as e:
            print(f"[INSERT] ERROR: Failed to insert chunk: {str(e)}")
            logger.error(f"[INSERT] Failed to insert chunk into `{mysql_config.get('database', 'devyani')}`.`{table_name}`: {str(e)}")
            import traceback
            logger.error(f"[INSERT] Traceback: {traceback.format_exc()}")
            if conn:
                try:
                    conn.close()
                except:
                    pass
            return False, str(e)

    @staticmethod
    def create_table_if_not_exists(table_name, columns, mysql_config):
        """
        Create a table with the given columns if it does not exist.
        columns: list of column definitions as strings, e.g. ["id INT PRIMARY KEY", ...]
        """
        conn = None
        cursor = None
        try:
            conn = mysql.connector.connect(**mysql_config)
            cursor = conn.cursor()
            columns_sql = ",\n    ".join(columns)
            create_query = f"""
            CREATE TABLE IF NOT EXISTS {table_name} (
                {columns_sql}
            )
            """
            cursor.execute(create_query)
            conn.commit()
            return True, None
        except Exception as e:
            if conn:
                conn.rollback()
            return False, str(e)
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
