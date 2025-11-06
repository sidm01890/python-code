import concurrent.futures
import logging
import os
import time
from datetime import datetime
from typing import Dict, List

import pandas as pd
import schedule
from astrapy import DataAPIClient
from dotenv import load_dotenv

from app.config.database import get_collection
from app.core.database import DatabaseHandler
from app.core.processor import DataProcessor

collection = get_collection("column_vectors")
logger = logging.getLogger(__name__)

# Try to import FileTracker and FileProcessingDB, but allow them to be missing
try:
    from app.core.file_tracker import FileTracker
    from app.core.file_db import FileProcessingDB
except ImportError:
    # Create stub classes if modules are missing
    class FileTracker:
        def __init__(self):
            self.pending_dir = "uploads/pending"
            logger.warning("FileTracker module not found. Using stub class.")
        def sync_queue_to_db(self):
            pass
        def add_file(self, *args, **kwargs):
            return False, "FileTracker not implemented"
        def update_file_status(self, *args, **kwargs):
            pass
        def cleanup_old_files(self):
            pass
    
    class FileProcessingDB:
        def __init__(self):
            logger.warning("FileProcessingDB module not found. Using stub class.")
        def get_pending_files(self):
            return []
        def update_file_status(self, *args, **kwargs):
            pass
        def add_processing_stats(self, *args, **kwargs):
            pass



def process_chunk_mp(chunk_data):
    """
    Function to process a chunk in a separate process.
    Each process creates its own db_handler and processor instance.
    chunk_data: tuple (chunk, file_id)
    """
    chunk, file_id = chunk_data
    processor = DataProcessor(chunk_size=1000)
    db_handler = DatabaseHandler()
    cleaned_chunk = processor.clean_chunk(chunk)
    validation_errors = processor.validate_chunk(cleaned_chunk)
    if validation_errors:
        # Can't call save_failed_chunk here (file system not shared safely in multiprocessing)
        return (0, len(validation_errors), False, validation_errors, cleaned_chunk.to_dict(), file_id)
    success, error = db_handler.insert_chunk(cleaned_chunk, "sales_data")
    if success:
        return (len(cleaned_chunk), 0, True, None, None, None)
    else:
        return (0, len(cleaned_chunk), False, error, cleaned_chunk.to_dict(), file_id)

