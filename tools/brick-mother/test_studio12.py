"""Real browser checks. Screenshots are engineering evidence, not generated illustrations."""
import os,sys,json,time,hashlib,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=sys.argv[1].rstrip('/');OUT=Path(sys.argv[2]);OUT.mkdir(parents=True,exist_ok=True)
API='window.__BRICK_MOTHER_WEATHERING_PBR__'
report={'url':BASE,'runtime':'1.2.0-alpha.9','checks':[],'errors':[],'gpuBenchmark':False,'visualApproved':False,'productionApproved':False}
def check(name,condition,details=None):
 report['checks'].append({'name':name,'passed':bool(condition),'details':details});(OUT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(name,bool(condition),flush=True)
 assert condition,(name,details)
def ready(page):
 page.wait_for_function("document.documentElement.dataset.workbenchReady==='true'||document.documentElement.dataset.runtimeFailure==='true'",timeout=90000)
 ok=page.evaluate("document.documentElement.dataset.runtimeFailure!=='true'");check('runtime healthy',ok,None if ok else page.locator('#error').inner_text())
 page.wait_for_function("Number(document.documentElement.dataset.renderCount)>1",timeout=20000);page.wait_for_timeout(400)
def wake(page):page.keyboard.press('Tab')
def hide(page):
 wake(page);page.click('#hidePanels');page.wait_for_timeout(500)
 check('hidden presentation chrome',page.evaluate("document.body.classList.contains('immersive')"))
def screenshot(page,name):
 page.screenshot(path=str(OUT/(name+'.png')));check('screenshot '+name,(OUT/(name+'.png')).stat().st_size>15000)
def diagnostics(page):
 return page.evaluate(API+'.getRenderDiagnostics()')
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('google-chrome-stable'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':1280,'height':850},device_scale_factor=1);page.on('pageerror',lambda e:report['errors'].append(str(e)))
 try:
  start=time.monotonic();response=page.goto(BASE+'/studio.html',wait_until='domcontentloaded',timeout=60000)
  check('HTTP HTML',response.status==200 and 'text/html' in response.headers.get('content-type',''));ready(page)
  report['initialReadyMs']=round((time.monotonic()-start)*1000);report['firstMeshMs']=page.evaluate('Number(document.documentElement.dataset.firstMeshMs)')
  report['renderer']=page.evaluate("(()=>{const g=document.querySelector('canvas').getContext('webgl2');const e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);})()")
  check('actual version',page.evaluate(API+'.version')=='1.2.0-alpha.9');check('six families',page.locator('.family-btn').count()==6)
  check('worker completed four meshes',page.evaluate("document.documentElement.dataset.meshCount==='4'&&document.documentElement.dataset.geometryWorker==='true'"))
  for family in range(6):
   wake(page);page.click('#showMaterials');page.click(f'.family-btn[data-family="{family}"]');ready(page);check('material '+str(family),page.evaluate(API+'.state.family')==family)
   hide(page);screenshot(page,'family-'+str(family))
  wake(page);page.click('#showControls')
  for channel in range(16):
   page.click(f'.diag[data-view="{channel}"]');page.wait_for_timeout(110);check('diagnostic '+str(channel),page.evaluate(API+'.state.viewMode')==channel)
  page.click('.diag[data-view="0"]')
  for light in ['studio','neutral','raking','overcast','outdoor']:
   page.click(f'.light-btn[data-light="{light}"]');page.wait_for_timeout(250);check('light '+light,page.evaluate(API+'.state.lightMode')==light)
  page.click('.light-btn[data-light="studio"]');page.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
  before=page.evaluate(API+'.state.form');page.locator('#form').focus();page.keyboard.press('ArrowRight');ready(page)
  check('shape range rebuild',page.evaluate(API+'.state.form')>before);check('no replacement loading curtain',page.evaluate("document.querySelector('#loading').classList.contains('hidden')"))
  page.click('#playPause');report['resumeBefore']=diagnostics(page);t0=page.evaluate(API+'.state.simTime')
  page.wait_for_function(f'{API}.state.simTime>{t0}',timeout=12000);report['resumeAfter']=diagnostics(page)
  check('evolution advances',page.evaluate(API+'.state.simTime')>t0,report['resumeAfter'])
  page.click('#playPause');page.wait_for_timeout(500);t0=page.evaluate(API+'.state.simTime');page.wait_for_timeout(400)
  check('pause preserves time',page.evaluate(API+'.state.simTime')==t0)
  page.click('#rainPulse');page.wait_for_timeout(500);check('rain resumes',page.evaluate(API+'.state.playing') is True);page.click('#playPause')
  hide(page);old=page.evaluate(API+'.camera.goalYaw');page.mouse.move(540,410);page.mouse.down();page.mouse.move(680,445,steps=12);page.mouse.up();page.wait_for_timeout(1600)
  check('orbit drag',abs(page.evaluate(API+'.camera.goalYaw')-old)>.1);check('drag leaves immersive mode',page.evaluate("document.body.classList.contains('immersive')"))
  page.mouse.click(540,410);check('tap reveals controls',page.evaluate("!document.body.classList.contains('immersive')"))
  page.click('#fullScreen');page.wait_for_timeout(500);check('fullscreen gesture',page.evaluate('!!document.fullscreenElement'));page.evaluate('document.exitFullscreen()')
  page.wait_for_timeout(2000);n0=page.evaluate('Number(document.documentElement.dataset.renderCount)');page.wait_for_timeout(800);n1=page.evaluate('Number(document.documentElement.dataset.renderCount)')
  check('idle rendering stops',n1-n0<=2,{'before':n0,'after':n1});page.wait_for_timeout(6000)
  check('automatic immersive mode',page.evaluate("document.body.classList.contains('immersive')"));check('no page errors',not report['errors'],report['errors'])
  mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);mobile.on('pageerror',lambda e:report['errors'].append(str(e)))
  mobile.goto(BASE+'/studio.html?family=3',wait_until='domcontentloaded');ready(mobile)
  mobile.keyboard.press('Tab');mobile.click('#showMaterials');check('mobile family drawer',mobile.evaluate("document.body.classList.contains('left-open')"));mobile.click('.family-btn[data-family="4"]');ready(mobile)
  mobile.keyboard.press('Tab');mobile.click('#showControls');check('mobile parameter drawer',mobile.evaluate("document.body.classList.contains('right-open')"));screenshot(mobile,'mobile-controls')
  mobile.keyboard.press('Escape');screenshot(mobile,'mobile-immersive');check('mobile no horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  check('all errors empty',not report['errors'],report['errors'])
 except Exception as e:
  report['failure']=str(e)
  try:report['lastScheduler']=diagnostics(page);page.screenshot(path=str(OUT/'failure.png'));(OUT/'failure.html').write_text(page.content())
  except Exception:pass
  raise
 finally:
  report['passed']=not report.get('failure') and all(c['passed'] for c in report['checks']);report['screenshots']=[{'name':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(OUT.glob('*.png'))]
  (OUT/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close()
