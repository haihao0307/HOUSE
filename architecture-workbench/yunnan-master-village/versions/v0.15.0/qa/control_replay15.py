import os,json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
os.environ['DISPLAY']=':99';D=Path('/mnt/data');R=D/'yunnan_v015_work/qa'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1100,'height':800});page.set_content((D/'Yunnan_Master_and_Village_V0.15.0.html').read_text());page.wait_for_function('YKY?.ready');out={}
 page.locator('#walkTest15').click();page.evaluate('YKY.setInspectionTime(12)');out['caption']=page.locator('#timelineTitle').inner_text();out['rangeMax']=page.locator('#timeline').get_attribute('max');out['pausedIcon']=page.locator('#play').inner_text()
 page.locator('#timeline').fill('21');page.locator('#timeline').dispatch_event('input');out['seek']=page.evaluate('YKY.getCirculationProbe()')
 page.locator('#play').click();samples=[]
 for _ in range(6):
  page.wait_for_timeout(500);samples.append(page.evaluate('({time:YKY.getCirculationProbe().time,workers:YKY.getCirculationProbe().workers.map(w=>w.position)})'))
 out['real_time_motion']=samples;page.locator('#play').click();out['pausedTime']=page.evaluate('YKY.getCirculationProbe().time');page.wait_for_timeout(200);out['pauseHeld']=out['pausedTime']==page.evaluate('YKY.getCirculationProbe().time')
 page.evaluate('YKY.setInspectionTime(62)');page.locator('#play').click();page.wait_for_timeout(120);out['replayRestarts']=page.evaluate('YKY.getCirculationProbe().time<2');page.locator('#restart').click();out['returnToConstruction']=page.evaluate('({replay:YKY.getCirculationProbe().mode,max:document.querySelector("#timeline").max,key:YKY.getFastProbe().stageKey})');page.evaluate('YKY.setTimeFast(0)')
 out['pass']=out['rangeMax']=='62' and out['seek']['time']==21 and out['pauseHeld'] and out['replayRestarts'] and out['returnToConstruction']['max']=='408' and samples[-1]['time']>samples[0]['time']
 (R/'controls_v015.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print('controls',out['pass'],out['caption'],out['rangeMax'],out['pauseHeld'],out['replayRestarts']);b.close()
