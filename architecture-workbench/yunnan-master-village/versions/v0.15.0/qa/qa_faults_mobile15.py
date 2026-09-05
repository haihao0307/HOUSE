import os,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
os.environ['DISPLAY']=':99';D=Path('/mnt/data');W=D/'yunnan_v015_work';R=W/'qa';C=D/'yunnan_v015_captures';C.mkdir(exist_ok=True)
html=(D/'Yunnan_Master_and_Village_V0.15.0.html').read_text()
# Test-only access to real meshes. The deliverable has no mutation controls.
inject="""window.YKY={__testFault:(name,on)=>{if(name==='upper_overlap')topLanding.position.z+=on?-.26:.26;if(name==='height_mismatch')topLanding.position.y+=on?.12:-.12;if(name==='floating_base')bottomLanding.position.y+=on?.60:-.60;if(name==='missing_bearer')stairBearers[0].position.x+=on?5:-5;if(name==='closed_door'){accessDoors.forEach(g=>g.rotation.y=on?0:g.userData.openSign*Math.PI*.56);}if(name==='sunken_foot')builders[0].g.position.y+=on?-.20:.20;scene.updateMatrixWorld(true);return{stairs:auditStair15(),body:bodyClearanceProbe15()};},"""
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 pg=b.new_page(viewport={'width':1360,'height':900});pg.set_content(html.replace('window.YKY={',inject,1));pg.wait_for_function('YKY?.ready');out={'fault_harness_injected_only_in_test':True,'faults':[]}
 for name in ['upper_overlap','height_mismatch','floating_base','missing_bearer']:
  pg.evaluate('YKY.setInspectionTime(5)');r=pg.evaluate('(n)=>YKY.__testFault(n,true)',name);out['faults'].append({'id':name,'detected':not r['stairs']['pass'],'failed_checks':[t['id'] for t in r['stairs']['tests'] if not t['pass']]});pg.evaluate('(n)=>YKY.__testFault(n,false)',name)
 # At least one sample places torso in the doorway. Closing it must be detected.
 closed=[]
 for i in range(4,25):
  t=i*.25;pg.evaluate('(t)=>YKY.setInspectionTime(t)',t);r=pg.evaluate('YKY.__testFault("closed_door",true)');
  if r['body']['bodyHits']:closed.append({'t':t,'hits':r['body']['bodyHits']})
  pg.evaluate('YKY.__testFault("closed_door",false)')
 out['faults'].append({'id':'closed_door','detected':bool(closed),'examples':closed[:2]})
 pg.evaluate('YKY.setInspectionTime(22)');r=pg.evaluate('YKY.__testFault("sunken_foot",true)');out['faults'].append({'id':'sunken_foot','detected':bool(r['body']['soleHits']),'examples':r['body']['soleHits'][:4]});pg.evaluate('YKY.__testFault("sunken_foot",false)');pg.close()
 out['mobile']=[]
 for width,height in[(390,844),(430,932)]:
  pg=b.new_page(viewport={'width':width,'height':height},is_mobile=True,has_touch=True,device_scale_factor=1);err=[];pg.on('pageerror',lambda e:err.append(str(e)));pg.set_content(html);pg.wait_for_function('YKY?.ready');print('MOBILE',width,'ready',flush=True)
  metrics=pg.evaluate('({innerWidth,scrollWidth:document.documentElement.scrollWidth,body:document.body.scrollWidth})');pg.locator('#walkTest15').tap();pg.wait_for_timeout(120);walk=pg.evaluate('YKY.getCirculationProbe().mode');pg.locator('#cinemaButton').tap();pg.wait_for_timeout(120)
  cinema=pg.evaluate('document.body.classList.contains("cinema-mode")');pg.evaluate('YKY.setInspectionTime(17);YKY.setView("walk");YKY.setDirector(false)');pg.screenshot(path=str(C/f'06_mobile_walk_{width}.png'));pg.locator('#cinemaExit').tap();exited=pg.evaluate('!document.body.classList.contains("cinema-mode")')
  pg.locator('#feastJump').tap();pg.evaluate('YKY.setStageFast(YKYCore.I.feast,.65);YKY.setView("feast");YKY.setCinema(true)');pg.screenshot(path=str(C/f'07_mobile_feast_{width}.png'))
  out['mobile'].append({'width':width,'height':height,'metrics':metrics,'walk_button':walk,'cinema_enter':cinema,'cinema_exit':exited,'errors':err});pg.close();print('MOBILE',width,'done',flush=True)
 (R/'faults_mobile_v015.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps(out,ensure_ascii=False,indent=2),flush=True);b.close()
