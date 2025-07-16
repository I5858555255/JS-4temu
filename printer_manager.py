# printer_manager.py
import os
import sys
import tempfile
import win32print
from functools import partial

from PySide6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout,
                               QHBoxLayout, QCheckBox, QLabel, QPushButton,
                               QFileDialog, QLineEdit, QSpinBox, QListWidget,
                               QGroupBox, QMessageBox, QFrame, QTabWidget,
                               QTableWidget, QTableWidgetItem, QHeaderView)
from PySide6.QtCore import Qt, QDateTime
from printer_config import PrinterConfig
from printer_panel import PrinterPanel
from print_logger import read_print_log, LOG_HEADER, delete_print_log_entry, clear_all_print_logs # Added clear_all_print_logs

def read_printers_from_file(file_path: str) -> list:
    printers = []
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            printers = [line.strip() for line in f.readlines() if line.strip()]
    return printers

class PrinterManager(QMainWindow):
    def __init__(self):
        super().__init__()
        self.printer_config = PrinterConfig()
        self.config = self.printer_config.get_config()

        self.temuskupdf_folder = self.config.get('temuskupdf_folder', 'D:\\temuskupdf')
        self.other_folder = self.config.get('other_folder', 'D:\\other')
        self.print_set_file = self.config.get('print_set_file', 'print_set.txt')

        self.printer_panels = {}
        self.temp_dir = tempfile.mkdtemp()
        self.default_printer = win32print.GetDefaultPrinter()
        self.history_table = None
        self.print_tab_widget = None

        self.gs_path = self._find_ghostscript()
        if not self.gs_path:
            QMessageBox.warning(self, "警告", "未找到 Ghostscript，请确保正确安装了 Ghostscript 10.04.0 或兼容版本。")

        self._init_ui()

    def _find_ghostscript(self):
        possible_paths = [
            r"C:\Program Files\gs\gs10.04.0\bin\gswin64c.exe",
            r"C:\Program Files (x86)\gs\gs10.04.0\bin\gswin32c.exe",
        ]
        for path in possible_paths:
            if os.path.exists(path):
                return path
        try:
            import subprocess
            result = subprocess.run(['where', 'gswin64c.exe'], capture_output=True, text=True, check=True, shell=True)
            if result.stdout.strip(): return result.stdout.strip().split('\n')[0]
            result = subprocess.run(['where', 'gswin32c.exe'], capture_output=True, text=True, check=True, shell=True)
            if result.stdout.strip(): return result.stdout.strip().split('\n')[0]
        except Exception:
            pass
        return None

    def __del__(self):
        try:
            import shutil
            if hasattr(self, 'temp_dir') and os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir)
        except Exception as e:
            print(f"Error cleaning up temp directory: {e}")

    def _init_ui(self):
        self.setWindowTitle('打印管理系统')
        self.setGeometry(100, 100, 950, 700)

        self.tabs_widget = QTabWidget()
        self.setCentralWidget(self.tabs_widget)

        self.print_tab_widget = QWidget()
        self.print_tab_layout = QVBoxLayout(self.print_tab_widget)

        printers = read_printers_from_file(self.print_set_file)
        if not printers:
            no_printers_label = QLabel(f"没有在 {self.print_set_file} 文件中找到打印机。\n请检查文件内容和路径设置。")
            no_printers_label.setAlignment(Qt.AlignCenter)
            self.print_tab_layout.addWidget(no_printers_label)
        else:
            for printer_name in printers:
                self.create_printer_panel(printer_name, self.print_tab_layout)

        self.tabs_widget.addTab(self.print_tab_widget, "打印")

        history_tab_widget = QWidget()
        history_layout = QVBoxLayout(history_tab_widget)

        # Top button layout for Refresh and Clear All
        top_button_layout = QHBoxLayout()

        refresh_button = QPushButton("刷新记录")
        refresh_button.clicked.connect(self._load_print_history)
        top_button_layout.addWidget(refresh_button)

        top_button_layout.addStretch(1) # Add stretch to push Clear All to the right

        clear_all_button = QPushButton("清空所有记录")
        clear_all_button.setStyleSheet("QPushButton { color: red; }") # Make it look dangerous
        clear_all_button.clicked.connect(self._handle_clear_all_records_button_clicked)
        top_button_layout.addWidget(clear_all_button)

        history_layout.addLayout(top_button_layout) # Add the button layout to the main history tab layout

        self.history_table = QTableWidget()
        self.action_column_title = "操作"
        self.history_table_headers = LOG_HEADER + [self.action_column_title]
        self.history_table.setColumnCount(len(self.history_table_headers))
        self.history_table.setHorizontalHeaderLabels(self.history_table_headers)
        self.history_table.setSortingEnabled(True)

        self.history_table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeToContents)
        action_column_idx = self.history_table_headers.index(self.action_column_title)
        self.history_table.horizontalHeader().setSectionResizeMode(action_column_idx, QHeaderView.Fixed)
        self.history_table.setColumnWidth(action_column_idx, 160)

        history_layout.addWidget(self.history_table) # Add table below buttons

        self.tabs_widget.addTab(history_tab_widget, "打印历史")

        self._load_print_history()

    def create_printer_panel(self, printer_name: str, layout: QVBoxLayout):
        panel = PrinterPanel(printer_name, self, self.printer_config, self)
        self.printer_panels[printer_name] = panel
        layout.addWidget(panel.panel)

    def _load_print_history(self):
        if not self.history_table:
            return

        log_data = read_print_log()
        self.history_table.setSortingEnabled(False)
        self.history_table.setRowCount(0)

        if not log_data:
            self.history_table.setSortingEnabled(True)
            return

        self.history_table.setRowCount(len(log_data))
        action_column_idx = self.history_table_headers.index(self.action_column_title)

        for row_idx, record in enumerate(reversed(log_data)):
            for col_idx, item_text in enumerate(record):
                table_item = QTableWidgetItem(item_text)
                table_item.setFlags(table_item.flags() & ~Qt.ItemIsEditable)
                self.history_table.setItem(row_idx, col_idx, table_item)

            timestamp_for_buttons = record[0]
            sku_basename = record[1]
            quantity_str = record[2]
            printer_name_for_reprint = record[3]

            try:
                quantity = int(quantity_str)
            except ValueError:
                quantity = 1
                print(f"Warning: Could not parse quantity '{quantity_str}' for log entry: {record}. Defaulting to 1.")

            action_widget = QWidget()
            action_layout = QHBoxLayout(action_widget)
            action_layout.setContentsMargins(5, 0, 5, 0)
            action_layout.setSpacing(5)

            reprint_button = QPushButton("重打")
            reprint_button.clicked.connect(
                partial(self._handle_reprint_button_clicked,
                        printer_name_for_reprint,
                        sku_basename,
                        quantity)
            )
            action_layout.addWidget(reprint_button)

            delete_button = QPushButton("删除")
            delete_button.clicked.connect(
                partial(self._handle_delete_button_clicked, timestamp_for_buttons)
            )
            action_layout.addWidget(delete_button)

            self.history_table.setCellWidget(row_idx, action_column_idx, action_widget)

        self.history_table.setSortingEnabled(True)

    def _handle_reprint_button_clicked(self, printer_name: str, sku_basename: str, quantity: int):
        target_panel = self.printer_panels.get(printer_name)
        if not target_panel:
            QMessageBox.warning(self, "重打印错误", f"打印机 '{printer_name}' 当前未配置或不可用。")
            return

        if not self.temuskupdf_folder:
             QMessageBox.critical(self, "配置错误", "Temuskupdf 文件夹路径未在配置中设置。")
             return
        full_path = os.path.join(self.temuskupdf_folder, sku_basename)

        if not os.path.exists(full_path):
            QMessageBox.warning(self, "重打印错误", f"文件 '{full_path}' 不再存在，无法重打印。")
            return

        if self.print_tab_widget:
            self.tabs_widget.setCurrentWidget(self.print_tab_widget)

        target_panel.file_path.setText(full_path)
        target_panel.copies_spinbox.setValue(quantity)
        target_panel.panel.setFocus()
        target_panel.file_path.setFocus()
        target_panel._print_file()

    def _handle_delete_button_clicked(self, timestamp_to_delete: str):
        reply = QMessageBox.question(self, '确认删除',
                                     f"您确定要删除这条打印记录吗？\n时间戳: {timestamp_to_delete}",
                                     QMessageBox.Yes | QMessageBox.No, QMessageBox.No)

        if reply == QMessageBox.Yes:
            deleted = delete_print_log_entry(timestamp_to_delete)
            if deleted:
                QMessageBox.information(self, "删除成功", "选择的打印记录已成功删除。")
                self._load_print_history()
            else:
                QMessageBox.warning(self, "删除失败", "未能删除选择的打印记录。\n记录可能已被移除或发生文件错误。")

    def _handle_clear_all_records_button_clicked(self):
        reply = QMessageBox.question(self, '确认清空所有记录',
                                     "您确定要删除所有打印记录吗？\n此操作无法撤销！",
                                     QMessageBox.Yes | QMessageBox.No, QMessageBox.No)

        if reply == QMessageBox.Yes:
            cleared = clear_all_print_logs()
            if cleared:
                QMessageBox.information(self, "清空成功", "所有打印记录已成功删除。")
                self._load_print_history() # Refresh the table, it should be empty
            else:
                QMessageBox.warning(self, "清空失败", "清空所有打印记录失败。\n可能发生文件错误。")


if __name__ == '__main__':
    app = QApplication(sys.argv)
    manager = PrinterManager()
    manager.show()
    sys.exit(app.exec())
