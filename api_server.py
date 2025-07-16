# api_server.py
import http.server
import socketserver
import json
import threading
import win32print
from local_printer_interface import print_sku_locally
from printer_config import PrinterConfig

PORT = 8080

class StoppableHTTPServer(socketserver.TCPServer):
    """A stoppable HTTP server."""
    def serve_forever(self, poll_interval=0.5):
        self._stop_event = threading.Event()
        super().serve_forever(poll_interval)

    def shutdown(self):
        self._stop_event.set()

class PrintAPIHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/print':
            try:
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data)

                sku = data.get('sku')
                quantity = data.get('quantity')

                print(f"Received print request: SKU={sku}, Quantity={quantity}")

                if not sku or not quantity:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b'Missing sku or quantity')
                    return

                printer_name = win32print.GetDefaultPrinter()

                success = print_sku_locally(
                    sku=sku,
                    quantity=quantity,
                    printer_name=printer_name
                )

                if success:
                    self.send_response(200)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(b'Print job submitted')
                else:
                    self.send_response(500)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.end_headers()
                    self.wfile.write(b'Failed to submit print job')

            except Exception as e:
                self.send_response(500)
                self.end_headers()
                self.wfile.write(f'Server error: {e}'.encode())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'Not Found')

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type")
        self.end_headers()

def create_server():
    return StoppableHTTPServer(("", PORT), PrintAPIHandler)

if __name__ == '__main__':
    server = create_server()
    print(f"Serving on port {PORT}")
    server.serve_forever()