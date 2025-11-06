import base64
import json
import logging
from datetime import datetime
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from app.config.database import get_collection

# Configure logging for this module
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


# Load the embedding model (should match the one used for canonical vectors)
model = SentenceTransformer('all-MiniLM-L6-v2')
VECTOR_DIMENSION = 384 # Dimension for 'all-MiniLM-L6-v2' model

# Define a similarity threshold for automatic mapping
SIMILARITY_THRESHOLD = 0.75  # Tune this value as needed


def normalize_column_name(col_name: str) -> str:
    """
    Normalize a column name for comparison (case-insensitive, strip, replace special chars).
    
    Args:
        col_name: Column name to normalize
        
    Returns:
        Normalized column name (lowercase, stripped, special chars replaced with underscore)
    """
    if not col_name:
        return ""
    normalized = str(col_name).strip().lower()
    # Replace special characters with underscore
    normalized = normalized.replace(' ', '_').replace('-', '_')
    # Remove multiple underscores
    while '__' in normalized:
        normalized = normalized.replace('__', '_')
    # Strip underscores from ends
    normalized = normalized.strip('_')
    return normalized


def load_json_column_mapping(table_name: str = "orders") -> dict:
    """
    Load column mappings from JSON file (e.g., pos_orders_column_mapping.json).
    
    Args:
        table_name: Table name to load mappings for (default: "orders")
        
    Returns:
        Dictionary mapping excel_column_name (normalized) -> db_column_name
    """
    mapping_file = Path(__file__).parent.parent.parent / "pos_orders_column_mapping.json"
    
    if not mapping_file.exists():
        logger.debug(f"JSON mapping file not found: {mapping_file}")
        return {}
    
    try:
        with open(mapping_file, 'r', encoding='utf-8') as f:
            mappings = json.load(f)
        
        # Convert list of dicts to a mapping dict
        mapping_dict = {}
        for mapping in mappings:
            excel_col = mapping.get("excel_column_name", "")
            db_col = mapping.get("db_column_name", "")
            if excel_col and db_col:
                # Normalize the excel column name for matching
                normalized_excel = normalize_column_name(excel_col)
                # Store both normalized and original (lowercase) for matching
                mapping_dict[normalized_excel] = db_col
                mapping_dict[excel_col.lower()] = db_col  # Also match original (case-insensitive)
        
        logger.info(f"Loaded {len(mapping_dict)} mappings from JSON file for table '{table_name}'")
        return mapping_dict
    except Exception as e:
        logger.warning(f"Error loading JSON mapping file: {e}")
        return {}


def decode_vector_from_binary(vector_field):
    """
    Decodes a base64-encoded binary vector from AstraDB into a numpy array of floats.
    """
    if not vector_field or "$binary" not in vector_field:
        logger.warning(f"decode_vector_from_binary: No $binary in {vector_field}")
        return None
    try:
        binary_data = base64.b64decode(vector_field["$binary"])
        vec = np.frombuffer(binary_data, dtype=np.float32)
        logger.info(f"Decoded vector of length {len(vec)}")
        return vec
    except Exception as e:
        logger.error(f"Failed to decode vector: {e}")
        return None

def get_canonical_data():
    """
    Retrieves all canonical column data (name, vector, user_defined_aliases, wordnet_synonyms) from Astra DB.
    Returns:
        canonical_columns: dict mapping canonical name to its data (vector, aliases, synonyms)
        all_user_defined_aliases: dict mapping alias to canonical name
    """
    collection = get_collection("column_vectors")
    # Process cursor iteratively to avoid timeout issues
    cursor = collection.find({})
    canonical_columns = {}  # Maps canonical name to its data (vector, aliases, synonyms)
    all_user_defined_aliases = {}  # Maps alias to canonical name
    
    for doc in cursor:
        col_name = doc.get('column_name')
        if not col_name:
            logger.warning(f"Skipping document with missing 'column_name': {doc}")
            continue

        # Use the decoder for $vector
        vector_data = None
        if "$vector" in doc:
            vector_data = decode_vector_from_binary(doc["$vector"])
        elif "vector" in doc and isinstance(doc["vector"], list):
            vector_data = np.array(doc["vector"])
        if vector_data is None or not isinstance(vector_data, np.ndarray):
            logger.warning(f"Skipping document for column '{col_name}' due to missing or invalid vector data.")
            continue

        # Ensure vector has correct dimension
        if len(vector_data) != VECTOR_DIMENSION:
            logger.warning(f"Vector for column '{col_name}' has incorrect dimension ({len(vector_data)}). Expected {VECTOR_DIMENSION}. Padding/Truncating.")
            if len(vector_data) < VECTOR_DIMENSION:
                vector_data = np.pad(vector_data, (0, VECTOR_DIMENSION - len(vector_data)))
            else:
                vector_data = vector_data[:VECTOR_DIMENSION]

        canonical_columns[col_name] = {
            "vector": vector_data,
            "user_defined_aliases": doc.get('user_defined_aliases', []),
            "wordnet_synonyms": doc.get('wordnet_synonyms', [])
            }
        for alias in doc.get('user_defined_aliases', []):
            all_user_defined_aliases[alias.lower()] = col_name  # Store lowercase alias for case-insensitive match
    return canonical_columns, all_user_defined_aliases


