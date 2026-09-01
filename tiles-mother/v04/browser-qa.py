from pathlib import Path
import argparse,functools,http.server,threading,json,hashlib,time,traceback
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--site',required=True);p.add_argument('--url');p.add_argument('--out',required=True);args=p.parse_args()
site=Path(args.site);out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
report={'version':'0.4.0','tests':[],'errors':[],'failedRequests':[],'screenshots':[],'allPassed':False,'visualApproved':False,'productionApproved':False}
def check(name,ok,detail=None):
 report['tests'].append({'name':name,'passed':bool(ok),'detail':detail});assert ok,(name,detail)
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a):pass
server=None
if args.url:url=args.url
else:
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(site)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/'
report['url']=url
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  page=browser.new_page(viewport={'width':1440,'height':940},device_scale_factor=1)
  page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('console',lambda m:report['errors'].append(m.text) if m.type=='error' else None);page.on('requestfailed',lambda r:report['failedRequests'].append({'url':r.url,'failure':r.failure}))
  response=page.goto(url,wait_until='networkidle',timeout=60000);check('HTTP 200',response.status==200)
  page.wait_for_function('window.TilesStudy?.ready===true',timeout=60000);check('actual WebGL2',page.evaluate("!!document.querySelector('canvas').getContext('webgl2')"))
  report['browserVersion']=browser.version
  def snap(name):
   page.wait_for_timeout(250);path=out/(name+'.jpg');page.locator('#canvas').screenshot(path=str(path),type='jpeg',quality=88);im=np.asarray(Image.open(path).convert('RGB'));report['screenshots'].append({'path':path.name,'nativePixels':[im.shape[1],im.shape[0]],'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()});return im
  for family in ['pan','cover']:
   page.evaluate('(shape)=>TilesStudy.set({shape,trio:false,day:0,mode:"studio",channel:"final",relief:1,pores:1,forming:1})',family)
   a=snap(family+'-studio');check(family+' non-flat rendered image',a.std()>12,float(a.std()))
   r=page.evaluate('TilesStudy.receipt()');report[family]=r
   check(family+' geometry actually displaced',r['entities'][0]['metrics']['topPeakToValley']>.001)
   page.evaluate('TilesStudy.set({mode:"neutral"})');snap(family+'-neutral')
   page.evaluate('TilesStudy.set({mode:"diagnostic",channel:"clay"})');page.locator('#closeup').click();a=snap(family+'-geometry-close')
   hashes=page.evaluate('TilesStudy.geometryHashes()');page.evaluate('TilesStudy.set({relief:0})');b=snap(family+'-relief-off');check(family+' ablation changes rendered pixels',float(np.abs(a.astype(float)-b).mean())>.1)
   check(family+' ablation changes actual vertex hash',page.evaluate('TilesStudy.geometryHashes()')!=hashes)
   page.evaluate('TilesStudy.set({relief:1,mode:"studio",channel:"final",trio:true})');snap(family+'-three-variants');hashes=page.evaluate('TilesStudy.geometryHashes()');check(family+' three stable unique children',len(hashes)==3 and len(set(hashes))==3)
  page.evaluate('TilesStudy.set({shape:"pan",trio:false,mode:"studio",channel:"final"})');before=page.evaluate('TilesStudy.receipt().entities');a=snap('lights-default')
  for key in ['key','fill','rim']:
   page.evaluate('(key)=>TilesStudy.set({[key]:0})',key);check(key+' light keeps source state unchanged',page.evaluate('TilesStudy.receipt().entities')==before)
  b=snap('lights-off');check('lights visibly affect render',float(np.abs(a.astype(float)-b).mean())>.1)
  page.evaluate('TilesStudy.set({key:3.2,fill:.7,rim:1.8,shape:"roof",day:0})');snap('roof-new');r0=page.evaluate('TilesStudy.receipt()');check('one controller reaches 15 tiles',r0['entityCount']==15)
  page.evaluate('TilesStudy.set({day:60})');snap('roof-aged');r1=page.evaluate('TilesStudy.receipt()');check('all roof tiles receive same physical time',all(e['history']['physicalTimeSeconds']==60*86400 for e in r1['entities']));check('shared history keeps child diversity',len(set(round(e['history']['wetness'],8) for e in r1['entities']))>1);check('all roof budgets close',all(abs(e['history']['budget']['residual'])<1e-10 for e in r1['entities']))
  page.evaluate('TilesStudy.set({day:0})');check('rewind restores actual geometry',page.evaluate('TilesStudy.geometryHashes()')==[e['geometryHash'] for e in r0['entities']]);report['roof']=r1
  check('unknown runtime parameter rejected',page.evaluate("()=>{try{TilesStudy.set({productionApproved:true});return false}catch{return true}}"))
  mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True);mobile.on('pageerror',lambda e:report['errors'].append('mobile:'+str(e)));mobile.on('console',lambda m:report['errors'].append('mobile:'+m.text) if m.type=='error' else None);mobile.goto(url,wait_until='networkidle',timeout=60000);mobile.wait_for_function('window.TilesStudy?.ready===true',timeout=60000);check('mobile no horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth <= innerWidth+1'));mobile.screenshot(path=str(out/'mobile.jpg'),full_page=True,type='jpeg',quality=82);report['mobile']=mobile.evaluate('TilesStudy.receipt()');check('mobile source approval false',not report['mobile']['visualApproved'] and not report['mobile']['productionApproved']);check('no browser errors',not report['errors'],report['errors']);check('no failed requests',not report['failedRequests'],report['failedRequests']);report['allPassed']=True;browser.close()
except Exception as e:
 report['error']=str(e);report['traceback']=traceback.format_exc()
finally:
 if server:server.shutdown()
 (out/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({k:v for k,v in report.items() if k not in ['pan','cover','roof','mobile']},ensure_ascii=False,indent=2))
if not report['allPassed']:raise SystemExit(1)
