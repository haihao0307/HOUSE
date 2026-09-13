"""Browser rendering and public-delivery checks. No user visual approval is inferred."""
import argparse, base64, hashlib, io, json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat
from playwright.sync_api import sync_playwright

HERE=Path(__file__).resolve().parent
parser=argparse.ArgumentParser();parser.add_argument('--local',action='store_true');parser.add_argument('--public');parser.add_argument('--output',type=Path,required=True);parser.add_argument('--executable')
a=parser.parse_args();out=a.output;out.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];images={}
sha=lambda x:hashlib.sha256(x).hexdigest()
def check(name,condition,detail=None):
 print(('PASS ' if condition else 'FAIL ')+name,flush=True)
 checks.append({'name':name,'passed':bool(condition),'detail':detail})
 if not condition:raise AssertionError(name+': '+str(detail))
def settle(page):
 page.wait_for_function('window.TilesClean && document.getElementById("busy").hidden && !TilesClean.stats().pendingFrames && document.body.dataset.ready==="true"',timeout=60000)
 page.evaluate('TilesClean.renderer.gl.finish()')
def pixels(page):
 settle(page)
 s=page.evaluate('TilesClean.renderer.canvas.toDataURL("image/png")').split(',')[1]
 return base64.b64decode(s)
def diff(x,y):
 a1=Image.open(io.BytesIO(x)).convert('RGB');b1=Image.open(io.BytesIO(y)).convert('RGB')
 if a1.size!=b1.size:return 1000
 return sum(ImageStat.Stat(ImageChops.difference(a1,b1)).mean)/3
fingerprint='''() => { const h=b=>{let s=2166136261;for(let i=0;i<b.length;i++)s=Math.imul(s^b[i],16777619);return(s>>>0).toString(16);}; const entries=[];for(const [id,group] of TilesClean.workshop.groups){const g=group.mesh;entries.push([id,...['p','n','meta','idx'].map(k=>{const t=g[k];return t?h(new Uint8Array(t.buffer,t.byteOffset,t.byteLength)):null;})]);}return JSON.stringify({entries,snapshot:TilesClean.snapshot(),bounds:TilesClean.workshop.bounds});}'''
def snap(page,name):
 settle(page);page.screenshot(path=str(out/(name+'.png')));images[name]=name+'.png'

target=HERE/'START_HERE.html'; expected=sha(target.read_bytes())
url=None;response_hash=None
if a.public:
 url=f'https://raw.githack.com/haihao0307/HOUSE/{a.public}/tiles-mother/r2-closeout-08b-microscope/START_HERE.html'
 # Inspect the actual browser navigation response, not a separate Python client.
 # The earlier urllib 403 is retained in the previous CI log; it was not browser QA.

