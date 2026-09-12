from pathlib import Path
import json, threading, functools, http.server, io, sys
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parent
out=root/'qa-r2';out.mkdir(exist_ok=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=sys.argv[1] if len(sys.argv)>1 else f'http://127.0.0.1:{server.server_port}/material-microscope-lab-r2/Brick_Material_Microscope_Lab_R2.html'
report={'url':url,'checks':{},'errors':[], 'beautyToleranceMean8Bit':.01, 'baselineToleranceMean8Bit':.02, 'pixelDeltas':[]}
with sync_playwright() as p:
    browser=p.chromium.launch(channel='chrome',headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    page.on('pageerror',lambda e:report['errors'].append(str(e)))
    page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None)
    page.goto(url,wait_until='networkidle')
    if page.get_by_text('Open the page',exact=True).count():page.get_by_text('Open the page',exact=True).click();page.wait_for_load_state('networkidle')
    page.wait_for_selector('canvas[data-ready="true"]')
    def capture():
        page.wait_for_timeout(100)
        a=np.asarray(Image.open(io.BytesIO(page.locator('canvas').screenshot(style='.labels,.hint{visibility:hidden}'))))[:,:,:3].astype(float)
        return a[:,:a.shape[1]//2],a[:,a.shape[1]//2:]
    def setv(id,v):
        page.locator('#'+id).fill(str(v));page.locator('#'+id).dispatch_event('input')
    def mode(i):page.locator(f'[data-mode="{i}"]').click()
    def diff(a,b):
        value=float(np.abs(a-b).mean())
        report['pixelDeltas'].append(value)
        print('pixel delta',value,flush=True)
        return value
    def check(key,val):
        report['checks'][key]=bool(val)
        if not val: print('FAIL',key,flush=True)
    page.screenshot(path=str(out/'01-beauty-desktop.png'))
    check('shader_compiles',not report['errors'])
    page.locator('#reset').click()
    for i in range(4):
        mode(i);a,b=capture();check(f'baseline_panels_match_mode_{i}',diff(a,b)<.02)
    mode(1);_,base=capture();setv('height',3);_,height=capture();check('height_changes_height',diff(base,height)>.01)
    mode(2);_,rough0=capture();setv('height',0);_,rough1=capture();check('height_does_not_change_roughness',diff(rough0,rough1)==0)
    setv('roughness',1);_,rough2=capture();check('roughness_changes_roughness',diff(rough1,rough2)>.01)
    mode(1);_,h0=capture();setv('roughness',2);_,h1=capture();check('roughness_does_not_change_height',diff(h0,h1)==0)
    page.locator('#enhance').click()
    for i in [1,2]:
        mode(i);_,a=capture();setv('strength',0);_,b=capture();check(f'strength_changes_mode_{i}',diff(a,b)>.01);setv('strength',2)
    for i in [1,2]:
        mode(i);_,a=capture();setv('scale',2);_,b=capture();check(f'scale_changes_mode_{i}',diff(a,b)>.01);setv('scale',1)
    mode(3);_,mask0=capture();setv('strength',4);setv('scale',4);setv('height',4);setv('roughness',2);_,mask1=capture();check('controls_preserve_masks',diff(mask0,mask1)==0)
    for i in [0,1,2,3]:
        mode(i);page.locator('#mm').click();_,off=capture();page.locator('#mm').click();setv('strength',0);_,zero=capture();check(f'off_equals_zero_mode_{i}',diff(off,zero)<.01);setv('strength',4)
    mode(1);setv('strength',0);_,meso=capture();check('off_preserves_process_height',float(meso.std())>1)
    page.locator('#enhance').click()
    for i,label in [(1,'height'),(2,'roughness'),(3,'masks'),(0,'beauty')]:
        mode(i);page.screenshot(path=str(out/f'02-{label}.png'))
    page.locator('#mm').click();page.screenshot(path=str(out/'03-off.png'));page.locator('#mm').click();page.screenshot(path=str(out/'04-on.png'))
    page.locator('#scale').focus();page.keyboard.press('ArrowRight');check('keyboard_slider',page.locator('#scale').input_value()=='1.05')
    mode(2);check('mode_keeps_controls',page.locator('#scale').input_value()=='1.05')
    page.locator('#reset').click();check('reset_restores_values',[page.locator('#'+i).input_value() for i in ['strength','scale','height','roughness']]==['1','1','1','0'])
    mode(0);_,cam0=capture();box=page.locator('canvas').bounding_box();page.mouse.move(box['x']+300,box['y']+150);page.mouse.down();page.mouse.move(box['x']+360,box['y']+180);page.mouse.up();_,cam1=capture();check('drag_rotates',diff(cam0,cam1)>.1);page.locator('#camera').click();_,cam2=capture();check('camera_reset',diff(cam0,cam2)<.01)
    page.locator('#enhance').click();page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200);page.screenshot(path=str(out/'05-mobile.png'))
    check('mobile_no_horizontal_overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
    check('mobile_controls_in_view',all(page.locator('#'+i).bounding_box()['y']+page.locator('#'+i).bounding_box()['height']<=844 for i in ['strength','scale','height','roughness']))
    check('mobile_two_panels',page.locator('canvas').bounding_box()['height']>=320)
    check('no_browser_errors',not report['errors'])
    fallback=browser.new_page()
    fallback.add_init_script("HTMLCanvasElement.prototype.getContext=function(){return null;}")
    fallback.goto(url,wait_until='networkidle')
    if fallback.get_by_text('Open the page',exact=True).count():fallback.get_by_text('Open the page',exact=True).click();fallback.wait_for_load_state('networkidle')
    check('webgl_unavailable_message',fallback.locator('#error').is_visible() and 'WebGL2' in fallback.locator('#error').inner_text())
    browser.close()
server.shutdown()
report['passed']=all(report['checks'].values()) and not report['errors']
(out/('public-report.json' if len(sys.argv)>1 else 'local-report.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
sys.exit(0 if report['passed'] else 1)
