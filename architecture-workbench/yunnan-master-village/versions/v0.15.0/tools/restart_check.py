"""Cold-start check for the frozen V0.15.0 handoff, with fresh browser evidence.
Run from any directory. No runtime files are modified by this check.
"""
from pathlib import Path
import os, json, hashlib, re, subprocess, sys, time
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
V=ROOT if (ROOT/'Yunnan_Master_and_Village_V0.15.0.html').exists() else ROOT/'versions/v0.15.0'
OUT=V/'qa/restart'; OUT.mkdir(parents=True,exist_ok=True)
E=V/'evidence'; E.mkdir(exist_ok=True)
H=V/'Yunnan_Master_and_Village_V0.15.0.html'
B=V/'baseline/Yunnan_Master_and_Village_V0.14.0.html'
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(H.read_bytes())=='bdd566b7c1817a21c9fc136e23b53adaa1c018adaa6e4aa25a43ef292aaedae9'
assert sha(B.read_bytes())=='9fd104d6d95604351e041faa8dc39516d4337d85569601e1b6e3ca162dd5b587'
subprocess.run([sys.executable,str(V/'src/build_v015.py')],check=True,cwd=V)
assert sha(H.read_bytes())=='bdd566b7c1817a21c9fc136e23b53adaa1c018adaa6e4aa25a43ef292aaedae9'
html=H.read_text(encoding='utf-8')
result={'version':'0.15.0','checked_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'html_sha256':sha(H.read_bytes()),'rebuild_byte_identical':True,'baseline_sha256':sha(B.read_bytes()),'renderer':'Chromium / SwiftShader','hosted_public_site_tested':False,'physical_mobile_tested':False,'historical_truth_approved':False}
args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
with sync_playwright() as pw:
    options={'headless':not bool(os.environ.get('DISPLAY')),'args':args}
    if os.environ.get('CHROMIUM_EXECUTABLE'): options['executable_path']=os.environ['CHROMIUM_EXECUTABLE']
    browser=pw.chromium.launch(**options)
    errors=[];warnings=[];failed=[];requests=[]
    page=browser.new_page(viewport={'width':1600,'height':1000})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:warnings.append({'type':m.type,'text':m.text}) if m.type in ['error','warning'] else None)
    page.on('request',lambda r:requests.append(r.url))
    page.on('requestfailed',lambda r:failed.append({'url':r.url,'failure':r.failure}))
    try:
        page.goto(H.as_uri(),wait_until='load',timeout=30000)
        page.wait_for_function('window.YKY && YKY.ready',timeout=20000)
        result['load_method']='file navigation'
    except Exception as exc:
        errors.clear();warnings.clear();failed.clear();requests.clear()
        page.set_content(html,wait_until='load')
        result['load_method']='in-memory DOM of unchanged HTML bytes'
        result['file_navigation_unavailable']=str(exc)[:300]
    page.wait_for_function('window.YKY && YKY.ready',timeout=60000)
    result['ready']=True
    result['staircase']=page.evaluate('YKY.inspectStaircase()')
    stages=page.evaluate('YKY.getStages()')
    rows=[]
    for k in range(0,len(stages),4):
        rows+=page.evaluate('''([lo,hi])=>{const out=[];for(let i=lo;i<hi;i++){const st=YKYCore.STAGES[i];for(const q of [.12,.50,.92]){const a=YKY.evaluateOnly(st.start+q*st.duration);out.push({stage:st.key,index:i,progress:q,logical:a.logical,geometry:a.geometry});}}return out;}''',[k,min(k+4,len(stages))])
    (OUT/'stage_checks.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
    result['stage_count']=len(stages);result['state_samples']=len(rows)
    result['failed_states']=[{'stage':r['stage'],'progress':r['progress']} for r in rows if not r['logical']['pass'] or not r['geometry']['pass']]
    walks=[]
    for lo in range(0,125,25):
        walks+=page.evaluate('''lo=>{const out=[];for(let i=lo;i<Math.min(lo+25,125);i++){YKY.setInspectionTime(i*.5);out.push({t:i*.5,walk:YKY.getCirculationProbe(),collision:YKY.getBodyClearance()});}return out;}''',lo)
    (OUT/'walk_trace.json').write_text(json.dumps(walks,ensure_ascii=False,indent=2))
    result['walk_samples']=len(walks)
    result['body_hits']=sum(len(r['collision']['bodyHits']) for r in walks)
    result['sole_hits']=sum(len(r['collision']['soleHits']) for r in walks)
    graph=page.evaluate('YKY.exportComponentGraph()')
    (OUT/'component_graph.json').write_text(json.dumps(graph,ensure_ascii=False,indent=2))
    page.evaluate('YKY.setAtmosphere(false)');off=page.evaluate('YKY.exportComponentGraph()');page.evaluate('YKY.setAtmosphere(true)')
    result['atmosphere_isolation']=graph==off
    result['component_count']=len(graph)
    def stage_view(key,q,view,name):
        page.evaluate('''([key,q,view])=>{const s=YKYCore.STAGES.find(x=>x.key===key);if(!s)throw Error('Missing stage '+key);YKY.setTime(s.start+q*s.duration);YKY.setView(view);YKY.setDirector(false);}''',[key,q,view])
        page.wait_for_timeout(350)
        page.screenshot(path=str(E/name))
    # Fresh screenshots are identified separately from original delivery hashes.
    stage_view('descend',.42,'walk','01_workers_descending.png')
    page.evaluate('YKY.setInspectionTime(15)');page.wait_for_timeout(350);page.screenshot(path=str(E/'02_completed_stair_passage.png'))
    page.evaluate('YKY.setStageFast(YKYCore.I.groundfloor,.999);YKY.setDoor(true);YKY.setView("door");YKY.setDirector(false)');page.wait_for_timeout(350);page.screenshot(path=str(E/'03_open_upstairs_door.png'))
    stage_view('feastsetup',.55,'feast','04_carrying_table_to_front_court.png')
    stage_view('feast',.55,'feast','05_front_courtyard_feast.png')
    stage_view('feast',.62,'food','08_four_cooked_chicken_legs.png')
    raising=next((s for s in stages if s['key']=='brace1'),None)
    if raising:
        stage_view(raising['key'],.95,'raising','09_same_pole_brace_preserved.png')
    result['mobile']=[]
    for width,height in [(390,844),(430,932)]:
        ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=True,has_touch=True,device_scale_factor=1)
        m=ctx.new_page();merr=[]
        m.on('pageerror',lambda e:merr.append(str(e)))
        m.set_content(html,wait_until='load');m.wait_for_function('window.YKY && YKY.ready')
        m.evaluate('YKY.setInspectionTime(20)')
        # Locate the established mobile viewing control without assuming a new UI.
        buttons=m.locator('button').all()
        for b in buttons:
            if '手机观影' in b.inner_text():
                b.click(force=True);break
        m.wait_for_timeout(350);m.screenshot(path=str(E/f'06_mobile_walk_{width}.png'))
        mr=m.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,ready:YKY.ready})')
        m.evaluate('''()=>{const s=YKYCore.STAGES.find(x=>x.key==='feast');YKY.setTime(s.start+s.duration*.6);}''')
        m.wait_for_timeout(300);m.screenshot(path=str(E/f'07_mobile_feast_{width}.png'))
        result['mobile'].append({'viewport':[width,height],**mr,'page_errors':merr})
        ctx.close()
    result['page_errors']=errors;result['console_messages']=warnings;result['failed_requests']=failed
    result['external_requests']=[r for r in requests if r.startswith(('http:','https:'))]
    result['pass']=not result['failed_states'] and result['body_hits']==0 and result['sole_hits']==0 and result['atmosphere_isolation'] and not errors and not failed and not result['external_requests'] and all(x['scroll']==x['width'] and not x['page_errors'] for x in result['mobile'])
    (OUT/'report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    browser.close()
print(json.dumps({k:v for k,v in result.items() if k not in ['staircase']},ensure_ascii=False,indent=2))
assert result['pass'], 'Cold-start verification failed; do not publish'
