from pathlib import Path
import json,time,hashlib,os,traceback
from playwright.sync_api import sync_playwright
from PIL import Image,ImageStat
root=Path(__file__).resolve().parents[1];out=root/'qa/browser';out.mkdir(parents=True,exist_ok=True)
report={'version':'0.9.11','cases':[],'errors':[],'consoleErrors':[],'requests':[],'visualApproved':False,'productionApproved':False,'publicDeployed':False}
try:
 with sync_playwright() as p:
  launch={'headless':True,'args':['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}
  if os.getenv('CHROMIUM_EXECUTABLE'):launch['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
  b=p.chromium.launch(**launch);report['browser']=b.version
  page=b.new_page(viewport={'width':1440,'height':960},device_scale_factor=1)
  page.set_default_timeout(180000)
  page.on('pageerror',lambda e:report['errors'].append(str(e)));page.on('console',lambda m:report['consoleErrors'].append(m.text) if m.type=='error' else None)
  page.on('request',lambda r:report['requests'].append(r.url) if r.url.startswith('http') else None)
  page.goto((root/'START_HERE.html').as_uri(),wait_until='load');page.wait_for_function("window.TilesMotherV0911&&document.body.dataset.ready==='true'")
  def settle():
   page.evaluate('''()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))''');page.wait_for_timeout(100)
  def snap(name,view=None):
   started=time.perf_counter()
   if view:page.evaluate('(v)=>window.TilesMotherV0911.setView(v)',view)
   settle();page.screenshot(path=str(out/(name+'.png')))
   data=page.evaluate('''()=>{const d=window.__tilesDebug,g=d.renderer.getContext();let ext=g.getExtension('WEBGL_debug_renderer_info');return {state:window.TilesMotherV0911.getState(),perf:window.TilesMotherV0911.getPerformance(),field:window.TilesMotherV0911.getFieldReport(),roof:window.TilesMotherV0911.getRoofModel(),renderer:ext?g.getParameter(ext.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),programs:d.renderer.info.programs.map(p=>({name:p.name,runnable:p.diagnostics?.runnable??null})),width:innerWidth,bodyWidth:document.body.scrollWidth};}''')
   data.update(name=name,elapsedSeconds=round(time.perf_counter()-started,3));report['cases'].append(data)
   assert data['bodyWidth']<=data['width']+1,'horizontal overflow'
   assert data['perf']['renderer']['triangles']>0,'no triangles'
   assert not any(x['runnable'] is False for x in data['programs']),'shader compile error'
   assert not report['errors'] and not report['consoleErrors'],report['errors']+report['consoleErrors']
   return data
  snap('01_field_lab')
  snap('02_wood_fracture',{'scene':'fracture','specimen':'wood','year':8})
  snap('03_tile_fracture',{'scene':'fracture','specimen':'tile','year':8})
  snap('04_tile_intact',{'scene':'fracture','specimen':'tile','year':0})
  snap('05_trio_wave',{'scene':'trio','waveSurface':True,'year':5,'care':'maintained'})
  snap('06_trio_legacy',{'scene':'trio','waveSurface':False,'year':5,'care':'maintained'})
  snap('07_trio_without_moss',{'scene':'trio','waveSurface':True,'mossEnabled':False,'year':5,'care':'maintained'})
  # Same geometry, viewport, light and sample settings. Display time is not GPU timer data.
  benches=[]
  for mode in [False,True,False,True]:
   page.evaluate('(x)=>window.TilesMotherV0911.setView({scene:"trio",waveSurface:x,mossEnabled:false,care:"maintained",year:0})',mode);settle()
   v=page.evaluate('''async()=>{const D=window.__tilesDebug,API=window.TilesMotherV0911,gl=D.renderer.getContext();const times=[];for(let i=0;i<8;i++){const t=performance.now();API.setCamera(-.4+i*.035,.48,2.2);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));times.push(performance.now()-t);}return {times,triangles:D.renderer.info.render.triangles,calls:D.renderer.info.render.calls,timerExtension:!!gl.getExtension('EXT_disjoint_timer_query_webgl2')};}''')
   v['waveSurface']=mode;benches.append(v)
  report['sameSessionDisplayBench']=benches
  # Compact functional roof cases; point-in-time contact regressions.
  for name,view in [('08_forty8_zero',{'scene':'forty8','year':0,'care':'maintained','mossEnabled':True,'waveSurface':True}),('09_forty8_seven',{'scene':'forty8','year':7,'care':'abandoned'}),('10_forty8_ten',{'scene':'forty8','year':10,'care':'abandoned'}),('11_roof_zero',{'scene':'roof','year':0,'care':'maintained'}),('12_roof_ten',{'scene':'roof','year':10,'care':'abandoned'})]:
   d=snap(name,view);d['actualPairAudit']=page.evaluate((root.parent/'v099/qa/audit_runtime.js').read_text());assert not d['actualPairAudit']['penetrations'] and not d['actualPairAudit']['geometryFailures'],d['actualPairAudit'];q=d['roof']['contacts'];assert not q['timber']['penetrations'],q['timber'];assert q['actualGeometry']['allPassed'],q['actualGeometry']
   if view['year']==0:assert d['roof']['counts']['missing']==0,d['roof']['counts']
  page.evaluate("()=>{window.TilesMotherV0911.setView({scene:'forty8',year:7,care:'abandoned'});window.TilesMotherV0911.setCamera(.72,-.35,3.0);}");snap('13_forty8_under')
  before=page.evaluate('()=>window.TilesMotherV0911.getPerformance()');page.wait_for_timeout(6000);after=page.evaluate('()=>window.TilesMotherV0911.getPerformance()');report['idle']={'frames':after['frames']-before['frames'],'callbacks':after['frameCallbacks']-before['frameCallbacks']};assert report['idle']['frames']==0
  page.set_viewport_size({'width':390,'height':844});snap('14_mobile_lab',{'scene':'fracture','specimen':'both','year':8});
  page.locator('[data-specimen="wood"]').click();settle();snap('15_mobile_wood')
  page.set_viewport_size({'width':1440,'height':960})
  d=snap('16_maintained_lab',{'scene':'fracture','specimen':'both','year':10,'care':'maintained','waveSurface':True})
  assert d['field']['exposureYears']==0 and not d['field']['tile']['failed'] and not d['field']['wood']['failed'],'maintenance scenario wrongly aged as neglected'
  a=snap('17_fracture_legacy',{'scene':'fracture','specimen':'tile','year':8,'care':'abandoned','waveSurface':False,'mossEnabled':False})
  bb=snap('18_fracture_wave',{'scene':'fracture','specimen':'tile','year':8,'care':'abandoned','waveSurface':True,'mossEnabled':False})
  assert a['perf']['renderer']['triangles']==bb['perf']['renderer']['triangles']
  from PIL import ImageChops
  assert ImageChops.difference(Image.open(out/'17_fracture_legacy.png').convert('RGB'),Image.open(out/'18_fracture_wave.png').convert('RGB')).getbbox(),'surface switch did not change rendered appearance'
  snap('19_roof_fifteen',{'scene':'roof','year':15,'care':'abandoned','waveSurface':True,'mossEnabled':True})
  report['functionalPassed']=True;report['performanceGatePassed']=False
  report['performanceScope']='display turnaround samples for 8 changing views, no hardware GPU timing or full three-window acceptance'
  b.close()
except Exception as e:
 report['fatal']=str(e);report['traceback']=traceback.format_exc();report['functionalPassed']=False
finally:
 (out/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in report.items() if k not in ('cases',)},ensure_ascii=False,indent=2))
if not report.get('functionalPassed'):raise SystemExit(1)
