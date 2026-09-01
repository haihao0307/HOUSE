"""Actual browser checks; shader/asset failures never count as visual approval."""
import argparse, functools, hashlib, http.server, json, os, threading, traceback, zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--site',required=True);p.add_argument('--out',required=True);p.add_argument('--url');p.add_argument('--quick',action='store_true');a=p.parse_args()
site=Path(a.site).resolve();out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
report={'version':'0.4.0','tests':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'screenshots':[],'visualApproved':False,'productionApproved':False,'allPassed':False}
def check(n,v,d=None):
 report['tests'].append({'name':n,'passed':bool(v),'detail':d});print(n,bool(v),flush=True)
 if not v:raise AssertionError(n)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*_):pass
server=None
if not a.url:
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(site)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/index.html'
else:url=a.url
report['url']=url
expected=hashlib.sha256((site/'index.html').read_bytes()).hexdigest();report['indexSHA256']=expected

def settled(pg):
 pg.wait_for_function("window.TilesMother?.version==='0.4.0' && document.body.dataset.tilesMotherReady==='true'",timeout=60000);pg.wait_for_timeout(350)
def instrument(pg):
 pg.on('pageerror',lambda e:report['pageErrors'].append(str(e)))
 pg.on('console',lambda e:report['consoleErrors'].append(e.text) if e.type=='error' else None)
 pg.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
def shot(pg,name):
 pg.screenshot(path=str(out/(name+'.jpg')),type='jpeg',quality=86)
 report['screenshots'].append({'path':name+'.jpg','bytes':(out/(name+'.jpg')).stat().st_size,'nativeCanvas':pg.evaluate("({width:document.getElementById('gl').width,height:document.getElementById('gl').height})"),'upscaled':False})
