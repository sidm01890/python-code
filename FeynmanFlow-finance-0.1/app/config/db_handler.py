def insert_chunk(df, table_name):
    """
    Inserts a DataFrame chunk into the given MySQL table.
    Returns (True, None) on success, (False, error_message) on failure.
    """
    try:
        conn = mysql.connector.connect(
            host="localhost", user="root", password="NewStrongPassword123!.", database="devyani"
        )
        cursor = conn.cursor()
        cols = list(df.columns)
        cols_escaped = [f"`{col}`" for col in cols]  # Escape column names
        placeholders = ','.join(['%s'] * len(cols))
        sql = f"INSERT INTO {table_name} ({','.join(cols_escaped)}) VALUES ({placeholders})"
        
        rows = [tuple(row) for row in df.itertuples(index=False, name=None)]
        cursor.executemany(sql, rows)
        
        conn.commit()
        cursor.close()
        conn.close()
        return True, None
    except Exception as e:
        return False, str(e)
