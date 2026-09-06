"""Exercise the actual standalone page, locally or at its HTTPS URL."""
import os,json,hashlib,time
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];url=os.environ.get('PUBLIC_URL');out=R/'qa'/('public' if url else 'browser02');out.mkdir(exist_ok=True)
expected=hashlib.sha256((R/'START_HERE.html').read_bytes()).hexdigest();errors=[];checks=[];cases=[];responses=[];httpFailures=[];failedRequests=[]
with sync_playwright() as p:
 kw={'headless':not bool(os.environ.get('DISPLAY')),'args':['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}
 if os.path.exists('/usr/bin/chromium'):kw['executable_path']='/usr/bin/chromium'
 b=p.chromium.launch(**kw);pg=b.new_page(viewport={'width':1280,'height':900});pg.set_default_timeout(120000)
 def monitor(page):
  page.on('pageerror',lambda e:errors.append({'kind':'pageerror','text':str(e)}))
  page.on('console',lambda m:errors.append({'kind':'console','text':m.text,'location':m.location}) if m.type=='error' else None)
  page.on('response',lambda r:httpFailures.append({'url':r.url,'status':r.status}) if r.status>=400 else None)
  page.on('requestfailed',lambda r:failedRequests.append({'url':r.url,'failure':r.failure}))
 monitor(pg)
 if url:
  response=pg.goto(url,wait_until='load',timeout=120000);actual=hashlib.sha256(response.body()).hexdigest();assert actual==expected,(actual,expected);responses.append({'url':response.url,'status':response.status,'sha256':actual})
 else:pg.set_content((R/'START_HERE.html').read_text())
 pg.wait_for_function("window.TilesClean && document.body.dataset.ready==='true'")
 def settle():pg.wait_for_function('TilesClean.stats().pendingFrames===0');pg.wait_for_timeout(60)
 def select(sc,**params):
  pg.evaluate('async([sc,params])=>{Object.assign(TilesClean.settings,params);await TilesClean.option("scene",sc);TilesClean.fit()}',[sc,params]);settle()
 def pixels():return hashlib.sha256(pg.evaluate('document.querySelector("canvas").toDataURL()').encode()).hexdigest()
 def snap(name):
  settle();pg.screenshot(path=str(out/(name+'.png')));cases.append({'name':name,'stats':pg.evaluate('TilesClean.stats()')});(out/'partial.json').write_text(json.dumps(cases,indent=2))
 snap('01_open_color_panel');assert pg.evaluate('TilesClean.stats().coverLive')==21
 pg.click('#settings');select('pan',year=0,moss=0,fracture=0);snap('02_pan')
 # Real page controls: paired values must alter canvas, restore canvas, not geometry.
 pg.click('#settings')
 for k,lo,hi in [('brightness',.6,1.3),('temperature',-1,1),('variation',0,1.5),('patina',0,1),('warmth',0,1.5),('relief',0,1.6)]:
  old=pg.evaluate('(k)=>TilesClean.settings[k]',k);gen=pg.evaluate('TilesClean.stats().generation')
  def slider(v):pg.locator('#'+k).evaluate('(e,v)=>{e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}))}',v);settle()
  slider(lo);a=pixels();slider(hi);bb=pixels();slider(lo);c=pixels();slider(old)
  check={'control':k,'changesCanvas':a!=bb,'restores':a==c,'noGeometryBuild':gen==pg.evaluate('TilesClean.stats().generation')};checks.append(check);assert all(check[x] for x in ['changesCanvas','restores','noGeometryBuild']),check
 pg.click('#settings');select('pan',fracture=1,year=7,moss=.8);snap('03_clay_and_moss')
 select('wood',year=0,moss=0,fracture=0);snap('04_wood_zero');select('wood',year=10);snap('05_wood_eroded')
 pg.evaluate("TilesClean.option('twist',0)");settle();a=pixels();pg.evaluate("TilesClean.option('twist',1.6)");settle();bb=pixels();assert a!=bb;checks.append({'control':'twist','changesCanvas':True})
 select('roof48',year=0,moss=.8,fracture=0);snap('06_construct_zero');select('roof48',year=7,moss=1.1);snap('07_construct_seven');pg.evaluate('TilesClean.fit("under")');snap('08_timber_under')
 # Bulk scene change avoids unnecessary intermediate roof renders.
 select('roof860',year=0,moss=.8);snap('09_roof_zero');assert pg.evaluate('TilesClean.stats().panLive+TilesClean.stats().coverLive')==860
 select('roof860',year=7,moss=1.1);snap('10_roof_seven')
 select('roof48',year=10,moss=1.1);snap('11_construct_ten');f=pg.evaluate('TilesClean.stats().frames');pg.wait_for_timeout(6100);idle=pg.evaluate('TilesClean.stats().frames')-f;assert idle==0
 mp=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
 monitor(mp)
 if url:
  mr=mp.goto(url,wait_until='load',timeout=120000);mh=hashlib.sha256(mr.body()).hexdigest();assert mh==expected;responses.append({'url':mr.url,'status':mr.status,'sha256':mh,'viewport':'mobile'})
 else:mp.set_content((R/'START_HERE.html').read_text())
 mp.wait_for_function('window.TilesClean && TilesClean.stats().pendingFrames===0');mp.screenshot(path=str(out/'12_mobile.png'));mp.click('#settings');mp.screenshot(path=str(out/'13_mobile_panel.png'));overflow=mp.evaluate('document.documentElement.scrollWidth>innerWidth');assert not overflow
 (out/'NETWORK.json').write_text(json.dumps({'errors':errors,'httpFailures':httpFailures,'failedRequests':failedRequests},ensure_ascii=False,indent=2))
 glerror=pg.evaluate('TilesClean.renderer.gl.getError()');assert glerror==0;assert not errors,errors;assert not httpFailures,httpFailures;assert not failedRequests,failedRequests
 result={'htmlSHA256':expected,'htmlBytes':(R/'START_HERE.html').stat().st_size,'url':url,'responses':responses,'browser':b.version,'renderer':pg.evaluate('TilesClean.renderer.gl.getParameter(TilesClean.renderer.gl.RENDERER)'),'cases':cases,'controls':checks,'idleFramesSixSeconds':idle,'mobileOverflow':overflow,'errors':errors,'httpFailures':httpFailures,'failedRequests':failedRequests,'glError':glerror,'passed':True,'fullMotionPerformanceGate':'not_tested_this_script','humanVisualApproved':False,'note':'Browser pixel/control checks; appearance is a candidate. No calibrated physical collapse or universal device performance claim.'}
 (out/'REPORT.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in result.items() if k not in ['cases','controls']},ensure_ascii=False));b.close()
