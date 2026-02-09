#!/usr/bin/env python3
"""
InfinityGrid Sticker Designer - Backend Server
Simple HTTP server to serve the app and list icons from the Icons folder.
"""

import http.server
import json
import os
from pathlib import Path
from urllib.parse import unquote

PORT = 3000
BASE_DIR = Path(__file__).parent.resolve()
ICONS_FOLDER = BASE_DIR / "Icons_SVG"

# MIME types
MIME_TYPES = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".json": "application/json",
    ".stl": "model/stl",
}


def get_icon_files():
    """Get all SVG files from Icons_SVG folder."""
    if not ICONS_FOLDER.exists():
        print(f"Icons folder not found: {ICONS_FOLDER}")
        return []

    files = [f.name for f in ICONS_FOLDER.iterdir() if f.suffix.lower() == ".svg"]
    return sorted(files)


class RequestHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        # Suppress default logging, or customize here
        pass

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET")

    def do_GET(self):
        path = unquote(self.path)

        # API: List icons
        if path == "/api/icons":
            icons = get_icon_files()
            response = json.dumps({"files": icons})
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(response.encode())
            return

        # Serve files from Icons folder
        if path.startswith("/icons/"):
            filename = path[7:]  # Remove '/icons/'
            file_path = ICONS_FOLDER / filename

            # Security: ensure file is within Icons folder
            try:
                file_path = file_path.resolve()
                if not str(file_path).startswith(str(ICONS_FOLDER)):
                    self.send_error(403, "Forbidden")
                    return
            except Exception:
                self.send_error(400, "Bad Request")
                return

            if file_path.exists() and file_path.is_file():
                ext = file_path.suffix.lower()
                content_type = MIME_TYPES.get(ext, "application/octet-stream")

                self.send_response(200)
                self.send_header("Content-Type", content_type)
                self.send_cors_headers()
                self.end_headers()

                with open(file_path, "rb") as f:
                    self.wfile.write(f.read())
                return

            self.send_error(404, "Not Found")
            return

        # Serve static files
        if path == "/":
            path = "/index.html"

        file_path = BASE_DIR / path.lstrip("/")

        # Security: ensure file is within base directory
        try:
            file_path = file_path.resolve()
            if not str(file_path).startswith(str(BASE_DIR)):
                self.send_error(403, "Forbidden")
                return
        except Exception:
            self.send_error(400, "Bad Request")
            return

        if file_path.exists() and file_path.is_file():
            ext = file_path.suffix.lower()
            content_type = MIME_TYPES.get(ext, "application/octet-stream")

            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_cors_headers()
            self.end_headers()

            with open(file_path, "rb") as f:
                self.wfile.write(f.read())
            return

        self.send_error(404, "Not Found")


def main():
    # Create Icons folder if it doesn't exist
    ICONS_FOLDER.mkdir(exist_ok=True)

    icons = get_icon_files()

    print()
    print("🏷️  InfinityGrid Sticker Designer")
    print("━" * 34)
    print(f"Server running at: http://localhost:{PORT}")
    print(f"Icons folder: {ICONS_FOLDER}")
    print(f"Icons found: {len(icons)}")

    if len(icons) == 0:
        print()
        print("⚠️  No SVG files found in Icons_SVG folder.")
        print("   Add files with naming convention:")
        print("   category_subcategory_name.svg")
        print("   Example: electrical_connector_jst.svg")

    print()
    print("Press Ctrl+C to stop.")
    print()

    server = http.server.HTTPServer(("", PORT), RequestHandler)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.shutdown()


if __name__ == "__main__":
    main()
