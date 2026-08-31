"""Real Chromium QA. Test failures preserve screenshots and truthful diagnostics."""
import argparse,base64,functools,hashlib,http.server,json,os,shutil,threading,time,traceback,zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url');parser.add_argument('--quick',action='store_true');args=parser.parse_args()
root=Path(__file__).resolve().parent.parent;out=root/'qa';out.mkdir(exist_ok=True)
report={'version':'0.2.0','publicURL':args.url,'visualApproved':False,'productionApproved':False,'tests':[],'pageErrors':[],'consoleErrors':[],'failedRequests':[],'unexpectedNetworkRequests':[],'allPassed':False}
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=None
if not args.url:
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(root)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/site/index.html'
else:url=args.url
report['testedURL']=url

def check(name,value,detail=None):
 report['tests'].append({'name':name,'passed':bool(value),'detail':detail});print(name, bool(value),str(detail)[:150],flush=True)
 if not value:raise AssertionError(name+': '+str(detail))
def ready(page):page.wait_for_function('document.body.dataset.appInitialized==="true" && document.body.dataset.tilesMotherReady==="true"',timeout=45000)
def ingest(page,files,folder=False):
 page.locator('#refFolders' if folder else '#refFiles').set_input_files([str(x)for x in files] if not folder else str(files[0]));page.evaluate('TilesMother.references.whenIdle()')
def preview(page,name,expected='ready'):
 page.wait_for_function('n=>{const r=TilesMother.getRefs().find(r=>r.filename===n);if(!r)return false;const p=TilesMother.references.getPreviewState();return p.id===r.id && !["empty","loading"].includes(p.status);}',arg=name,timeout=60000)
 state=page.evaluate('TilesMother.references.getPreviewState()');check('preview '+name,state['status']==expected,state);return state
def select(page,name):page.evaluate('n=>TilesMother.references.select(TilesMother.getRefs().find(r=>r.filename===n).id)',name)
def instrument(page,label):
 page.on('pageerror',lambda e:report['pageErrors'].append(label+': '+str(e)))
 page.on('console',lambda e:report['consoleErrors'].append(label+': '+e.text)if e.type=='error'else None)
 page.on('requestfailed',lambda r:report['failedRequests'].append({'page':label,'url':r.url,'failure':r.failure}))
 page.on('request',lambda r:report['unexpectedNetworkRequests'].append(r.url)if r.url.startswith(('http:','https:'))and not r.url.startswith(url.split('/site/')[0]if'/site/'in url else url.split('?')[0].rsplit('/',1)[0])else None)

