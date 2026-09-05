"""Create a complete restart archive from the verified release source directory."""
from pathlib import Path
import os, json, hashlib, zipfile, argparse, subprocess
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--dist',type=Path,required=True);a=p.parse_args();a.dist.mkdir(parents=True,exist_ok=True)
subprocess.run(['python3',str(root/'tools/verify_package.py')],check=True)
report=json.loads((root/'qa/release-refresh/REPORT.json').read_text());assert report['allPassed']
state=json.loads((root/'PACKAGE_STATE.json').read_text())
state.update({'githubBuildSourceCommit':os.environ.get('GITHUB_SHA'),'githubActionsRunId':os.environ.get('GITHUB_RUN_ID'),'releaseBrowserChecksPassed':True,'publicSiteDeployed':False})
(root/'PACKAGE_STATE.json').write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Transport is a publishing detail. The exported package includes reconstructed,
# readable source and the complete offline runtime instead of transport chunks.
def included(p):
    r=p.relative_to(root)
    return not any(x in ['transport','__pycache__'] for x in r.parts) and r.as_posix() not in ['MANIFEST.json','SHA256SUMS.txt','materialize.py'] and p.is_file()
files=sorted(p for p in root.rglob('*') if included(p))
entries=[{'path':p.relative_to(root).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in files]
(root/'MANIFEST.json').write_text(json.dumps({'version':'0.9.8','packageRevision':'handoff.1','files':entries},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
manifest=root/'MANIFEST.json';files.append(manifest)
(root/'SHA256SUMS.txt').write_text(''.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(root).as_posix()}\n' for p in sorted(files)),encoding='utf-8');files.append(root/'SHA256SUMS.txt')
name='Tiles_Mother_V098_Full_Restart_Package_2026-09-05';target=a.dist/(name+'.zip')
with zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in sorted(files):
        i=zipfile.ZipInfo(name+'/'+p.relative_to(root).as_posix(),(2026,9,5,0,0,0));i.external_attr=0o644<<16;i.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(i,p.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
with zipfile.ZipFile(target) as z:assert z.testzip() is None
h=hashlib.sha256(target.read_bytes()).hexdigest();(a.dist/(target.name+'.sha256')).write_text(h+'  '+target.name+'\n')
receipt={'version':'0.9.8','archive':target.name,'bytes':target.stat().st_size,'sha256':h,'fileCount':len(files),'workbenchSHA256':state['sourceSHA256'],'githubBuildSourceCommit':state['githubBuildSourceCommit'],'visualApproved':False,'productionApproved':False}
(a.dist/'V098_PACKAGE_RECEIPT.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt,indent=2))
