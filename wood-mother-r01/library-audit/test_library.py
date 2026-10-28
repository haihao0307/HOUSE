"""Independent Wood library/playback CI. Normal sandbox Chrome, no external writes."""
import argparse,base64,hashlib,json,math,time,zlib
from pathlib import Path
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('--candidate',required=True);ap.add_argument('--browser',default='/opt/google/chrome/chrome');ap.add_argument('--out',default='library-audit/evidence');args=ap.parse_args()
candidate=Path(args.candidate).resolve();out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=True)
INSTRUMENT="(()=>{\n window.__audit={gl:0,mutations:[],resizes:[],longtasks:[],started:performance.now()};\n const g=HTMLCanvasElement.prototype.getContext;\n HTMLCanvasElement.prototype.getContext=function(t,...args){if(/^(webgl|webgl2|experimental-webgl)$/.test(t)){__audit.gl++;return null}return g.call(this,t,...args)};\n for(const name of ['putImageData','drawImage','fillRect','clearRect','reset']){const fn=CanvasRenderingContext2D.prototype[name];if(!fn)continue;CanvasRenderingContext2D.prototype[name]=function(...args){if(this.canvas.id==='view'){\n let full=false;if(name==='putImageData')full=args[0].width===this.canvas.width&&args[0].height===this.canvas.height&&args[1]===0&&args[2]===0&&args.length===3;\n if(name==='drawImage'){let s=args[0],d=args.slice(1);full=(d.length===2&&d[0]===0&&d[1]===0&&s.width===this.canvas.width&&s.height===this.canvas.height)||(d.length===4&&d[0]===0&&d[1]===0&&d[2]===this.canvas.width&&d[3]===this.canvas.height);}\n if(name==='fillRect'||name==='clearRect')full=args[0]===0&&args[1]===0&&args[2]===this.canvas.width&&args[3]===this.canvas.height;\n __audit.mutations.push({t:performance.now(),name,full,w:this.canvas.width,h:this.canvas.height,epoch:window.woodQA?.epoch,frames:window.woodQA?.frames});}\n return fn.apply(this,args)};}\n try{new PerformanceObserver(list=>{for(const e of list.getEntries())__audit.longtasks.push({start:e.startTime,duration:e.duration})}).observe({entryTypes:['longtask']})}catch(e){}\n})();"
RAW="""()=>{let c=document.querySelector('#view'),a=c.getContext('2d').getImageData(0,0,c.width,c.height).data,s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));return btoa(s)}"""
result={'candidate':str(candidate),'sha256':hashlib.sha256(candidate.read_bytes()).hexdigest(),'cases':[],'errors':[],'limits':['Viewport tests are not physical phone validation.','Visibility override is a logic injection, not actual OS background suspension.','Functional PASS does not imply smooth FPS or photorealistic wood.']}
def state(p):return p.evaluate('structuredClone(woodQA)')
def settle(p):
 p.wait_for_function("window.woodQA&&woodQA.phase==='complete'&&woodQA.committedGeneration===woodQA.epoch",timeout=120000)
 q=state(p);assert not q.get('error');assert p.evaluate('__audit.gl')==0;return q
def raw(p):return base64.b64decode(p.evaluate(RAW))
def hashed(p):return hashlib.sha256(raw(p)).hexdigest()
def change(p,id,value):p.locator('#'+id).evaluate('(e,v)=>{if(e.type==="checkbox")e.checked=v;else e.value=v;e.dispatchEvent(new Event("input",{bubbles:true}))}',value)
def snap(p,name):p.screenshot(path=str(out/(name+'.png')))
def budget(p,q):
 e=p.locator('#view').evaluate('(c)=>({w:Math.round(c.clientWidth*Math.min(devicePixelRatio,1.5)),h:Math.round(c.clientHeight*Math.min(devicePixelRatio,1.5))})');assert(q['width'],q['height'])==(e['w'],e['h']);return e
