"""Genuine Chromium WebGL inspection. Run --quick for visual evidence, --full for assembly."""
from pathlib import Path
import json,time,sys,hashlib,os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];stage='full' if '--full' in sys.argv else 'quick';out=root/'qa'/stage;out.mkdir(parents=True,exist_ok=True)
errors=[];console=[];requests=[];cases=[];checks=[];start=time.monotonic()
report={'version':'0.9.9','stage':stage,'hostPlatform':sys.platform,'windowsDeviceTested':False,'sourceSHA256':hashlib.sha256((root/'START_HERE.html').read_bytes()).hexdigest(),'pageErrors':errors,'consoleErrors':console,'externalRequests':requests,'cases':cases,'checks':checks,'visualApproved':False,'productionApproved':False,'publicSiteDeployed':False}
def save():
 report['seconds']=round(time.monotonic()-start,3);(out/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
with sync_playwright() as p:
 opts={'headless':True,'args':['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
 if os.environ.get('CHROMIUM'):opts['executable_path']=os.environ['CHROMIUM']
 browser=p.chromium.launch(**opts);report['browserVersion']=browser.version
 page=browser.new_page(viewport={'width':1500,'height':950},device_scale_factor=1);page.set_default_timeout(360000)
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:console.append(m.text) if m.type=='error' else None);page.on('request',lambda r:requests.append(r.url) if r.url.startswith(('http:','https:')) else None)
 try:
  page.goto((root/'START_HERE.html').as_uri(),wait_until='load',timeout=60000);report['protocol']='file'
  page.wait_for_function("window.TilesMotherV099 && document.body.dataset.ready==='true'",timeout=60000)
  def view(name,values,angle=None,audit=False):
   t=time.monotonic();page.evaluate('(x)=>TilesMotherV099.setView(x)',values)
   if angle:page.evaluate('(x)=>TilesMotherV099.setAngle(x)',angle)
   page.evaluate("__tilesDebug.renderer.render(__tilesDebug.scene,__tilesDebug.camera)");page.wait_for_timeout(100)
   stats=page.evaluate('({triangles:__tilesDebug.renderer.info.render.triangles,calls:__tilesDebug.renderer.info.render.calls,counts:TilesMotherV099.getCounts(),contact:TilesMotherV099.getContactQA(),uv:TilesMotherV099.runUVQA(),camera:TilesMotherV099.getCamera()})')
   assert stats['triangles']>0,name;assert stats['uv']['allPassed'],(name,'uv failed')
   if audit:
    stats['audit']=page.evaluate((root/'qa/audit_runtime.js').read_text());assert not stats['audit']['penetrations'],(name,'penetration',stats['audit']['penetrations'][:3]);assert not stats['audit']['geometryFailures'],(name,'actual geometry')
    if values.get('year')==0:assert stats['counts']['missing']==0,(name,stats['counts'])
   page.screenshot(path=str(out/(name+'.jpg')),type='jpeg',quality=87)
   cases.append({'name':name,'values':values,'seconds':round(time.monotonic()-t,3),'stats':stats,'screenshot':name+'.jpg'});save();print(name,cases[-1]['seconds'],flush=True)
  if stage=='quick':
   view('01_new_trio',{'scene':'trio','trioFamily':'pan','focusSingle':False,'geometryRevision':1,'surfaceRevision':1,'mode':'material'})
   common={'scene':'trio','trioFamily':'pan','focusSingle':True,'geometryRevision':1,'surfaceRevision':1,'mode':'material'}
   view('02_pan_new_edge',common,'edge');view('03_pan_shape_only',{**common,'surfaceRevision':0},'edge');view('04_pan_original',{**common,'geometryRevision':0,'surfaceRevision':0},'edge')
   view('05_pan_under',common,'under');view('06_cover_new',{**common,'trioFamily':'cover'},'edge');view('07_cover_original',{**common,'trioFamily':'cover','geometryRevision':0,'surfaceRevision':0},'edge')
   view('08_pan_clay',{**common,'mode':'clay'},'edge')
   # Actual UI click and same-camera switching, including shape cache separation.
   page.click('[data-study="shape"]');page.wait_for_timeout(600);a=page.evaluate('TilesMotherV099.getCamera()');page.click('[data-study="surface"]');page.wait_for_timeout(100);b=page.evaluate('TilesMotherV099.getCamera()');assert a==b;checks.append({'name':'shape_material_switch_keeps_camera','passed':True})
   page.set_viewport_size({'width':390,'height':844});view('09_mobile_trio',{**common,'focusSingle':False,'mode':'material'})
   body=page.evaluate('({inner:innerWidth,scroll:document.body.scrollWidth,canvas:__tilesDebug.renderer.domElement.clientWidth})');assert body['scroll']==body['inner'] and body['canvas']>0;checks.append({'name':'mobile_390x844_no_horizontal_overflow','passed':True,**body})
  else:
   for name,values in [('10_forty8_new',{'scene':'forty8','year':0,'care':'maintained'}),('11_roof_new',{'scene':'roof','year':0,'care':'maintained'}),('12_roof_abandoned',{'scene':'roof','year':100,'care':'abandoned'})]:
    view(name,{**values,'geometryRevision':1,'surfaceRevision':1,'mode':'material','focusSingle':False},audit=True)
   view('13_forty8_bottom',{'scene':'forty8','year':0,'care':'maintained','mode':'material','showContacts':True},'under',True)
   view('14_wood_uv',{'scene':'uv','uvFamily':'timber','mode':'uv'})
   # Six-second camera motion windows on the actual renderer; remote software costs only.
   for mobile in [False,True]:
    page.set_viewport_size({'width':390,'height':844} if mobile else {'width':1500,'height':950})
    for scene in ['trio','forty8','roof']:
     page.evaluate('(s)=>TilesMotherV099.setView({scene:s,year:0,care:"maintained",mode:"material",showContacts:false,focusSingle:false})',scene)
     page.evaluate("__tilesDebug.renderer.render(__tilesDebug.scene,__tilesDebug.camera)")
     sample=page.evaluate('''()=>new Promise(resolve=>{let start=performance.now(),last=start,times=[],positions=[];TilesMotherV099.state.autoRotate=true;function frame(now){times.push(now-last);last=now;positions.push(__tilesDebug.camera.position.toArray());if(now-start<6000)requestAnimationFrame(frame);else{TilesMotherV099.state.autoRotate=false;resolve({milliseconds:now-start,frames:times.length,fps:times.length*1000/(now-start),positions});}}requestAnimationFrame(frame);})''')
     sample['uniquePositions']=len({tuple(round(x,6) for x in a) for a in sample.pop('positions')});checks.append({'name':'motion_window','scene':scene,'mobile':mobile,**sample});save()
   page.set_viewport_size({'width':390,'height':844});view('15_mobile_forty8',{'scene':'forty8','year':0,'care':'maintained','mode':'material'})
  windows=[x for x in checks if x['name']=='motion_window'];report['performanceGate']={'requiredFPS':5,'requiredFrames':30,'requiredUniquePositions':25,'host':'CI software rendering, not user GPU','tested':bool(windows),'passed':all(x['fps']>=5 and x['frames']>=30 and x['uniquePositions']>=25 for x in windows) if windows else None};report['functionalAllPassed']=not errors and not console and not requests
  report['allPassed']=not errors and not console and not requests;save();assert report['allPassed'],(errors,console);print('PASS',stage,flush=True)
 except Exception as e:
  report['failure']=str(e);report['allPassed']=False
  try:page.screenshot(path=str(out/'failure.jpg'),type='jpeg',quality=85)
  except Exception:pass
  save();raise
 finally:browser.close()
