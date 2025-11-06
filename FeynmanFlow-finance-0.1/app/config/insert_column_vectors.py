import datetime
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

import nltk
import numpy as np
from dotenv import load_dotenv
from nltk.corpus import wordnet
from sentence_transformers import SentenceTransformer

from app.config.database import get_collection  # Updated to use DataAPIClient

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('vector_insert.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Constants
VECTOR_DIMENSION = 1024  # Changed from 384 to match the collection's dimension
BATCH_SIZE = 50  # Number of documents to process in each batch

# Download the WordNet corpus if not already present
try:
    nltk.data.find('corpora/wordnet')
except LookupError:
    logger.info("Downloading NLTK 'wordnet' corpus...")
    nltk.download('wordnet')
    logger.info("NLTK 'wordnet' corpus downloaded.")

def get_wordnet_synonyms(word: str) -> List[str]:
    """
    Retrieves synonyms for a given word using NLTK's WordNet.
    
    Args:
        word: The word to find synonyms for
        
    Returns:
        List of unique synonyms (excluding the original word)
    """
    if not word or not isinstance(word, str):
        return []
        
    synonyms: Set[str] = set()
    try:
        for syn in wordnet.synsets(word):
            for lemma in syn.lemmas():
                synonym = lemma.name().replace('_', ' ').lower()
                if synonym != word.lower():
                    synonyms.add(synonym)
    except Exception as e:
        logger.warning(f"Error getting synonyms for word '{word}': {str(e)}")
        
    return list(synonyms)

def process_batch(
    batch: List[Dict[str, Any]], 
    collection,  # Updated to remove AstraDBCollection type hint
    model: SentenceTransformer
) -> None:
    """Process a batch of documents and update them in the database."""
    if not batch:
        return
        
    try:
        # For each document in the batch
        for doc in batch:
            # Create a unique ID for the document
            doc_id = f"{doc['table_name']}_{doc['column_name']}"
            
            # Use insert_one with the compatibility class
            doc["_id"] = doc_id
            collection.insert_one(doc)
            
        logger.info(f"Processed batch of {len(batch)} documents")
            
    except Exception as e:
        logger.error(f"Error processing batch: {str(e)}", exc_info=True)
        raise

def insert_column_vector(table_name, column_name, original_name, vector):
    collection = get_collection("column_vectors")
    doc = {
        "_id": f"{table_name}_{column_name}",
        "table_name": table_name,
        "column_name": column_name,
        "original_name": original_name,
        "last_updated": datetime.datetime.utcnow().isoformat(),
        "vector": vector  # list of floats
    }
    collection.insert_one(doc)

def main() -> None:
    """Main function to process and insert column vectors into AstraDB."""
    try:
        logger.info("Starting column vector insertion process")
        # Initialize the model
        model = SentenceTransformer('all-MiniLM-L6-v2')
        # Get the collection using the helper (DataAPIClient-based)
        collection = get_collection("column_vectors")
        # Example: Insert a placeholder document for a single column
        # This part of the script needs to be adapted to fetch actual column names
        # from a MySQL table and process them in batches.
        # For now, we'll just insert a dummy document.
        # Placeholder for actual column names and processing
        # This section needs to be replaced with logic to fetch column names
        # from a MySQL table and process them in batches.
        # For example:
        # column_names = ["column_a", "column_b", "column_c"] # Replace with actual column names
        # for col_name in column_names:
        logger.info("Column vector insertion process completed successfully")
    except Exception as e:
        logger.error(f"Fatal error in main(): {str(e)}", exc_info=True)
        raise
        #     try:
        #         if not col_name or not str(col_name).strip():
        #             logger.warning(f"Skipping empty column name: {col_name}")
        #             continue
                    
        #         # Clean column name
        #         cleaned_name = str(col_name).strip().lower()
                    
        #         # Generate synonyms
        #         individual_words = cleaned_name.replace('_', ' ').split()
        #         generated_synonyms = set()
                    
        #         for word in individual_words:
        #             generated_synonyms.update(get_wordnet_synonyms(word))
                    
        #         # Add multi-word version if applicable
        #         if len(individual_words) > 1:
        #             generated_synonyms.add(cleaned_name.replace('_', ' '))
                    
        #         # Generate embedding for the column name and its synonyms
        #         all_terms = [cleaned_name] + list(generated_synonyms)
        #         embeddings = model.encode(all_terms, show_progress_bar=False)
        #         avg_embedding = np.mean(embeddings, axis=0).tolist()
                    
        #         # Create document
        #         doc = {
        #             "column_name": cleaned_name,
        #             "table_name": "placeholder_table", # Replace with actual table name
        #             "original_name": col_name,
        #             "synonyms": list(generated_synonyms),
        #             "$vector": avg_embedding,
        #             "last_updated": datetime.utcnow().isoformat()
        #         }
                    
        #         batch.append(doc)
                    
        #         # Process batch if size limit reached
        #         if len(batch) >= BATCH_SIZE:
        #             process_batch(batch, collection, model)
        #             batch = []
                        
        #     except Exception as e:
        #         logger.error(
        #             f"Error processing column '{col_name}' in table 'placeholder_table': {str(e)}",
        #             exc_info=True
        #         )
            
        # # Process remaining documents in the last batch
        # if batch:
        #     process_batch(batch, collection, model)
                
        logger.info("Column vector insertion process completed successfully")
        
    except Exception as e:
        logger.error(f"Fatal error in main(): {str(e)}", exc_info=True)
        raise

if __name__ == "__main__":
    main()