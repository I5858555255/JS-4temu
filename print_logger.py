import csv
import os
from datetime import datetime

LOG_FILE_NAME = "print_log.csv"
LOG_HEADER = ["Timestamp", "SKU/Filename", "Quantity", "Printer", "Status"]

def get_log_file_path() -> str:
    """Returns the absolute path to the log file."""
    # For now, place it in the same directory as this script.
    # In a real application, this might be a user-specific data directory.
    return os.path.abspath(LOG_FILE_NAME)

def log_print_job(timestamp: str, sku_or_filename: str, quantity: int, printer_name: str, status: str):
    """Appends a print job record to the CSV log file.

    Args:
        timestamp: The timestamp of the print job (e.g., "YYYY-MM-DD HH:MM:SS").
        sku_or_filename: The SKU or filename of the item printed.
        quantity: The number of copies printed.
        printer_name: The name of the printer used.
        status: The status of the print job (e.g., "Printed", "Failed").
    """
    log_file = get_log_file_path()
    file_exists = os.path.isfile(log_file)

    try:
        with open(log_file, 'a', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            if not file_exists or os.path.getsize(log_file) == 0:
                writer.writerow(LOG_HEADER)
            writer.writerow([timestamp, sku_or_filename, quantity, printer_name, status])
    except IOError as e:
        print(f"Error writing to log file {log_file}: {e}")

def read_print_log() -> list[list[str]]:
    """Reads all records from the print log CSV file.

    Returns:
        A list of lists, where each inner list represents a row (excluding the header).
        Returns an empty list if the log file doesn't exist.
    """
    log_file = get_log_file_path()
    if not os.path.isfile(log_file):
        return []

    records = []
    try:
        with open(log_file, 'r', newline='', encoding='utf-8') as csvfile:
            reader = csv.reader(csvfile)
            header = next(reader, None)  # Skip header
            if header: # Proceed only if header was read
                for row in reader:
                    if row: # Ensure row is not empty
                        records.append(row)
    except StopIteration:
        # This can happen if the file is empty (only header or nothing)
        pass
    except IOError as e:
        print(f"Error reading from log file {log_file}: {e}")
    return records

def delete_print_log_entry(timestamp_to_delete: str) -> bool:
    """Deletes a specific entry from the print log CSV file based on the timestamp.

    Args:
        timestamp_to_delete: The exact timestamp of the log entry to delete.

    Returns:
        True if an entry was found and deletion was attempted (file rewritten),
        False otherwise (entry not found, file not found, or I/O error).
    """
    log_file = get_log_file_path()
    if not os.path.isfile(log_file):
        print(f"Log file {log_file} not found.")
        return False

    rows_to_keep = []
    deleted_count = 0
    header_row = []

    try:
        with open(log_file, 'r', newline='', encoding='utf-8') as csvfile:
            reader = csv.reader(csvfile)
            header_row = next(reader, None)
            if not header_row: # Empty or malformed file
                print(f"Log file {log_file} is empty or has no header.")
                return False

            rows_to_keep.append(header_row) # Keep the header

            for row in reader:
                if row: # Ensure row is not empty
                    if row[0] == timestamp_to_delete:
                        deleted_count += 1
                    else:
                        rows_to_keep.append(row)

        if deleted_count == 0:
            print(f"No log entry found with timestamp: {timestamp_to_delete}")
            return False # Entry not found

        # Rewrite the file with the filtered rows
        with open(log_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerows(rows_to_keep)

        print(f"Successfully deleted {deleted_count} log entry(s) with timestamp: {timestamp_to_delete}")
        return True

    except StopIteration: # Should be caught by header check, but good practice
        print(f"Error: Log file {log_file} seems to be empty or improperly formatted (StopIteration).")
        return False
    except IndexError: # If a row doesn't have a timestamp column (e.g. malformed)
        print(f"Error: Malformed row found in {log_file} while checking timestamp.")
        return False
    except IOError as e:
        print(f"Error during file operation on {log_file}: {e}")
        return False

def clear_all_print_logs() -> bool:
    """Clears all entries from the print log CSV file, leaving only the header.

    Returns:
        True if the log was successfully cleared (or was already empty/missing and then created with header).
        False if an I/O error occurred.
    """
    log_file = get_log_file_path()
    try:
        # Overwrite the file, writing only the header.
        # This handles cases where the file doesn't exist (it will be created)
        # or is corrupted (it will be overwritten).
        with open(log_file, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(LOG_HEADER)
        print(f"Successfully cleared all print logs. File '{log_file}' now contains only the header.")
        return True
    except IOError as e:
        print(f"Error clearing print log file {log_file}: {e}")
        return False

if __name__ == '__main__':
    # Example usage:
    # Ensure the logger works by itself for testing
    print(f"Log file will be at: {get_log_file_path()}")

    # Get current timestamp for example
    example_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    log_print_job(example_ts, "TEST_SKU_001.pdf", 1, "Printer_1", "Printed")
    log_print_job(example_ts, "ANOTHER_FILE.pdf", 5, "Printer_2", "Printed")
    log_print_job(example_ts, "FAIL_DOC.pdf", 1, "Printer_1", "Failed")

    print(f"Example log entries written to {LOG_FILE_NAME}.")

    # Test reading the log
    print("\nReading log entries (before deletion):")
    log_data = read_print_log()
    if log_data:
        for row in log_data:
            print(row)
    else:
        print("No log data found or error reading log.")

    # Test deleting an entry - use a timestamp from one of the logged examples
    # Important: For a real test, this timestamp must exist from a previous run or be logged above.
    if log_data: # Only try to delete if there was data
        timestamp_to_try_delete = log_data[0][0] # Try to delete the first actual data entry's timestamp
        print(f"\nAttempting to delete entry with timestamp: {timestamp_to_try_delete}")
        if delete_print_log_entry(timestamp_to_try_delete):
            print(f"Deletion successful for {timestamp_to_try_delete}.")
        else:
            print(f"Deletion failed for {timestamp_to_try_delete}.")

        print("\nReading log entries (after attempted deletion):")
        log_data_after_delete = read_print_log()
        if log_data_after_delete:
            for row in log_data_after_delete:
                print(row)
        else:
            print("No log data found or error reading log (after delete).")

    # Test deleting a non-existent entry
    non_existent_ts = "2000-01-01 00:00:00"
    print(f"\nAttempting to delete non-existent entry with timestamp: {non_existent_ts}")
    if delete_print_log_entry(non_existent_ts):
        print(f"Deletion successful for {non_existent_ts} (this should not happen).")
    else:
        print(f"Deletion failed for {non_existent_ts} (as expected).")

    # Test clearing all logs
    print("\nAttempting to clear all log entries...")
    if clear_all_print_logs():
        print("Clearing all logs reported success.")
    else:
        print("Clearing all logs reported failure.")

    print("\nReading log entries (after clearing all):")
    log_data_after_clear_all = read_print_log()
    if not log_data_after_clear_all: # Expecting empty list
        print("Log data is empty as expected after clearing all.")
    elif len(log_data_after_clear_all) == 0 : # Also check for empty list this way
         print("Log data is an empty list as expected after clearing all.")
    else:
        print("Log data after clearing all (should be empty or header only):")
        for row in log_data_after_clear_all:
            print(row) # Should ideally print nothing if read_print_log correctly skips header

    # Log one more entry to ensure logging still works after clearing
    print("\nLogging one more entry after clearing...")
    final_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_print_job(final_ts, "FINAL_ENTRY.pdf", 1, "Printer_Test", "Printed")
    final_log_data = read_print_log()
    print("Final log data:")
    for row in final_log_data:
        print(row)