result={'version':'08B-microscope-pbr','url':url,'pageSHA':a.public,'sourceSHA256':expected,'publicBytesSHA256':response_hash,'checks':checks,'screenshots':images,'browserErrors':errors,'visualApproved':False,'productionApproved':False,'actualIPhoneSafariVerified':False,'browserVerified':False,'publicBrowserVerified':False}
try:
 with sync_playwright() as p:
  launch={'headless':True,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}
  if a.executable:launch['executable_path']=a.executable
  b=p.chromium.launch(**launch)
  result['browserVersion']=b.version
  def open_page(mobile=False,baseline=False):
   context=b.new_context(viewport={'width':390,'height':844} if mobile else {'width':960,'height':720},device_scale_factor=1,has_touch=mobile,is_mobile=mobile,accept_downloads=True)
   page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
   if url and not baseline:
    response=page.goto(url,wait_until='domcontentloaded',timeout=60000)
    content=response.body() if response else b''
    status=response.status if response else 0
    ctype=response.headers.get('content-type','') if response else ''
    response_hash=sha(content)
    result['publicBytesSHA256']=response_hash
    if status!=200 or response_hash!=expected:
     (out/('mobile_response.txt' if mobile else 'desktop_response.txt')).write_bytes(content)
     page.screenshot(path=str(out/('mobile_response.png' if mobile else 'desktop_response.png')))
    check(('mobile' if mobile else 'desktop')+' public browser HTTP 200 HTML and exact byte identity',status==200 and 'text/html' in ctype and response_hash==expected,{'url':page.url,'status':status,'contentType':ctype,'sha256':response_hash})
   else:
    page.set_content((HERE/('.qa-baseline08a.html' if baseline else 'START_HERE.html')).read_text(),wait_until='load')
   settle(page);return context,page
  c,page=open_page()
  check('workbench initialized and shader linked',page.locator('.fail').count()==0 and page.evaluate('TilesClean.renderer.gl.getError()')==0)
  check('correct runtime version',page.evaluate('TilesClean.version')=='r2-closeout-08B-microscope-pbr')
  check('Microscope controls initialized',page.evaluate('[TilesClean.settings.micStrength,TilesClean.settings.micScale,TilesClean.settings.micColor,TilesClean.settings.micRough]')==[1,1,.3,.3])
  snap(page,'desktop_controls')
  page.click('#panelClose');snap(page,'pan_default')
  basefp=page.evaluate(fingerprint);basecam=page.evaluate('TilesClean.camera()');basegen=page.evaluate('TilesClean.stats().generation')
  page.evaluate('TilesClean.camera().distance=.33;TilesClean.requestRender()');settle(page)
  camera=page.evaluate('TilesClean.camera()');snap(page,'pan_close_default')
  page.evaluate("TilesClean.option('micStrength',0)");im0=pixels(page)
  page.evaluate("TilesClean.option('micStrength',1)");im1=pixels(page)
  page.evaluate("TilesClean.option('micStrength',2.5)");im25=pixels(page);snap(page,'pan_close_strong')
  check('strength slider changes actual framebuffer',diff(im0,im1)>.08 and diff(im1,im25)>.08,{'off_to_1_mean_RGB':diff(im0,im1),'1_to_2_5_mean_RGB':diff(im1,im25)})
  page.evaluate("TilesClean.option('micStrength',1)");check('strength roundtrip deterministic',pixels(page)==im1)
  for value in [.5,3,1]:page.evaluate('(v)=>TilesClean.option("micScale",v)',value);settle(page)
  check('scale roundtrip deterministic',pixels(page)==im1)
  for key in ['micColor','micRough']:
   page.evaluate('(k)=>TilesClean.option(k,0)',key);first=pixels(page)
   page.evaluate('(k)=>TilesClean.option(k,1)',key);second=pixels(page)
   check(key+' changes framebuffer',diff(first,second)>.001,{'meanRGB':diff(first,second)})
   page.evaluate('(k)=>TilesClean.option(k,.3)',key);settle(page)
  check('all material controls preserve geometry buffers and matrices',page.evaluate(fingerprint)==basefp)
  check('all material controls preserve camera',page.evaluate('TilesClean.camera()')==camera)
  check('all material controls avoid geometry rebuild',page.evaluate('TilesClean.stats().generation')==basegen)
  page.click('#settings');el=page.locator('#micStrength');el.focus();page.keyboard.press('ArrowRight');settle(page)
  check('keyboard slider event wired',abs(page.evaluate('TilesClean.settings.micStrength')-1.05)<1e-9)
  page.click('#micReset');check('reset restores controls',page.evaluate('[TilesClean.settings.micStrength,TilesClean.settings.micScale,TilesClean.settings.micColor,TilesClean.settings.micRough]')==[1,1,.3,.3])
  page.click('#micToggle');check('off button only disables microscope normal',page.evaluate('TilesClean.settings.micStrength')==0)
  page.click('#micToggle');check('on button restores prior intensity',page.evaluate('TilesClean.settings.micStrength')==1)
  page.click('#micCopy');check('copy or selection fallback gives exact numbers',page.locator('#micValues').inner_text()=='起伏 1.00 / 尺度 1.00 / 色差 0.30 / 粗糙 0.30')
  page.locator('details').last.locator('summary').click()
  with page.expect_download() as download:page.click('#save')
  path=out/'saved-parameters.json';download.value.save_as(path);saved=json.loads(path.read_text())
  check('export includes reproducible Microscope values',all(saved['settings'][k]==v for k,v in {'micStrength':1,'micScale':1,'micColor':.3,'micRough':.3}.items()))
  page.click('#panelClose');page.click('#home');settle(page)
  check('home keeps original camera fit',page.evaluate('TilesClean.camera()')==basecam)
  page.mouse.move(510,360);page.mouse.down();page.mouse.move(560,385,steps=5);page.mouse.up();settle(page)
  check('rotation works',page.evaluate('TilesClean.camera()')!=basecam)
  olddist=page.evaluate('TilesClean.camera().distance');page.mouse.wheel(0,-100);settle(page)
  check('zoom works',page.evaluate('TilesClean.camera().distance')<olddist)
  page.click('#home');settle(page)
  for scene in ['cover','wood','roof48','roof860']:
   page.evaluate('(s)=>TilesClean.option("scene",s)',scene);settle(page)
   check('scene '+scene+' renders',page.evaluate('TilesClean.renderer.gl.getError()')==0 and page.locator('.fail').count()==0)
   if scene=='wood':
    wood0=pixels(page)
    page.evaluate("TilesClean.option('micStrength',3);TilesClean.option('micColor',1);TilesClean.option('micScale',3)")
    check('Microscope controls do not modify wood',wood0==pixels(page))
    page.evaluate("TilesClean.option('micStrength',1);TilesClean.option('micColor',.3);TilesClean.option('micScale',1)")
   snap(page,scene)
  years={}
  page.evaluate('TilesClean.option("year",0)');settle(page);state0=page.evaluate(fingerprint)
  for year in [0,3,5,7,10]:
   page.locator('[data-year="'+str(year)+'"]').click();settle(page)
   s=page.evaluate('TilesClean.stats()');years[str(year)]={k:s[k] for k in ['panLive','coverLive','missing','unsupportedLive','failedRafterSegments']}
   check('year '+str(year)+' renders',page.evaluate('TilesClean.renderer.gl.getError()')==0)
  snap(page,'roof860_year10')
  page.locator('[data-year="0"]').click();settle(page)
  check('year roundtrip preserves active geometry state',page.evaluate(fingerprint)==state0)
  page.locator('[data-year="10"]').click();page.click('#care');settle(page)
  care_stats=page.evaluate('({care:TilesClean.settings.care,year:TilesClean.settings.year,pan:TilesClean.stats().panLive,cover:TilesClean.stats().coverLive,total:TilesClean.stats().originalTiles})')
  check('maintenance state restores original tile count',care_stats['care'] and care_stats['pan']+care_stats['cover']==care_stats['total'],care_stats)
  result['roofStates']=years
  if a.local:
   bc,bp=open_page(baseline=True)
   check('pan geometry identical to materialized 08A',bp.evaluate(fingerprint)==basefp)
   bp.evaluate('TilesClean.option("scene","wood")');settle(bp);bw=pixels(bp)
   page.evaluate('TilesClean.option("scene","wood");TilesClean.option("year",0);TilesClean.option("care",false)');settle(page)
   check('wood framebuffer identical to materialized 08A',bw==pixels(page))
   bc.close()
  c.close()
  mc,mp=open_page(mobile=True)
  check('mobile 390x844 no horizontal overflow',mp.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  mp.click('#settings');check('mobile material panel opens',mp.locator('#panel').is_visible())
  mp.locator('#micStrength').evaluate('(el)=>{el.value="1.75";el.dispatchEvent(new Event("input",{bubbles:true}));}');settle(mp)
  check('mobile input event updates displayed value',mp.locator('#micStrengthVal').inner_text()=='1.75×')
  snap(mp,'mobile_panel')
  mp.locator('#panel').evaluate('(el)=>el.scrollTop=el.scrollHeight');mp.click('#panelClose')
  check('mobile close after scrolling works',mp.locator('#panel').is_hidden())
  mp.click('#settings');mp.locator('#panel').evaluate('(el)=>el.scrollTop=0');mp.click('#micReset');mp.click('#panelClose')
  check('mobile reopen and reset',mp.evaluate('TilesClean.settings.micStrength')==1)
  snap(mp,'mobile_pan')
  mp.click('[data-scene="roof48"]');settle(mp);snap(mp,'mobile_roof48')
  check('mobile roof scene renders',mp.evaluate('TilesClean.renderer.gl.getError()')==0)
  mc.close();b.close()
 check('no browser JavaScript exceptions',not errors,errors)
 result['browserVerified']=True;result['publicBrowserVerified']=bool(a.public)
 result['status']='passed';result['passed']=len(checks);result['failed']=0
except Exception as e:
 result['status']='failed';result['failure']=str(e);result['passed']=sum(c['passed'] for c in checks);result['failed']=max(1,sum(not c['passed'] for c in checks))
 raise
finally:
 (out/'QA.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(result,ensure_ascii=False,indent=2))
