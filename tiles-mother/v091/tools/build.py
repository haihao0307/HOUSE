#!/usr/bin/env python3
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
html = (root / "workbench/index.html").read_bytes()
scripts = re.findall(rb"<script\b[^>]*>(.*?)</script>", html, re.S | re.I)
if len(scripts) != 8 or not any(b"var TilesReferenceRuntime=" in script for script in scripts):
    raise SystemExit("Invalid self-contained workbench")
(root / "index.html").write_bytes(html)
print(root / "index.html")
