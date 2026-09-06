from pathlib import Path
import os,sys,json,hashlib,io
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
url=sys.argv[1];out=Path(os.environ['BRICK_QA_OUT']);out.mkdir(parents=True,exist_ok=True)
r={'url':url,'checks':[],'errors':[],'humanVisualApproved':False,'productionApproved':False}
with sync_playwright() as p:
 b=p.chromium.launch(headless=False,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']);g=b.new_page(viewport={'width':1200,'height':820});g.on('pageerror',lambda e:r['errors'].append(str(e)))
 try:
  resp=g.goto(url,wait_until='load',timeout=60000);assert resp.status==200 and 'text/html' in resp.headers.get('content-type','');assert 'attachment' not in resp.headers.get('content-disposition','')
  r.update({'httpStatus':resp.status,'contentType':resp.headers['content-type'],'htmlSHA256':hashlib.sha256(resp.body()).hexdigest(),'bytes':len(resp.body())})
  g.wait_for_function('window.BrickR6 && BrickR6.audit.ready',timeout=90000);r['sourceHead']=g.locator('meta[name="source-commit"]').get_attribute('content')
  def ready(f):
   g.wait_for_function('(f)=>!BrickR6.stats().busy&&BrickR6.audit.ready&&BrickR6.stats().geometry.family===f',arg=f,timeout=90000);assert g.locator('#error').is_hidden()
  def shot():
   g.wait_for_timeout(600);return np.asarray(Image.open(io.BytesIO(g.locator('#view').screenshot())).convert('RGB'))
  for f in ['fired','kiln','adobe','dressed','rubble','stone','pebble']:
   g.locator('[data-family="'+f+'"]').click();ready(f);shot();assert g.evaluate('BrickR6.renderer.state.mode')==0;g.screenshot(path=str(out/(f+'.png')));r['checks'].append('material '+f)
  images=[]
  for rock in range(1,8):
   g.locator('#rock').select_option(str(rock));assert g.evaluate('BrickR6.parameters().rock')==rock;images.append(shot())
  assert all(np.any(abs(a.astype(float)-c.astype(float))>=2,axis=2).sum()>500 for i,a in enumerate(images) for c in images[i+1:]);r['checks'].append('seven actual lithologies differ')
  g.locator('#togglePanel').click();g.locator('#tone').evaluate('(e)=>{e.value=-.8;e.dispatchEvent(new Event("input",{bubbles:true}))}');g.locator('#closePanel').click();a=shot()
  g.locator('#togglePanel').click();g.locator('#tone').evaluate('(e)=>{e.value=.8;e.dispatchEvent(new Event("input",{bubbles:true}))}');g.locator('#closePanel').click();c=shot();assert np.any(abs(a.astype(float)-c.astype(float))>=2,axis=2).sum()>500;r['checks'].append('real slider changes finished canvas')
  g.locator('[data-family="adobe"]').click();ready('adobe');s=g.evaluate('BrickR6.stats().geometry');assert s['riceHusks']>0 and len(set(x['face'] for x in s['huskAudit']))==6
  for face in ['front','back','left','right','top','bottom']:g.locator('[data-face="'+face+'"]').click();shot()
  r['checks'].append('six faces including anchored hull parts')
  before=g.evaluate('JSON.stringify(BrickR6.renderer.camera)');box=g.locator('#view').bounding_box();x=box['x']+box['width']*.55;y=box['y']+box['height']*.5
  g.mouse.move(x,y);g.mouse.down();g.mouse.move(x+110,y+25,steps=10);g.mouse.up();shot();assert before!=g.evaluate('JSON.stringify(BrickR6.renderer.camera)');r['checks'].append('real pointer rotation')
  for w,h in [(390,844),(844,390)]:
   g.set_viewport_size({'width':w,'height':h});g.locator('[data-family="pebble"]').click();ready('pebble');shot()
   for el in ['[data-family="'+f+'"]' for f in ['fired','kiln','adobe','dressed','rubble','stone','pebble']]+['#rock','#nextSeed','#pause','#togglePanel']:
    e=g.locator(el);assert e.is_visible();q=e.bounding_box();assert q and q['x']>=-.1 and q['y']>=-.1 and q['x']+q['width']<=w+.1 and q['y']+q['height']<=h+.1
   g.locator('#rock').select_option('3');shot();assert g.evaluate('BrickR6.renderer.state.rock')==3;g.screenshot(path=str(out/f'mobile-{w}x{h}.png'));r['checks'].append('working mobile controls '+str((w,h)))
  assert not r['errors'] and g.evaluate('BrickR6.renderer.gl.getError()')==0;r['passed']=True
 except Exception as e:
  r['passed']=False;r['failure']=str(e)
  try:g.screenshot(path=str(out/'failure.png'))
  except:pass
  raise
 finally:
  (out/'public-browser-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));b.close()
print(json.dumps(r,ensure_ascii=False))
