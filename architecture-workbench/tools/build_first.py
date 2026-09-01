#!/usr/bin/env python3
"""Build archive data, then current preflight and a final owned-file manifest."""
import argparse,hashlib,json,os,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--app-root',type=Path,required=True);p.add_argument('--repository-root',type=Path);a=p.parse_args()
 cmd=[sys.executable,str(ROOT/'tools/build.py'),'--app-root',str(a.app_root)]
 if a.repository_root:cmd+=['--repository-root',str(a.repository_root)]
 subprocess.run(cmd,check=True)
 subprocess.run(['node',str(ROOT/'first-building/run-audit.mjs'),str(a.app_root.resolve())],check=True)
 build=json.loads((ROOT/'data/build.json').read_text());audit=json.loads((ROOT/'first-building/data/audit.json').read_text())
 build.update({'workbenchVersion':'0.2.0','defaultEntry':'first-building/','archiveEntry':'workspace.html','legacyDefaultRetired':True,'architectureAuditVersion':'0.1.0','newBuildingCompleted':False,'newBuildingEvidenceStatus':'blocked_on_primary_drawings_and_historical_identity','auditSha256':digest(ROOT/'first-building/data/audit.json'),'sourceCommit':audit['sourceCommit'],'visualApproved':False,'productionApproved':False})
 (ROOT/'data/build.json').write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n')
 paths=[p for p in ROOT.rglob('*') if p.is_file() and '__pycache__' not in str(p) and '/evidence/' not in str(p) and p.name!='file-manifest.json']
 (ROOT/'file-manifest.json').write_text(json.dumps({'version':'0.2.0','files':{str(p.relative_to(ROOT)):digest(p) for p in sorted(paths)}},ensure_ascii=False,indent=2)+'\n')
 print('FIRST_BUILDING_PREFLIGHT_BUILT; building completion and approval remain false')
if __name__=='__main__':main()
