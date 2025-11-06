import os
import time
import logging
import glob
from app.core.file_tracker import FileTracker
from app.core.file_db import FileProcessingDB

logger = logging.getLogger(__name__)

class FileScanner:
    def __init__(self, input_dir: str = "input_files", scan_interval_seconds: int = 60):
        self.input_dir = input_dir
        self.scan_interval = scan_interval_seconds
        self.file_tracker = FileTracker()
        self.file_db = FileProcessingDB()
        self._create_input_directory()

    def _create_input_directory(self):
        """Create the input directory if it doesn't exist"""
        os.makedirs(self.input_dir, exist_ok=True)
        logger.info(f"Input directory '{self.input_dir}' ensured to exist.")

    def scan_and_queue_files(self):
        """Scan the input directory for new files and queue them"""
        logger.info(f"Scanning input directory: {self.input_dir}")
        try:
            # List supported files in the input directory
            supported_files = glob.glob(os.path.join(self.input_dir, '*.xlsx')) + \
                              glob.glob(os.path.join(self.input_dir, '*.xls')) + \
                              glob.glob(os.path.join(self.input_dir, '*.csv'))

            if not supported_files:
                logger.info("No supported files found in input directory.")
                return

            logger.info(f"Found {len(supported_files)} supported files.")

            for file_path in supported_files:
                original_filename = os.path.basename(file_path)
                logger.info(f"Attempting to queue file: {original_filename}")
                try:
                    # Add file to tracking system (moves to pending and creates db record indirectly via sync)
                    # file_tracker.add_file already handles moving the file and creating the db record indirectly via sync
                    success, result = self.file_tracker.add_file(file_path, original_filename)

                    if success:
                        # The file_tracker.add_file method already removes the original file if successful.
                        # So we don't need os.remove(file_path) here.
                        logger.info(f"Successfully queued: {original_filename}. Queued as: {result}")
                    else:
                        # If add_file returns False, it means it failed for some reason
                        logger.error(f"Failed to queue file through file_tracker: {original_filename}. Error: {result}")

                except FileNotFoundError:
                    # Catch the specific error if the file disappears between listing and processing
                    logger.warning(f"File disappeared before processing could start: {file_path}. Skipping.")
                    continue # Skip to the next file

                except Exception as e:
                    logger.error(f"Error processing file for queuing {file_path}: {str(e)}", exc_info=True)
                    # If an error occurs during the process for a single file, log and continue
                    continue

        except Exception as e:
            logger.error(f"Error during directory scan: {str(e)}", exc_info=True)

    def start(self):
        """Start the file scanner"""
        logger.info("Starting file scanner...")
        while True:
            try:
                self.scan_and_queue_files()
            except Exception as e:
                logger.error(f"Error in file scanner loop: {str(e)}")

            logger.info(f"Next scan in {self.scan_interval} seconds.")
            time.sleep(self.scan_interval)

if __name__ == "__main__":
    # You can configure the input directory and scan interval here if needed
    # For example: scanner = FileScanner(input_dir="/path/to/your/input", scan_interval_seconds=300)
    scanner = FileScanner()
    scanner.start() 