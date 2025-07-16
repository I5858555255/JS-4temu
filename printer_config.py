# printer_config.py
import os
import json

class PrinterConfig:
    def __init__(self):
        self.config_file = "printer_config.json"
        self.default_paths = {
            'temuskupdf_folder': 'D:\\temuskupdf',
            'other_folder': 'D:\\other',
            'print_set_file': 'D:\\print_set.txt'
        }
        self.config = self.load_config()

    def load_config(self):
        config_changed = False
        if os.path.exists(self.config_file):
            with open(self.config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
        else:
            config = {
                'selected_printers': [],
                'last_sizes': {},
                'last_paths': {}
            }
            config_changed = True # If file doesn't exist, it will be new, so defaults will be added.

        for key, value in self.default_paths.items():
            if key not in config:
                config[key] = value
                config_changed = True

        if config_changed:
            # Save immediately if defaults were added or if the file was newly created
            self._save_config_data(config)

        return config

    def _save_config_data(self, config_data):
        # Internal method to save config data, used by load_config and save_config
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(config_data, f, indent=4)

    def save_config(self):
        # Public method to save the current state of self.config
        self._save_config_data(self.config)

    def get_config(self):
        return self.config