try:
 with sync_playwright()as p:
  exe=shutil.which('google-chrome')or shutil.which('chromium')or shutil.which('chromium-browser')
  browser=p.chromium.launch(executable_path=exe,headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  report['browserVersion']=browser.version
  ctx=browser.new_context(viewport={'width':1536,'height':960},device_scale_factor=1,accept_downloads=True);page=ctx.new_page();instrument(page,'desktop');page.on('dialog',lambda d:d.accept())
  response=page.goto(url,wait_until='load',timeout=60000);check('entry HTTP 200',response.status==200,response.status);ready(page)
  check('workbench version',page.evaluate('TilesMother.version')=='0.2.0')
  check('WebGL2 real context',page.evaluate('!!document.getElementById("gl").getContext("webgl2")'))
  check('all-format input',page.locator('#refFiles').get_attribute('accept')is None)
  check('IndexedDB ready',page.evaluate('TilesMother.getStorage().dbReady'))
  before=page.evaluate('TilesMother.getProject()');profile_hashes={}
  for family in ['pan','cover','earthen','glazed']:
   page.evaluate('f=>TilesMother.setProfile(f)',family);q=page.evaluate('TilesMother.runQA()');check('procedural QA '+family,q['allPassed'],q['geometryHash']);profile_hashes[family]=q['geometryHash']
  page.evaluate('TilesMother.setProfile("pan")');page.screenshot(path=str(out/'desktop-empty.png'))
  for name in ['tile.GLB','tile-binary.fbx']:
   ingest(page,[root/'fixtures'/name]);state=preview(page,name);check('mesh present '+name,state['triangles']==4)
  if not args.quick:
   ingest(page,[root/'toolchain/fixtures/stanford-bunny.fbx']);state=preview(page,'stanford-bunny.fbx');check('FBX ASCII substantial mesh',state['triangles']==30338,state['triangles']);page.screenshot(path=str(out/'desktop-fbx.png'))
  # Real pointer orbit, wheel zoom, modal expansion, and render modes.
  select(page,'tile.GLB');preview(page,'tile.GLB');page.locator('#expandModel').click();page.wait_for_timeout(150)
  check('model expands',page.locator('#modelModal').is_visible())
  bounds=page.locator('#referenceCanvas').bounding_box();cam0=page.evaluate('TilesMother.references.getCamera()');x=bounds['x']+bounds['width']*.52;y=bounds['y']+bounds['height']*.5
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+110,y+55,steps=12);page.mouse.up();cam1=page.evaluate('TilesMother.references.getCamera()');check('reference orbit changed',cam0['position']!=cam1['position'])
  page.mouse.wheel(0,-400);page.wait_for_timeout(150);cam2=page.evaluate('TilesMother.references.getCamera()');check('reference zoom closer',cam2['distance']<cam1['distance'])
  for mode in ['clay','wire','original']:page.locator('#refRenderMode').select_option(mode)
  page.locator('#modelFit').click();page.screenshot(path=str(out/'model-expanded.png'))
  with page.expect_download()as d:page.locator('#modelCapture').click()
  d.value.save_as(str(out/'reference-render.png'));check('real reference PNG bytes',(out/'reference-render.png').read_bytes()[:8]==b'\x89PNG\r\n\x1a\n')
  from PIL import Image,ImageStat
  im=Image.open(out/'reference-render.png').convert('RGB');st=ImageStat.Stat(im);check('reference canvas has visible content',max(st.stddev)>3,st.stddev)
  page.locator('[data-close="modelModal"]').click();check('reference restored to side panel',page.locator('#modelDock #modelStage').count()==1)
  if not args.quick:
   for name in ['tile.obj','tile.stl','tile.ply','tile.dae','tile.3mf']:
    ingest(page,[root/'fixtures/materials.mtl',root/'fixtures'/name]if name.endswith('obj')else[root/'fixtures'/name]);preview(page,name)
   ingest(page,[root/'fixtures/资料文件夹'],folder=True);preview(page,'tile.gltf');check('folder paths retained',any('资料文件夹/'in r['relativePath']for r in page.evaluate('TilesMother.getRefs()')))
   ingest(page,[root/'fixtures/model-with-assets.zip']);page.wait_for_function('TilesMother.references.getPreviewState().status==="ready"');check('ZIP original and unpacked references retained',len([r for r in page.evaluate('TilesMother.getRefs()')if'model-with-assets'in r['relativePath']])==4)
   ingest(page,[root/'fixtures/traversal.zip']);check('unsafe archive retained without traversal',any(r['filename']=='traversal.zip'for r in page.evaluate('TilesMother.getRefs()'))and not any(r['filename']=='unsafe.txt'for r in page.evaluate('TilesMother.getRefs()')))
   check('unsafe archive notice shown','未展开'in page.locator('#ingestReport').inner_text())
   ingest(page,[root/'fixtures/unknown.blend']);preview(page,'unknown.blend','saved')
   ingest(page,[root/'fixtures/malicious.html']);preview(page,'malicious.html','saved');check('reference HTML remains inert',page.evaluate('window.UNSAFE_EXECUTED!==true'))
   ingest(page,[root/'fixtures/invalid.glb']);preview(page,'invalid.glb','error');check('invalid model original retained',any(r['filename']=='invalid.glb'for r in page.evaluate('TilesMother.getRefs()')))
  # Metadata edits persist and switching/deleting cannot resurrect a pending note.
  select(page,'tile.GLB');preview(page,'tile.GLB');page.locator('#refNotes').fill('QA: 原始几何保留，参考资料独立。');page.wait_for_timeout(700)
  refs_before=page.evaluate('TilesMother.getRefs()');n=len(refs_before);page.reload();ready(page);check('all references survive reload',len(page.evaluate('TilesMother.getRefs()'))==n)
  select(page,'tile.GLB');preview(page,'tile.GLB');check('reference notes survive reload',page.locator('#refNotes').input_value()=='QA: 原始几何保留，参考资料独立。')
  check('import leaves procedural core unchanged',page.evaluate('TilesMother.runQA().geometryHash')==profile_hashes['pan'])
  with page.expect_download(timeout=60000)as d:page.locator('#exportBtn').click()
  exported=out/'collaboration-roundtrip.zip';d.value.save_as(str(exported))
  with zipfile.ZipFile(exported)as z:
   manifest=json.loads(z.read('workspace.json'));check('export preserves false approvals',not manifest['project']['visualApproved']and not manifest['project']['productionApproved']);check('all references exported',len(manifest['referenceFiles'])==n)
   for r in manifest['referenceFiles']:check('SHA roundtrip '+r['relativePath'],hashlib.sha256(z.read(r['archivePath'])).hexdigest()==r['sha256'])
  ctx2=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True);pg2=ctx2.new_page();instrument(pg2,'roundtrip');pg2.on('dialog',lambda d:d.accept());pg2.goto(url);ready(pg2);pg2.locator('#projectFile').set_input_files(str(exported));pg2.wait_for_function('n=>TilesMother.getRefs().length===n',arg=n,timeout=60000);check('collaboration import restores all files',len(pg2.evaluate('TilesMother.getRefs()'))==n)
  for r in pg2.evaluate('TilesMother.getRefs()'):check('import metadata '+r['relativePath'],any(x['sha256']==r['sha256']and x['relativePath']==r['relativePath']for x in refs_before))
  check('imported project approval stays false',pg2.evaluate('!TilesMother.getProject().visualApproved && !TilesMother.getProject().productionApproved'));ctx2.close()
  # Legacy V0.1 JSON record remains importable.
  if not args.quick:
   legacy_project=page.evaluate('TilesMother.getProject()');legacy_project['version']='0.1.0';legacy={'schema':'tiles-mother-collaboration','version':'0.1.0','project':legacy_project,'referenceImages':[]};(root/'fixtures/legacy.json').write_text(json.dumps(legacy));page.locator('#projectFile').set_input_files(str(root/'fixtures/legacy.json'));page.wait_for_timeout(500);check('legacy V0.1 project accepted',page.evaluate('TilesMother.getProject().version')=='0.2.0')
  select(page,'tile.GLB');preview(page,'tile.GLB');page.screenshot(path=str(out/'desktop-workbench.png'))
  mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);mp=mobile.new_page();instrument(mp,'mobile');mp.goto(url);ready(mp);ingest(mp,[root/'fixtures/tile.GLB']);preview(mp,'tile.GLB');mp.locator('#jumpRefs').click();mp.wait_for_timeout(350);check('mobile no horizontal overflow',mp.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));mp.screenshot(path=str(out/'mobile-reference.png'));mp.locator('#expandModel').click();mp.wait_for_timeout(150);mp.screenshot(path=str(out/'mobile-expanded.png'));check('mobile expanded viewer fits',mp.locator('#referenceCanvas').bounding_box()['width']<=390);mobile.close()
  check('no uncaught page errors',not report['pageErrors'],report['pageErrors']);check('no console errors',not report['consoleErrors'],report['consoleErrors']);check('no failed requests',not report['failedRequests'],report['failedRequests']);check('no reference data sent to external services',not report['unexpectedNetworkRequests'],report['unexpectedNetworkRequests'])
  report['allPassed']=True;browser.close()
except Exception as error:
 report['error']=str(error);report['traceback']=traceback.format_exc();print(report['traceback'],flush=True)
 try:page.screenshot(path=str(out/'failure.png'))
 except:pass
finally:
 if server:server.shutdown()
 (out/('public-browser-report.json'if args.url else'browser-report.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2))
if not report['allPassed']:raise SystemExit(1)
