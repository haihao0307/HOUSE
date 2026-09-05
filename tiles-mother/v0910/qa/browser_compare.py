"""Same-host Chromium/WebGL before-after checks. No assumed FPS improvement."""
from pathlib import Path
import json,time,hashlib,base64,traceback
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops,ImageStat
root=Path(__file__).resolve().parents[1];out=root/'qa/browser';out.mkdir(parents=True,exist_ok=True)
report={'version':'0.9.10','host':'same GitHub Actions Linux runner, software WebGL','versions':{},'pixelComparisons':[],'visualApproved':False,'productionApproved':False,'publicSiteDeployed':False}
def save(): (out/'REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
snapshot=r'''async()=>{const D=__tilesDebug,api=TilesMotherV099;let data=[],capacity=0,used=0;
 D.stageRoot.updateMatrixWorld(true);D.stageRoot.traverse(o=>{if(!o.geometry)return;let g=o.geometry;
 data.push(o.userData.kind||'',o.matrix.elements);for(const n of Object.keys(g.attributes).sort()){const a=g.attributes[n];data.push(n,a.itemSize,Array.from(a.array));}data.push(g.index?Array.from(g.index.array):null);
 if(o.isInstancedMesh){data.push(o.count,Array.from(o.instanceMatrix.array.slice(0,o.count*16)),o.instanceColor?Array.from(o.instanceColor.array.slice(0,o.count*3)):null);capacity+=o.instanceMatrix.array.byteLength+(o.instanceColor?.array.byteLength||0);used+=o.count;}
 });
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data)));
 const digest=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
 return {geometrySHA256:digest,counts:api.getCounts(),contacts:api.getContactQA(),timber:api.getTimberQA(),instanceBytes:capacity,usedInstances:used,render:{calls:D.renderer.info.render.calls,triangles:D.renderer.info.render.triangles},camera:api.getCamera()};}'''
render="()=>{const D=__tilesDebug;D.renderer.shadowMap.needsUpdate=true;const t=performance.now();D.renderer.render(D.scene,D.camera);D.renderer.getContext().finish();return performance.now()-t;}"
configs=[('trio',{'scene':'trio','year':0,'care':'maintained','focusSingle':False}),('forty8',{'scene':'forty8','year':0,'care':'maintained'}),('roof',{'scene':'roof','year':0,'care':'maintained'}),('abandoned',{'scene':'roof','year':100,'care':'abandoned'})]
with sync_playwright() as p:
 try:
  for version,folder in [('before',root.parent/'v099'),('after',root)]:
   browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
   page=browser.new_page(viewport={'width':1500,'height':950},device_scale_factor=1);page.set_default_timeout(180000)
   errors=[];console=[];external=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('console',lambda e:console.append(e.text) if e.type=='error' else None)
   page.on('request',lambda q:external.append(q.url) if q.url.startswith('http') else None)
   v={'browser':browser.version,'htmlSHA256':hashlib.sha256((folder/'START_HERE.html').read_bytes()).hexdigest(),'errors':errors,'consoleErrors':console,'externalRequests':external,'cases':[]};report['versions'][version]=v;save()
   page.goto((folder/'START_HERE.html').as_uri());page.wait_for_function("window.TilesMotherV099&&document.body.dataset.ready==='true'")
   for name,cfg in configs:
    t=time.monotonic();ms=page.evaluate('(cfg)=>{const t=performance.now();TilesMotherV099.setView({...cfg,showContacts:false,timberOnly:false,mode:"material",geometryRevision:1,surfaceRevision:1,edgeStrength:1,colorLayer:1,striations:.7});return performance.now()-t;}',cfg)
    render_ms=page.evaluate(render);case={'name':name,'buildMs':ms,'firstRenderIncludingFinishMs':render_ms,'wallSeconds':time.monotonic()-t,**page.evaluate(snapshot)};v['cases'].append(case)
    # Canvas bytes only; UI changes cannot hide a shape or material regression.
    encoded=page.evaluate("document.querySelector('#stage').toDataURL('image/png').split(',')[1]")
    (out/f'{version}_{name}.png').write_bytes(base64.b64decode(encoded))
    if version=='after':
     old=next(x for x in report['versions']['before']['cases'] if x['name']==name)
     assert case['geometrySHA256']==old['geometrySHA256'],(name,'geometry changed')
     assert case['counts']==old['counts'],(name,'counts changed')
     assert case['contacts']==old['contacts'],(name,'contact report changed')
     a=Image.open(out/f'before_{name}.png').convert('RGB');b=Image.open(out/f'after_{name}.png').convert('RGB');assert a.size==b.size
     diff=ImageChops.difference(a,b);ext=diff.getextrema();ma=max(z[1] for z in ext);mean=sum(ImageStat.Stat(diff).mean)/3
     report['pixelComparisons'].append({'name':name,'size':a.size,'maxChannelDifference':ma,'meanAbsoluteDifference':mean,'exact':ma==0})
     assert ma==0,(name,'render pixels changed',ma,mean)
    save()
   # Warm repeat, real measured CPU work. No screenshot or contact audit in timer.
   ms=page.evaluate('()=>{const t=performance.now();TilesMotherV099.setView({scene:"roof",year:100,care:"abandoned"});return performance.now()-t;}');v['sameRoofRepeatMs']=ms
   # Force collection after transient arrays to distinguish retained memory.
   cdp=page.context.new_cdp_session(page);cdp.send('HeapProfiler.collectGarbage');v['heapAfterCollection']=cdp.send('Runtime.getHeapUsage');save()
   if version=='after':
    v['performance']=page.evaluate('TilesMotherV0910.getPerformance()')
    # Proxies are lazily reconstructed using the original calculation transform.
    audit=page.evaluate((root.parent/'v099/qa/audit_runtime.js').read_text());v['lazyAudit']=audit;assert not audit['penetrations'] and not audit['geometryFailures'];page.evaluate('TilesMotherV0910.releaseAudit()')
    # Shader uniforms update on cached scenes, without a geometric rebuild.
    page.click('[data-light="rain"]');page.wait_for_function("document.querySelector('#runtimeOverlay').hidden")
    assert page.evaluate('TilesMotherV0910.getPerformance().lastBuildMode')=='完整场景复用'
    assert page.evaluate("()=>{let good=true;__tilesDebug.stageRoot.traverse(o=>{let m=o.material;if(m&&!Array.isArray(m)&&m.userData.uniforms)good&&=m.userData.uniforms.ceramic.value.z===1;});return good;}")
    page.click('[data-light="neutral"]');page.wait_for_function("document.querySelector('#runtimeOverlay').hidden")
    # Repeated scene restore maintains the original visual state.
    page.evaluate('TilesMotherV099.setView({scene:"roof",year:100,care:"abandoned",showContacts:false,timberOnly:false})');page.evaluate(render)
    png=page.evaluate("document.querySelector('#stage').toDataURL('image/png').split(',')[1]");(out/'after_warm_abandoned.png').write_bytes(base64.b64decode(png));assert (out/'after_warm_abandoned.png').read_bytes()==(out/'after_abandoned.png').read_bytes()
    # Ensure only two full roofs are kept and evicted instance buffers are disposed.
    for y in [20,30,40,50]:
     page.evaluate('(y)=>TilesMotherV099.setView({scene:"forty8",year:y,care:"maintained"})',y)
     assert len(page.evaluate('TilesMotherV0910.getPerformance().cacheKeys'))<=2
    # A real stopped view does not poll requestAnimationFrame.
    page.evaluate('TilesMotherV0910.state.autoRotate=false');page.wait_for_timeout(1200);a=page.evaluate('TilesMotherV0910.getPerformance()');page.wait_for_timeout(6000);b=page.evaluate('TilesMotherV0910.getPerformance()');v['idle6s']={'frames':b['frames']-a['frames'],'callbacks':b['frameCallbacks']-a['frameCallbacks'],'pending':b['pendingFrame']};assert v['idle6s']=={'frames':0,'callbacks':0,'pending':False}
    windows=[]
    for mobile in [False,True]:
     page.set_viewport_size({'width':390,'height':844} if mobile else {'width':1500,'height':950})
     for scene in ['trio','forty8','roof']:
      page.evaluate('(s)=>TilesMotherV099.setView({scene:s,year:0,care:"maintained",mode:"material",showContacts:false,timberOnly:false,focusSingle:false})',scene);page.evaluate(render)
      row=page.evaluate('''()=>new Promise(resolve=>{let start=performance.now(),frames=0,positions=[];TilesMotherV0910.state.autoRotate=true;function f(t){frames++;positions.push(__tilesDebug.camera.position.toArray());if(t-start<6000)requestAnimationFrame(f);else{TilesMotherV0910.state.autoRotate=false;resolve({ms:t-start,frames,fps:frames*1000/(t-start),positions});}}requestAnimationFrame(f);})''');row['uniquePositions']=len({tuple(round(t,6) for t in x) for x in row.pop('positions')});windows.append({'mobile':mobile,'scene':scene,**row});v['motionWindows']=windows;save()
    v['performanceGatePassed']=all(w['fps']>=5 and w['frames']>=30 and w['uniquePositions']>=25 for w in windows)
    page.evaluate('TilesMotherV099.setView({scene:"forty8",year:0,care:"maintained"})');page.evaluate(render);page.screenshot(path=str(out/'mobile.png'))
    assert page.evaluate('document.body.scrollWidth<=390')
   assert not errors and not console and not external,(errors,console,external)
   browser.close();save()
  report['allFunctionalPassed']=True;save()
 except Exception as e:
  report['allFunctionalPassed']=False;report['error']=str(e);report['traceback']=traceback.format_exc();save()
  try:page.screenshot(path=str(out/'failure.png'));browser.close()
  except Exception:pass
  raise