class FileProcessingScheduler:
    def __init__(self):
        self.file_tracker = FileTracker()
        self.file_db = FileProcessingDB()
        self.processor = DataProcessor(chunk_size=1000)
    
    def process_pending_files(self):
        """Process all pending files"""
        try:
            logger.info("Starting scheduled file processing...")

            # Get pending files from database
            pending_files = self.file_db.get_pending_files()
            logger.info(f"Found {len(pending_files)} pending files in the database.")

            for file_record in pending_files:
                filename = file_record['filename']
                file_id = file_record['id']
                file_path = os.path.join(self.file_tracker.pending_dir, filename)
                failure_reason = None # Initialize failure reason

                try:
                    logger.info(f"Attempting to process file ID {file_id}: {filename}")
                    logger.info(f"Checking for file existence at: {file_path}")

                    # Check if the file exists BEFORE attempting to process
                    if not os.path.exists(file_path):
                        failure_reason = f"File not found in pending directory: {filename}"
                        logger.error(f"{failure_reason}. Marking status as failed for file ID {file_id}.")
                        # If file is not found, update status to failed immediately in DB
                        self.file_db.update_file_status(file_id, 'failed', failure_reason)
                        # Also update file tracker's internal state (this updates queue.json and attempts to move if file is in a different tracked dir)
                        self.file_tracker.update_file_status(filename, 'failed')
                        # Explicitly log the failure reason to the terminal
                        logger.error(f"File {filename} (ID: {file_id}) failed processing. Reason: {failure_reason}")
                        continue # Skip to the next file

                    logger.info(f"File found at: {file_path}. Proceeding with processing.")

                    # If file exists, update status to processing in DB
                    self.file_db.update_file_status(file_id, 'processing')
                    logger.info(f"Updated status to 'processing' for file ID {file_id}")

                    # Process the file
                    start_time = datetime.now()
                    total_rows = 0
                    processed_rows = 0
                    failed_rows = 0

                    if filename.endswith('.csv'):
                        chunks = []
                        for chunk in pd.read_csv(file_path, chunksize=1000):
                            total_rows += len(chunk)
                            chunks.append((chunk, file_id))
                        with concurrent.futures.ProcessPoolExecutor(max_workers=5) as executor:
                            futures = [executor.submit(process_chunk_mp, chunk_data) for chunk_data in chunks]
                            for future in concurrent.futures.as_completed(futures):
                                chunk_processed, chunk_failed, success, error, failed_chunk_dict, failed_file_id = future.result()
                                processed_rows += chunk_processed
                                failed_rows += chunk_failed
                                if failed_chunk_dict is not None:
                                    # Save failed chunk in main process
                                    failed_chunk_df = pd.DataFrame(failed_chunk_dict)
                                    self.processor.save_failed_chunk(failed_chunk_df, failed_file_id, error if isinstance(error, list) else [{"error": error}])

                    else:  # Excel files
                        df = pd.read_excel(file_path)
                        total_rows = len(df)
                        chunks = []
                        for start_idx in range(0, len(df), 1000):
                            chunk = df.iloc[start_idx:start_idx + 1000]
                            chunks.append((chunk, file_id))
                        with concurrent.futures.ProcessPoolExecutor(max_workers=5) as executor:
                            futures = [executor.submit(process_chunk_mp, chunk_data) for chunk_data in chunks]
                            for future in concurrent.futures.as_completed(futures):
                                chunk_processed, chunk_failed, success, error, failed_chunk_dict, failed_file_id = future.result()
                                processed_rows += chunk_processed
                                failed_rows += chunk_failed
                                if failed_chunk_dict is not None:
                                    failed_chunk_df = pd.DataFrame(failed_chunk_dict)
                                    self.processor.save_failed_chunk(failed_chunk_df, failed_file_id, error if isinstance(error, list) else [{"error": error}])
                    
                    # Calculate processing duration
                    processing_duration = (datetime.now() - start_time).total_seconds()
                    
                    # Update processing stats in DB
                    self.file_db.add_processing_stats(
                        file_id,
                        total_rows,
                        processed_rows,
                        failed_rows,
                        processing_duration
                    )
                    logger.info(f"Added processing stats for file ID {file_id}")
                    
                    # Determine final status based on failed rows from processing
                    final_status = 'completed' if failed_rows == 0 else 'failed'
                    final_error_message = f"Processed {processed_rows} rows, {failed_rows} failed" if failed_rows > 0 else None

                    # If the status is failed due to processing errors (failed_rows > 0),
                    # set the failure reason for explicit logging.
                    if final_status == 'failed' and final_error_message:
                         failure_reason = final_error_message
                         logger.error(f"File {filename} (ID: {file_id}) failed processing due to row errors. Details: {failure_reason}")

                    # Update final file status in DB
                    self.file_db.update_file_status(
                        file_id,
                        final_status,
                        final_error_message
                    )
                    logger.info(f"Updated final database status to '{final_status}' for file ID {file_id}")
                    
                    # Move file to appropriate directory using FileTracker
                    self.file_tracker.update_file_status(filename, final_status)
                    logger.info(f"Moved physical file {filename} to '{final_status}' directory.")
                    
                except Exception as e:
                    # This catches any unexpected errors during the processing of a file.
                    failure_reason = f"Unhandled processing error: {str(e)}"
                    logger.error(f"Unhandled error processing file {filename} (ID: {file_id}): {str(e)}", exc_info=True) # Log traceback
                    # Update status to failed in DB on unexpected errors
                    self.file_db.update_file_status(file_id, 'failed', failure_reason)
                    # Update status in FileTracker (queue.json and move file)
                    self.file_tracker.update_file_status(filename, 'failed')
                     # Explicitly log the failure reason to the terminal
                    logger.error(f"File {filename} (ID: {file_id}) failed processing. Reason: {failure_reason}")
                    continue # Continue to the next file
            
            # Cleanup old files in completed/failed directories
            self.file_tracker.cleanup_old_files()
            logger.info("Old files cleanup completed.")
            
            logger.info("Scheduled file processing run completed")
            
        except Exception as e:
            # This catches errors during the overall scheduler run, not specific file processing.
            logger.error(f"Error during scheduled processing run: {str(e)}", exc_info=True) # Log traceback
    
    def start(self):
        """Start the scheduler"""
        logger.info("Starting file processing scheduler...")
        
        # Sync queue to database first
        self.file_tracker.sync_queue_to_db()
        
        # Schedule the job to run every 15 minutes
        schedule.every(15).minutes.do(self.process_pending_files)
        
        # Run the job immediately on startup
        print("Running initial processing")
        self.process_pending_files()
        print("Initial processing complete")

        
        # Keep the scheduler running
        while True:
            try:
                schedule.run_pending()
                time.sleep(1)
            except KeyboardInterrupt:
                logger.info("Scheduler stopped by user")
                break
            except Exception as e:
                logger.error(f"Scheduler error: {str(e)}")
                time.sleep(60)  # Wait a minute before retrying

if __name__ == "__main__":
    scheduler = FileProcessingScheduler()
    scheduler.start()