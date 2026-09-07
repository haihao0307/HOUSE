"""Fresh browser regression. Usage: xvfb-run -a python verify_v0151.py BASE HTML OUTDIR.
Requires Playwright, Chromium and Pillow. No remote assets or original SKP are loaded.
"""
import argparse, hashlib, json, os, time
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops, ImageStat

def digest(obj): return hashlib.sha256(json.dumps(obj,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def run(base:Path,candidate:Path,out:Path):
    out.mkdir(parents=True,exist_ok=True);evidence=out.parent/'evidence';evidence.mkdir(exist_ok=True)
    rawbase=base.read_bytes(); raw=candidate.read_bytes()
    assert hashlib.sha256(rawbase).hexdigest()=='bdd566b7c1817a21c9fc136e23b53adaa1c018adaa6e4aa25a43ef292aaedae9'
    report={'version':'0.15.1','checked_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
      'base_sha256':hashlib.sha256(rawbase).hexdigest(),'html_sha256':hashlib.sha256(raw).hexdigest(),
      'renderer':'Chromium headed / Xvfb / SwiftShader','physical_mobile_tested':False,
      'public_site_deployed':False,'measurementTruthApproved':False,'visualApproved':False,'productionApproved':False}
    with sync_playwright() as pw:
      b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_EXECUTABLE','/usr/bin/chromium'),headless=False,
        args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
      def load(html,width=1400,height=900,mobile=False):
        ctx=b.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
        p=ctx.new_page();errors=[];warnings=[];requests=[]
        p.on('pageerror',lambda e:errors.append(str(e)))
        p.on('console',lambda m:warnings.append({'type':m.type,'text':m.text}) if m.type in ('warning','error') else None)
        p.on('request',lambda r:requests.append(r.url))
        p.set_content(html,wait_until='load');p.wait_for_function('window.YKY && YKY.ready')
        return ctx,p,errors,warnings,requests
      def samples(p):
        stages=p.evaluate('YKY.getStages()');rows=[]
        for lo in range(0,len(stages),4):
          rows+=p.evaluate('''([lo,hi])=>{let a=[];for(let i=lo;i<hi;i++){let s=YKYCore.STAGES[i];for(let q of [.12,.5,.92]){let v=YKY.evaluateOnly(s.start+s.duration*q);a.push({stage:s.key,q,logical:v.logical,geometry:v.geometry});}}return a;}''',[lo,min(lo+4,len(stages))])
        walks=[]
        for lo in range(0,125,25):
          walks+=p.evaluate('''lo=>{let a=[];for(let i=lo;i<Math.min(lo+25,125);i++){YKY.setInspectionTime(i*.5);a.push({t:i*.5,walk:YKY.getCirculationProbe(),collision:YKY.getBodyClearance()});}return a;}''',lo)
        return rows,walks,p.evaluate('YKY.exportComponentGraph()')
      ctx,old,oe,ow,orr=load(rawbase.decode());print('BASE READY',flush=True)
      oldrows,oldwalks,oldgraph=samples(old);oldstairs=old.evaluate('YKY.inspectStaircase()');ctx.close();print('BASE SAMPLED',flush=True)
      ctx,p,errors,warnings,requests=load(raw.decode());print('CANDIDATE READY',flush=True)
      rows,walks,graph=samples(p);print('CANDIDATE SAMPLED',flush=True)
      report['three_revision']=p.evaluate('THREE.REVISION');report['load_method']='set_content of complete standalone HTML bytes'
      report['stage_samples']=len(rows);report['stages_identical']=rows==oldrows
      report['stage_failures']=[{'stage':r['stage'],'q':r['q']} for r in rows if not r['logical']['pass'] or not r['geometry']['pass']]
      report['walk_samples']=len(walks);report['walk_identical']=walks==oldwalks
      report['body_hits']=sum(len(r['collision']['bodyHits']) for r in walks);report['sole_hits']=sum(len(r['collision']['soleHits']) for r in walks)
      report['component_graph_identical']=graph==oldgraph;report['component_count']=len(graph)
      report['staircase']=p.evaluate('YKY.inspectStaircase()');report['staircase_identical']=report['staircase']==oldstairs
      p.evaluate('YKY.setAtmosphere(false)');report['atmosphere_isolation']=p.evaluate('YKY.exportComponentGraph()')==graph;p.evaluate('YKY.setAtmosphere(true)')
      for name,data in [('stage_samples.json',rows),('walk_samples.json',walks),('component_graph.json',graph)]:
        (out/name).write_text(json.dumps(data,ensure_ascii=False,indent=2));report[name+'_sha256']=digest(data)
      report['material_probe']=p.evaluate('YKY.materialBridge.getProbe()')
      axis=p.evaluate('''()=>{const a=YKY.materialBridge,tests=[];function ck(id,pass){tests.push({id,pass:!!pass});}
        for(let i=0;i<7;i++){ck('upper_'+i,a.inspect('STAIR-UPPER-TREAD-'+i).axis==='x');ck('lower_'+i,a.inspect('STAIR-LOWER-TREAD-'+i).axis==='z');}
        ck('board_preserved',a.inspect('BOARD-0').axis==='y');ck('square_unresolved',a.inspect('STAIR-TURN-LANDING').ambiguous);
        ck('fresh_dimension_x',a.chooseAxis([4,.1,.3]).axis===0);ck('fresh_dimension_z',a.chooseAxis([.2,.06,3]).axis===2);
        ck('explicit_generator',a.chooseAxis([3,2,.1],true).axis===1);ck('square_guard',a.chooseAxis([1,.1,1]).ambiguous);
        let threw=0;for(const d of [[0,1,2],[-1,2,3],[NaN,1,2],null])try{a.chooseAxis(d);}catch(e){threw++;}ck('invalid_dimensions',threw===4);
        try{a.setMode('invalid');ck('invalid_mode',false);}catch(e){ck('invalid_mode',true);}
        let before=a.inspect('STAIR-UPPER-TREAD-0').seed;YKY.setTimeFast(0);YKY.setInspectionTime(15);ck('stable_seed_after_replay',a.inspect('STAIR-UPPER-TREAD-0').seed===before);
        return tests;}''')
      report['axis_tests']=axis
      p.evaluate('YKY.setStageFast(YKYCore.I.descend,.42);YKY.setView("walk");YKY.setLight("neutral");YKY.setDirector(false)')
      p.locator('#mb151-panel summary').click();report['panel_open']=p.locator('#mb151-panel').evaluate('(e)=>e.open')
      report['material_modes']=[]
      for mode in ['baseline','grain','response','endgrain','baseline']:
        p.locator('#mb151-mode').select_option(mode);p.wait_for_timeout(350)
        report['material_modes'].append(p.evaluate('YKY.materialBridge.getProbe().mode'))
        p.screenshot(path=str(evidence/('material_'+mode+('_restored' if len(report['material_modes'])==5 else '')+'.png')))
      im1=Image.open(evidence/'material_baseline.png').convert('RGB');im2=Image.open(evidence/'material_baseline_restored.png').convert('RGB')
      diff=ImageChops.difference(im1,im2);report['baseline_restored_pixel_identical']=diff.getbbox() is None
      report['baseline_restored_channel_mean_absolute_difference']=ImageStat.Stat(diff).mean
      p.evaluate('YKY.materialBridge.setMode("grain")')
      report['desktop_errors']=errors;report['desktop_console']=warnings;report['baseline_errors']=oe;report['baseline_console']=ow
      report['external_requests']=[r for r in requests+orr if r.startswith(('http:','https:'))]
      ctx.close();print('DESKTOP FINISHED',flush=True)
      report['mobile']=[]
      for w,h in [(390,844),(430,932)]:
        ctx,m,me,mw,mr=load(raw.decode(),w,h,True)
        m.locator('#mb151-panel summary').click();m.locator('#mb151-mode').select_option('endgrain');m.wait_for_timeout(250)
        bounds=m.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,mode:YKY.materialBridge.getProbe().mode})')
        rect=m.locator('#mb151-mode').bounding_box();summary=m.locator('#mb151-panel summary').bounding_box()
        bounds.update({'viewport':[w,h],'errors':me,'console':mw,'selector_bounds':rect,'summary_bounds':summary})
        bounds['control_within_view']=all([rect is not None,summary is not None]) and rect['x']>=0 and rect['y']>=0 and rect['x']+rect['width']<=w and rect['y']+rect['height']<=h
        m.screenshot(path=str(evidence/f'mobile_{w}.png'));report['mobile'].append(bounds);ctx.close();print('MOBILE',w,flush=True)
      b.close()
    report['pass']=all([report['stages_identical'],report['walk_identical'],report['component_graph_identical'],report['staircase_identical'],report['atmosphere_isolation'],not report['stage_failures'],report['body_hits']==0,report['sole_hits']==0,not errors,not warnings,not oe,not ow,not report['external_requests'],all(t['pass'] for t in axis),report['material_modes']==['baseline','grain','response','endgrain','baseline'],report['baseline_restored_pixel_identical'],all(x['width']==x['scroll'] and x['control_within_view'] and not x['errors'] and not x['console'] for x in report['mobile'])])
    (out/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ('material_probe','staircase')},ensure_ascii=False,indent=2));assert report['pass']
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('baseline',type=Path);p.add_argument('candidate',type=Path);p.add_argument('output',type=Path);a=p.parse_args();run(a.baseline,a.candidate,a.output)