def get_vector_cache_path(database_name=None):
    """Get the path to the local vector cache file."""
    cache_dir = Path(__file__).parent.parent.parent / "vector_cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_filename = f"vectors_{database_name or 'default'}.json"
    return cache_dir / cache_filename


def load_vector_cache(database_name=None):
    """Load vectors from local cache file."""
    cache_path = get_vector_cache_path(database_name)
    if not cache_path.exists():
        return None
    
    try:
        with open(cache_path, 'r', encoding='utf-8') as f:
            cached_data = json.load(f)
        logger.info(f"[CACHE] Loaded {len(cached_data.get('table_to_columns', {}))} tables from cache")
        return cached_data
    except Exception as e:
        logger.warning(f"[CACHE] Error loading cache: {e}")
        return None


def save_vector_cache(table_to_columns, database_name=None):
    """Save vectors to local cache file."""
    cache_path = get_vector_cache_path(database_name)
    try:
        # Convert numpy arrays to lists for JSON serialization
        serializable_data = {}
        for table, columns in table_to_columns.items():
            serializable_data[table] = {}
            for col_name, col_data in columns.items():
                vector = col_data.get('vector')
                if isinstance(vector, np.ndarray):
                    vector = vector.tolist()
                serializable_data[table][col_name] = {
                    "vector": vector,
                    "user_defined_aliases": col_data.get('user_defined_aliases', []),
                    "wordnet_synonyms": col_data.get('wordnet_synonyms', [])
                }
        
        cache_data = {
            "database_name": database_name,
            "cached_at": datetime.now().isoformat(),
            "table_to_columns": serializable_data
        }
        
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, indent=2)
        logger.info(f"[CACHE] Saved {len(serializable_data)} tables to cache")
    except Exception as e:
        logger.warning(f"[CACHE] Error saving cache: {e}")


