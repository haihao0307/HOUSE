"""Real browser transfer diagnostics using explicitly synthetic file bytes."""
import argparse,functools,hashlib,http.server,json,shutil,struct,tempfile,threading,traceback,zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--url');a=p.parse_args()
repo=Path.cwd();out=repo/'tiles-mother/qa-transfer';out.mkdir(parents=True,exist_ok=True)
report={'scope':'synthetic package integrity and UI only; user Yunnan model bytes have not been read','publicURL':a.url,'tests':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'outboundWrites':[],'allPassed':False,'sourceReadVerified':False,'distillationComplete':False,'visualApproved':False,'productionApproved':False}
def check(name,value,detail=None):
 report['tests'].append({'name':name,'passed':bool(value),'detail':detail});print(name,bool(value),flush=True)
 if not value:raise AssertionError(name+': '+str(detail))
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=None
try:
 if a.url:url=a.url
 else:
  server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(repo)))
  threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/tiles-mother/check-package.html'
 with tempfile.TemporaryDirectory()as tmp:
  root=Path(tmp);raw=[('板瓦.GLB',b'QA-GLB-FILE-BYTES'+bytes(range(256))*30),('顶瓦.fbx',b'QA-FBX-FILE-BYTES'+bytes(range(255))*20),('贴图.png',b'QA-IMAGE-FILE-BYTES'+bytes(range(256))*10)]
  refs=[{'filename':name,'relativePath':'云南瓦片/'+name,'archivePath':'files/'+str(i)+'/'+name,'size':len(b),'sha256':hashlib.sha256(b).hexdigest(),'source':'Synthetic transfer QA, not a historical asset'}for i,(name,b)in enumerate(raw)]
  contents={r['archivePath']:b for r,(_,b)in zip(refs,raw)}
  def make(name,rows,payload,method=0):
   path=root/name
   with zipfile.ZipFile(path,'w',compression=method)as z:
    z.writestr('workspace.json',json.dumps({'schema':'tiles-mother-collaboration','version':'0.2.0','referenceFiles':rows},ensure_ascii=False))
    for n,b in payload.items():z.writestr(n,b)
   return path
  good=make('valid.zip',refs,contents);make('deflated.zip',refs,contents,zipfile.ZIP_DEFLATED);make('empty.zip',[],{})
  badrefs=json.loads(json.dumps(refs));badrefs[0]['sha256']='0'*64;make('hash-mismatch.zip',badrefs,contents)
  missing=dict(contents);missing.pop(refs[1]['archivePath']);make('missing.zip',refs,missing)
  broken=bytearray(good.read_bytes())
  with zipfile.ZipFile(good)as z:
   h=z.getinfo(refs[0]['archivePath']).header_offset;nl,xl=struct.unpack_from('<HH',broken,h+26);broken[h+30+nl+xl]^=1
  (root/'crc-mismatch.zip').write_bytes(broken);(root/'truncated.zip').write_bytes(good.read_bytes()[:-10])
  with zipfile.ZipFile(root/'unsafe.zip','w')as z:z.writestr('../outside.txt',b'QA')
  with sync_playwright()as pw:
   browser=pw.chromium.launch(executable_path=shutil.which('google-chrome')or shutil.which('chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
   report['browserVersion']=browser.version
   ctx=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True);page=ctx.new_page()
   def instrument(pg):
    pg.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
    pg.on('console',lambda e:report['consoleErrors'].append(e.text)if e.type=='error'else None)
    pg.on('requestfailed',lambda r:report['failedRequests'].append(r.url))
    pg.on('request',lambda r:report['outboundWrites'].append(r.url)if r.method not in ['GET','HEAD']else None)
   instrument(page);response=page.goto(url,wait_until='load',timeout=60000)
   check('HTTP 200',response.status==200);page.wait_for_function('document.body.dataset.inspectorReady==="true"')
   check('ready',page.evaluate('TilesPackageCheck.version')=='1.0.0')
   page.screenshot(path=str(out/'desktop-empty.png'),full_page=True)
   for name,expected in [('valid.zip',True),('deflated.zip',True),('empty.zip',False),('hash-mismatch.zip',False),('missing.zip',False),('crc-mismatch.zip',False),('truncated.zip',False),('unsafe.zip',False)]:
    page.locator('#packageFile').set_input_files(str(root/name));page.wait_for_function('document.body.dataset.checkComplete==="true"')
    with page.expect_download()as dl:page.locator('#saveReport').click()
    dest=root/(name+'.json');dl.value.save_as(str(dest));r=json.loads(dest.read_text())
    check(name+' truthful integrity state',r['packageIntegrityVerified']==expected,r.get('errors'))
    check(name+' receiver and approvals remain pending',not r['chatReceiverReadVerified']and not r['distillationComplete']and not r['visualApproved']and not r['productionApproved'])
    if expected:
     check(name+' original counts',r['modelCount']==2 and r['imageCount']==1 and r['referenceCount']==3)
     check(name+' whole package SHA',r['packageSHA256']==hashlib.sha256((root/name).read_bytes()).hexdigest())
     check(name+' report is small',dest.stat().st_size<12000)
     page.screenshot(path=str(out/'desktop-verified.png'),full_page=True)
   check('safe text output',page.evaluate('document.querySelectorAll("#fileRows script").length')==0)
   check('conservative oversize warning',not page.evaluate('TilesPackageCheck.sizeAssessment(600*1024*1024).withinConservativeChatSize'))
   # The actual drop event follows the same receiver path as input selection.
   data=list(good.read_bytes());page.evaluate('a=>{const d=new DataTransfer();d.items.add(new File([new Uint8Array(a)],"drop-test.zip",{type:"application/zip"}));document.getElementById("drop").dispatchEvent(new DragEvent("drop",{bubbles:true,dataTransfer:d}));}',data)
   page.wait_for_function('document.body.dataset.checkComplete==="true"');check('drag and drop package checked','逐文件校验通过'in page.locator('#resultTitle').inner_text())
   mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);pg=mobile.new_page();instrument(pg);pg.goto(url,wait_until='load');pg.wait_for_function('document.body.dataset.inspectorReady==="true"');pg.locator('#packageFile').set_input_files(str(good));pg.wait_for_function('document.body.dataset.checkComplete==="true"')
   check('mobile no page overflow',pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));pg.screenshot(path=str(out/'mobile-verified.png'),full_page=True)
   check('no page errors',not report['pageErrors'],report['pageErrors']);check('no console errors',not report['consoleErrors'],report['consoleErrors']);check('no failed requests',not report['failedRequests'],report['failedRequests']);check('no original data upload',not report['outboundWrites'],report['outboundWrites']);browser.close();report['allPassed']=True
except Exception:
 report['error']=traceback.format_exc();print(report['error']);raise
finally:
 if server:server.shutdown()
 (out/('public-browser-report.json'if a.url else'browser-report.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
