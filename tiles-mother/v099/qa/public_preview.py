"""Read back an immutable public preview; never treat HTTP alone as visual proof."""
from pathlib import Path
import hashlib,json,os,time,urllib.request
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'qa/public';out.mkdir(parents=True,exist_ok=True)
commit=os.environ['PREVIEW_SOURCE_SHA'];expected=hashlib.sha256((root/'START_HERE.html').read_bytes()).hexdigest()
url=f'https://rawcdn.githack.com/haihao0307/HOUSE/{commit}/tiles-mother/v099/START_HERE.html'
r={'version':'0.9.9','commit':commit,'url':url,'expectedSHA256':expected,'ownPagesDeployed':False,'thirdPartyPreview':True,'visualApproved':False,'productionApproved':False,'errors':[],'consoleErrors':[],'requestFailures':[],'cases':[],'checks':[]}
def save(): (out/'REPORT.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
try:
 start=time.monotonic()
 with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'TilesMother-Preview-Verification/0.9.9'}),timeout=30) as response:
  body=response.read();r['http']={'status':response.status,'contentType':response.headers.get('content-type'),'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'seconds':time.monotonic()-start}
 assert r['http']['status']==200 and 'text/html' in r['http']['contentType'] and r['http']['sha256']==expected
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']);r['browser']=b.version
  page=b.new_page(viewport={'width':1500,'height':950},device_scale_factor=1);page.set_default_timeout(20000)
  page.on('pageerror',lambda e:r['errors'].append(str(e)));page.on('console',lambda x:r['consoleErrors'].append(x.text) if x.type=='error' else None)
  page.on('requestfailed',lambda q:r['requestFailures'].append({'url':q.url,'reason':q.failure}))
  response=page.goto(url,wait_until='load',timeout=30000);r['browserHTTP']={'status':response.status,'headers':response.all_headers(),'sha256':hashlib.sha256(response.body()).hexdigest()}
  assert response.status==200 and r['browserHTTP']['sha256']==expected,'Browser response does not match workbench bytes'
  try: page.wait_for_function("window.TilesMotherV099&&document.body.dataset.ready==='true'")
  except Exception:
   r['diagnostic']=page.evaluate("({title:document.title,url:location.href,ready:document.body?.dataset.ready,api:typeof window.TilesMotherV099,scriptCount:document.scripts.length,text:document.body?.innerText?.slice(0,2000)})")
   page.screenshot(path=str(out/'failure.jpg'),type='jpeg',quality=80);raise
  assert page.evaluate('TilesMotherV099.version')=='0.9.9'
  page.screenshot(path=str(out/'desktop.jpg'),type='jpeg',quality=85)
  r['cases'].append({'name':'public_desktop','triangles':page.evaluate('__tilesDebug.renderer.info.render.triangles')})
  page.click('[data-study="original"]');page.wait_for_timeout(500);assert page.evaluate('TilesMotherV099.state.geometryRevision')==0
  page.click('[data-study="surface"]');page.wait_for_timeout(500);assert page.evaluate('TilesMotherV099.state.geometryRevision')==1
  r['checks'].append({'name':'public_actual_ABC_buttons','passed':True})
  before=page.evaluate('TilesMotherV099.getCamera()');page.mouse.move(730,420);page.mouse.down();page.mouse.move(800,460,steps=12);page.mouse.up();after=page.evaluate('TilesMotherV099.getCamera()');assert before!=after
  r['checks'].append({'name':'public_mouse_drag_changes_camera','passed':True})
  page.set_viewport_size({'width':390,'height':844});page.evaluate('TilesMotherV099.setView({scene:"trio",focusSingle:false})');page.wait_for_timeout(300)
  assert page.evaluate('document.body.scrollWidth===innerWidth')
  page.screenshot(path=str(out/'mobile.jpg'),type='jpeg',quality=85);r['cases'].append({'name':'public_mobile390x844','triangles':page.evaluate('__tilesDebug.renderer.info.render.triangles')})
  b.close()
 r['allPassed']=not r['errors'] and not r['consoleErrors'];assert r['allPassed']
except Exception as e:
 r['failure']=str(e);r['allPassed']=False;save();raise
save();print(json.dumps(r,ensure_ascii=False,indent=2))
