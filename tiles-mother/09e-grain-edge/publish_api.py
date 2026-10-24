from pathlib import Path
import subprocess, json, os, base64, hashlib, time
from concurrent.futures import ThreadPoolExecutor
from urllib.request import Request, urlopen
from urllib.error import HTTPError

here=Path(__file__).parent
branch='codex/tiles09c-source-rebuild-20261024'
prefix='tiles-mother/09c-source-rebuild'
parent='3ab76bebf906c4c467b7ac95704d7fd4a5514385'
env=dict(os.environ,GCM_INTERACTIVE='Never',GIT_TERMINAL_PROMPT='0')
c=subprocess.run(['git','credential','fill'],input='protocol=https\nhost=github.com\n\n',capture_output=True,text=True,env=env,timeout=30)
creds=dict(line.split('=',1) for line in c.stdout.splitlines() if '=' in line)
if 'password' not in creds:raise SystemExit('Noninteractive GitHub credential unavailable')
headers={'Authorization':'Bearer '+creds['password'],'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'}
api='https://api.github.com/repos/haihao0307/HOUSE'
def call(method,path,data=None,allow404=False):
    for attempt in range(3):
        req=Request(api+path,data=json.dumps(data).encode() if data is not None else None,headers=headers,method=method)
        try:
            with urlopen(req,timeout=45) as r:return json.load(r)
        except HTTPError as err:
            if allow404 and err.code==404:return None
            if err.code in [502,503,504] and attempt<2:time.sleep(2);continue
            raise RuntimeError(f'GitHub API {method} {path}: HTTP {err.code}') from None

files=['START_HERE.html','README.md','LEARNING_UPDATE.md','sources.json','source-curves.json','paint-curves.json','ridge_ink09c.json','source_observations09c.json','SOURCE_ROOFS09C_OBSERVATIONS.json','SOURCE_GEOMETRY09C.json','DETAIL_GEOMETRY_QA.json','SOURCE_COVERAGE09C.json','LOCAL_BROWSER09C.json','roof_seats09c.json','MOTHER_OBJECT_DEFINITION_RULE_2026-09-09.md','MOTHER_PUBLIC_PREVIEW_DELIVERY_RULE_2026-09-08.md','FUNCTION_ENTRY_HANDOFF_09C.md']
files += [p.name for p in sorted(here.glob('*.js'))] + [p.name for p in sorted(here.glob('*.py'))] + ['source_geometry09c.cjs','detail_geometry_qa.cjs']
files += [p.relative_to(here).as_posix() for folder in ['vendor','references'] for p in sorted((here/folder).glob('*')) if p.is_file()]
files=list(dict.fromkeys(files))
for name in files:
    if not (here/name).is_file():raise SystemExit('Missing delivery file '+name)
for name in ['SOURCE_GEOMETRY09C.json','DETAIL_GEOMETRY_QA.json','LOCAL_BROWSER09C.json']:
    if not json.loads((here/name).read_text(encoding='utf-8'))['pass']:raise SystemExit('QA has not passed: '+name)

def upload(name):
    raw=(here/name).read_bytes();digest=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
    existing=call('GET','/git/blobs/'+digest,allow404=True)
    if not existing:existing=call('POST','/git/blobs',{'encoding':'base64','content':base64.b64encode(raw).decode()})
    if existing['sha']!=digest:raise RuntimeError('Blob integrity mismatch: '+name)
    print('Verified blob '+name,flush=True)
    return {'path':prefix+'/'+name,'mode':'100644','type':'blob','sha':digest}
parent_info=call('GET','/git/commits/'+parent)
with ThreadPoolExecutor(max_workers=3) as pool:entries=list(pool.map(upload,files))
tree=call('POST','/git/trees',{'base_tree':parent_info['tree']['sha'],'tree':entries})
existing=call('GET','/git/ref/heads/'+branch,allow404=True)
if existing:
    commit=call('GET','/git/commits/'+existing['object']['sha'])
    if commit['tree']['sha']!=tree['sha']:raise SystemExit('Existing branch has a different tree; no branch changed')
else:
    commit=call('POST','/git/commits',{'message':'Tiles Mother 09C: align drip lips, restore axial timber and rebuild source-specific sections','tree':tree['sha'],'parents':[parent]})
    call('POST','/git/refs',{'ref':'refs/heads/'+branch,'sha':commit['sha']})
receipt={'version':'09C','commit':commit['sha'],'tree':tree['sha'],'branch':branch,'public_preview':'https://raw.githack.com/haihao0307/HOUSE/'+commit['sha']+'/'+prefix+'/START_HERE.html','public_browser_verified':False,'user_visual_accepted':False,'historical_replica_verified':False,'files':len(files),'source_read_verified':True}
(here/'PUBLISH_RECEIPT.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
print(json.dumps(receipt),flush=True)
