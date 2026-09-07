import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright
os.environ['DISPLAY']=':99';D=Path('/mnt/data');C=D/'yunnan_v015_captures';R=D/'yunnan_v015_work/qa'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1600,'height':1000});page.set_content((D/'Yunnan_Master_and_Village_V0.15.0.html').read_text(),wait_until='load');page.wait_for_function('YKY?.ready')
 shots=[
 ('01_workers_descending.png','YKY.setStageFast(YKYCore.I.descend,.34);YKY.setView("walk");YKY.setDirector(false)'),
 ('02_completed_stair_passage.png','YKY.setInspectionTime(18.5);YKY.setView("walk");YKY.setDirector(false)'),
 ('03_open_upstairs_door.png','YKY.setStageFast(YKYCore.I.groundfloor,.999);YKY.setDoor(true);YKY.setView("door");YKY.setDirector(false)'),
 ('04_carrying_table_to_front_court.png','YKY.setStageFast(YKYCore.I.feastsetup,.5);YKY.setView("feast");YKY.setDirector(false)'),
 ('05_front_courtyard_feast.png','YKY.setStageFast(YKYCore.I.feast,.61);YKY.setView("feast");YKY.setDirector(false)'),
 ('08_four_cooked_chicken_legs.png','YKY.setStageFast(YKYCore.I.feast,.61);YKY.setView("food");YKY.setDirector(false)'),
 ('09_same_pole_brace_preserved.png','YKY.setStageFast(YKYCore.I.brace1,.80);YKY.setView("raising");YKY.setDirector(false)')]
 meta=[]
 for name,js in shots:
  page.evaluate(js);page.wait_for_timeout(100);page.screenshot(path=str(C/name));meta.append({'file':name,'probe':page.evaluate('YKY.getFastProbe()')});print('CAPTURE',name,flush=True)
 (R/'captures_v015.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2));b.close()