def get_canonical_data_by_table(database_name=None, use_cache=True):
    """
    Retrieves all canonical column data grouped by table_name from Astra DB.
    Optionally filters by database_name if provided.
    Uses local cache if available to avoid repeated AstraDB calls.
    
    Args:
        database_name: Optional database name to filter by (e.g., 'devyani', 'bercos')
        use_cache: Whether to use local cache (default: True)
    
    Returns:
        table_to_columns: dict mapping table_name to dict of canonical columns and their data
    """
    # Try to load from cache first
    if use_cache:
        cached_data = load_vector_cache(database_name)
        if cached_data:
            table_to_columns = {}
            for table, columns in cached_data.get('table_to_columns', {}).items():
                table_to_columns[table] = {}
                for col_name, col_data in columns.items():
                    vector = col_data.get('vector')
                    if isinstance(vector, list):
                        vector = np.array(vector, dtype=np.float32)
                    table_to_columns[table][col_name] = {
                        "vector": vector,
                        "user_defined_aliases": col_data.get('user_defined_aliases', []),
                        "wordnet_synonyms": col_data.get('wordnet_synonyms', [])
                    }
            logger.info(f"[CACHE] Using cached vectors for database: '{database_name or 'default'}'")
            return table_to_columns
    
    # If cache miss or disabled, fetch from AstraDB
    collection = get_collection("column_vectors")
    
    # Build query filter - include database_name if provided
    query_filter = {}
    if database_name:
        query_filter["database_name"] = database_name
        logger.info(f"[MATCH] Filtering vectors by database_name: '{database_name}'")
    
    # Process cursor iteratively to avoid timeout issues
    # The timeout is configured at the database level (60 seconds)
    try:
        cursor = collection.find(query_filter)
        
        table_to_columns = {}
        doc_count = 0
        
        # Process documents one by one from the cursor to avoid memory issues and timeouts
        for doc in cursor:
            doc_count += 1
            table = doc.get('table_name', 'default')
            col = doc.get('column_name')
            vector_data = None
            if "$vector" in doc:
                vector_data = decode_vector_from_binary(doc["$vector"])
            elif "vector" in doc and isinstance(doc["vector"], list):
                vector_data = np.array(doc["vector"])
            if vector_data is None or not isinstance(vector_data, np.ndarray):
                logger.warning(f"Skipping doc for column '{col}' in table '{table}' due to missing/invalid vector.")
                continue
            if table not in table_to_columns:
                table_to_columns[table] = {}
            table_to_columns[table][col] = {
                "vector": vector_data,
                "user_defined_aliases": doc.get('user_defined_aliases', []),
                "wordnet_synonyms": doc.get('wordnet_synonyms', [])
            }
        
        logger.info(f"Fetched {doc_count} canonical docs from AstraDB" + (f" for database '{database_name}'" if database_name else ""))
        logger.debug(f"Grouped columns by table: { {k: len(v) for k,v in table_to_columns.items()} }")
        
        # Save to cache for future use
        if use_cache and table_to_columns:
            save_vector_cache(table_to_columns, database_name)
        
        return table_to_columns
        
    except Exception as e:
        logger.error(f"Error fetching canonical data from AstraDB: {e}")
        # Fallback: try with default timeout if custom timeout fails
        logger.info("Retrying with default timeout settings...")
        try:
            cursor = collection.find(query_filter)
            table_to_columns = {}
            doc_count = 0
            for doc in cursor:
                doc_count += 1
                table = doc.get('table_name', 'default')
                col = doc.get('column_name')
                vector_data = None
                if "$vector" in doc:
                    vector_data = decode_vector_from_binary(doc["$vector"])
                elif "vector" in doc and isinstance(doc["vector"], list):
                    vector_data = np.array(doc["vector"])
                if vector_data is None or not isinstance(vector_data, np.ndarray):
                    logger.warning(f"Skipping doc for column '{col}' in table '{table}' due to missing/invalid vector.")
                    continue
                if table not in table_to_columns:
                    table_to_columns[table] = {}
                table_to_columns[table][col] = {
                    "vector": vector_data,
                    "user_defined_aliases": doc.get('user_defined_aliases', []),
                    "wordnet_synonyms": doc.get('wordnet_synonyms', [])
                }
            logger.info(f"Fetched {doc_count} canonical docs from AstraDB (fallback)" + (f" for database '{database_name}'" if database_name else ""))
            
            # Save to cache for future use
            if use_cache and table_to_columns:
                save_vector_cache(table_to_columns, database_name)
            
            return table_to_columns
        except Exception as fallback_error:
            logger.error(f"Fallback also failed: {fallback_error}")
            raise


def detect_best_table_for_headers(excel_headers, database_name=None):
    """
    Given a list of Excel headers, detect the best-matching table_name by comparing header vectors to canonical columns grouped by table_name.
    
    Args:
        excel_headers: List of Excel header names
        database_name: Optional database name to filter by (e.g., 'devyani', 'bercos')
    
    Returns:
        best_table: str, the detected table_name
        table_scores: dict of table_name to average similarity score
    """
    table_to_columns = get_canonical_data_by_table(database_name=database_name)
    # Ensure model is initialized if this function is called independently
    current_model = model if 'model' in globals() else SentenceTransformer('all-MiniLM-L6-v2')
    header_vectors = current_model.encode(excel_headers)
    table_scores = {}
    for table, columns in table_to_columns.items():
        canonical_vectors = np.array([data["vector"] for data in columns.values()])
        if len(canonical_vectors) == 0:
            table_scores[table] = 0
            continue
        # Compute max similarity for each header to any canonical column in this table
        max_sims = []
        for header_vec in header_vectors:
            sims = cosine_similarity([header_vec], canonical_vectors)[0]
            max_sims.append(np.max(sims))
        # Average max similarity across all headers
        table_scores[table] = float(np.mean(max_sims)) if max_sims else 0
    
    if not table_scores:
        logger.warning("No table scores generated. Cannot detect best table.")
        return None, {}

    best_table = max(table_scores, key=table_scores.get)
    return best_table, table_scores


