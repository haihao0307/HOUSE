"""Technical checks of exact R5 HTML. An optional URL tests real HTTP/HTTPS.
Performance is recorded separately, not converted into user visual approval.
"""
from pathlib import Path
import sys,json,time,os,hashlib
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('BRICK_QA_OUT',str(ROOT/'qa')));OUT.mkdir(parents=True,exist_ok=True)
URL=sys.argv[1] if len(sys.argv)>1 else None
REPORT={'version':'R5.0.0','url':URL,'loadMethod':'HTTP navigation' if URL else 'set_content full HTML','checks':[],'errors':[],'performance':[],'humanVisualApproved':False,'productionApproved':False}
def passed(name,**kw):REPORT['checks'].append({'test':name,'passed':True,**kw})
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','') or None,headless=False,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'])
 page=browser.new_page(viewport={'width':1280,'height':860},device_scale_factor=1)
 page.on('pageerror',lambda e:REPORT['errors'].append(str(e)))
 try:
  if URL:
   response=page.goto(URL,wait_until='load',timeout=60000)
   assert response and response.status==200
   assert 'text/html' in response.headers.get('content-type','')
   assert 'attachment' not in response.headers.get('content-disposition','')
   REPORT['http']={'status':response.status,'contentType':response.headers['content-type'],'sha256':hashlib.sha256(response.body()).hexdigest(),'bytes':len(response.body())}
  else:
   html=(ROOT/'web/index.html').read_text();REPORT['sha256']=hashlib.sha256(html.encode()).hexdigest();page.set_content(html,wait_until='load')
  page.wait_for_function("document.querySelector('#error:not([hidden])') || (window.BrickR5 && BrickR5.audit.ready)",timeout=90000)
  assert page.locator('#error').is_hidden(),page.locator('#error').inner_text()
  assert page.evaluate('BrickR5.audit.ready')
  REPORT['sourceHead']=page.locator('meta[name="source-commit"]').get_attribute('content')
  passed('HTML initializes real WebGL geometry')
  page.evaluate("window.geometryHash=()=>{const a=BrickR5.getGeometry();let h=2166136261;for(const v of new Uint32Array(a.position.buffer)){h=Math.imul(h^v,16777619);}for(const v of a.index){h=Math.imul(h^v,16777619);}return h>>>0;}")
  def wait(f):
   page.wait_for_function('(f)=>!BrickR5.stats().busy && BrickR5.stats().geometry?.family===f',arg=f,timeout=90000)
   assert page.locator('#error').is_hidden()
  def select(f):page.locator('[data-family="'+f+'"]').click();wait(f)
  def settled():page.wait_for_timeout(650)
  def snap(name):settled();page.screenshot(path=str(OUT/name))
  for f in ['fired','kiln','adobe','dressed','rubble','stone','pebble']:
   select(f);snap('desktop-'+f+'.png')
   assert page.evaluate('BrickR5.stats().audit.displayedFamily')==f
   assert page.locator('[data-family="'+f+'"]').is_visible()
   passed('seven-family switch '+f,name=page.locator('#specimenName').inner_text(),ms=page.evaluate('BrickR5.stats().geometry.buildMs'))
  for f in ['dressed','rubble','pebble']:
   select(f);g=page.evaluate('geometryHash()');uploads=page.evaluate('BrickR5.renderer.stats.geometryUploads');pictures=[]
   for rock in [1,2,3,4]:
    page.locator('#rock').select_option(str(rock));settled()
    assert page.evaluate('geometryHash()')==g
    assert page.evaluate('BrickR5.renderer.stats.geometryUploads')==uploads
    assert page.evaluate('BrickR5.renderer.state.rock')==rock
    data=page.locator('#view').screenshot();pictures.append(hashlib.sha256(data).hexdigest())
    if f=='pebble':(OUT/f'pebble-rock-{rock}.png').write_bytes(data)
   assert len(set(pictures))==4
   passed(f+' four lithologies visibly differ without geometry rebuild',images=4)
  select('fired');before=page.evaluate('geometryHash()');page.locator('#deepAging').click();wait('fired');assert before!=page.evaluate('geometryHash()');snap('brick-heavy-optional.png');page.locator('#normalAging').click();wait('fired');assert before==page.evaluate('geometryHash()');passed('normal/heavy presets are separate and reversible')
  select('dressed');g=page.evaluate('geometryHash()');count=page.evaluate('BrickR5.audit.builds');page.locator('#togglePanel').click()
  for key,value in [('rough',65),('wet',40),('color',125),('grain',40),('frequency',17)]:
   page.locator('#'+key).evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}));}',value);settled()
   assert page.evaluate('geometryHash()')==g;assert page.evaluate('BrickR5.audit.builds')==count
   passed('shading-only '+key+' retains exact mesh')
  preset=page.evaluate('BrickR5.preset()');page.evaluate('(d)=>BrickR5.importData(d)',preset);wait('dressed');assert page.evaluate('BrickR5.preset().parameters')==preset['parameters'];passed('R5 preset round-trip');page.locator('#closePanel').click()
  for f in ['adobe','pebble']:
   select(f);g=page.evaluate('geometryHash()')
   if f=='adobe':assert len(set(page.evaluate('BrickR5.stats().geometry.fiberAudit.map(x=>x.face)')))==6
   for side in ['front','back','left','right','top','bottom']:
    page.locator('[data-face="'+side+'"]').click();settled();assert page.evaluate('geometryHash()')==g
    if side in ['back','bottom']:snap(f+'-'+side+'.png')
   passed(f+' six viewpoints keep geometry and complete face coverage')
  select('fired');g=page.evaluate('geometryHash()');old=page.evaluate('JSON.stringify(BrickR5.renderer.camera)');box=page.locator('#view').bounding_box();x=box['x']+box['width']*.6;y=box['y']+box['height']*.5
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+120,y+38,steps=14);page.mouse.up();settled()
  assert old!=page.evaluate('JSON.stringify(BrickR5.renderer.camera)');assert g==page.evaluate('geometryHash()');passed('actual pointer rotation without rebuild')
  old=page.evaluate('BrickR5.renderer.camera.radius');page.mouse.wheel(0,-150);settled();assert old!=page.evaluate('BrickR5.renderer.camera.radius');passed('actual wheel zoom')
  for f in ['fired','dressed','pebble']:
   select(f);page.locator('#resetView').click();settled()
   page.evaluate('BrickR5.renderer.stats.frameTrace=[];BrickR5.renderer.stats.traceEnabled=true;BrickR5.renderer.state.auto=true;BrickR5.renderer.invalidate()')
   start=time.monotonic();page.wait_for_timeout(6000);elapsed=time.monotonic()-start
   trace=page.evaluate('BrickR5.renderer.stats.frameTrace');page.evaluate('BrickR5.renderer.state.auto=false;BrickR5.renderer.invalidate()')
   REPORT['performance'].append({'family':f,'viewport':[1280,860],'seconds':elapsed,'frames':len(trace),'uniquePositions':len(set(round(t['yaw'],8) for t in trace)),'fps':len(trace)/elapsed,'pixels':trace[0]['pixels'] if trace else 0,'renderer':'ANGLE SwiftShader'})
   settled();a=page.evaluate('BrickR5.renderer.stats.frames');page.wait_for_timeout(1200);assert a==page.evaluate('BrickR5.renderer.stats.frames');passed(f+' idle ceases drawing')
  page.locator('#pause').click();assert not page.evaluate('BrickR5.stats().workerAlive');a=page.evaluate('BrickR5.renderer.stats.frames');page.wait_for_timeout(500);assert a==page.evaluate('BrickR5.renderer.stats.frames');passed('pause cancels worker and redraws');page.locator('#pause').click();wait('pebble')
  for w,h in [(390,844),(844,390)]:
   page.set_viewport_size({'width':w,'height':h});select('pebble');page.locator('#resetView').click();settled()
   for el in ['[data-family="'+f+'"]' for f in ['fired','kiln','adobe','dressed','rubble','stone','pebble']]+['#rock','#nextSeed','#pause','#original']:
    q=page.locator(el);assert q.is_visible();b=q.bounding_box();assert b and b['x']>=-.1 and b['y']>=-.1 and b['x']+b['width']<=w+.1 and b['y']+b['height']<=h+.1,(el,b,w,h)
   passed('visible material/lithology controls '+str((w,h)));snap(f'mobile-{w}x{h}.png')
  assert not REPORT['errors'];assert page.evaluate('BrickR5.renderer.gl.getError()')==0;passed('no script errors or WebGL errors')
  REPORT['passed']=True
 except Exception as e:
  REPORT['passed']=False;REPORT['failure']=str(e)
  try:page.screenshot(path=str(OUT/'test-failure.png'))
  except Exception:pass
  raise
 finally:
  REPORT['softwarePerformanceFloor5fps']=all(x['fps']>=5 for x in REPORT['performance']) if REPORT['performance'] else None
  REPORT['performanceGateScope']='single 6-second windows recorded, not full multi-window production gate or user-device approval'
  (OUT/'browser-report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2));browser.close()
print(json.dumps({'passed':True,'checks':len(REPORT['checks']),'performance':REPORT['performance']},ensure_ascii=False))