def playback_sample(p):
 q=state(p);a=q['playback'];assert a['activeCount']<=1 and a['queuedCount']<=1;assert math.isfinite(a['time']) and math.isfinite(a['phase']);return {'t':p.evaluate('performance.now()'),'frames':q['frames'],'committed':q['committedGeneration'],'rendered':q.get('renderedState'),'playback':a}
def pause(p):
 # Capture the already-visible frame in the same click event, before its handler.
 p.evaluate("""()=>{document.querySelector('#play').addEventListener('click',()=>{let c=document.querySelector('#view');window.__pausePixels=Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data)},{capture:true,once:true})}""")
 p.locator('#play').click();q=settle(p);assert not q['playback']['playing'];before=bytes(p.evaluate('__pausePixels'));after=raw(p);assert after==before,'Pause changed visible pixels';h=hashlib.sha256(after).hexdigest();f=q['frames'];p.wait_for_timeout(1200);assert hashed(p)==h and state(p)['frames']==f;return {'state':q,'sha256':h,'stableAfterMs':1200,'exactPausePixelsUnchanged':True}
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,executable_path=args.browser,chromium_sandbox=True,ignore_default_args=['--enable-unsafe-swiftshader','--no-sandbox','--unsafely-disable-devtools-self-xss-warnings','--disable-ipc-flooding-protection','--disable-client-side-phishing-detection']);result['browser']=b.version
  for name,vp,dpr in [('desktop',{'width':1280,'height':900},1),('mobile-viewport',{'width':390,'height':844},3)]:
   c=b.new_context(viewport=vp,device_scale_factor=dpr);c.add_init_script(INSTRUMENT);p=c.new_page();p.on('pageerror',lambda e:result['errors'].append(str(e)));p.goto(candidate.as_uri());q=settle(p);r={'name':name,'initial':q,'budget':budget(p,q)};result['cases'].append(r);snap(p,name+'-initial');assert p.locator('#view').evaluate('(e)=>getComputedStyle(e).transform')=='none';assert p.locator('#view').evaluate('(e)=>e.getAnimations().length')==0
   if name=='desktop':
    r['materials']=[];options=p.locator('#family option').evaluate_all('(es)=>es.map(e=>({value:e.value,text:e.textContent}))');assert len(options)>=6
    for op in options:
     change(p,'family',op['value']);q=settle(p);pixels=raw(p);h=hashlib.sha256(pixels).hexdigest();r['materials'].append({'option':op,'state':q,'rgba_sha256':h});(out/('family-'+op['value']+'.rgba.z')).write_bytes(zlib.compress(pixels));snap(p,'family-'+op['value'])
    assert len(set(x['rgba_sha256'] for x in r['materials']))>=6,'Not six distinct rendered examples'
    change(p,'family',options[1]['value']);settle(p);r['finishes']=[]
    for op in p.locator('#finish option').evaluate_all('(es)=>es.map(e=>({value:e.value,text:e.textContent}))'):
     change(p,'finish',op['value']);q=settle(p);r['finishes'].append({'option':op,'state':q,'rgba_sha256':hashed(p)});snap(p,'finish-'+op['value'])
    assert len(set(x['rgba_sha256'] for x in r['finishes']))>=3
    r['ages']=[]
    for v in [0,.5,1]:
     change(p,'weather',v);q=settle(p);r['ages'].append({'age':v,'state':q,'rgba_sha256':hashed(p)});snap(p,'age-'+str(v))
    assert len(set(x['rgba_sha256'] for x in r['ages']))==3
    r['surfaceControls']=[]
    for control,values in [('roughnessAdjust',[-.2,.2]),('coatGloss',[0,1])]:
     hashes=[]
     for value in values:
      change(p,control,value);q=settle(p);h=hashed(p);hashes.append(h);r['surfaceControls'].append({'control':control,'value':value,'hash':h,'state':q})
     assert len(set(hashes))==2,control+' has no visible effect'
    change(p,'roughnessAdjust',0);change(p,'coatGloss',.85);settle(p)
   # One full period of actual continuous model evaluation, not just a RAF counter.
   change(p,'cycle',8);settle(p);p.locator('#play').click();p.wait_for_function('woodQA.playback.playing');trace=[];start=time.monotonic()
   while time.monotonic()-start<9.5:
    p.wait_for_timeout(100);trace.append(playback_sample(p))
   r['playbackTrace']=trace;r['actualFps']=(trace[-1]['frames']-trace[0]['frames'])/((trace[-1]['t']-trace[0]['t'])/1000);assert trace[-1]['frames']>trace[0]['frames'];phases=[s['rendered']['animationPhase'] for s in trace if s['rendered']];r['loopWraps']=sum(phases[i]<phases[i-1]-.2 for i in range(1,len(phases)));assert r['loopWraps']>=1,'No actual loop boundary observed';r['pause']=pause(p);snap(p,name+'-paused')
   # Resume and change controls while actual rendering continues.
   p.locator('#play').click();p.wait_for_function('woodQA.playback.playing');change(p,'family','2');change(p,'finish','1');change(p,'weather',.5);p.wait_for_function("woodQA.renderedState.family===2&&woodQA.renderedState.finish===1&&woodQA.renderedState.weather===.5",timeout=120000);r['resumeChanges']=pause(p);q=settle(p);r['afterResume']=q;assert q['renderedState']['family']==2 and q['renderedState']['finish']==1 and q['renderedState']['weather']==.5
   # A pending material edit must not be silently reverted by pausing an older frame.
   p.locator('#play').click();change(p,'family','4');change(p,'finish','2');change(p,'weather',.25);p.locator('#play').click();q=settle(p);assert not q['playback']['playing'];assert q['renderedState']['family']==4 and q['renderedState']['finish']==2 and q['renderedState']['weather']==.25;r['immediateEditPause']=q;snap(p,name+'-edit-then-pause')
   # Controlled visibility state injection validates hide/resume logic only.
   p.evaluate("""()=>{window.__qaHidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>__qaHidden});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>__qaHidden?'hidden':'visible'})}""");p.locator('#play').click();p.wait_for_function('woodQA.playback.playing');p.wait_for_timeout(250);p.evaluate("()=>{__qaHidden=true;document.dispatchEvent(new Event('visibilitychange'))}");p.wait_for_timeout(200);hidden=state(p);hh=hashed(p);p.wait_for_timeout(900);assert hashed(p)==hh;assert state(p)['frames']==hidden['frames'];assert state(p)['playback']['activeCount']==0 and state(p)['playback']['queuedCount']==0;r['hidden']=hidden
   p.evaluate("()=>{__qaHidden=false;document.dispatchEvent(new Event('visibilitychange'))}");p.wait_for_function('woodQA.frames>'+str(hidden['frames']),timeout=120000);r['afterVisible']=pause(p)
   r['audit']=p.evaluate('structuredClone(__audit)');assert all(m['full'] for m in r['audit']['mutations']);assert r['audit']['gl']==0;c.close()
  # Independent worker-blocked check includes play->pause, not only first frame.
  c=b.new_context(viewport={'width':800,'height':600});c.add_init_script(INSTRUMENT);c.add_init_script("window.Worker=function(){throw Error('QA Worker unavailable')}");p=c.new_page();p.on('pageerror',lambda e:result['errors'].append(str(e)));p.goto(candidate.as_uri());q=settle(p);assert 'fallback' in q['backend'].lower();p.locator('#play').click();p.wait_for_timeout(700);result['workerBlockedPause']=pause(p);assert all(m['full'] for m in p.evaluate('__audit.mutations'));c.close();b.close()
 assert not result['errors'];result['functional_status']='PASS';result['motion_status']='MEASURED_AT_LEAST_30FPS' if min(r['actualFps'] for r in result['cases'])>=30 else 'NOT_30FPS_SMOOTH';result['material_quality']='REQUIRES_INDEPENDENT_VISUAL_REVIEW'
except Exception as e:result['functional_status']='FAIL_OR_BLOCKED';result['failure']=repr(e);raise
finally:(out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
