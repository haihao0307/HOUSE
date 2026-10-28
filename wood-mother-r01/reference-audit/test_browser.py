"""Bounded independent reference scene QA; normal sandbox Chrome only."""
import argparse,hashlib,json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--candidate',required=True);ap.add_argument('--browser',default='/opt/google/chrome/chrome');ap.add_argument('--out',default='reference-audit/browser-evidence');a=ap.parse_args();src=Path(a.candidate).resolve();out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
R={'source_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'checks':[],'limits':['Viewport, not physical device.','Actual pixels required; numeric PASS not visual acceptance.']}
def ck(k,v):R['checks'].append({'name':k,'pass':bool(v)});assert v,k
def q(p):return p.evaluate('JSON.parse(JSON.stringify(woodReferenceQA))')
def settled(p,previous=0):p.wait_for_function('(n)=>window.woodReferenceQA&&woodReferenceQA.renderedCount>n&&woodReferenceQA.active===0&&woodReferenceQA.queued===0',arg=previous,timeout=90000);return q(p)
def change(p,i,v):p.locator('#'+i).evaluate('(e,v)=>{if(e.type==="checkbox")e.checked=v;else e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}))}',v)
def hashcanvas(p):return p.locator('#view').evaluate('(e)=>{const d=e.getContext("2d").getImageData(0,0,e.width,e.height).data;let h=2166136261;for(const b of d)h=Math.imul(h^b,16777619)>>>0;return h}')
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,executable_path=a.browser,chromium_sandbox=True,ignore_default_args=['--no-sandbox','--enable-unsafe-swiftshader','--unsafely-disable-devtools-self-xss-warnings','--disable-ipc-flooding-protection','--disable-client-side-phishing-detection']);R['browser']=b.version
  c=b.new_context(viewport={'width':1000,'height':800});p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  p.add_init_script("window.__gl=0;const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){if(/webgl/.test(t)){__gl++;return null}return g.call(this,t,...a)}")
  p.goto(src.as_uri());s=settled(p);R['initial']=s;expected=p.locator('#view').evaluate('(e)=>({w:Math.round(e.clientWidth*Math.min(devicePixelRatio,1.5)),h:Math.round(e.clientHeight*Math.min(devicePixelRatio,1.5))})');ck('full original pixel budget',s['renderedState']['view']['width']==expected['w'] and s['renderedState']['view']['height']==expected['h']);ck('bounded worker pool',s.get('workerCount',0)<=6);ck('seven real instances',len(s['renderedState']['instances'])==7);ck('no WebGL attempted',p.evaluate('__gl')==0);p.screenshot(path=str(out/'initial.png'))
  for name,value in [('damage',0),('damage',1),('gray',True),('density',2),('length',3.3)]:
   n=q(p)['renderedCount'];change(p,name,value);s=settled(p,n);R[name+'-'+str(value)]={'state':s,'pixels':hashcanvas(p)};p.screenshot(path=str(out/(name+'-'+str(value)+'.png')))
  ck('damage changes pixels',R['damage-0']['pixels']!=R['damage-1']['pixels']);ck('length consumed',s['renderedState']['source']['Object']['parameters']['length']==3.3)
  n=q(p)['renderedCount'];change(p,'gray',False);settled(p,n)
  # Start legacy playback, then ensure returning unloads or freezes its renderer.
  n=q(p)['renderedCount'];p.locator('#mode').select_option('eight')
  legacy=p.frame_locator('#legacy');legacy.locator('#play').wait_for(timeout=90000)
  iframe=p.locator('#legacy').element_handle().content_frame();iframe.wait_for_function('window.woodQA&&woodQA.phase==="complete"',timeout=90000)
  legacy.locator('#play').click();p.wait_for_timeout(250)
  p.locator('#mode').select_option('reference');settled(p,n)
  legacy_live=p.locator('#legacy').element_handle().content_frame()
  if legacy_live and legacy_live.url not in ('about:blank',''):
   old=legacy_live.evaluate('woodQA.frames');p.wait_for_timeout(5000);ck('hidden legacy stops rendering',legacy_live.evaluate('woodQA.frames')==old)
  else:ck('hidden legacy unloaded',True)
  n=q(p)['renderedCount'];p.locator('#mode').select_option('eight');p.locator('#mode').select_option('reference');settled(p,n);ck('mode return renders',q(p)['renderedCount']>n)
  start=q(p);p.locator('#play').click();p.wait_for_function('(n)=>woodReferenceQA.renderedCount>=n+2',arg=start['renderedCount'],timeout=60000)
  moving=q(p);ck('actual 3D yaw changes',moving['renderedState']['view']['yaw']!=start['renderedState']['view']['yaw']);R['playSample']={'before':start,'after':moving}
  before=p.evaluate("()=>{const e=document.querySelector('#view'),d=e.getContext('2d').getImageData(0,0,e.width,e.height).data;let h=2166136261;for(const b of d)h=Math.imul(h^b,16777619)>>>0;document.querySelector('#play').click();return h}");p.wait_for_timeout(5000);ck('pause retains visible pixels',hashcanvas(p)==before)
  p.locator('#play').click();p.wait_for_timeout(150)
  p.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))");f=q(p)['renderedCount'];h=hashcanvas(p);p.wait_for_timeout(5000);ck('hidden freezes commits',q(p)['renderedCount']==f and hashcanvas(p)==h)
  ck('no page errors',not errors);R['errors']=errors
  mobile=b.new_context(viewport={'width':390,'height':844},device_scale_factor=3);mp=mobile.new_page();mp.goto(src.as_uri());ms=settled(mp)
  me=mp.locator('#view').evaluate('(e)=>({w:Math.round(e.clientWidth*Math.min(devicePixelRatio,1.5)),h:Math.round(e.clientHeight*Math.min(devicePixelRatio,1.5))})')
  ck('mobile viewport original pixel budget',ms['renderedState']['view']['width']==me['w'] and ms['renderedState']['view']['height']==me['h'])
  ck('mobile viewport seven instances',len(ms['renderedState']['instances'])==7)
  ck('mobile single-row toolbar',mp.locator('footer').evaluate('(e)=>getComputedStyle(e).flexWrap')=='nowrap')
  mp.screenshot(path=str(out/'mobile-viewport.png'));R['mobileViewport']=ms;mobile.close();b.close()
 R['status']='PASS_FUNCTIONAL_VISUAL_REVIEW_REQUIRED'
except Exception as e:R['status']='FAIL_OR_BLOCKED';R['failure']=repr(e);raise
finally:(out/'result.json').write_text(json.dumps(R,ensure_ascii=False,indent=2))
