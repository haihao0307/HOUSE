from pathlib import Path
import subprocess, json, os, tempfile, hashlib, base64
from concurrent.futures import ThreadPoolExecutor
root=Path('G:/HOUSE')
work=root/'brick-tiles-mother-09i-20261026'
core=root/'TILES_MOTHER_R02'
parent='b332b5a8a896973cab1b6da9d77882dec1803669'
branch='codex/tiles-mother-sheet-r02-20261026'
tag='tiles-mother-sheet-r02-20261026'
receipt=work/'PUBLISH_RECEIPT.json'
for f in ['QA09I.json','FOLD_CONTACT09I.json','SUPPORT09I.json']:
    assert json.loads((work/f).read_text())['pass'],f
for f in ['VALIDATION.json','GPU_VALIDATION.json']:
    assert json.loads((core/f).read_text())['pass'],f
files={str(p.relative_to(root)).replace('\\','/'):p for p in core.iterdir() if p.is_file() and p.suffix in ['.md','.cjs','.js','.json','.glsl','.html','.py']}
for name in ['AGENTS.md','TILES_MOTHER_CHARTER.md','TILE_FUNCTION_R01/SHEET_LEARNING.md']:
    files[name]=root/name
for name in ['START_HERE.html','QA09I.json','FOLD_CONTACT09I.json','SUPPORT09I.json','qa09i.cjs','contact-fold09i.cjs','support09i.cjs','roof-cache09i.json','stitch-cache09i.json','LOCAL_BROWSER09I.json']:
    files['brick-tiles-mother/09i/'+name]=work/name
def git(*args,input=None,env=None):
    return subprocess.check_output(['git','-C',str(root),*args],input=input,env=env)
if receipt.exists():
    r=json.loads(receipt.read_text()); commit=r['commit']; tree=r['tree']
else:
    with tempfile.TemporaryDirectory(prefix='tiles-r02-') as tmp:
        environ=dict(os.environ,GIT_INDEX_FILE=str(Path(tmp)/'index'))
        git('read-tree',parent,env=environ)
        for name,p in files.items():
            blob=git('hash-object','-w','--stdin',input=p.read_bytes()).decode().strip()
            git('update-index','--add','--cacheinfo','100644',blob,name,env=environ)
        tree=git('write-tree',env=environ).decode().strip()
        commit=git('commit-tree',tree,'-p',parent,input=b'Tiles Mother R02: shared sheet pressing and unified material evaluation\n').decode().strip()
    for ref in ['refs/heads/'+branch,'refs/tags/'+tag]:
        git('update-ref',ref,commit,'0'*40)
    r={'version':'09I / Tiles Mother R02','commit':commit,'tree':tree,'parent':parent,'branch':branch,'tag':tag,'files':sorted(files),'public_preview':f'https://raw.githack.com/haihao0307/HOUSE/{commit}/brick-tiles-mother/09i/START_HERE.html','remote_verified':False,'public_browser_verified':False,'user_visual_accepted':False}
    receipt.write_text(json.dumps(r,indent=2),encoding='utf8')
# Reuse established credential transport without printing secrets.
exec((root/'brick-tiles-mother-09h-20261026/publish09h.py').read_text(encoding='utf8').split('files=[')[0])
# That prefix supplies call() and auth only; restore this publication identity.
parent=r['parent'];branch=r['branch'];tag=r['tag']
def upload(name):
    sha=git('rev-parse',commit+':'+name).decode().strip()
    raw=git('cat-file','blob',sha)
    blob=call('POST','/git/blobs',{'encoding':'base64','content':base64.b64encode(raw).decode()})
    assert blob['sha']==sha,name
    return {'path':name,'mode':'100644','type':'blob','sha':sha}
p=call('GET','/git/commits/'+parent)
with ThreadPoolExecutor(max_workers=3) as pool: entries=list(pool.map(upload,r['files']))
t=call('POST','/git/trees',{'base_tree':p['tree']['sha'],'tree':entries});assert t['sha']==tree
meta=git('show','-s','--format=%an%n%ae%n%aI%n%cn%n%ce%n%cI',commit).decode().splitlines()
body=git('cat-file','commit',commit).split(b'\n\n',1)[1].decode()
c=call('POST','/git/commits',{'message':body,'tree':tree,'parents':[parent],'author':dict(zip(['name','email','date'],meta[:3])),'committer':dict(zip(['name','email','date'],meta[3:]))});assert c['sha']==commit
for ref in ['heads/'+branch,'tags/'+tag]:
    v=call('GET','/git/ref/'+ref,allow404=True)
    if v: assert v['object']['sha']==commit
    else: call('POST','/git/refs',{'ref':'refs/'+ref,'sha':commit})
    assert call('GET','/git/ref/'+ref)['object']['sha']==commit
r['remote_verified']=True
receipt.write_text(json.dumps(r,indent=2),encoding='utf8')
print(json.dumps({k:r[k] for k in ['commit','tag','public_preview','remote_verified']}))
