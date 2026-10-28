from pathlib import Path
from playwright.sync_api import sync_playwright
import json,hashlib,base64,zlib
root=Path(__file__).resolve().parents[1];out=root/'ci/evidence/cpu';out.mkdir(parents=True,exist_ok=True)
result={'candidate_sha256':hashlib.sha256((root/'cpu-lane/candidate.html').read_bytes()).hexdigest(),'cases':[],'errors':[]}
RAW="""()=>{let c=document.querySelector('canvas'),a=c.getContext('2d').getImageData(0,0,c.width,c.height).data,s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));return btoa(s)}"""
DENY_GL="""(()=>{window.glAttempts=0;const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl'||type==='webgl2'||type==='experimental-webgl'){glAttempts++;return null}return original.call(this,type,...args)}})()"""
def wait(p):
 p.wait_for_function("window.woodQA&&woodQA.phase==='complete'&&woodQA.committedGeneration===woodQA.epoch",timeout=120000);q=p.evaluate('woodQA');assert not q['error'] and q['tiles']==q['total'];assert p.evaluate('glAttempts')==0;return q
try:
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,executable_path='/opt/google/chrome/chrome',chromium_sandbox=True,ignore_default_args=['--enable-unsafe-swiftshader','--no-sandbox','--unsafely-disable-devtools-self-xss-warnings','--disable-ipc-flooding-protection','--disable-client-side-phishing-detection']);result['browser']=b.version
  initial=None
  for name,vp,dpr in [('desktop',{'width':1280,'height':900},1),('user-size',{'width':1356,'height':1245},1.5),('mobile',{'width':390,'height':844},3)]:
   context=b.new_context(viewport=vp,device_scale_factor=dpr);context.add_init_script(DENY_GL);page=context.new_page();page.on('pageerror',lambda e:result['errors'].append(str(e)));page.goto((root/'cpu-lane/candidate.html').as_uri());c={'name':name,'initial':wait(page),'steps':[]};result['cases'].append(c);page.screenshot(path=str(out/(name+'-board.png')));raw=base64.b64decode(page.evaluate(RAW));(out/(name+'-board.rgba.z')).write_bytes(zlib.compress(raw));assert sum(raw[3::4])==255*len(raw)//4
   if name=='desktop':initial=raw
   page.evaluate("()=>{let e=document.querySelector('#shape');e.value=1;e.dispatchEvent(new Event('input'))}");page.wait_for_function("woodQA.phase==='rendering' && woodQA.tiles>1");page.evaluate("()=>{let e=document.querySelector('#cut');e.value=.25;e.dispatchEvent(new Event('input'))}");q=wait(page);assert q['renderedState']['shape']==1 and q['renderedState']['cut']==.25;c['steps'].append({'actual_inflight_cancel':q});page.screenshot(path=str(out/(name+'-cylinder-cut.png')))
   page.evaluate("()=>{document.querySelector('#reset').click();let e=document.querySelector('#cut');e.value=.7;e.dispatchEvent(new Event('input'))}");q=wait(page);page.screenshot(path=str(out/(name+'-cylinder.png')))
   if name=='desktop':
    box=page.locator('canvas').bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+box['width']/2+40,box['y']+box['height']/2+20);page.mouse.up();q=wait(page);assert q['renderedState']['yaw']!=.9;c['steps'].append({'actual_pointer_rotate':q})
    before=q['renderedState']['dist'];page.mouse.wheel(0,100);q=wait(page);assert q['renderedState']['dist']>before;c['steps'].append({'actual_wheel_zoom':q})
    page.set_viewport_size({'width':1200,'height':860});page.evaluate("()=>window.dispatchEvent(new Event('resize'))");q=wait(page);assert q['width']==920;c['steps'].append({'actual_resize':q})
    page.set_viewport_size(vp);page.evaluate("()=>window.dispatchEvent(new Event('resize'))");wait(page)
    page.evaluate("()=>document.querySelector('#endgrain').click()");c['steps'].append({'endgrain':wait(page)});page.screenshot(path=str(out/'endgrain.png'))
    page.evaluate("()=>{let e=document.querySelector('#knot');e.checked=false;e.dispatchEvent(new Event('input'))}");c['steps'].append({'no_knot':wait(page)})
    page.evaluate("()=>{let e=document.querySelector('#channel');e.value=2;e.dispatchEvent(new Event('input'))}");c['steps'].append({'roughness':wait(page)})
   c['glAttempts']=page.evaluate('glAttempts');context.close()
  # A blocked Worker must run the same algorithm on the cooperative main thread.
  c=b.new_context(viewport={'width':1280,'height':900},device_scale_factor=1);c.add_init_script(DENY_GL);c.add_init_script("window.Worker=function(){throw new Error('TEST Worker blocked')}");page=c.new_page();page.goto((root/'cpu-lane/candidate.html').as_uri());q=wait(page);raw=base64.b64decode(page.evaluate(RAW));assert raw==initial;result['fallback']={'qa':q,'identical_to_worker':True,'glAttempts':page.evaluate('glAttempts')};page.evaluate("()=>{let e=document.querySelector('#shape');e.value=1;e.dispatchEvent(new Event('input'))}");page.wait_for_function("woodQA.phase==='rendering' && woodQA.tiles>1");page.evaluate("()=>{let e=document.querySelector('#shape');e.value=0;e.dispatchEvent(new Event('input'))}");result['fallback']['cancelled_back_to_board']=wait(page);assert base64.b64decode(page.evaluate(RAW))==initial;page.screenshot(path=str(out/'worker-blocked-fallback.png'));c.close();assert not result['errors'];result['status']='PASS_CPU_ONLY_INTERACTIVE_AND_WORKER_FALLBACK';b.close()
except Exception as e:result['failure']=repr(e);raise
finally:(out/'result.json').write_text(json.dumps(result,indent=2))
