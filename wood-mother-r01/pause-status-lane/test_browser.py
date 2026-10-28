from pathlib import Path
import json,hashlib
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];candidate=root/'pause-status-lane/candidate.html';out=root/'ci/evidence/pause-status';out.mkdir(parents=True,exist_ok=True)
r={'sha256':hashlib.sha256(candidate.read_bytes()).hexdigest(),'scope':'Focused status regression; full prior geometry/material tests not repeated.','errors':[]}
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,executable_path='/opt/google/chrome/chrome',chromium_sandbox=True,ignore_default_args=['--enable-unsafe-swiftshader','--no-sandbox','--unsafely-disable-devtools-self-xss-warnings','--disable-ipc-flooding-protection','--disable-client-side-phishing-detection'])
  p=b.new_page(viewport={'width':1000,'height':700});p.on('pageerror',lambda e:r['errors'].append(str(e)));p.goto(candidate.as_uri())
  p.wait_for_function("woodQA.phase==='complete'&&woodQA.epoch===woodQA.committedGeneration",timeout=120000)
  r['initial']=p.locator('#status').inner_text();assert r['initial'].startswith('已暂停')
  p.locator('#play').click();p.wait_for_function("woodQA.playback.playing&&woodQA.phase==='rendering'")
  p.locator('#play').click();r['pauseImmediate']=p.locator('#status').inner_text();assert r['pauseImmediate'].startswith(('播放已暂停','已暂停'))
  p.wait_for_function("woodQA.phase==='complete'&&woodQA.epoch===woodQA.committedGeneration",timeout=120000)
  r['pauseComplete']=p.locator('#status').inner_text();assert r['pauseComplete'].startswith('已暂停') and '计算中' not in r['pauseComplete']
  p.screenshot(path=str(out/'paused.png'))
  p.locator('#family').select_option('4');p.wait_for_function("woodQA.phase==='complete'&&woodQA.epoch===woodQA.committedGeneration",timeout=120000);assert p.evaluate('woodQA.renderedState.family')==4;r['staticEdit']=p.locator('#status').inner_text();assert r['staticEdit'].startswith('已暂停')
  p.evaluate("()=>window.dispatchEvent(new ErrorEvent('error',{message:'QA injected failure'}))");r['error']=p.locator('#status').inner_text();assert 'QA injected failure' in r['error']
  p.evaluate("()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))}");assert p.locator('#status').inner_text()==r['error'];r['errorPriorityOverHide']=True
  assert not r['errors'];r['status']='PASS';b.close()
except Exception as e:r['status']='FAIL';r['failure']=repr(e);raise
finally:(out/'result.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