def map_excel_headers_to_canonical_with_suggestions(excel_headers):
    """
    Maps Excel headers to canonical columns, using the following order:
    1. User-defined aliases (exact, case-insensitive)
    2. Direct match with any wordnet_synonyms (case-insensitive)
    3. Vector similarity (with threshold)
    Returns:
        tuple: (dict: tentative_mapping, list of str: unrecognized_headers, list of str: canonical_options)
    """
    canonical_data, all_user_defined_aliases = get_canonical_data()
    canonical_names_for_vectors = list(canonical_data.keys())
    
    # Only create canonical_vectors_array if there's data, otherwise it will be empty
    canonical_vectors_array = np.array([canonical_data[name]["vector"] for name in canonical_names_for_vectors]) if canonical_names_for_vectors else np.array([])


    tentative_mapping = {}
    remaining_excel_headers_for_vector_match = []

    for header in excel_headers:
        header_lower = header.lower()
        # 1. User-defined aliases
        if header_lower in all_user_defined_aliases:
            tentative_mapping[header] = all_user_defined_aliases[header_lower]
            continue
        # 2. Direct synonym match
        matched = False
        for canonical_name, data in canonical_data.items():
            if header_lower in [syn.lower() for syn in data.get('wordnet_synonyms', [])]:
                tentative_mapping[header] = canonical_name
                matched = True
                break
        if not matched:
            remaining_excel_headers_for_vector_match.append(header)

    # 3. Vector Similarity for remaining headers
    unrecognized_headers = []
    if remaining_excel_headers_for_vector_match:
        # Ensure model is initialized if this function is called independently
        current_model = model if 'model' in globals() else SentenceTransformer('all-MiniLM-L6-v2')
        excel_vectors = current_model.encode(remaining_excel_headers_for_vector_match)
        for i, excel_vec in enumerate(excel_vectors):
            header = remaining_excel_headers_for_vector_match[i]
            if len(canonical_vectors_array) == 0:
                unrecognized_headers.append(header)
                continue
            sims = cosine_similarity([excel_vec], canonical_vectors_array)[0]
            best_idx = np.argmax(sims)
            best_sim_score = sims[best_idx]
            if best_sim_score >= SIMILARITY_THRESHOLD:
                tentative_mapping[header] = canonical_names_for_vectors[best_idx]
            else:
                unrecognized_headers.append(header)
    else:
        unrecognized_headers = []  # No headers left to be unrecognized

    return tentative_mapping, unrecognized_headers, canonical_names_for_vectors


