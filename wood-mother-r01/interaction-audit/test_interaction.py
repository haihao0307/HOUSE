"""Independent browser audit. Run in normal-sandbox Chrome; no production mutations.
Usage: python test_interaction.py --candidate /path/candidate.html --browser /opt/google/chrome/chrome
"""
import argparse, hashlib, json, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--candidate',required=True);ap.add_argument('--browser',default='/opt/google/chrome/chrome');ap.add_argument('--out',default='interaction-audit/evidence');a=ap.parse_args()
candidate=Path(a.candidate).resolve();out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
INSTRUMENT=r'''(()=>{
 window.__audit={gl:0,mutations:[],resizes:[],longtasks:[],started:performance.now()};
 const g=HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext=function(t,...args){if(/^(webgl|webgl2|experimental-webgl)$/.test(t)){__audit.gl++;return null}return g.call(this,t,...args)};
 for(const name of ['putImageData','drawImage','fillRect','clearRect','reset']){const fn=CanvasRenderingContext2D.prototype[name];if(!fn)continue;CanvasRenderingContext2D.prototype[name]=function(...args){if(this.canvas.id==='view'){
 let full=false;if(name==='putImageData')full=args[0].width===this.canvas.width&&args[0].height===this.canvas.height&&args[1]===0&&args[2]===0&&args.length===3;
 if(name==='drawImage'){let s=args[0],d=args.slice(1);full=(d.length===2&&d[0]===0&&d[1]===0&&s.width===this.canvas.width&&s.height===this.canvas.height)||(d.length===4&&d[0]===0&&d[1]===0&&d[2]===this.canvas.width&&d[3]===this.canvas.height);}
 if(name==='fillRect'||name==='clearRect')full=args[0]===0&&args[1]===0&&args[2]===this.canvas.width&&args[3]===this.canvas.height;
 __audit.mutations.push({t:performance.now(),name,full,w:this.canvas.width,h:this.canvas.height,epoch:window.woodQA?.epoch,frames:window.woodQA?.frames});}
 return fn.apply(this,args)};}
 try{new PerformanceObserver(list=>{for(const e of list.getEntries())__audit.longtasks.push({start:e.startTime,duration:e.duration})}).observe({entryTypes:['longtask']})}catch(e){}
})();'''
HASH=r'''()=>{let c=document.querySelector('#view'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,h=2166136261;for(const v of d){h^=v;h=Math.imul(h,16777619)}return {hash:h>>>0,length:d.length}}'''
result={'candidate':str(candidate),'sha256':hashlib.sha256(candidate.read_bytes()).hexdigest(),'cases':[],'errors':[],'limits':['Browser viewport is not a physical phone test.','Timing is measured on this test machine only.','Atomic presentation alone is not smooth motion.']}
def settle(p):
 p.wait_for_function("window.woodQA && woodQA.phase==='complete' && woodQA.committedGeneration===woodQA.epoch",timeout=120000)
 q=p.evaluate('structuredClone(woodQA)');assert not q.get('error');assert 1<=q.get('workerCount',1)<=6;assert p.evaluate('__audit.gl')==0;return q
def change(p,id,value):
 p.locator('#'+id).evaluate('(e,v)=>{if(e.type===\"checkbox\")e.checked=v;else e.value=v;e.dispatchEvent(new Event(\"input\",{bubbles:true}))}',value)
