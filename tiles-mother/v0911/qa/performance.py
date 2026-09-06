"""Same-session material comparison with actual WebGL timer queries when available."""
from pathlib import Path
import json,statistics,traceback
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1];out=root/'qa/browser';out.mkdir(parents=True,exist_ok=True)
r={'scope':'Same-session Linux software WebGL; not user hardware power or temperature','trials':[],'errors':[],'visualApproved':False,'productionApproved':False}
measure="""async()=>{
 const D=window.__tilesDebug,A=window.TilesMotherV0911,g=D.renderer.getContext(),ext=g.getExtension('EXT_disjoint_timer_query_webgl2');
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));const result=[];
 for(let i=0;i<8;i++){
  A.setCamera(-.50+i*.014,.48,A.getState().scene==='roof'?8:2.2);
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await sleep(30);
  const query=ext?g.createQuery():null;const start=performance.now();
  if(query)g.beginQuery(ext.TIME_ELAPSED_EXT,query);
  D.renderer.render(D.scene,D.camera);
  if(query)g.endQuery(ext.TIME_ELAPSED_EXT);
  const submitMs=performance.now()-start;let timerMs=null,disjoint=null;
  if(query){const limit=performance.now()+10000;while(!g.getQueryParameter(query,g.QUERY_RESULT_AVAILABLE)&&performance.now()<limit)await sleep(10);
   disjoint=!!g.getParameter(ext.GPU_DISJOINT_EXT);if(g.getQueryParameter(query,g.QUERY_RESULT_AVAILABLE)&&!disjoint)timerMs=g.getQueryParameter(query,g.QUERY_RESULT)/1e6;g.deleteQuery(query);}
  result.push({submitMs,timerMs,disjoint});
 }
 return {samples:result,triangles:D.renderer.info.render.triangles,calls:D.renderer.info.render.calls,timerExtension:!!ext};
}"""
try:
 with sync_playwright() as p:
  b=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']);r['browser']=b.version
  page=b.new_page(viewport={'width':1440,'height':960});page.set_default_timeout(180000);page.on('pageerror',lambda e:r['errors'].append(str(e)))
  page.goto((root/'START_HERE.html').as_uri());page.wait_for_function('!!window.TilesMotherV0911')
  for scene in ['trio','roof']:
   for wave in [False,True,False,True]:
    page.evaluate('(v)=>window.TilesMotherV0911.setView(v)',{'scene':scene,'year':0,'care':'maintained','waveSurface':wave,'mossEnabled':False,'autoRotate':False})
    page.wait_for_timeout(1000);v=page.evaluate(measure);v.update(scene=scene,waveSurface=wave)
    timers=[x['timerMs'] for x in v['samples'][2:] if x['timerMs'] is not None];v['medianTimerMs']=statistics.median(timers) if timers else None;r['trials'].append(v)
  r['completed']=True;b.close()
except Exception as e:r.update(completed=False,fatal=str(e),traceback=traceback.format_exc())
(out/'PERFORMANCE.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps(r,ensure_ascii=False))
if not r.get('completed') or r['errors']:raise SystemExit(1)
