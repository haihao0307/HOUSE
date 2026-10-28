from pathlib import Path
from playwright.sync_api import sync_playwright
import json,hashlib
root=Path(__file__).resolve().parents[1];out=root/'ci/evidence/runtime';out.mkdir(parents=True,exist_ok=True)
result={'candidate_sha256':hashlib.sha256((root/'runtime-lane/candidate.html').read_bytes()).hexdigest(),'baseline_sha256':hashlib.sha256((root/'index.html').read_bytes()).hexdigest(),'cases':[],'errors':[]}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/opt/google/chrome/chrome',chromium_sandbox=True,ignore_default_args=['--enable-unsafe-swiftshader','--no-sandbox','--unsafely-disable-devtools-self-xss-warnings','--disable-ipc-flooding-protection','--disable-client-side-phishing-detection'])
  result['browser']=browser.version
  for name,vp,dpr in [('desktop',{'width':1280,'height':900},1),('user-large-hiDPR',{'width':1920,'height':1080},2),('mobile-viewport',{'width':390,'height':844},3)]:
   context=browser.new_context(viewport=vp,device_scale_factor=dpr);page=context.new_page();page.on('pageerror',lambda e:result['errors'].append(str(e)));page.goto((root/'runtime-lane/candidate.html').as_uri());page.wait_for_function('window.woodQA && woodQA.frames>0',timeout=120000)
   c={'name':name,'viewport':vp,'deviceScaleFactor':dpr,'initial':page.evaluate('woodQA'),'steps':[]}
   def action(label,js):
    f=page.evaluate('woodQA.frames');page.evaluate(js);page.wait_for_function('(f)=>woodQA.frames>f',arg=f,timeout=120000);q=page.evaluate('woodQA');assert not q['error'] and q['pixels']['opaque']==48;c['steps'].append({'name':label,'qa':q})
   for n in range(3):
    action('cylinder '+str(n),"()=>{let e=document.querySelector('#shape');e.value=1;e.dispatchEvent(new Event('input'))}")
    action('board '+str(n),"()=>{let e=document.querySelector('#shape');e.value=0;e.dispatchEvent(new Event('input'))}")
   action('user screenshot cylinder parameters; not same machine',"()=>{let e=document.querySelector('#shape');e.value=1;e.dispatchEvent(new Event('input'))}");page.screenshot(path=str(out/(name+'-cylinder.png')))
   for i in range(2):
    for size in [{'width':vp['width']-100,'height':vp['height']-60},vp]:
     f=page.evaluate('woodQA.frames');page.set_viewport_size(size);page.wait_for_function('(f)=>woodQA.frames>f',arg=f,timeout=120000);assert not page.evaluate('woodQA.error')
   c['steps'].append({'name':'four resize transitions','qa':page.evaluate('woodQA')})
   cdp=context.new_cdp_session(page);cdp.send('Page.setWebLifecycleState',{'state':'frozen'});cdp.send('Page.setWebLifecycleState',{'state':'active'})
   action('after actual freeze/unfreeze; explicit pageshow event',"()=>window.dispatchEvent(new PageTransitionEvent('pageshow'))")
   if name=='desktop':
    page.evaluate("()=>{window.qaLoss=document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context');qaLoss.loseContext()}");page.wait_for_function('woodQA.contextLost && woodQA.losses===1');c['loss_visible']=page.locator('#status').inner_text();page.screenshot(path=str(out/'context-lost-visible.png'))
    f=page.evaluate('woodQA.frames');page.get_by_role('button',name='尝试恢复一次').click();page.wait_for_function('(f)=>woodQA.restores===1 && woodQA.frames>f',arg=f,timeout=120000);assert not page.evaluate('woodQA.error');c['restored']=page.evaluate('woodQA');page.screenshot(path=str(out/'restored-cylinder.png'))
   c['final']=page.evaluate('woodQA');assert not c['final']['error'];result['cases'].append(c);context.close()
  assert not result['errors'];result['status']='PASS_SIMULATED_FAILURE_RECOVERY_NOT_USER_MACHINE_ROOT_CAUSE';browser.close()
except Exception as e:result['failure']=str(e);raise
finally:(out/'result.json').write_text(json.dumps(result,indent=2))