def map_excel_headers_to_canonical_with_suggestions_by_table(excel_headers, table_name, database_name=None):
    """
    Maps Excel headers to canonical columns for a specific table_name.
    Uses the following priority order:
    1. JSON file-based mappings (highest priority)
    2. Direct column name matches (normalized, case-insensitive)
    3. User-defined aliases from AstraDB
    4. Direct synonym match
    5. Vector similarity (lowest priority)
    
    Args:
        excel_headers: List of Excel header names
        table_name: Name of the target table
        database_name: Optional database name to filter by (e.g., 'devyani', 'bercos')
    
    Returns:
        tuple: (dict: tentative_mapping, list of str: unrecognized_headers, list of str: canonical_options)
    """
    logger.info(f"[MATCH] Mapping headers for table: '{table_name}'" + (f" in database: '{database_name}'" if database_name else ""))
    table_to_columns = get_canonical_data_by_table(database_name=database_name)
    canonical_data = table_to_columns.get(table_name, {})
    
    if not canonical_data:
        logger.warning(f"[MATCH] No canonical columns found for table '{table_name}'. Available tables: {list(table_to_columns.keys())}")
        # If table not found, try to use all columns (fallback)
        canonical_data = {}
        for table_cols in table_to_columns.values():
            canonical_data.update(table_cols)
        if canonical_data:
            logger.info(f"[MATCH] Using fallback: all available columns ({len(canonical_data)} total)")
    all_user_defined_aliases = {}
    for canonical_name, data in canonical_data.items():
        for alias in data.get('user_defined_aliases', []):
            all_user_defined_aliases[alias.lower()] = canonical_name
    canonical_names_for_vectors = list(canonical_data.keys())
    
    # Only create canonical_vectors_array if there's data, otherwise it will be empty
    canonical_vectors_array = np.array([canonical_data[name]["vector"] for name in canonical_names_for_vectors]) if canonical_names_for_vectors else np.array([])

    # Load JSON-based mappings (priority 1)
    json_mappings = load_json_column_mapping(table_name)
    
    # Create a normalized lookup for direct column name matching (priority 2)
    normalized_canonical_lookup = {}
    for canonical_name in canonical_names_for_vectors:
        normalized = normalize_column_name(canonical_name)
        normalized_canonical_lookup[normalized] = canonical_name

    tentative_mapping = {}
    remaining_excel_headers_for_vector_match = []

    for header in excel_headers:
        header_lower = header.lower()
        header_normalized = normalize_column_name(header)
        
        # 1. JSON file-based mappings (highest priority)
        # Check both normalized and original (lowercase) versions
        if header_normalized in json_mappings:
            db_column = json_mappings[header_normalized]
        elif header_lower in json_mappings:
            db_column = json_mappings[header_lower]
        else:
            db_column = None
        
        if db_column:
            # Verify the db_column exists in canonical_data
            if db_column in canonical_names_for_vectors:
                tentative_mapping[header] = db_column
                logger.info(f"[MATCH] JSON mapping: '{header}' -> '{db_column}'")
                continue
            else:
                logger.warning(f"[MATCH] JSON mapping found '{header}' -> '{db_column}', but '{db_column}' not in canonical columns")
        
        # 2. Direct column name match (case-insensitive, normalized)
        if header_normalized in normalized_canonical_lookup:
            tentative_mapping[header] = normalized_canonical_lookup[header_normalized]
            logger.info(f"[MATCH] Direct match: '{header}' -> '{normalized_canonical_lookup[header_normalized]}'")
            continue
        
        # 3. User-defined aliases from AstraDB
        if header_lower in all_user_defined_aliases:
            tentative_mapping[header] = all_user_defined_aliases[header_lower]
            logger.info(f"[MATCH] Alias match: '{header}' -> '{all_user_defined_aliases[header_lower]}'")
            continue
        
        # 4. Direct synonym match
        matched = False
        for canonical_name, data in canonical_data.items():
            if header_lower in [syn.lower() for syn in data.get('wordnet_synonyms', [])]:
                tentative_mapping[header] = canonical_name
                logger.info(f"[MATCH] Synonym match: '{header}' -> '{canonical_name}'")
                matched = True
                break
        
        if not matched:
            remaining_excel_headers_for_vector_match.append(header)

    # 3. Vector Similarity for remaining headers
    unrecognized_headers = []
    if remaining_excel_headers_for_vector_match:
        # Ensure model is initialized if this function is called independently
        current_model = model if 'model' in globals() else SentenceTransformer('all-MiniLM-L6-v2')
        excel_vectors = current_model.encode(remaining_excel_headers_for_vector_match)
        for i, excel_vec in enumerate(excel_vectors):
            header = remaining_excel_headers_for_vector_match[i]
            if len(canonical_vectors_array) == 0:
                unrecognized_headers.append(header)
                continue
            sims = cosine_similarity([excel_vec], canonical_vectors_array)[0]
            best_idx = np.argmax(sims)
            best_sim_score = sims[best_idx]
            if best_sim_score >= SIMILARITY_THRESHOLD:
                tentative_mapping[header] = canonical_names_for_vectors[best_idx]
            else:
                unrecognized_headers.append(header)
    else:
        unrecognized_headers = []  # No headers left to be unrecognized

    return tentative_mapping, unrecognized_headers, canonical_names_for_vectors


def map_excel_headers_to_canonical(excel_headers):
    """
    Compatibility wrapper for legacy code. Returns only the mapping (dict) as before.
    """
    mapping, _, _ = map_excel_headers_to_canonical_with_suggestions(excel_headers)
    return mapping


def add_user_defined_alias(canonical_name, alias):
    """
    Adds a user-defined alias to the specified canonical column in Astra DB.
    """
    collection = get_collection("column_vectors")
    collection.update_one(
        {"column_name": canonical_name},
        {"$addToSet": {"user_defined_aliases": alias.lower()}}
    )


def batch_add_user_defined_aliases(manual_mappings):
    """
    Given a dict of {excel_header: canonical_name}, add each excel_header as an alias for the canonical_name.
    """
    for excel_header, canonical_name in manual_mappings.items():
        add_user_defined_alias(canonical_name, excel_header)

# Debug code - commented out to avoid execution on import
# collection = get_collection("column_vectors")
# doc = collection.find_one({})
# print(doc)
