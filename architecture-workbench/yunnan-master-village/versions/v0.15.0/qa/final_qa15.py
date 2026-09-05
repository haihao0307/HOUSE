"""Reproducible regression on final standalone HTML, using an in-memory DOM.
Browser policy prohibits file navigation in this environment. No remote resources used.
Fault injection is test-only and never written into the deliverable.
"""
import os, json, re, hashlib, time
from pathlib import Path
from playwright.sync_api import sync_playwright
os.environ['DISPLAY']=':99'
D=Path('/mnt/data');W=D/'yunnan_v015_work';R=W/'qa'
html=(D/'Yunnan_Master_and_Village_V0.15.0.html').read_text()
base=(D/'Yunnan_Master_and_Village_V0.14.0.html').read_text()
args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
result={'harness':'Chromium headed + Xvfb + SwiftShader; set_content of complete HTML bytes', 'timestamp_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'html_sha256':hashlib.sha256(html.encode()).hexdigest(),'baseline_sha256':hashlib.sha256(base.encode()).hexdigest()}
# Source-level regression locks: actual blocks, not booleans declared by the app.
bjs=re.findall(r'<script[^>]*>([\s\S]*?)</script>',base)[2];njs=re.findall(r'<script[^>]*>([\s\S]*?)</script>',html)[2]
locks=[]
for name,first,last in [('whole_bent_generator','function buildBent(fi){','const longRows='),('raising_crew_and_brace','function updateRig(s){','function resetInstall('),('sound_engine','function enableSound(','function showSequential(')]:
 try:
  a=bjs[bjs.index(first):bjs.index(last,bjs.index(first))]; b=njs[njs.index(first):njs.index(last,njs.index(first))]
  locks.append({'name':name,'identical':a==b,'bytes':len(a.encode()),'sha256':hashlib.sha256(a.encode()).hexdigest()})
 except ValueError: locks.append({'name':name,'not_found':True})
result['source_locks']=locks
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=args)
 page=b.new_page(viewport={'width':1440,'height':960});errors=[];console=[];req=[];fail=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:console.append({'type':m.type,'text':m.text}) if m.type in ['error','warning'] else None)
 page.on('request',lambda r:req.append(r.url));page.on('requestfailed',lambda r:fail.append({'url':r.url,'failure':r.failure}))
 page.set_content(html,wait_until='load');page.wait_for_function('window.YKY?.ready');print('READY',flush=True)
 result['initial']=page.evaluate('YKY.getFastProbe()');result['staircase']=page.evaluate('YKY.inspectStaircase()')
 stages=page.evaluate('YKY.getStages()');states=[]
 for k in range(0,len(stages),6):
  rows=page.evaluate('''([lo,hi])=>{const out=[];for(let i=lo;i<hi;i++){const st=YKYCore.STAGES[i];for(const q of[.12,.50,.92]){const a=YKY.evaluateOnly(st.start+q*st.duration);out.push({stage:st.key,index:i,progress:q,logical:{pass:a.logical.pass,total:a.logical.total,passed:a.logical.passed,failures:a.logical.tests.filter(t=>!t.pass)},geometry:{pass:a.geometry.pass,total:a.geometry.total,passed:a.geometry.passed,failures:a.geometry.tests.filter(t=>!t.pass)}});}}return out;}''',[k,min(k+6,len(stages))]);states+=rows;print('STAGES',k,'FAIL',sum(not r['logical']['pass'] or not r['geometry']['pass'] for r in rows),flush=True)
 result['stages']=states
 graph=page.evaluate('YKY.exportComponentGraph()');(R/'component_graph_v015.json').write_text(json.dumps(graph,ensure_ascii=False,indent=2));old=json.loads((R/'baseline_graph.json').read_text());om={r['id']:r for r in old};nm={r['id']:r for r in graph};frozen=[x for x in om if x.startswith(('BENT-','BASE-','LINK-','PURLIN-','RAFTER-','GJOIST-','GBOARD-','BOARD-'))]
 result['graph_regression']={'checked':len(frozen),'missing':[x for x in frozen if x not in nm],'changed':[x for x in frozen if x in nm and om[x]!=nm[x]],'total_current':len(nm)}
 before=json.dumps(graph,ensure_ascii=False,sort_keys=True)
 page.evaluate('YKY.setAtmosphere(false)');off=page.evaluate('YKY.exportComponentGraph()');page.evaluate('YKY.setAtmosphere(true)');result['atmosphere_graph_isolation']=json.dumps(off,ensure_ascii=False,sort_keys=True)==before
 # Independent completed-building walk: 125 samples, static walls and rafters present.
 walks=[]
 for lo in range(0,125,25):
  chunk=page.evaluate('''(lo)=>{const out=[];for(let i=lo;i<Math.min(lo+25,125);i++){YKY.setInspectionTime(i*.5);out.push({t:i*.5,walk:YKY.getCirculationProbe(),collision:YKY.getBodyClearance()});}return out;}''',lo);walks+=chunk;print('WALK',lo,'body',sum(len(r['collision']['bodyHits']) for r in chunk),'sole',sum(len(r['collision']['soleHits']) for r in chunk),flush=True)
 (R/'walk_trace_v015.json').write_text(json.dumps(walks,ensure_ascii=False))
 clearance=[f['clearance'] for r in walks for w in r['walk']['workers'] for f in w['feet']]
 result['walk']={'sample_count':len(walks),'step_seconds':.5,'workers':3,'foot_centres':len(clearance),'sole_footprint_points':len(clearance)*5,'min_centre_clearance_m':min(clearance),'body_hits':sum(len(r['collision']['bodyHits']) for r in walks),'sole_hits':sum(len(r['collision']['soleHits']) for r in walks),'final':walks[-1]['walk']}
 meals=[]
 for key,q in [('feastsetup',.0),('feastsetup',.5),('feastsetup',.999),('feast',.1),('feast',.6),('feast',.9)]:
  page.evaluate('([key,q])=>YKY.setStageFast(YKYCore.I[key],q)',[key,q]);meals.append({'progress':q,'probe':page.evaluate('YKY.getMealProbe()')})
 result['meals']=meals
 # Door and replay navigation through actual DOM controls.
 page.evaluate('YKY.setStageFast(YKYCore.I.groundfloor,.999)');page.locator('#doorToggle15').click();result['door_manual_open']=page.evaluate('YKY.getCirculationProbe().doorOpenDegrees');page.locator('#doorToggle15').click();result['door_manual_close']=page.evaluate('YKY.getCirculationProbe().doorOpenDegrees')
 page.locator('#walkTest15').click();page.wait_for_timeout(160);result['walk_button']=page.evaluate('YKY.getCirculationProbe().mode');page.locator('#feastJump').click();result['replay_cleared_by_feast']=page.evaluate('YKY.getCirculationProbe().enabled===false && YKY.getFastProbe().stageKey==="feast"');page.evaluate('YKY.setStageFast(YKYCore.I.feast,.60)')
 page.locator('#soundDemoButton').click();page.wait_for_timeout(1500);result['audio']=page.evaluate('YKY.getAudioProbe()')
 result['desktop_errors']=errors;result['desktop_console']=console;result['requests']=req;result['failed_requests']=fail
 result['static_dependencies']={'external_scripts':re.findall(r'<script[^>]+src=["\']([^"\']+)',html),'image_tags':len(re.findall(r'<img\b',html,re.I)),'media_tags':len(re.findall(r'<(?:audio|video|iframe)\b',html,re.I))}
 (R/'final_qa_v015.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print('WROTE SUMMARY',flush=True);b.close()
