from pathlib import Path
from playwright.sync_api import sync_playwright
import json,hashlib,base64,zlib
root=Path(__file__).resolve().parents[1];out=root/'ci/evidence/tiled';out.mkdir(parents=True,exist_ok=True)
result={'candidate_sha256':hashlib.sha256((root/'tiled-lane/candidate.html').read_bytes()).hexdigest(),'cases':[],'errors':[]}
RAW="""()=>{const c=document.querySelector('canvas'),g=c.getContext('webgl2'),a=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,a);let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));return btoa(s)}"""
def wait(page):
 page.wait_for_function("window.woodQA && woodQA.phase==='complete' && woodQA.committedGeneration===woodQA.epoch",timeout=120000)
 q=page.evaluate('woodQA');assert not q['error'] and q['tiles']==q['totalTiles'];return q
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/opt/google/chrome/chrome',chromium_sandbox=True,ignore_default_args=['--enable-unsafe-swiftshader','--no-sandbox','--unsafely-disable-devtools-self-xss-warnings','--disable-ipc-flooding-protection','--disable-client-side-phishing-detection'])
  result['browser']=browser.version
  # Negative control: an old WebGLSync is invalid after context restoration.
  control=browser.new_page();control.set_content('<canvas width="16" height="16"></canvas>')
  control.evaluate("""()=>{window.g=document.querySelector('canvas').getContext('webgl2');window.old=g.fenceSync(g.SYNC_GPU_COMMANDS_COMPLETE,0);g.flush();window.ext=g.getExtension('WEBGL_lose_context');document.querySelector('canvas').addEventListener('webglcontextlost',e=>{e.preventDefault();setTimeout(()=>ext.restoreContext(),100)});document.querySelector('canvas').addEventListener('webglcontextrestored',()=>window.restored=true);ext.loseContext()}""")
  control.wait_for_function('window.restored===true');neg=control.evaluate('()=>({wait:g.clientWaitSync(old,0,0),error:g.getError(),failed:g.WAIT_FAILED,invalid:g.INVALID_OPERATION})');assert neg['wait']==neg['failed'] and neg['error']!=0;result['old_sync_negative_control']=neg;control.close()
  for name,vp,dpr in [('desktop',{'width':1280,'height':900},1),('user-large-hiDPR',{'width':1920,'height':1080},2),('mobile-viewport',{'width':390,'height':844},3)]:
   context=browser.new_context(viewport=vp,device_scale_factor=dpr);page=context.new_page();page.on('pageerror',lambda e:result['errors'].append(str(e)));page.goto((root/'tiled-lane/candidate.html').as_uri());c={'name':name,'initial':wait(page),'steps':[]};result['cases'].append(c);page.screenshot(path=str(out/(name+'-board.png')))
   tiled=base64.b64decode(page.evaluate(RAW));base=context.new_page();base.goto((root/'tiled-lane/baseline-stable.html').as_uri());base.wait_for_function('woodQA.frames>0',timeout=120000);baseline=base64.b64decode(base.evaluate(RAW));assert len(tiled)==len(baseline);diff=[abs(a-b) for a,b in zip(tiled,baseline)];c['whole_frame_comparison']={'bytes':len(tiled),'max_abs':max(diff),'different_bytes':sum(x!=0 for x in diff),'mean_abs':sum(diff)/len(diff)};(out/(name+'-tiled.rgba.z')).write_bytes(zlib.compress(tiled));(out/(name+'-baseline.rgba.z')).write_bytes(zlib.compress(baseline));c['baseline']=base.evaluate('woodQA');base.screenshot(path=str(out/(name+'-baseline.png')));base.close()
   old=context.new_page();old.goto((root/'tiled-lane/baseline-v5.html').as_uri());old.wait_for_function('woodQA.frames>0',timeout=120000);oldraw=base64.b64decode(old.evaluate(RAW));od=[abs(a-b) for a,b in zip(tiled,oldraw)];c['old_v5_difference_not_equivalence']={'max_abs':max(od),'different_bytes':sum(x!=0 for x in od),'mean_abs':sum(od)/len(od)};(out/(name+'-old-v5.rgba.z')).write_bytes(zlib.compress(oldraw));old.close()
   # Repeated async input must commit exactly the last state, not merely another frame.
   page.evaluate("()=>{for(let i=0;i<20;i++){const e=document.querySelector('#shape');e.value=i%2;e.dispatchEvent(new Event('input'))}}")
   q=wait(page);assert q['renderedState']['shape']==1;c['steps'].append({'rapid_shapes':q});page.screenshot(path=str(out/(name+'-cylinder.png')))
   page.evaluate("()=>{let e=document.querySelector('#shape');e.value=0;e.dispatchEvent(new Event('input'))}")
   page.wait_for_function("woodQA.phase==='tiled-render' && woodQA.busy",timeout=10000)
   page.evaluate("()=>{let e=document.querySelector('#shape');e.value=1;e.dispatchEvent(new Event('input'))}")
   q=wait(page);assert q['renderedState']['shape']==1 and q['cancelledGenerations']>0;c['steps'].append({'in_flight_generation_cancel':q})
   page.evaluate("()=>document.querySelector('#endgrain').click()");q=wait(page);assert q['renderedState']['pitch']==1.05;c['steps'].append({'endgrain':q})
   page.evaluate("()=>{let e=document.querySelector('#cut');e.value=-.5;e.dispatchEvent(new Event('input'))}");q=wait(page);assert q['renderedState']['cut']==-.5;c['steps'].append({'thin_cut':q})
   page.evaluate("()=>{let e=document.querySelector('#channel');e.value=2;e.dispatchEvent(new Event('input'))}");q=wait(page);assert q['renderedState']['channel']==2;c['steps'].append({'roughness':q})
   for size in [{'width':vp['width']-80,'height':vp['height']-40},vp]:
    page.set_viewport_size(size);page.evaluate("()=>window.dispatchEvent(new Event('resize'))");q=wait(page);assert q['width']==round(q['cssSize'][0]*min(dpr,1.5));c['steps'].append({'resize':q})
   if name=='desktop':
    page.evaluate("()=>{let e=document.querySelector('#channel');e.value=0;e.dispatchEvent(new Event('input'))}")
    page.wait_for_function("woodQA.phase==='tiled-render' && woodQA.busy",timeout=10000)
    page.evaluate("()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
    page.wait_for_function('woodQA.losses===1',timeout=10000);page.wait_for_function('woodQA.restores===1',timeout=20000);q=wait(page);assert q['restoreAttempts']==1;c['steps'].append({'loss_during_tile_restored':q});page.screenshot(path=str(out/'restored.png'))
    page.evaluate("()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
    page.wait_for_function('woodQA.losses===2 && woodQA.stopped',timeout=10000);q=page.evaluate('woodQA');before=q['draws'];page.wait_for_timeout(800);assert page.evaluate('woodQA.draws')==before;c['steps'].append({'second_loss_stops_no_reload':page.evaluate('woodQA')})
   context.close()
  assert not result['errors'];assert all(c['whole_frame_comparison']['max_abs']<=1 for c in result['cases']), 'Full-frame pixel mismatch; raw evidence retained';result['status']='PASS_EQUIVALENT_PIXELS_AND_BOUNDED_RECOVERY_NOT_USER_GPU_PROOF';browser.close()
except Exception as e:result['failure']=str(e);raise
finally:(out/'result.json').write_text(json.dumps(result,indent=2))
