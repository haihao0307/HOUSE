"""Reduce installed-scene cost without changing single-tile study geometry or optics."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def edit(path,old,new):
 p=root/path;s=p.read_text();assert old in s,(path,old);p.write_text(s.replace(old,new))
edit('source/edge_geometry.js','const qs=[0,.05272,.18,.5,.82,.94728,1];','const qs=nv<=22?[0,.18,.5,.82,1]:[0,.05272,.18,.5,.82,.94728,1];')
edit('source/edge_geometry.js','bevelBands:6,','bevelBands:qs.length-1,')
edit('tools/build.py','(is48?{nu:20,nv:30}:{nu:12,nv:20})','(is48?{nu:16,nv:22}:{nu:10,nv:14})')
edit('qa/geometry.cjs','[[12,20],[20,30],[36,46]]','[[10,14],[16,22],[36,46]]')
p=root/'tools/build.py';s=p.read_text();mark="s += '\\n'+ui";assert mark in s
s=s.replace(mark,mark+"\ns=s.replace(\"function rebuild(){lastRoof=null;\",\"function rebuild(){renderer.shadowMap.needsUpdate=true;lastRoof=null;\")\ns += '\\nrenderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;needsRender=true;\\n'\ns=s.replace('首次打开860片屋面需要几秒至十余秒。','首次打开860片需要计算实际接触，等待时间取决于设备。')")
p.write_text(s)
p=root/'qa/browser.py';s=p.read_text().replace('page.wait_for_timeout(300)','page.evaluate("__tilesDebug.renderer.render(__tilesDebug.scene,__tilesDebug.camera)");page.wait_for_timeout(100)')
s=s.replace("sample=page.evaluate('''", "page.evaluate(\"__tilesDebug.renderer.render(__tilesDebug.scene,__tilesDebug.camera)\")\n     sample=page.evaluate('''")
s=s.replace("report['allPassed']=not errors", "windows=[x for x in checks if x['name']=='motion_window'];report['performanceGate']={'requiredFPS':5,'requiredFrames':30,'requiredUniquePositions':25,'host':'CI software rendering, not user GPU','tested':bool(windows),'passed':all(x['fps']>=5 and x['frames']>=30 and x['uniquePositions']>=25 for x in windows) if windows else None};report['functionalAllPassed']=not errors and not console and not requests\n  report['allPassed']=not errors")
p.write_text(s)
print('Applied scoped scene-resolution, shadow-cache and precise QA sampling changes.')
