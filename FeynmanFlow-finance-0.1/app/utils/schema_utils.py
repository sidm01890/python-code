import pandas as pd
from sqlalchemy import Column, Integer, BigInteger, Float, Boolean, DateTime, String, Text
from typing import Dict, List, Any, Optional, Union, Tuple
import numpy as np

# Maximum length for VARCHAR fields
MAX_VARCHAR_LENGTH = 255

def infer_sql_type(series: pd.Series) -> Column:
    """
    Infer the most appropriate SQLAlchemy column type for a pandas Series.
    
    Args:
        series: Pandas Series containing the data to analyze
        
    Returns:
        SQLAlchemy Column type
    """
    # Handle empty series
    if series.empty:
        return String(MAX_VARCHAR_LENGTH)
    
    # Convert to pandas nullable types for better type inference
    series = series.convert_dtypes()
    
    # Check for float types
    if pd.api.types.is_float_dtype(series):
        # Check if it's actually an integer stored as float
        if series.dropna().apply(lambda x: x.is_integer() if pd.notnull(x) else False).all():
            max_val = series.max(skipna=True)
            min_val = series.min(skipna=True)
            if pd.notna(max_val) and pd.notna(min_val):
                return BigInteger() if max_val > 2_147_483_647 or min_val < -2_147_483_648 else Integer()
        return Float()
    
    # Check for integer types
    elif pd.api.types.is_integer_dtype(series):
        max_val = series.max(skipna=True)
        min_val = series.min(skipna=True)
        if pd.notna(max_val) and pd.notna(min_val):
            return BigInteger() if max_val > 2_147_483_647 or min_val < -2_147_483_648 else Integer()
        return Integer()
    
    # Check for boolean types
    elif pd.api.types.is_bool_dtype(series):
        return Boolean()
    
    # Check for datetime types
    elif pd.api.types.is_datetime64_any_dtype(series):
        return DateTime()
    
    # Handle string types
    elif pd.api.types.is_string_dtype(series):
        # Remove NA values and convert to string
        sample = series.dropna().astype(str).str.strip()
        
        # Check if it's actually a numeric string
        if not sample.empty and sample.str.fullmatch(r'\d+').all():
            try:
                numeric_col = pd.to_numeric(sample, errors='coerce')
                if not numeric_col.isna().any():
                    max_val = numeric_col.max()
                    if max_val > 2_147_483_647:
                        return BigInteger()
                    else:
                        return Integer()
            except:
                pass
        
        # Check for potential text data
        max_len = sample.str.len().max()
        if pd.isna(max_len) or max_len > MAX_VARCHAR_LENGTH:
            return Text()
        return String(MAX_VARCHAR_LENGTH)
    
    # Default to Text for any other type
    return Text()

def generate_schema_from_dataframe(df: pd.DataFrame) -> Dict[str, Column]:
    """
    Generate a SQLAlchemy schema from a pandas DataFrame.
    
    Args:
        df: Pandas DataFrame to analyze
        
    Returns:
        Dictionary mapping column names to SQLAlchemy Column types
    """
    schema = {}
    for col in df.columns:
        schema[col] = infer_sql_type(df[col])
    return schema

def generate_create_table_statement(table_name: str, df: pd.DataFrame, if_not_exists: bool = True) -> str:
    """
    Generate a CREATE TABLE SQL statement based on DataFrame structure.
    
    Args:
        table_name: Name of the table to create
        df: Pandas DataFrame to analyze
        if_not_exists: Whether to add IF NOT EXISTS clause
        
    Returns:
        SQL CREATE TABLE statement as a string
    """
    type_mapping = {
        'BIGINT': 'BIGINT',
        'INTEGER': 'INT',
        'FLOAT': 'FLOAT',
        'BOOLEAN': 'BOOLEAN',
        'DATETIME': 'DATETIME',
        'TEXT': 'TEXT',
        'VARCHAR': f'VARCHAR({MAX_VARCHAR_LENGTH})'
    }
    
    columns = []
    for col_name, col_type in generate_schema_from_dataframe(df).items():
        type_name = str(col_type.type).split('(')[0].upper()
        sql_type = type_mapping.get(type_name, 'TEXT')
        columns.append(f'`{col_name}` {sql_type}')
    
    if_not_exists_clause = 'IF NOT EXISTS ' if if_not_exists else ''
    return f"CREATE TABLE {if_not_exists_clause}`{table_name}` (\n  " + ",\n  ".join(columns) + "\n);"

def validate_data_against_schema(df: pd.DataFrame, table_name: str) -> Tuple[bool, List[str]]:
    """
    Validate that a DataFrame's structure matches the expected schema.
    
    Args:
        df: Pandas DataFrame to validate
        table_name: Name of the table to validate against
        
    Returns:
        Tuple of (is_valid, [error_messages])
    """
    # TODO: Implement schema validation logic
    # This would check if the DataFrame structure matches the expected schema
    # for the given table_name
    return True, []

def get_table_columns_mysql(connection, table_name: str) -> List[Dict[str, Any]]:
    """
    Get column information for a table from MySQL.
    
    Args:
        connection: MySQL connection object
        table_name: Name of the table
        
    Returns:
        List of dictionaries containing column information
    """
    with connection.cursor(dictionary=True) as cursor:
        cursor.execute(f"""
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, 
                   IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY, EXTRA
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = %s
            ORDER BY ORDINAL_POSITION
        """, (table_name,))
        return cursor.fetchall()

def table_exists(connection, table_name: str) -> bool:
    """
    Check if a table exists in the database.
    
    Args:
        connection: Database connection object
        table_name: Name of the table to check
        
    Returns:
        bool: True if table exists, False otherwise
    """
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT COUNT(*)
            FROM information_schema.tables
            WHERE table_schema = DATABASE()
            AND table_name = %s
        """, (table_name,))
        return cursor.fetchone()[0] == 1
