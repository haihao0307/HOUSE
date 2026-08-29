from pathlib import Path
import json
import re

root = Path(
    "yunnan-courtyard-architecture-factory-v5.2.1-full-local/"
    "yunnan-courtyard-architecture-factory-v5.2.1-full-local/brick-mother"
)

index = (root / "index.html").read_text(encoding="utf-8")
styles = {
    "style.css": (root / "style.css").read_text(encoding="utf-8"),
    "gaea-distilled.css": (root / "gaea-distilled.css").read_text(encoding="utf-8"),
    "visual-calibration.css": (root / "visual-calibration.css").read_text(encoding="utf-8"),
}
scripts = {
    "brick-mother-gaea-kernel-v1.js": (root / "brick-mother-gaea-kernel-v1.js").read_text(encoding="utf-8"),
    "brick-mother-geometry-v2.js": (root / "brick-mother-geometry-v2.js").read_text(encoding="utf-8"),
    "brick-mother-renderer-v2.js": (root / "brick-mother-renderer-v2.js").read_text(encoding="utf-8"),
}
app = (root / "brick-mother-app-v2.js").read_text(encoding="utf-8")
data = json.loads((root / "data/brick-material-profiles-v2.json").read_text(encoding="utf-8"))
html = index

for filename, css in styles.items():
    pattern = rf'<link rel="stylesheet" href="\./{re.escape(filename)}[^"]*"[^>]*>'
    html, count = re.subn(
        pattern,
        "<style>\n" + css.replace("</style>", "<\\/style>") + "\n</style>",
        html,
        count=1,
    )
    if count != 1:
        raise RuntimeError(f"failed to inline stylesheet {filename}: {count}")

for filename, source in scripts.items():
    pattern = rf'<script src="\./{re.escape(filename)}[^"]*" defer></script>'
    html, count = re.subn(
        pattern,
        "<script>\n" + source.replace("</script>", "<\\/script>") + "\n</script>",
        html,
        count=1,
    )
    if count != 1:
        raise RuntimeError(f"failed to inline script {filename}: {count}")

inline_data = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
wrapped_app = 'window.addEventListener("DOMContentLoaded", () => {\n' + app + "\n});"
app_inline = (
    "<script>window.__BRICK_MOTHER_INLINE_DATA__=" + inline_data + ";</script>\n"
    "<script>\n" + wrapped_app.replace("</script>", "<\\/script>") + "\n</script>"
)
html, count = re.subn(
    r'<script src="\./brick-mother-app-v2\.js[^"]*" defer></script>',
    lambda _match: app_inline,
    html,
    count=1,
)
if count != 1:
    raise RuntimeError(f"failed to inline app script: {count}")

html = html.replace(
    "<title>Brick Mother 砖块母体生产线 V2</title>",
    "<title>Brick Mother V2.7 视觉真值单文件网页版</title>",
    1,
)
standalone = root / "brick-mother-standalone-v2.7.html"
standalone.write_text(html, encoding="utf-8")
print(f"Wrote {standalone} ({standalone.stat().st_size} bytes)")
