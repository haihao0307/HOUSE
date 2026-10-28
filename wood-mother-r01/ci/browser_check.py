from playwright.sync_api import sync_playwright
from pathlib import Path
import json,hashlib,shutil,time
root=Path(__file__).resolve().parents[1]
evidence=root/'ci/evidence';evidence.mkdir(exist_ok=True)
result={'html_sha256':hashlib.sha256((root/'index.html').read_bytes()).hexdigest(),'tests':[],'errors':[],'status':'STARTED'}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/opt/google/chrome/chrome',chromium_sandbox=True,ignore_default_args=['--enable-unsafe-swiftshader','--no-sandbox','--unsafely-disable-devtools-self-xss-warnings','--disable-ipc-flooding-protection','--disable-client-side-phishing-detection'])
  command=browser.new_browser_cdp_session().send('Browser.getBrowserCommandLine')['arguments'];result['browser_command']=command;result['browser_version']=browser.version
  forbidden=['--no-sandbox','--disable-setuid-sandbox','--disable-web-security','--ignore-certificate-errors','--enable-unsafe-swiftshader','--unsafely-disable-devtools-self-xss-warnings','--disable-ipc-flooding-protection','--disable-client-side-phishing-detection'];assert not any(a.split('=')[0] in forbidden for a in command)
  page=browser.new_page(viewport={'width':1280,'height':900})
  page.on('pageerror',lambda e:result['errors'].append(str(e)))
  page.goto((root/'index.html').as_uri());page.wait_for_timeout(500)
  page.screenshot(path=str(evidence/'desktop-initial.png'))
  qa=page.evaluate('window.woodQA');result['initial_qa']=qa
  assert qa and qa.get('frames',0)>0 and qa.get('error')==0,'No rendered frame or GPU error'
  pixels=page.evaluate('''()=>{let c=document.querySelector('canvas'),g=c.getContext('webgl2'),a=new Uint8Array(c.width*c.height*4);g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,a);let lo=255,hi=0;for(let i=0;i<a.length;i+=4){lo=Math.min(lo,a[i]);hi=Math.max(hi,a[i]);}return {lo,hi,error:g.getError()}}''');result['pixel_range']=pixels;assert pixels['hi']-pixels['lo']>20 and pixels['error']==0,'Blank or invalid pixel buffer'
  initial=page.locator('canvas').screenshot();result['tests'].append('WebGL2 frame and GL_NO_ERROR')
  result['gpu']=page.evaluate("()=>{let g=document.querySelector('canvas').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return {renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),version:g.getParameter(g.VERSION)}}")
  def action(name,fn,changes=True):
   before=page.locator('canvas').screenshot();frame=page.evaluate('woodQA.frames');fn();page.wait_for_function('(f)=>woodQA.frames>f',arg=frame)
   after=page.locator('canvas').screenshot()
   if changes:assert after!=before,name+' did not change pixels'
   result['tests'].append(name)
  def slider(id,value):page.locator('#'+id).evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}))}',str(value))
  action('cylinder',lambda:page.select_option('#shape','1'));page.screenshot(path=str(evidence/'cylinder.png'))
  action('board restored',lambda:page.select_option('#shape','0'))
  action('knot off',lambda:page.locator('#knot').uncheck());page.screenshot(path=str(evidence/'without-knot.png'))
  action('knot on',lambda:page.locator('#knot').check())
  action('endgrain view',lambda:page.locator('#endgrain').click());page.screenshot(path=str(evidence/'endgrain.png'));action('full view restored',lambda:page.locator('#reset').click())
  action('cut through active knot',lambda:slider('cut',.45));page.screenshot(path=str(evidence/'cut-through-knot.png'));action('cut full restored',lambda:slider('cut',.7))
  action('knot height',lambda:slider('height',.4));action('knot radius',lambda:slider('radius',.25));action('cut advance',lambda:slider('cut',0));page.screenshot(path=str(evidence/'cut.png'))
  action('cut restored',lambda:slider('cut',.7))
  for value in ['1','2','3','0']:action('channel '+value,lambda v=value:page.select_option('#channel',v))
  box=page.locator('canvas').bounding_box()
  def drag():
   page.mouse.move(box['x']+100,box['y']+100);page.mouse.down();page.mouse.move(box['x']+240,box['y']+150);page.mouse.up()
  action('drag orbit',drag);action('camera reset',lambda:page.locator('#reset').click())
  frame=page.evaluate('woodQA.frames');page.set_viewport_size({'width':390,'height':844});page.wait_for_function('(f)=>woodQA.frames>f',arg=frame);page.screenshot(path=str(evidence/'mobile-viewport.png'))
  assert page.evaluate('document.body.scrollWidth<=innerWidth'),'Horizontal mobile overflow'
  result['final_qa']=page.evaluate('window.woodQA');assert result['final_qa']['error']==0 and not result['errors']
  result['tests'].append('rotation/reset/channels/mobile viewport; not physical iPhone')
  result['status']='BROWSER_PASS_NEEDS_VISUAL_REVIEW';browser.close()
except Exception as e:
 result['status']='BLOCKED_OR_FAILED';result['failure']=str(e);raise
finally:
 (evidence/'result.json').write_text(json.dumps(result,indent=2))
