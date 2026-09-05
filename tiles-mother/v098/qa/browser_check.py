from pathlib import Path
import argparse,json,hashlib
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--html',type=Path,default=Path(__file__).resolve().parents[1]/'START_HERE.html');p.add_argument('--chromium');p.add_argument('--headful',action='store_true');p.add_argument('--mode',choices=['file','inject'],default='file');a=p.parse_args()
with sync_playwright() as w:
 opts={'headless':not a.headful}
 if a.chromium:opts['executable_path']=a.chromium
 b=w.chromium.launch(**opts);page=b.new_page(viewport={'width':1500,'height':950});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 if a.mode=='file':page.goto(a.html.resolve().as_uri(),wait_until='load')
 else:page.set_content(a.html.read_text(encoding='utf-8'),wait_until='load')
 page.wait_for_function("window.TilesMotherV098 && document.body.dataset.ready==='true'")
 cases=[]
 for scene,year,care in [('forty8',0,'maintained'),('forty8',100,'abandoned'),('roof',0,'maintained'),('roof',100,'abandoned')]:
  page.evaluate('s=>TilesMotherV098.setView(s)',{'scene':scene,'year':year,'care':care});audit=page.evaluate((Path(__file__).parent/'audit_runtime.js').read_text());cases.append({'scene':scene,'year':year,'care':care,'audit':audit})
 report={'sourceSHA256':hashlib.sha256(a.html.read_bytes()).hexdigest(),'protocol':a.mode,'errors':errors,'cases':cases}
 (Path(__file__).parent/'local_browser_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));b.close()
 assert not errors and all(not c['audit']['penetrations'] and not c['audit']['geometryFailures'] for c in cases)
 print('Completed. See qa/local_browser_report.json')