def picture(p,name):p.screenshot(path=str(out/(name+'.png')))
def capture(p):return p.evaluate('structuredClone(__audit)')
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,executable_path=a.browser,chromium_sandbox=True,ignore_default_args=['--enable-unsafe-swiftshader','--no-sandbox','--unsafely-disable-devtools-self-xss-warnings','--disable-ipc-flooding-protection','--disable-client-side-phishing-detection'])
  result['browser']=b.version;reference=None
  for name,vp,dpr in [('desktop',{'width':1280,'height':900},1),('user-size',{'width':1356,'height':1245},1.5),('mobile-viewport',{'width':390,'height':844},3)]:
   c=b.new_context(viewport=vp,device_scale_factor=dpr);c.add_init_script(INSTRUMENT);p=c.new_page();p.on('pageerror',lambda e:result['errors'].append(str(e)));p.goto(candidate.as_uri());q=settle(p);r={'name':name,'initial':q,'initialHash':p.evaluate(HASH),'steps':[]};result['cases'].append(r)
   expected=p.locator('#view').evaluate('(c)=>({width:Math.round(c.clientWidth*Math.min(devicePixelRatio,1.5)),height:Math.round(c.clientHeight*Math.min(devicePixelRatio,1.5)),clientWidth:c.clientWidth,clientHeight:c.clientHeight,dpr:devicePixelRatio})');r['expectedPixelBudget']=expected;assert q['width']==expected['width'];assert q['height']==expected['height'];picture(p,name+'-initial')
   if name=='desktop':reference=r['initialHash']
   before=capture(p);base_n=len(before['mutations']);change(p,'height',-.26);change(p,'radius',.25);change(p,'cut',.7);q=settle(p);assert q['renderedState']['kh']==-.26 and q['renderedState']['kr']==.25 and q['renderedState']['cut']==.7;r['steps'].append({'latest_parameters':q});picture(p,name+'-latest')
   new=capture(p)['mutations'][base_n:];assert all(e['full'] for e in new),f'Partial visible mutation: {new}';r['atomic_parameter_changes']=new
   change(p,'shape','1');q=settle(p);r['steps'].append({'cylinder':q});picture(p,name+'-cylinder')
   if name=='desktop':
    # Real continuous input. Count actual completed visible frames, not input events.
    box=p.locator('#view').bounding_box();x=box['x']+box['width']*.5;y=box['y']+box['height']*.5
    startq=p.evaluate('structuredClone(woodQA)');p.mouse.move(x,y);p.mouse.down();t0=time.monotonic();trace=[]
    for i in range(40):
     p.mouse.move(x+(i+1)*2,y+((i%10)-5));p.wait_for_timeout(50);trace.append(p.evaluate('({t:performance.now(),frames:woodQA.frames,epoch:woodQA.epoch,commit:woodQA.committedGeneration})'))
    t1=time.monotonic();p.mouse.up();q=settle(p);r['drag']={'seconds':t1-t0,'trace':trace,'commitsDuringInput':trace[-1]['frames']-startq['frames'],'fpsDuringInput':(trace[-1]['frames']-startq['frames'])/(t1-t0),'final':q,'settleAfterReleaseMs':(time.monotonic()-t1)*1000};assert q['renderedState']['yaw']!=startq['renderedState']['yaw'];picture(p,'desktop-drag')
    commits=q.get('commitTimes',[]);gaps=[commits[i]-commits[i-1] for i in range(1,len(commits))];r['drag']['commitIntervalsMs']=gaps
    if gaps:r['drag']['maxCommitIntervalMs']=max(gaps)
    p.mouse.wheel(0,80);q=settle(p);r['steps'].append({'wheel':q})
    p.set_viewport_size({'width':1200,'height':860});p.wait_for_function("(()=>{let c=document.querySelector('#view'),d=Math.min(devicePixelRatio,1.5);return c.width===Math.round(c.clientWidth*d)&&c.height===Math.round(c.clientHeight*d)})()");q=settle(p);assert q['width']==920 and q['height']==602;r['steps'].append({'resize':q});picture(p,'desktop-resize')
    p.locator('#endgrain').click();q=settle(p);r['steps'].append({'endgrain':q});picture(p,'desktop-endgrain')
    change(p,'knot',False);q=settle(p);r['steps'].append({'no_knot':q});picture(p,'desktop-no-knot')
   r['audit']=capture(p);r['nominalRGBABytes']=q['width']*q['height']*4;assert all(e['full'] for e in r['audit']['mutations']);c.close()
  c=b.new_context(viewport={'width':1280,'height':900},device_scale_factor=1);c.add_init_script(INSTRUMENT);c.add_init_script("window.Worker=function(){throw Error('QA: Worker blocked')}");p=c.new_page();p.goto(candidate.as_uri());q=settle(p);result['workerBlocked']={'state':q,'hash':p.evaluate(HASH),'audit':capture(p)};assert result['workerBlocked']['hash']==reference;assert all(e['full'] for e in result['workerBlocked']['audit']['mutations']);picture(p,'worker-blocked')
  change(p,'shape','1');p.wait_for_function("woodQA.phase==='rendering'");change(p,'height',.17);change(p,'cut',.2);q=settle(p);assert q['renderedState']['shape']==1 and q['renderedState']['kh']==.17 and q['renderedState']['cut']==.2;result['workerBlocked']['inflightLatest']=q;picture(p,'worker-blocked-inflight-latest');c.close()
  # Late worker failure must detach old handlers and recover once, without re-entry loss.
  c=b.new_context(viewport={'width':800,'height':600},device_scale_factor=1);c.add_init_script(INSTRUMENT);c.add_init_script("""(()=>{const W=window.Worker;let fired=false;window.Worker=function(...args){const w=new W(...args),post=w.postMessage.bind(w);w.postMessage=function(m,...rest){post(m,...rest);if(!fired&&m.type==='render'){fired=true;setTimeout(()=>w.dispatchEvent(new ErrorEvent('error',{message:'QA mid-frame worker failure',cancelable:true})),20)}};return w}})()""");p=c.new_page();p.goto(candidate.as_uri());q=settle(p);assert 'fallback' in q['backend'].lower();result['lateWorkerFailure']={'state':q,'audit':capture(p)};assert all(e['full'] for e in result['lateWorkerFailure']['audit']['mutations']);picture(p,'late-worker-failure');c.close();b.close()
 assert not result['errors'];result['functional_status']='PASS';fps=result['cases'][0]['drag']['fpsDuringInput'];result['motion_status']='MEASURED_AT_LEAST_30FPS' if fps>=30 else 'NOT_30FPS_SMOOTH';result['visual_status']='REQUIRES_HUMAN_IMAGE_REVIEW'
except Exception as e:
 result['functional_status']='FAIL_OR_BLOCKED';result['failure']=repr(e);raise
finally:(out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
