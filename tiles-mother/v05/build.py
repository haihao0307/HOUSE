"""Build the V0.5 adapter from the actual published V0.4 entry point."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

BASE_COMMIT = "f7650361b7b783745b47154848dc0974705855c8"
INDEX_PATH = "tiles-mother/index.html"
ROOT = Path(__file__).resolve().parents[2]
V05 = ROOT / "tiles-mother" / "v05"
CONFIG = ROOT / "tiles-mother" / "knowledge" / "jiangwutang-001" / "material-candidate-v0.5.json"
MODULES = ["profile.js", "geometry-operators.js", "roof-joints.js", "studio.js", "integration.js"]
FORBIDDEN = ("讲武堂瓦片精细.zip", "01.fbx", "01_u1_v1_diffuse.png", "01_u1_v1_normal.png")


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob(commit: str, path: str) -> bytes:
    return subprocess.check_output(["git", "show", f"{commit}:{path}"], cwd=ROOT)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one {label}, found {count}")
    return text.replace(old, new, 1)


def build(base: str) -> str:
    html = base.replace("\r\n", "\n")
    app_match = re.search(r'(<script id="tiles-mother-app">)([\s\S]*?)(</script>)', html)
    if not app_match:
        raise SystemExit("V0.4 app script not found")
    app = app_match.group(2)

    def app_replace(old: str, new: str, label: str) -> None:
        nonlocal app
        app = replace_once(app, old, new, label)

    app_replace("const VERSION='0.4.0';", "const VERSION='0.5.0';", "app version")
    app_replace("package:'TILES_THIN_SHELL_EVOLUTION_V0.4',version:'0.4.0'", "package:'TILES_THIN_SHELL_EVOLUTION_V0.5',version:'0.5.0'", "source package")
    app_replace("config:'knowledge/jiangwutang-001/material-candidate-v0.3.json'", "config:'knowledge/jiangwutang-001/material-candidate-v0.5.json'", "source config")
    app_replace("generator:'v04/operators.js',renderer:'v04/studio.js',adapter:'v04/integration.js'", "generator:'v05/geometry-operators.js',renderer:'v04/studio.js',adapter:'v05/integration.js'", "source generator")
    app_replace("materialPreset:'relief-v04',study:studyDefaults()", "materialPreset:'jiangwutang-v05',v05:{enabled:true,view:'roof',mode:'studio_beauty',focus:'all',layers:{macro:true,meso:true,micro:true,weather:true},physicalTime:0,solverStep:21600,displayTime:0},study:studyDefaults()", "new V0.5 project")
    app_replace("!['0.1.0','0.2.0','0.3.0','0.4.0'].includes(raw.version)", "!['0.1.0','0.2.0','0.3.0','0.4.0','0.5.0'].includes(raw.version)", "accepted project versions")
    app_replace("支持 V0.1 至 V0.4。", "支持 V0.1 至 V0.5。", "migration text")
    app_replace("p.materialPreset=raw.version==='0.4.0'&&['relief-v04','legacy-v02','jiangwutang-v03'].includes(raw.materialPreset)?raw.materialPreset:'relief-v04';", "p.materialPreset=['jiangwutang-v05','relief-v04','legacy-v02','jiangwutang-v03'].includes(raw.materialPreset)?raw.materialPreset:'relief-v04';", "material preset migration")
    app_replace("const p=newProject();if(Object.hasOwn(PROFILE_DEFS,raw.active))", "const p=newProject();if(raw.v05&&typeof raw.v05==='object'){p.v05={...p.v05,...raw.v05,layers:{...p.v05.layers,...(raw.v05.layers||{})}};}if(Object.hasOwn(PROFILE_DEFS,raw.active))", "V0.5 state migration")
    app_replace(" attachReferenceAPI();attachStudyAPI();", " window.TilesMotherV05?.connect({app:window.TilesMother,renderer,project,saveSoon});\n attachReferenceAPI();attachStudyAPI();", "V0.5 adapter connection")
    html = html[:app_match.start(2)] + app + html[app_match.end(2):]
    html = html.replace("V0.4 · 立体瓦面研究候选", "V0.5 · 讲武堂材质候选", 1)
    html = html.replace("V0.4 使用真实起伏网格和共享湿润历史。尺寸、微结构和时间响应均为待校准候选。", "V0.5 使用真实网格、独立种子和候选屋面关系。尺寸、微结构和时间响应均为待校准候选。", 1)

    scripts = "\n".join(f'<script src="v05/{name}?v=0.5.0"></script>' for name in MODULES)
    html = replace_once(html, '<script id="tiles-mother-app">', scripts + '\n<script id="tiles-mother-app">', "V0.5 scripts")
    html = html.replace("<title>Tiles Mother V0.4 · 立体瓦面与共享岁月</title>", "<title>Tiles Mother V0.5 · 讲武堂几何与材质候选</title>")
    css = """<style id="tm-v05-style">#v05Panel{border-top:1px solid #c7c9c4;padding-top:12px}.v05-panel .row{gap:6px}.v05-panel button.active{background:#6e5946;color:#fff}.v05-panel output{float:right;color:#76634e}.v05-panel .explain{font-size:10px;line-height:1.55}.v05-panel select{width:100%}.v05-panel details{margin-top:8px}.v05-panel label{margin:5px 0}.v05-panel input[type=range]{width:100%}@media(max-width:600px){#v05Panel{order:-1}}</style>"""
    html = replace_once(html, "</head>", css + "\n</head>", "V0.5 styles")
    for marker in ["const VERSION='0.5.0';", 'v05/geometry-operators.js', 'TilesMotherV05?.connect', 'jiangwutang-v05']:
        if marker not in html:
            raise SystemExit(f"generated V0.5 missing {marker}")
    leaked = [marker for marker in FORBIDDEN if marker in html]
    if leaked:
        raise SystemExit(f"raw source leaked into runtime HTML: {leaked}")
    return html


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--base-commit", default=BASE_COMMIT)
    args = parser.parse_args()
    base_bytes = git_blob(args.base_commit, INDEX_PATH)
    generated = build(base_bytes.decode("utf-8")).encode("utf-8")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(generated)
    module_records = [{"path": f"tiles-mother/v05/{name}", "bytes": (V05 / name).stat().st_size, "sha256": sha((V05 / name).read_bytes())} for name in MODULES]
    manifest = {
        "schema": "tiles-mother-v05-build-manifest", "version": "0.5.0", "baseCommit": args.base_commit,
        "baseIndexSHA256": sha(base_bytes), "indexPath": INDEX_PATH, "indexSHA256": sha(generated), "bytes": len(generated),
        "runtimeModules": module_records, "configPath": "tiles-mother/knowledge/jiangwutang-001/material-candidate-v0.5.json", "configSHA256": sha(CONFIG.read_bytes()),
        "runtimeSourceDependencies": ["first-party V0.4 renderer and storage/import workflow", "first-party V0.5 geometry, roof and state adapters"],
        "rawSourceInRuntime": False, "completeLargeTexturesInRuntime": False, "legacyV02V03V04FallbackPreserved": True,
        "policyVersionRead": "1.0.0", "policySchemaAndValidatorIdentity": "not_received", "visualApproved": False, "productionApproved": False, "distillationComplete": False
    }
    args.manifest.parent.mkdir(parents=True, exist_ok=True)
    args.manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