def canvas(pg):return pg.locator('#gl').screenshot(type='png')
def state(pg):return pg.evaluate("({hashes:TilesMother.getGeometryHashes(),source:TilesMother.study.sourceFingerprint(),metrics:TilesMother.study.metrics()})")
try:
 with sync_playwright() as pw:
  opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader']}
  if os.environ.get('CHROME_PATH'):opts['executable_path']=os.environ['CHROME_PATH']
  browser=pw.chromium.launch(**opts);report['browserVersion']=browser.version
  ctx=browser.new_context(viewport={'width':1536,'height':1000},accept_downloads=True);pg=ctx.new_page();instrument(pg)
  response=pg.goto(url,wait_until='networkidle',timeout=90000);check('HTTP 200',response.status==200);check('served exact built bytes',hashlib.sha256(response.body()).hexdigest()==expected);settled(pg)
  check('V0.4 enabled',pg.evaluate("TilesMother.getProject().materialPreset==='relief-v04'"));check('real WebGL2 canvas',pg.evaluate("!!document.getElementById('gl').getContext('webgl2')"));check('source reference database ready',pg.evaluate('TilesMother.getStorage().dbReady'))
  for family in ['pan','cover']:
   pg.evaluate('x=>TilesMother.setProfile(x)',family);settled(pg)
   q=pg.evaluate('TilesMother.runQA()');check(family+' builtin geometry checks',q['allPassed'])
   st=state(pg);check(family+' measured generated relief present',st['metrics'][0]['metrics']['topPeakToValley']>.001,st['metrics'][0]['metrics']);check(family+' minimum remaining shell thickness',st['metrics'][0]['metrics']['minThickness']>=st['metrics'][0]['metrics']['minimumAllowedThickness'])
   pg.evaluate("TilesMother.study.setPresentation({mode:'neutral_inspection'})");pg.wait_for_timeout(250);shot(pg,family+'-neutral');geom=state(pg)
   pg.evaluate("TilesMother.study.setPresentation({mode:'studio_beauty'})");pg.wait_for_timeout(250);shot(pg,family+'-studio');check(family+' presentation leaves source and mesh unchanged',geom['hashes']==state(pg)['hashes'] and geom['source']==state(pg)['source'])
   light_before=canvas(pg);pg.evaluate("TilesMother.study.setPresentation({key:{enabled:false,intensity:3.2,kelvin:5500}})");pg.wait_for_timeout(180);check(family+' key-light control affects actual pixels',canvas(pg)!=light_before);pg.evaluate("TilesMother.study.setPresentation({key:{enabled:true,intensity:3.2,kelvin:5500}})")
   pg.evaluate("TilesMother.study.setPresentation({mode:'diagnostic'})");pg.locator('#channel').select_option('source');pg.wait_for_timeout(400);shot(pg,family+'-geometry');
   pg.locator('#channel').select_option('albedo');pg.wait_for_timeout(250);original=canvas(pg);geom=state(pg);pg.evaluate("TilesMother.study.setPresentation({mode:'studio_beauty',rotation:73})");pg.wait_for_timeout(250);check(family+' albedo pixels independent of lights',canvas(pg)==original)
   seeds=pg.evaluate('TilesMother.getProject().profiles.'+family+'.seeds');pg.evaluate("n=>TilesMother.setSeed('color',n)",seeds['color']+1);pg.wait_for_timeout(250);check(family+' color seed changes actual albedo pixels',canvas(pg)!=original);check(family+' color seed preserves mesh',state(pg)['hashes']==geom['hashes']);pg.evaluate("n=>TilesMother.setSeed('color',n)",seeds['color']);pg.wait_for_timeout(250)
   before=canvas(pg);cam=pg.evaluate('TilesMother.getCamera()');box=pg.locator('#gl').bounding_box();pg.mouse.move(box['x']+box['width']*.55,box['y']+box['height']*.6);pg.mouse.down();pg.mouse.move(box['x']+box['width']*.64,box['y']+box['height']*.63,steps=6);pg.mouse.up();pg.wait_for_timeout(150);check(family+' orbit really changes image',canvas(pg)!=before);pg.locator('#resetView').click();pg.wait_for_timeout(200)
   pg.evaluate("TilesMother.setLayout('trio')");settled(pg);check(family+' distinct stable child identities',len(set(x['id'] for x in state(pg)['metrics']))==3);check(family+' three distinct actual geometries',len(set(state(pg)['hashes']))==3);pg.locator('#channel').select_option('final');pg.evaluate("TilesMother.study.setPresentation({mode:'studio_beauty',rotation:0})");pg.wait_for_timeout(200);shot(pg,family+'-trio')
   pg.evaluate("TilesMother.setLayout('single')");settled(pg)
  pg.evaluate("TilesMother.setProfile('pan');TilesMother.study.roof()");settled(pg);report['roofInitial']=state(pg);check('roof has 28 persistent tile identities',len(report['roofInitial']['metrics'])==28 and len(set(x['id'] for x in report['roofInitial']['metrics']))==28);shot(pg,'roof-dry')
  pg.evaluate('TilesMother.study.setTime(50*86400)');pg.wait_for_timeout(1700);shot(pg,'roof-after-history');st=state(pg);report['roofAfter']=st;check('all tiles share requested physical time',all(m['state']['physicalTimeSeconds']==50*86400 for m in st['metrics']));check('children retain different moisture response',len(set(round(m['state']['wetness'],7) for m in st['metrics']))>10);check('water budget on every roof tile',all(abs(m['state']['budget']['residual'])<1e-9 for m in st['metrics']));check('history affects actual mesh',st['hashes']!=report['roofInitial']['hashes']);pg.locator('#channel').select_option('wetness');pg.wait_for_timeout(200);shot(pg,'roof-moisture-diagnostic');
  pg.evaluate('TilesMother.study.setTime(0)');pg.wait_for_timeout(1500);check('rewind by deterministic replay',state(pg)['hashes']==report['roofInitial']['hashes']);pg.evaluate('TilesMother.study.setTime(50*86400)');pg.wait_for_timeout(1500);check('forward replay reproduces state',state(pg)['hashes']==st['hashes'])
  pg.evaluate("TilesMother.study.setHistory({rain:0})");pg.wait_for_timeout(1000);check('rain cause off removes moisture on entire roof',all(m['state']['wetness']==0 for m in state(pg)['metrics']));pg.evaluate("TilesMother.study.setHistory({rain:1});TilesMother.setLayout('single')");settled(pg)
  check('reject unknown profile overrides',pg.evaluate("() => {let s=TilesMother.getProject().study;s.allowApprove=true;try{TilesMother.study.validate(s);return false;}catch{return true;}}"))
  # Current runtime, not previous-version evidence, exercises the original importers.
  fixture=Path('/tmp/tiles-v02/fixtures')
  if not a.quick and fixture.exists():
   selected=[fixture/'tile.GLB',fixture/'tile-binary.fbx']
   check('GLB and FBX fixtures available',all(x.is_file() for x in selected));pg.locator('#refFiles').set_input_files([str(x) for x in selected]);pg.evaluate('TilesMother.references.whenIdle()');pg.wait_for_timeout(700);refs=pg.evaluate('TilesMother.getRefs()');check('GLB and FBX both received',len(refs)==2)
   for r in refs:
    pg.evaluate('id=>TilesMother.references.select(id)',r['id']);pg.wait_for_function("TilesMother.references.getPreviewState().status==='ready'",timeout=30000);check(r['filename']+' preview actual mesh',pg.evaluate('TilesMother.references.getPreviewState().meshes')>0)
   pg.on('dialog',lambda d:d.accept())
   with pg.expect_download(timeout=20000) as dl:pg.locator('#exportBtn').click()
   zip_path=out/'roundtrip.zip';dl.value.save_as(zip_path)
   with zipfile.ZipFile(zip_path) as z:
    check('collaboration CRC roundtrip',z.testzip() is None);record=json.loads(z.read('workspace.json'));check('V0.4 history included in existing collaboration export',record['project']['study']['physicalTimeSeconds']==50*86400);check('original source bytes preserved in export',len(record['referenceFiles'])==2)
   pg.locator('#projectFile').set_input_files(str(zip_path));pg.wait_for_timeout(1800);check('V0.4 collaboration import retains history',pg.evaluate('TilesMother.getProject().study.physicalTimeSeconds')==50*86400)
   zip_path.unlink()
  pg.wait_for_timeout(800);pg.reload(wait_until='networkidle');settled(pg);check('time and mode persist after reload',pg.evaluate('TilesMother.getProject().study.physicalTimeSeconds')==50*86400);check('approval remains false',pg.evaluate('!TilesMother.getProject().visualApproved&&!TilesMother.getProject().productionApproved'))
  pg.evaluate("TilesMother.setProfile('earthen')");settled(pg);check('ceramic original renderer remains available',pg.locator('#gl').count()==1);pg.evaluate("TilesMother.setProfile('pan')");settled(pg)
  mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True).new_page();instrument(mobile);mobile.goto(url,wait_until='networkidle',timeout=90000);settled(mobile);check('mobile real WebGL2',mobile.evaluate("!!document.getElementById('gl').getContext('webgl2')"));check('mobile no horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));shot(mobile,'mobile-studio')
  check('no shader or console errors',not report['consoleErrors'],report['consoleErrors']);check('no page errors',not report['pageErrors'],report['pageErrors']);check('no failed asset requests',not report['failedRequests'],report['failedRequests']);report['presentation']=pg.evaluate('TilesMother.study.presentation()');report['allPassed']=True;browser.close()
except Exception as e:
 report['error']=str(e);report['traceback']=traceback.format_exc()
 try:shot(pg,'failure')
 except Exception:pass
 raise
finally:
 (out/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 if server:server.shutdown()
 print(json.dumps({'allPassed':report['allPassed'],'tests':len(report['tests']),'error':report.get('error')}))
