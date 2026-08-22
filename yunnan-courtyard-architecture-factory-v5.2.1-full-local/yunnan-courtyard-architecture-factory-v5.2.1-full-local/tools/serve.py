#!/usr/bin/env python3
from __future__ import annotations

import argparse
import http.server
import socketserver
import threading
import webbrowser
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Serve the Yunnan architecture factory locally")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    handler = lambda *a, **kw: http.server.SimpleHTTPRequestHandler(*a, directory=str(root), **kw)
    url = f"http://{args.host}:{args.port}/"

    with socketserver.ThreadingTCPServer((args.host, args.port), handler) as httpd:
        httpd.daemon_threads = True
        print(f"Local server: {url}")
        print("Press Ctrl+C to stop.")
        if not args.no_browser:
            threading.Timer(0.8, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
