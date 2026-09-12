"""Test finished pixels, not changing labels. Close the drawer for both captures."""
from pathlib import Path
import os,sys,json,time,hashlib,io
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=Path(os.environ.get('BRICK_QA_OUT',str(ROOT/'qa')));OUT.mkdir(parents=True,exist_ok=True)
URL=sys.argv[1] if len(sys.argv)>1 else None
R={'version':'R6.0.0','url':URL,'checks':[],'controls':[],'performance':[],'errors':[],'failures':[],'humanVisualApproved':False,'productionApproved':False}
def ok(t,**d):R['checks'].append({'test':t,'passed':True,**d})
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,headless=False,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox'])
 page=browser.new_page(viewport={'width':1200,'height':820},device_scale_factor=1)
 page.on('pageerror',lambda e:R['errors'].append(str(e)))
 try:
  if URL:
   response=page.goto(URL,wait_until='load',timeout=60000)
   assert response and response.status==200 and 'text/html' in response.headers.get('content-type','')
   assert 'attachment' not in response.headers.get('content-disposition','')
   R['http']={'status':response.status,'contentType':response.headers.get('content-type'),'bytes':len(response.body()),'sha256':hashlib.sha256(response.body()).hexdigest()};R['loadMethod']='HTTP navigation'
  else:
   page.set_content((ROOT/'web/index.html').read_text(),wait_until='load');R['loadMethod']='set_content on blank page; local navigation restricted'
  page.wait_for_function("document.querySelector('#error:not([hidden])') || (window.BrickR6 && BrickR6.audit.ready)",timeout=90000)
  assert page.locator('#error').is_hidden(),page.locator('#error').inner_text();assert page.evaluate('BrickR6.audit.ready')
  R['sourceHead']=page.locator('meta[name="source-commit"]').get_attribute('content')
  page.evaluate("window.meshHash=()=>{const m=BrickR6.getGeometry();let h=2166136261;for(const a of[new Uint32Array(m.position.buffer),m.index])for(const v of a)h=Math.imul(h^v,16777619);return h>>>0;}")
  def ready(f=None):
   page.wait_for_function('(f)=>!BrickR6.stats().busy&&BrickR6.audit.ready&&(!f||BrickR6.stats().geometry.family===f)',arg=f,timeout=90000)
   assert page.locator('#error').is_hidden(),page.locator('#error').inner_text()
  def capture():
   if page.locator('#closePanel').is_visible():page.locator('#closePanel').click()
   page.wait_for_timeout(420)
   return np.asarray(Image.open(io.BytesIO(page.locator('#view').screenshot())).convert('RGB'))
  def diff(a,b):
   d=np.abs(a.astype(float)-b.astype(float));return {'meanByteDifference':float(d.mean()),'changedPixels':int(np.any(d>=2,axis=2).sum()),'fraction':float(np.any(d>=2,axis=2).mean())}
  def family(f):page.locator('[data-family="'+f+'"]').click();ready(f)
  def update(k,v):
   if page.locator('#panel').is_hidden():page.locator('#togglePanel').click()
   e=page.locator('#'+k);e.scroll_into_view_if_needed()
   e.evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}));e.dispatchEvent(new Event("change",{bubbles:true}));}',str(v))
   ready();page.wait_for_timeout(170);ready()
   assert abs(page.evaluate('(k)=>BrickR6.parameters()[k]',k)-v)<1e-7
  for f in ['fired','kiln','adobe','dressed','rubble','stone','pebble']:
   family(f);capture();page.screenshot(path=str(OUT/(f+'-default.png')))
   assert page.locator('[data-family="'+f+'"]').is_visible();assert page.evaluate('BrickR6.renderer.state.mode')==0
   controls=page.evaluate('BrickR6.controlKeys()');defaults=page.evaluate('BrickR6.parameters()')
   for k in controls:
    if k=='frequency':low,high=8,24
    elif k=='rough':low,high=.35,.96
    elif k=='tone':low,high=-.8,.8
    elif k in ['color','strength']:low,high=.05,1.35
    elif k in ['damage','relief','edgeWear','chisel','strata','roundness']:low,high=.10,.85
    else:low,high=0,1
    update(k,low);a=capture();h0=page.evaluate('meshHash()');update(k,high);b=capture();h1=page.evaluate('meshHash()')
    d=diff(a,b);dep=page.evaluate('(k)=>BrickR6.definitions[k][4]',k)
    passed=d['changedPixels']>=24 and d['meanByteDifference']>.0005 and ((h0!=h1) if dep=='geo' else (h0==h1))
    entry={'family':f,'key':k,'dependency':dep,'low':low,'high':high,**d,'meshChanged':h0!=h1,'passed':passed};R['controls'].append(entry)
    print('control',f,k,passed,d['changedPixels'],round(d['meanByteDifference'],5),flush=True)
    if not passed:R['failures'].append(entry);Image.fromarray(b).save(OUT/('control-failure-'+f+'-'+k+'.png'))
    update(k,defaults[k]);capture()
   ok('finished family '+f,controls=len(controls))
  family('pebble');h0=page.evaluate('meshHash()');pictures=[]
  for rock in range(1,8):
   page.locator('#rock').select_option(str(rock));assert page.evaluate('BrickR6.parameters().rock')==rock
   a=capture();pictures.append(a);assert page.evaluate('meshHash()')==h0;page.screenshot(path=str(OUT/('pebble-rock-'+str(rock)+'.png')))
  assert all(diff(a,b)['changedPixels']>500 for i,a in enumerate(pictures) for b in pictures[i+1:]);ok('seven lithologies produce distinct pebble pixels')
  for rock in [1,2,5,7]:
   page.locator('[data-rock="'+str(rock)+'"]').click();capture();assert page.evaluate('BrickR6.renderer.state.rock')==rock
  ok('desktop lithology buttons are connected')
  family('dressed');page.locator('#rock').select_option('1');ready();hard=page.evaluate('BrickR6.getGeometry().stats.mechanicalProfile');h0=page.evaluate('meshHash()');page.locator('#rock').select_option('2');ready();assert hard=='hard-fracture' and h0!=page.evaluate('meshHash()');ok('hard-stone fracture envelope')
  # Additional conditional combinations, beyond the default-family slider matrix.
  family('stone');page.locator('#rock').select_option('1');ready();assert 'strata' not in page.evaluate('BrickR6.controlKeys()');ok('irrelevant layering control hidden on hard stone')
  family('rubble');page.locator('#rock').select_option('5');ready();update('strata',.1);h0=page.evaluate('meshHash()');update('strata',.85);assert h0!=page.evaluate('meshHash()');capture();ok('slate rubble layering changes real geometry')
  family('adobe');g=page.evaluate('BrickR6.getGeometry().stats');assert g['riceHusks']>0 and len(set(x['face'] for x in g['huskAudit']))==6
  for face in ['front','back','left','right','top','bottom']:
   page.locator('[data-face="'+face+'"]').click();capture()
   if face in ['back','bottom']:page.screenshot(path=str(OUT/('adobe-'+face+'.png')))
  ok('six adobe views and shell geometry',husks=g['riceHusks'])
  family('pebble');page.locator('#resetView').click();c0=page.evaluate('JSON.stringify(BrickR6.renderer.camera)');h0=page.evaluate('meshHash()');box=page.locator('#view').bounding_box();x=box['x']+box['width']*.6;y=box['y']+box['height']*.5
  page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+110,y+40,steps=14);page.mouse.up();capture();assert c0!=page.evaluate('JSON.stringify(BrickR6.renderer.camera)') and h0==page.evaluate('meshHash()');ok('real pointer without rebuild')
  radius=page.evaluate('BrickR6.renderer.camera.radius');page.mouse.wheel(0,-180);capture();assert radius!=page.evaluate('BrickR6.renderer.camera.radius');ok('wheel zoom')
  before=page.evaluate('meshHash()');page.locator('#nextSeed').click();ready();assert page.evaluate('meshHash()')!=before;ok('master seed changes specimen')
  pre=page.evaluate('BrickR6.preset()');page.evaluate('(d)=>BrickR6.importData(d)',pre);ready();assert page.evaluate('BrickR6.parameters()')==pre['parameters'];assert page.evaluate('BrickR6.preset().camera')==pre['camera'];ok('parameter and camera roundtrip')
  page.locator('#pause').click();assert not page.evaluate('BrickR6.stats().workerAlive');a=page.evaluate('BrickR6.renderer.stats.frames');page.wait_for_timeout(800);assert a==page.evaluate('BrickR6.renderer.stats.frames');page.locator('#pause').click();ok('pause stops worker and drawing')
  for wh in [(390,844),(844,390)]:
   page.set_viewport_size({'width':wh[0],'height':wh[1]});family('pebble');page.locator('#resetView').click();capture()
   for selector in ['[data-family="'+f+'"]' for f in ['fired','kiln','adobe','dressed','rubble','stone','pebble']]+['#rock','#nextSeed','#pause','#togglePanel','#previous']:
    e=page.locator(selector);assert e.is_visible();b=e.bounding_box();assert b and b['x']>=-.1 and b['y']>=-.1 and b['x']+b['width']<=wh[0]+.1 and b['y']+b['height']<=wh[1]+.1,(selector,b,wh)
   page.locator('#rock').select_option('5');capture();assert page.evaluate('BrickR6.renderer.state.rock')==5;page.screenshot(path=str(OUT/('mobile-'+str(wh[0])+'x'+str(wh[1])+'.png')));ok('mobile controls '+str(wh))
  for wh in [(1200,820),(390,844)]:
   page.set_viewport_size({'width':wh[0],'height':wh[1]})
   for f in ['fired','dressed','pebble']:
    family(f)
    if f=='dressed':page.locator('#rock').select_option('1');ready()
    page.locator('#resetView').click();capture();programs=page.evaluate('BrickR6.renderer.programCount()');bakes=page.evaluate('BrickR6.renderer.stats.coordinateBakes');builds=page.evaluate('BrickR6.audit.builds')
    page.evaluate('BrickR6.renderer.stats.traceEnabled=true;BrickR6.renderer.stats.frameTrace=[];BrickR6.renderer.state.auto=true;BrickR6.renderer.invalidate()')
    t=time.monotonic();page.wait_for_timeout(6000);elapsed=time.monotonic()-t;tr=page.evaluate('BrickR6.renderer.stats.frameTrace');page.evaluate('BrickR6.renderer.state.auto=false;BrickR6.renderer.invalidate()');capture()
    R['performance'].append({'viewport':list(wh),'family':f,'seconds':elapsed,'frames':len(tr),'uniquePositions':len(set(round(t['yaw'],7) for t in tr)),'fps':len(tr)/elapsed,'pixels':tr[0]['pixels'] if tr else 0})
    assert programs==page.evaluate('BrickR6.renderer.programCount()') and bakes==page.evaluate('BrickR6.renderer.stats.coordinateBakes') and builds==page.evaluate('BrickR6.audit.builds')
    a=page.evaluate('BrickR6.renderer.stats.frames');page.wait_for_timeout(750);assert a==page.evaluate('BrickR6.renderer.stats.frames')
  ok('rotation reuses programs, coordinates and geometry; idle stops')
  assert page.evaluate('BrickR6.renderer.gl.getError()')==0;assert not R['errors'],R['errors'];assert not R['failures'],R['failures'];R['passed']=True
 except Exception as e:
  R['passed']=False;R['exception']=str(e)
  try:page.screenshot(path=str(OUT/'browser-failure.png'))
  except:pass
  raise
 finally:
  R['performanceScope']='software Chromium ANGLE SwiftShader; three 6s material windows per viewport, user device untested'
  (OUT/'browser-report.json').write_text(json.dumps(R,indent=2,ensure_ascii=False));browser.close()
print(json.dumps({'passed':R.get('passed'),'checks':len(R['checks']),'controls':len(R['controls']),'performance':R['performance']},ensure_ascii=False))
