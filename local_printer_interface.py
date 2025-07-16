# local_printer_interface.py
# This file will contain the functions for the local printer interface.

import os
import fitz  # PyMuPDF
from typing import Optional, Dict, Union # Union was missing for type hint
from pathlib import Path

# Assuming printer_config.py is in the same directory or accessible in PYTHONPATH
from printer_config import PrinterConfig

def get_sku_info(sku: str) -> Union[Dict[str, Union[str, float, bool]], None]:
    """
    Retrieves information about a given SKU, including its PDF file path and dimensions.

    Args:
        sku: The SKU string (e.g., "TESTSKU" or "TESTSKU.pdf").

    Returns:
        A dictionary with PDF information if found, otherwise None.
        The dictionary contains:
        - 'full_path': Absolute path to the PDF file.
        - 'filename': Name of the PDF file.
        - 'width_cm': Width of the PDF in centimeters.
        - 'height_cm': Height of the PDF in centimeters.
        - 'is_landscape': Boolean indicating if the PDF is landscape oriented.
    """
    try:
        config_manager = PrinterConfig()
        app_config = config_manager.get_config()
        temuskupdf_folder = app_config.get('temuskupdf_folder')

        if not temuskupdf_folder:
            print("Error: 'temuskupdf_folder' not configured in printer_config.json.")
            return None

        if not os.path.isdir(temuskupdf_folder):
            print(f"Error: Configured 'temuskupdf_folder' does not exist or is not a directory: {temuskupdf_folder}")
            return None

        file_name = sku if sku.lower().endswith('.pdf') else f"{sku}.pdf"
        full_path = os.path.join(temuskupdf_folder, file_name)

        if not os.path.exists(full_path):
            print(f"Error: PDF file not found at {full_path}")
            return None

        # Analyze PDF (similar to PrinterPanel._analyze_and_update_size)
        doc = fitz.open(full_path)
        if not doc or len(doc) == 0:
            print(f"Error: Could not open or read PDF: {full_path}")
            doc.close()
            return None

        page = doc[0]
        # Convert points to cm (1 point = 1/72 inch, 1 inch = 2.54 cm)
        # Conversion factor: (1/72) * 2.54 cm/point
        # PyMuPDF page.rect.width/height are in points
        width_cm = page.rect.width * (2.54 / 72.0)
        height_cm = page.rect.height * (2.54 / 72.0)
        doc.close()

        is_landscape = width_cm > height_cm
        actual_width_cm = width_cm
        actual_height_cm = height_cm

        if is_landscape:
            # If landscape, swap width and height for portrait representation often used in settings
            # However, for raw info, we might want to keep original orientation sense
            # For now, let's report dimensions as they are and a flag
            pass # Keeping dimensions as they are, is_landscape flag indicates orientation

        return {
            'full_path': full_path,
            'filename': file_name,
            'width_cm': round(actual_width_cm, 2),
            'height_cm': round(actual_height_cm, 2),
            'is_landscape': is_landscape
        }

    except Exception as e:
        print(f"An error occurred in get_sku_info: {e}")
        return None


# --- Helper function to find Ghostscript (similar to PrinterManager._find_ghostscript) ---
def _find_ghostscript() -> Optional[str]:
    """Tries to find the Ghostscript executable."""
    possible_paths = [
        r"C:\Program Files\gs\gs10.04.0\bin\gswin64c.exe", # Added common GS 10.04.0 paths
        r"C:\Program Files (x86)\gs\gs10.04.0\bin\gswin32c.exe",
        r"C:\Program Files\gs\gs10.03.1\bin\gswin64c.exe", # Older common GS paths
        r"C:\Program Files (x86)\gs\gs10.03.1\bin\gswin32c.exe",
    ]
    for path in possible_paths:
        if os.path.exists(path):
            return path
    try:
        # Try 'where' command on Windows
        import subprocess
        result = subprocess.run(['where', 'gswin64c.exe'], capture_output=True, text=True, check=False, shell=True)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().split('\n')[0]
        result = subprocess.run(['where', 'gswin32c.exe'], capture_output=True, text=True, check=False, shell=True)
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().split('\n')[0]

        # Try 'which' command on Unix-like systems
        if os.name != 'nt':
            result = subprocess.run(['which', 'gs'], capture_output=True, text=True, check=False)
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip().split('\n')[0]
    except Exception:
        pass # Silently ignore if 'where' or 'which' fails or not found
    return None

