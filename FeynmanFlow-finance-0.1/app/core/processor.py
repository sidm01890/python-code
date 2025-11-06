import pandas as pd
from typing import List, Dict, Any, Tuple
import logging
from datetime import datetime
import os

logger = logging.getLogger(__name__)

class DataProcessor:
    def __init__(self, chunk_size: int = 1000):
        self.chunk_size = chunk_size
        self.processed_chunks = 0
        self.failed_chunks = []
        self.error_log = []
        self.total_rows_processed = 0
        self.start_time = None
        self.end_time = None
        
    def start_processing(self):
        """Start the processing timer"""
        self.start_time = datetime.now()
        logger.info(f"Starting data processing at {self.start_time}")
        
    def end_processing(self):
        """End the processing timer"""
        self.end_time = datetime.now()
        duration = (self.end_time - self.start_time).total_seconds()
        logger.info(f"Processing completed in {duration} seconds")
        
    def validate_chunk(self, chunk: pd.DataFrame) -> List[Dict[str, Any]]:
        """Validates a chunk of data and returns validation results"""
        errors = []
        for index, row in chunk.iterrows():
            row_errors = self._validate_row(row)
            if row_errors:
                errors.append({
                    'row_index': index,
                    'errors': row_errors,
                    'data': row.to_dict()
                })
        return errors
    
    def _validate_row(self, row: pd.Series) -> List[str]:
        """Validates individual row data"""
        errors = []
        
        # Required fields validation
        required_fields = ['units_sold', 'manufacturing_price', 'sale_price']
        for field in required_fields:
            if field not in row or pd.isna(row.get(field)):
                errors.append(f'{field} is required')
                
        # Numeric fields validation
        numeric_fields = ['units_sold', 'manufacturing_price', 'sale_price', 'gross_sales']
        for field in numeric_fields:
            if field in row and not pd.isna(row[field]):
                try:
                    value = float(str(row[field]).replace('$', '').replace(',', '').strip())
                    if value < 0:
                        errors.append(f'{field} cannot be negative')
                except ValueError:
                    errors.append(f'{field} must be a valid number')
                    
        # Date validation
        if 'date' in row and not pd.isna(row['date']):
            try:
                pd.to_datetime(row['date'])
            except ValueError:
                errors.append('date must be in a valid format')
                
        return errors
    
    def clean_chunk(self, chunk: pd.DataFrame) -> pd.DataFrame:
        """Cleans and transforms the chunk data"""
        try:
            # Clean currency columns
            currency_columns = ['manufacturing_price', 'sale_price', 'gross_sales', 
                              'discounts', 'sales', 'cogs', 'profit']
            
            for col in currency_columns:
                if col in chunk.columns:
                    chunk[col] = chunk[col].apply(self._clean_currency)
                    
            # Convert date column
            if 'date' in chunk.columns:
                chunk['date'] = pd.to_datetime(chunk['date']).dt.date
                
            # Convert numeric columns
            numeric_columns = ['units_sold', 'month_number', 'year']
            for col in numeric_columns:
                if col in chunk.columns:
                    chunk[col] = pd.to_numeric(chunk[col], errors='coerce')
                    
            return chunk
            
        except Exception as e:
            logger.error(f"Error cleaning chunk: {str(e)}")
            raise
    
    def _clean_currency(self, value: Any) -> float:
        """Cleans currency values"""
        if pd.isna(value):
            return 0.0
        if isinstance(value, str):
            # Remove currency symbols, commas, and whitespace
            cleaned = value.replace('$', '').replace(',', '').strip()
            # Handle negative values in parentheses
            if cleaned.startswith('(') and cleaned.endswith(')'):
                cleaned = '-' + cleaned[1:-1]
            # Convert to float, defaulting to 0 if empty
            return float(cleaned or 0)
        return float(value)
    
    def save_failed_chunk(self, chunk: pd.DataFrame, chunk_index: int, 
                         errors: List[Dict[str, Any]]) -> None:
        """Saves failed chunk to a file for later processing"""
        try:
            # Create failed_chunks directory if it doesn't exist
            os.makedirs('failed_chunks', exist_ok=True)
            
            # Save chunk to CSV
            filename = f'failed_chunks/chunk_{chunk_index}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            chunk.to_csv(filename, index=False)
            
            # Save error information
            error_info = {
                'chunk_index': chunk_index,
                'timestamp': datetime.now().isoformat(),
                'errors': errors,
                'filename': filename
            }
            
            self.failed_chunks.append(error_info)
            logger.info(f"Saved failed chunk {chunk_index} to {filename}")
            
        except Exception as e:
            logger.error(f"Failed to save failed chunk: {str(e)}")
    
    def get_processing_stats(self) -> Dict[str, Any]:
        """Returns processing statistics"""
        duration = (self.end_time - self.start_time).total_seconds() if self.end_time else 0
        
        return {
            'total_chunks_processed': self.processed_chunks,
            'total_rows_processed': self.total_rows_processed,
            'failed_chunks': len(self.failed_chunks),
            'processing_duration_seconds': duration,
            'failed_chunks_details': self.failed_chunks
        } 