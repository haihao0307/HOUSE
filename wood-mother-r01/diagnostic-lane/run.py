"""Isolated instrumentation of frozen v4. Does not overwrite production HTML."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import hashlib,json
root=Path(__file__).resolve().parents[1]
evidence=root/'ci/evidence/diagnostic'; evidence.mkdir(parents=True,exist_ok=True)
src=(root/'index.html').read_text();sha=hashlib.sha256(src.encode()).hexdigest()
assert sha=='a3dcee04302b87a4f37d1045d82b71478c5b2ceaa6a65ca955c523fbafabbb61'
s=src.replace('uniform int knot,shape,channel;','uniform int knot,shape,channel,diagnostic;')
probe='''if(diagnostic>0){vec3 fp=detailCoord(p);vec3 fw=fwidth(fp);float ff=max(max(fw.x,fw.y),fw.z);float weight=1.-smoothstep(.15,.8,ff);float raw=noise(fp);float fine=mix(.5,raw,weight);float pf=max(length(dFdx(p)),length(dFdy(p)));float bumpWeight=1.-smoothstep(.15,.8,max(fwidth(growth(p))*170.,pf*6.));vec3 bn=bumpNormal(p,n,pf);if(diagnostic==1)frag=vec4(clamp(ff/4.,0.,1.),weight,2.*abs(fine-.5),1);else if(diagnostic==2)frag=vec4(2.*abs(raw-.5),smoothstep(.52,.84,fine),clamp(length(bn-n)*10.,0.,1.),1);else frag=vec4(bumpWeight,clamp(pf*100.,0.,1.),clamp(fwidth(growth(p))*170./4.,0.,1.),1);return;}'''
s=s.replace('float r;vec3 al=wood(p,r);',probe+'float r;vec3 al=wood(p,r);')
s=s.replace('}else{float g=(-1.55-ro.y)/rd.y;', '}else{if(diagnostic>0){frag=vec4(0);return;}float g=(-1.55-ro.y)/rd.y;')
s=s.replace('let frames=0;','let frames=0;let diagnosticMode=0;window.woodDiagnostic=(mode,distance)=>{diagnosticMode=mode;if(distance)dist=distance;render()};')
s=s.replace('gl.drawArrays(gl.TRIANGLES,0,3);',"gl.uniform1i(gl.getUniformLocation(program,'diagnostic'),diagnosticMode);gl.disable(gl.DITHER);gl.drawArrays(gl.TRIANGLES,0,3);")
html=evidence/'diagnostic.html';html.write_text(s)
result={'baseline_sha256':sha,'instrumented_sha256':hashlib.sha256(s.encode()).hexdigest(),'encoding':'RGBA8 raw linear, no display tone/gamma; normalized quantization +/-0.5/255. ff encoded /4 saturated at4, bump normal delta x10; alpha object mask, eroded2px. Derivatives inside hit branch remain approximate.','cases':[],'errors':[]}
read='''()=>{const c=document.querySelector('canvas'),g=c.getContext('webgl2'),w=c.width,h=c.height,a=new Uint8Array(w*h*4);g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,a);let values=[[],[],[]],n=0;for(let y=2;y<h-2;y++)for(let x=2;x<w-2;x++){let good=true;for(let j=-2;j<=2&&good;j++)for(let i=-2;i<=2;i++)if(a[((y+j)*w+x+i)*4+3]<254){good=false;break}if(good){n++;for(let k=0;k<3;k++)values[k].push(a[(y*w+x)*4+k]/255)}}return {w,h,n,error:g.getError(),channels:values.map(v=>{v.sort((a,b)=>a-b);return {mean:v.reduce((s,x)=>s+x,0)/v.length,p05:v[Math.floor(v.length*.05)],p50:v[Math.floor(v.length*.5)],p95:v[Math.floor(v.length*.95)],below_01:v.filter(x=>x<.1).length/v.length,below_05:v.filter(x=>x<.5).length/v.length,zero:v.filter(x=>x===0).length/v.length,saturated:v.filter(x=>x===1).length/v.length}})}}'''
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/opt/google/chrome/chrome',chromium_sandbox=True,ignore_default_args=['--enable-unsafe-swiftshader','--no-sandbox','--unsafely-disable-devtools-self-xss-warnings','--disable-ipc-flooding-protection','--disable-client-side-phishing-detection'])
  args=browser.new_browser_cdp_session().send('Browser.getBrowserCommandLine')['arguments'];assert not any(a.split('=')[0] in ['--enable-unsafe-swiftshader','--no-sandbox','--disable-setuid-sandbox','--disable-web-security'] for a in args)
  result['browser']=browser.version;result['command']=args
  page=browser.new_page(viewport={'width':1280,'height':900});page.on('pageerror',lambda e:result['errors'].append(str(e)));page.goto(html.as_uri());page.wait_for_function('window.woodQA && woodQA.frames>0')
  result['gpu']=page.evaluate("()=>{let g=document.querySelector('canvas').getContext('webgl2'),e=g.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)}")
  for name,vp in [('desktop',{'width':1280,'height':900}),('mobile-viewport',{'width':390,'height':844})]:
   page.set_viewport_size(vp)
   for label,distance in [('near',5),('mid',8.8),('far',12)]:
    case={'viewport':name,'view':label,'distance':distance,'diagnostic':{}}
    for mode in [0,1,2,3]:
     frame=page.evaluate('woodQA.frames');page.evaluate('([m,d])=>woodDiagnostic(m,d)',[mode,distance]);page.wait_for_function('(f)=>woodQA.frames>f',arg=frame)
     if mode==0:page.screenshot(path=str(evidence/f'{name}-{label}-material.png'))
     else:
      data=page.evaluate(read);assert data['n']>100 and data['error']==0;case['diagnostic'][str(mode)]=data
      if mode==1:page.locator('canvas').screenshot(path=str(evidence/f'{name}-{label}-raw.png'))
    result['cases'].append(case)
  assert not result['errors'];result['status']='PASS_RAW_BUFFER_DIAGNOSTIC_NOT_VISUAL_APPROVAL';browser.close()
except Exception as e:result['failure']=str(e);raise
finally:(evidence/'result.json').write_text(json.dumps(result,indent=2))