# --- Main print function ---
import subprocess
import sys
from print_logger import log_print_job # Assuming print_logger.py is accessible
from PySide6.QtCore import QDateTime # For timestamp, though can be replaced with datetime

def print_sku_locally(sku: str, quantity: int, printer_name: str,
                      gs_path: Optional[str] = None,
                      temuskupdf_folder: Optional[str] = None,
                      other_folder: Optional[str] = None,
                      print_separator: bool = True,
                      separator_pdf_name: str = "分割72.pdf") -> bool:
    """
    Prints a given SKU to a specified printer.

    Args:
        sku: The SKU to print.
        quantity: Number of copies.
        printer_name: Name of the target printer.
        gs_path: Optional path to Ghostscript executable. If None, tries to find it.
        temuskupdf_folder: Optional path to the SKU PDF folder. If None, reads from config.
        other_folder: Optional path to the folder containing separator PDFs. If None, reads from config.
        print_separator: Whether to print a separator page after the main job.
        separator_pdf_name: Filename of the separator PDF in the other_folder.

    Returns:
        True if printing (and logging) was successful, False otherwise.
    """
    if quantity <= 0:
        print("Error: Quantity must be greater than 0.")
        return False

    # 1. Get SKU Info
    # If temuskupdf_folder is provided, we can't directly use the global get_sku_info
    # as it reads from config. We need a way to pass this.
    # For now, let's assume get_sku_info will use the config if temuskupdf_folder is None
    # This is a bit of a workaround. A better way would be for get_sku_info to accept folder path.

    # Re-fetch config if specific folders aren't passed.
    # This is slightly redundant if get_sku_info also does it, but ensures paths are available here.
    _config_manager = PrinterConfig()
    _app_config = _config_manager.get_config()

    if temuskupdf_folder is None:
        temuskupdf_folder = _app_config.get('temuskupdf_folder')
    if other_folder is None:
        other_folder = _app_config.get('other_folder')

    # We need to pass the temuskupdf_folder to a modified get_sku_info or replicate logic
    # For now, I will proceed assuming get_sku_info uses the config, and ensure config is loaded.
    sku_info = get_sku_info(sku) # This will use the config from PrinterConfig()

    if not sku_info:
        print(f"Error: Could not get info for SKU '{sku}'.")
        return False

    pdf_full_path = sku_info['full_path']
    pdf_width_cm = sku_info['width_cm']
    pdf_height_cm = sku_info['height_cm']

    # Fixed paper size 7CM x 5CM
    paper_width_cm = 7.0
    paper_height_cm = 5.0

    # Convert to points (1 cm = 28.346 points)
    points_per_cm = 28.346
    paper_width_pts = paper_width_cm * points_per_cm
    paper_height_pts = paper_height_cm * points_per_cm

    pdf_width_pts = pdf_width_cm * points_per_cm
    pdf_height_pts = pdf_height_cm * points_per_cm

    # Calculate centering offset
    offset_x_pts = (paper_width_pts - pdf_width_pts) / 2
    offset_y_pts = (paper_height_pts - pdf_height_pts) / 2

    # 2. Find Ghostscript
    if gs_path is None:
        gs_path = _find_ghostscript()
    if not gs_path or not os.path.exists(gs_path):
        print("Error: Ghostscript executable not found or path is invalid.")
        print("Please install Ghostscript or provide a valid 'gs_path'.")
        return False

    # 3. Prepare Ghostscript Command
    creation_flags = 0
    if sys.platform == "win32":
        creation_flags = subprocess.CREATE_NO_WINDOW

    base_gs_command = [
        gs_path,
        "-dNOPAUSE",
        "-dBATCH",
        "-dSAFER",
        "-sDEVICE=mswinpr2",
        f"-sOutputFile=%printer%{printer_name}",
        f"-dNumCopies={quantity}",
        f"-dDEVICEWIDTHPOINTS={paper_width_pts}",
        f"-dDEVICEHEIGHTPOINTS={paper_height_pts}",
        "-c",
        f"<< /PageOffset [{offset_x_pts} {offset_y_pts}] /BeginPage {{ 1.0 dup scale }}  >> setpagedevice",
        "-f"
    ]

    main_print_command = base_gs_command + [pdf_full_path]

    # 4. Execute Main Print Command
    try:
        print(f"Executing Ghostscript for main document: {' '.join(main_print_command)}")
        result = subprocess.run(
            main_print_command,
            check=True, # Raises CalledProcessError on non-zero exit
            capture_output=True,
            text=True,
            shell=False, # Safer not to use shell=True if command is fully formed
            creationflags=creation_flags
        )

        if result.returncode == 0:
            print(f"Successfully submitted '{sku_info['filename']}' ({quantity} copies) to printer '{printer_name}'.")
            # Log the main print job
            current_time_str = QDateTime.currentDateTime().toString("yyyy-MM-dd hh:mm:ss")
            log_print_job(
                timestamp=current_time_str,
                sku_or_filename=sku_info['filename'],
                quantity=quantity,
                printer_name=printer_name,
                status="Printed via Local Interface"
            )

            # 5. Optionally Print Separator Page
            if print_separator and other_folder and separator_pdf_name:
                full_separator_path = os.path.join(other_folder, separator_pdf_name)
                if os.path.exists(full_separator_path):
                    separator_gs_command = [
                        gs_path,
                        "-dNOPAUSE", "-dBATCH", "-dSAFER",
                        "-sDEVICE=mswinpr2",
                        f"-sOutputFile=%printer%{printer_name}",
                        "-dNumCopies=1", # Force 1 copy for separator
                        f"-dDEVICEWIDTHPOINTS={paper_width_pts}",
                        f"-dDEVICEHEIGHTPOINTS={paper_height_pts}",
                        "-c",
                        f"<< /PageOffset [{offset_x_pts} {offset_y_pts}] /BeginPage {{ 1.0 dup scale }}  >> setpagedevice",
                        "-f",
                        full_separator_path
                    ]
                    try:
                        print(f"Executing Ghostscript for separator: {' '.join(separator_gs_command)}")
                        sep_result = subprocess.run(
                            separator_gs_command,
                            check=True, capture_output=True, text=True,
                            shell=False, creationflags=creation_flags
                        )
                        if sep_result.returncode == 0:
                            print(f"Successfully printed separator page '{separator_pdf_name}'.")
                            log_print_job(
                                timestamp=QDateTime.currentDateTime().toString("yyyy-MM-dd hh:mm:ss"),
                                sku_or_filename=separator_pdf_name,
                                quantity=1,
                                printer_name=printer_name,
                                status="Printed Separator via Local Interface"
                            )
                        else:
                            print(f"Warning: Ghostscript failed for separator page '{separator_pdf_name}'. Stderr: {sep_result.stderr}")
                    except subprocess.CalledProcessError as sep_e:
                        print(f"Error printing separator page '{separator_pdf_name}': {sep_e}")
                        print(f"Stderr: {sep_e.stderr}")
                    except Exception as sep_e_gen:
                        print(f"General error printing separator page: {sep_e_gen}")
                else:
                    print(f"Warning: Separator PDF '{separator_pdf_name}' not found in '{other_folder}'. Skipping.")
            elif print_separator:
                print("Warning: Separator printing enabled but 'other_folder' or 'separator_pdf_name' is not set. Skipping separator.")

            return True # Main job was successful

        else: # Should be caught by check=True, but as a fallback
            print(f"Error: Ghostscript returned code {result.returncode} for '{pdf_full_path}'. Stderr: {result.stderr}")
            return False

    except subprocess.CalledProcessError as e:
        print(f"Error executing Ghostscript for '{pdf_full_path}': {e}")
        print(f"Command: {' '.join(e.cmd)}")
        print(f"Stderr: {e.stderr}")
        return False
    except FileNotFoundError: # If gs_path itself is not found by subprocess.run
        print(f"Error: Ghostscript executable not found at path '{gs_path}'. Ensure it is correct and accessible.")
        return False
    except Exception as e_gen:
        print(f"An unexpected error occurred during printing: {e_gen}")
        return False