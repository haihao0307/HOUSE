"""Build an additive, self-contained Brick Mother studio from the retained V1.1 sources.
No frozen core files are changed. Renderer and worker are embedded in one HTML.
"""
from pathlib import Path
import hashlib,json,sys,re
ROOT=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/mnt/data/bm_delivery/site')
VER='1.2.0-alpha.9'
CORE='7b10389cb9367f7423619262820883cc94b07a61'
def blob(data): return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
assert blob((ROOT/'brick-mother-standalone-v2.7.5.html').read_bytes())==CORE
runtime=(ROOT/'brick-mother-realtime-weathering-pbr-v1.1.js').read_text()
page=(ROOT/'brick-mother-realtime-weathering-pbr-v1.1.0.html').read_text()
css=(ROOT/'brick-mother-realtime-weathering-pbr-v1.1.css').read_text()
def replace(old,new):
 global runtime
 assert old in runtime, old[:100]
 runtime=runtime.replace(old,new)
def function(name,code):
 global runtime
 start=runtime.index('function '+name+'(')
 brace=runtime.index('{',start); level=1;end=brace+1
 while level:
  if runtime[end]=='{':level+=1
  elif runtime[end]=='}':level-=1
  end+=1
 runtime=runtime[:start]+code+runtime[end:]
replace("const Geometry=window.BrickMotherWeatheringGeometryV11;","const Geometry={worker:true};")
replace('preserveDrawingBuffer:true','preserveDrawingBuffer:false')
replace("'1.1.0-alpha.3'",repr(VER))
replace('idx.push(top,tr+i,tr+i+1);idx.push(bot,i+1,i);','idx.push(top,tr+i+1,tr+i);idx.push(bot,i,i+1);')
function('makeBeveledCylinder',r'''function makeBeveledCylinder(radius,height,segments=72,bevel=.055){
 const pos=[],nor=[],idx=[],rings=[[0,radius-bevel,-.7],[bevel,radius,0],[height-bevel,radius,0],[height,radius-bevel,.7]];
 for(const [y,r,ny] of rings)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,c=Math.cos(a),s=Math.sin(a),l=Math.hypot(1,ny);pos.push(c*r,y,s*r);nor.push(c/l,ny/l,s/l);}
 for(let j=0;j<3;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;idx.push(a,c,b,b,c,d);}
 for(const top of [false,true]){const center=pos.length/3;pos.push(0,top?height:0,0);nor.push(0,top?1:-1,0);const first=pos.length/3;for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;pos.push(Math.cos(a)*(radius-bevel),top?height:0,Math.sin(a)*(radius-bevel));nor.push(0,top?1:-1,0);}for(let i=0;i<segments;i++)if(top)idx.push(center,first+i+1,first+i);else idx.push(center,first+i,first+i+1);}
 return {positions:new Float32Array(pos),normals:new Float32Array(nor),indices:new Uint32Array(idx)};
}''')
runtime=re.sub(r'^fixed.push\(object\(gpuGeometry\(makeAnnulus.*\n','',runtime,flags=re.M)
replace('for(int x=-2;x<=2;x++)for(int y=-2;y<=2;y++)','for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)')
replace('return sum/25.0;','return sum/9.0;')
start=runtime.index('void deriveMaterial('); end=runtime.index('\nvoid main(){',start)
runtime=runtime[:start]+r'''
void deriveMaterial(vec3 p,vec3 N,out vec3 baseRaw,out float rough,out float heightLow,out float heightHigh,out float ao,out float cavity,out float runoff,out float fracture,out float wetness,out float deposit,out float saltMask,out float bioMask,out float abrasion,out float safeMask,out float slopeSignal,out float contactSignal){
 vec3 q=p+vec3(uSeed*.013,uSeed*.007,uSeed*.019);
 float broad=valueNoise(q*.88),patch=valueNoise(q*2.8+vec3(6.2,1.8,9.4));
 vec3 warp=vec3(valueNoise(q*1.1+8.0),valueNoise(q*.9+3.0),valueNoise(q*1.2-4.0));
 vec3 s=q+warp*.19;
 float meso=valueNoise(s*9.0),grain=valueNoise(s*37.0),micro=valueNoise(s*91.0);
 float grainGate=smoothstep(.24,.65,patch),pit=smoothstep(.63,.87,meso)*smoothstep(.36,.62,broad);
 float edge=saturate(vSurface.z),event=saturate(vSurface.w),broken=smoothstep(2.55,3.15,vSurface.x);
 float up=smoothstep(.1,.86,N.y),side=1.0-smoothstep(.38,.88,abs(N.y));
 contactSignal=exp(-max(p.y,0.0)*max(p.y,0.0)*35.0);
 slopeSignal=sqrt(max(0.0,1.0-N.y*N.y));
 cavity=saturate(pit*.48+event*.24+contactSignal*.32);
 float line=1.0-smoothstep(.012,.055,abs(valueNoise(s*vec3(2.1,.75,2.4))-.50));
 fracture=saturate(broken*(.22+event*.52)+line*smoothstep(.6,.8,patch)*.35);
 float paths=smoothstep(.57,.79,valueNoise(s*vec3(5.2,.30,5.4)));
 runoff=saturate(paths*side*uRain+fracture*.13*uRain);
 wetness=saturate(uWetGlobal*(.22*up+.45*cavity+.60*runoff)+uRetainedGlobal*(.32*contactSignal+.2*cavity));
 deposit=saturate(uDepositGlobal*(.48*up+.32*cavity+.40*contactSignal)*(1.0-runoff*.7));
 saltMask=saturate(uSaltGlobal*(.40*cavity+.35*contactSignal)*uDrying);
 bioMask=saturate(uBioGlobal*(.30*cavity+.22*contactSignal)*uRetainedGlobal);
 abrasion=saturate(uAbrasionGlobal*edge*(1.0-uHardness*.6));
 vec3 dark,mid,pale,oxide;
 if(uFamily==0){dark=vec3(.30,.155,.105);mid=vec3(.58,.275,.175);pale=vec3(.73,.47,.32);oxide=vec3(.38,.35,.31);}
 else if(uFamily==1){dark=vec3(.32,.255,.17);mid=vec3(.60,.475,.31);pale=vec3(.78,.68,.49);oxide=vec3(.44,.405,.32);}
 else if(uFamily==4){dark=vec3(.255,.275,.29);mid=vec3(.43,.46,.47);pale=vec3(.64,.65,.61);oxide=vec3(.46,.36,.265);}
 else {dark=vec3(.285,.30,.295);mid=vec3(.49,.50,.46);pale=vec3(.72,.69,.60);oxide=vec3(.53,.395,.265);}
 float zone=smoothstep(.19,.78,broad);
 baseRaw=mix(dark,mid,zone);baseRaw=mix(baseRaw,pale,smoothstep(.50,.8,patch)*.48);
 baseRaw=mix(baseRaw,oxide,smoothstep(.66,.88,broad)*smoothstep(.43,.70,patch)*.50);
 baseRaw*=mix(.86,1.13,meso);baseRaw=mix(baseRaw,pale,smoothstep(.73,.90,grain)*grainGate*.27);
 heightLow=(meso-.5)*.037+(patch-.5)*.018-pit*.018;
 heightHigh=(grain-.5)*.011*mix(.32,1.0,grainGate)+(micro-.5)*.003;
 if(uFamily==1){vec3 f=s*vec3(12.0,63.0,29.0);float fibers=smoothstep(.69,.86,valueNoise(f))*smoothstep(.48,.75,patch);baseRaw=mix(baseRaw,pale,fibers*.5);heightHigh+=fibers*.009;}
 if(uFamily==2){float chisel=smoothstep(.65,.86,valueNoise(s*vec3(20,7,16)))*side*(1.0-broken);heightLow-=chisel*.007;}
 if(uFamily==4){float seam=smoothstep(.66,.85,valueNoise(s*vec3(3,16,3)))*side*event; heightLow-=seam*.013; baseRaw=mix(baseRaw,dark,seam*.23);}
 if(uFamily==5){heightLow*=.35;heightHigh*=.5;}
 float fresh=broken*event*exp(-uAge/55.0);baseRaw=mix(baseRaw,pale,fresh*.24);
 baseRaw=mix(baseRaw,baseRaw*mix(.77,.88,1.0-uPorosity),wetness);
 baseRaw=mix(baseRaw,mix(mid,pale,.6),deposit*.38);baseRaw=mix(baseRaw,vec3(.82,.81,.76),saltMask*.55);
 baseRaw=mix(baseRaw,vec3(.25,.31,.19),bioMask*.55);
 rough=clamp(uBaseRoughness+(grain-.5)*.12+pit*.08+deposit*.10-wetness*.12-abrasion*.06,uFamily==5?.42:.64,.98);
 ao=clamp(1.0-cavity*.25-contactSignal*.12,.60,1.0);
 baseRaw=pbrSafeAlbedo(baseRaw*(.97+uTint*.09),safeMask);
}
''' + runtime[end:]
replace("else if(uKind==1){float n=fbm4(vLocal*4.6+vec3(uSeed*.01));base=srgbToLinear(mix(vec3(.018,.023,.026),vec3(.058,.064,.067),n));rough=.30;ao=.94;}","else if(uKind==1){base=srgbToLinear(vec3(.42,.435,.45));rough=.94;ao=1.0;}")
replace('vec3 bg=mix(vec3(.006,.009,.014),vec3(.031,.034,.036),g)+n*.0018;','vec3 bg=mix(vec3(.10,.117,.137),vec3(.22,.235,.245),g);')
replace('float wetFilm=saturate(wetness*.88),roughEff=mix(rough,max(.075,rough*.30),wetFilm);','float wetFilm=smoothstep(.72,1.0,wetness)*.35,roughEff=mix(rough,max(.38,rough*.8),wetFilm);')
replace('col+=uRimColor*grazing*uRimIntensity*.035;col+=vec3(.12,.075,.030)*uSelected*.014;','')
replace("playing:true,simSpeed:1", "playing:false,simSpeed:1")
replace('rain:.38,drying:.42','rain:.08,drying:.60')
replace('wet:.12,retained:.10','wet:.02,retained:.02')
replace('rough:.78','rough:.88')
replace('rough:.50','rough:.64')
replace('fillDir=norm([-keyDir[0]*.75,.34,-keyDir[2]*.75]),rimDir=norm([keyDir[2]*.82,.54,-keyDir[0]*.82])','fillDir=norm([.72,.46,.62]),rimDir=norm([-.4,.70,-.7])')
a=runtime.index('const lights={');b=runtime.index('\nlet lightVP=',a)
runtime=runtime[:a]+"""const lights={
 studio:{key:[1,.96,.91,3.1],fill:[.92,.96,1,2.20],rim:[1,.98,.95,2.0],sky:[.25,.28,.31],ground:[.095,.09,.085],ambient:1.55,exposure:1.06,height:7.5},
 neutral:{key:[1,1,1,2.7],fill:[1,1,1,2.1],rim:[1,1,1,1.4],sky:[.27,.27,.27],ground:[.1,.1,.1],ambient:1.45,exposure:1.0,height:8},
 raking:{key:[1,.97,.92,3.6],fill:[.90,.95,1,1.4],rim:[1,.97,.91,1.5],sky:[.21,.23,.25],ground:[.07,.07,.07],ambient:1.35,exposure:1.03,height:2.4},
 overcast:{key:[.95,.97,1,2.1],fill:[.96,.98,1,1.9],rim:[1,1,1,1],sky:[.29,.30,.32],ground:[.1,.11,.12],ambient:1.7,exposure:1,height:12},
 outdoor:{key:[1,.94,.83,3.8],fill:[.78,.87,1,1.7],rim:[.88,.94,1,1.5],sky:[.22,.27,.35],ground:[.1,.09,.075],ambient:1.45,exposure:1.05,height:11}};"""+runtime[b:]
a=runtime.index('async function rebuildStones(');b=runtime.index('\nfunction scheduleRebuild',a)
runtime=runtime[:a]+r'''
let meshWorker=null;
function rebuildStones(initial=false){
 const token=++rebuildToken;clearTimeout(rebuildTimer);if(meshWorker)meshWorker.terminate();
 const f=state.family,baseSeed=state.seed,config={...state},current=stones.slice();
 document.documentElement.dataset.workbenchReady='false';document.documentElement.dataset.building='true';
 $('#runtimeLabel').textContent='细化形体';setProgress(.1,'生成程序化形体');
 const source=document.getElementById('geometryWorkerSource').textContent;
 const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));meshWorker=new Worker(url);URL.revokeObjectURL(url);
 const rots=[[0,-.34,0],[0,.38,0],[0,-.54,0],[0,.66,0]],scales=[1,.43,.39,.45];
 meshWorker.onmessage=e=>{
  if(token!==rebuildToken)return;const {data,index,phase,error,elapsed}=e.data;
  if(error){fail('形体工作线程错误',new Error(error));return;}
  const o=object(gpuGeometry(data),index===0?[-.42,floorY+.35,0]:[miniPos[index-1][0],floorY+miniHeights[index-1]+.012,miniPos[index-1][1]],rots[index],[1,1,1],0,{family:f,seed:baseSeed+index*1067,selected:index===0?1:0,objectScale:scales[index],tint:index===0?.02:(index-2)*.15,ageOffset:index*9,weatherScale:1});
  if(index===0&&phase==='preview'){for(const old of current)destroyGeometry(old.geo);stones=[o];}
  else{if(stones[index])destroyGeometry(stones[index].geo);stones[index]=o;}
  stones=stones.filter(Boolean);shadowDirty=true;invalidate();
  triangleTotal=stones.reduce((s,x)=>s+x.geo.triangles,0);$('#triangleCount').textContent=Math.round(triangleTotal).toLocaleString()+' TRI';
  loading.classList.add('hidden');document.documentElement.dataset.visualReady='true';
  document.documentElement.dataset.runtimeVersion='1.2.0-alpha.9';document.documentElement.dataset.geometryWorker='true';
  if(!document.documentElement.dataset.firstMeshMs)document.documentElement.dataset.firstMeshMs=performance.now().toFixed(0);
  if(index===3){document.documentElement.dataset.workbenchReady='true';document.documentElement.dataset.building='false';document.documentElement.dataset.meshCount='4';document.documentElement.dataset.buildMs=elapsed.toFixed(0);$('#runtimeLabel').textContent=state.playing?'实时演化':'观察模式';meshWorker.terminate();meshWorker=null;}
 };
 meshWorker.onerror=e=>fail('形体线程未能启动',new Error(e.message));
 meshWorker.postMessage({family:f,seed:baseSeed,controls:config,mobile:innerWidth<760});
}
''' +runtime[b:]
a=runtime.index('let last=performance.now()');b=runtime.index('\nfunction rangeFill',a)
runtime=runtime[:a]+r'''
let last=performance.now(),lastUi=0,renderCount=0,pendingFrame=0,renderScale=1;
let frameTimes=[],fpsFrames=0,fpsTime=last;
function resize(){const dpr=Math.min(devicePixelRatio||1,1.25),budget=innerWidth<760?650000:1300000,scale=Math.min(dpr,Math.sqrt(budget/(innerWidth*innerHeight)))*renderScale;const w=Math.max(2,Math.round(innerWidth*scale)),h=Math.max(2,Math.round(innerHeight*scale));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;shadowDirty=true;}document.documentElement.dataset.renderScale=scale.toFixed(2);}
function invalidate(){if(!pendingFrame&&!document.hidden)pendingFrame=requestAnimationFrame(animate);}
function animate(now){pendingFrame=0;const dt=Math.min(.06,Math.max(.001,(now-last)/1000));last=now;resize();updateWeather(dt);if(state.auto)camera.goalYaw+=dt*.17;const k=1-Math.exp(-dt*12);camera.yaw=mix(camera.yaw,camera.goalYaw,k);camera.pitch=mix(camera.pitch,camera.goalPitch,k);camera.radius=mix(camera.radius,camera.goalRadius,k);camera.target=lerp3(camera.target,camera.goalTarget,k);updateLight();const eye=cameraEye(),vp=mat4Multiply(mat4Perspective(35*Math.PI/180,canvas.width/canvas.height,.05,60),mat4LookAt(eye,camera.target,[0,1,0]));if(shadowDirty){renderShadow();shadowDirty=false;}renderMain(vp,eye);renderCount++;document.documentElement.dataset.renderCount=String(renderCount);if(now-lastUi>250){updateStateUI();lastUi=now;}
 const moving=Math.abs(camera.yaw-camera.goalYaw)+Math.abs(camera.pitch-camera.goalPitch)+Math.abs(camera.radius-camera.goalRadius)+length3(sub(camera.target,camera.goalTarget))>.001;
 if(moving||state.auto||state.playing){frameTimes.push(dt*1000);if(frameTimes.length>24){const avg=frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length;if(avg>45&&renderScale>.62){renderScale=Math.max(.62,renderScale*.9);}frameTimes=[];}fpsFrames++;if(now-fpsTime>1200){$('#fpsLabel').textContent=Math.round(fpsFrames*1000/(now-fpsTime))+' FPS';fpsTime=now;fpsFrames=0;}if(state.playing&&!moving&&!state.auto)setTimeout(invalidate,32);else invalidate();}
 else{$('#fpsLabel').textContent='静止节能';fpsTime=now;fpsFrames=0;}
}
window.addEventListener('resize',invalidate);document.addEventListener('visibilitychange',()=>{last=performance.now();invalidate();});
for(const ev of ['input','change','click','keydown'])document.addEventListener(ev,()=>setTimeout(invalidate,0));
const touches=new Map();let gesture=null;
canvas.addEventListener('contextmenu',e=>e.preventDefault());
function touchPair(){const a=[...touches.values()];return a.length<2?null:{x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2,d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)};}
function pan(dx,dy){const forward=norm(sub(camera.target,cameraEye())),right=norm(cross(forward,[0,1,0])),up=norm(cross(right,forward)),k=camera.radius*.0014;camera.goalTarget=add(camera.goalTarget,add(muls(right,-dx*k),muls(up,dy*k)));}
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);touches.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,drag:false,multi:touches.size>0,pan:e.button===2||e.shiftKey});if(touches.size>1)for(const p of touches.values())p.multi=true;gesture=touchPair();});
canvas.addEventListener('pointermove',e=>{const p=touches.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;p.drag ||=Math.hypot(p.x-p.sx,p.y-p.sy)>6;const pair=touchPair();if(pair&&gesture){camera.goalRadius=clamp(camera.goalRadius*gesture.d/Math.max(pair.d,5),2.2,18);pan(pair.x-gesture.x,pair.y-gesture.y);gesture=pair;}else if(p.pan)pan(dx,dy);else{camera.goalYaw-=dx*.006;camera.goalPitch=clamp(camera.goalPitch+dy*.005,-.35,1.35);}invalidate();});
canvas.addEventListener('pointerup',e=>{const p=touches.get(e.pointerId);touches.delete(e.pointerId);gesture=touchPair();if(p&&!p.drag&&!p.multi)window.dispatchEvent(new Event('studio-tap'));});
canvas.addEventListener('pointercancel',e=>{touches.delete(e.pointerId);gesture=touchPair();});
canvas.addEventListener('wheel',e=>{e.preventDefault();camera.goalRadius=clamp(camera.goalRadius*Math.exp(e.deltaY*.001),2.2,18);invalidate();},{passive:false});
window.addEventListener('keydown',e=>{if(e.target.matches('input'))return;if(e.key.toLowerCase()==='r')resetCamera();if(e.code==='Space'){e.preventDefault();togglePlay();}});
''' +runtime[b:]
replace("loading.classList.remove('hidden');setProgress(.02,'SWITCHING MATERIAL FAMILY');","setProgress(.02,'SWITCHING MATERIAL FAMILY');")
replace("loading.classList.remove('hidden');setProgress(.02,'DERIVING NEW MATERIAL DNA');","setProgress(.02,'DERIVING NEW MATERIAL DNA');")
replace("bindRange('relief','relief','reliefOut');","bindRange('relief','relief','reliefOut',{rebuild:true});")
replace('rebuildStones(true);requestAnimationFrame(animate);',"$('#playPause').textContent='继续演化';rebuildStones(true);invalidate();")
replace("if(params.has('age'))", "if(params.has('seed'))state.seed=clamp(Number(params.get('seed'))||5045,1,999983);if(params.has('age'))")
runtime=runtime.replace("sourceBasis:['The PBR Guide, Third Edition, 2018'", "calibratedWeathering:false,renderer:'WebGL2',sourceBasis:['The PBR Guide, Third Edition, 2018'")
runtime=runtime.replace("window.__BRICK_MOTHER_WEATHERING_PBR__={", "window.__BRICK_MOTHER_WEATHERING_PBR__={invalidate,camera,")
worker='const window=self;\n'+(ROOT/'brick-mother-stone-form-geometry-v3.5.js').read_text()+'\n'+(ROOT/'brick-mother-weathering-geometry-v1.1.js').read_text()+r'''
function n3(x,y,z,seed){const h=(a,b,c)=>{let v=Math.imul(a,374761393)^Math.imul(b,668265263)^Math.imul(c,2147483647)^seed;v=Math.imul(v^(v>>>13),1274126177);return ((v^(v>>>16))>>>0)/4294967295;};const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let a=x-ix,b=y-iy,c=z-iz;a=a*a*(3-2*a);b=b*b*(3-2*b);c=c*c*(3-2*c);const m=(a,b,t)=>a+(b-a)*t;return m(m(m(h(ix,iy,iz),h(ix+1,iy,iz),a),m(h(ix,iy+1,iz),h(ix+1,iy+1,iz),a),b),m(m(h(ix,iy,iz+1),h(ix+1,iy,iz+1),a),m(h(ix,iy+1,iz+1),h(ix+1,iy+1,iz+1),a),b),c);}
function detailMesh(d,seed,family,controls,scale){const p=d.positions,n=d.normals,s=d.surface,amp=(family===5?.004:.023)*controls.relief*scale;
 const height=(x,y,z)=>{x/=scale;y/=scale;z/=scale;const broad=n3(x*3.2,y*3.2,z*3.2,seed),grain=n3(x*14,y*14,z*14,seed+113),pit=Math.max(0,grain-.66);return amp*((broad-.5)*1.1+(grain-.5)*.45-pit*1.6);};const eps=.003*scale;
 for(let i=0;i<p.length;i+=3){let x=p[i],y=p[i+1],z=p[i+2];const gate=Math.min(1,Math.max(0,y/(scale*.09))),h=height(x,y,z)*gate,nx=n[i],ny=n[i+1],nz=n[i+2];p[i]+=nx*h;p[i+1]+=ny*h;p[i+2]+=nz*h;const gx=(height(x+eps,y,z)-height(x-eps,y,z))/(2*eps)*gate,gy=(height(x,y+eps,z)-height(x,y-eps,z))/(2*eps)*gate,gz=(height(x,y,z+eps)-height(x,y,z-eps))/(2*eps)*gate,dot=gx*nx+gy*ny+gz*nz;let ax=nx-gx+dot*nx,ay=ny-gy+dot*ny,az=nz-gz+dot*nz,len=Math.hypot(ax,ay,az);n[i]=ax/len;n[i+1]=ay/len;n[i+2]=az/len;}
 let low=Infinity;for(let i=1;i<p.length;i+=3)low=Math.min(low,p[i]);for(let i=1;i<p.length;i+=3)p[i]-=low;return d;}
self.onmessage=e=>{const start=performance.now(),{family,seed,controls,mobile}=e.data;
 try{for(const [index,quality,phase] of [[0,.36,'preview'],[0,mobile?.58:.72,'detail'],[1,.40,'detail'],[2,.40,'detail'],[3,.40,'detail']]){
  const scale=[1,.43,.39,.45][index],actualSeed=seed+index*1067;let d=window.BrickMotherWeatheringGeometryV11.buildMesh(family,actualSeed,controls,quality,scale);d=detailMesh(d,actualSeed,family,controls,scale);
  const data={positions:d.positions,normals:d.normals,surface:d.surface,sourceGrammar:d.sourceGrammar||d.meta?.grammar||'StoneV35'};if(d.indices)data.indices=d.indices;
  const transfer=Object.values(data).filter(a=>ArrayBuffer.isView(a)).map(a=>a.buffer);self.postMessage({data,index,phase,elapsed:performance.now()-start},transfer);
 }}catch(e){self.postMessage({error:String(e.stack||e)});}};
'''
app=r'''
(()=>{const body=document.body;let timer=0,held=false,installEvent=null;
 function hide(){if(held)return;body.classList.add('immersive');body.classList.remove('left-open','right-open');body.dataset.immersive='true';}
 function wake(){body.classList.remove('immersive');body.dataset.immersive='false';clearTimeout(timer);timer=setTimeout(hide,5500);}
 document.addEventListener('pointerdown',e=>{if(e.target.closest('.control-panel,.family-rail,.appbar,.viewbar,.lightbar')){held=true;wake();}});
 document.addEventListener('pointerup',()=>{held=false;});document.addEventListener('input',wake);
 window.addEventListener('studio-tap',()=>{if(body.classList.contains('immersive'))wake();else hide();});
 document.getElementById('showMaterials').onclick=()=>{wake();body.classList.toggle('left-open');body.classList.remove('right-open');};
 document.getElementById('showControls').onclick=()=>{wake();body.classList.toggle('right-open');body.classList.remove('left-open');};
 document.getElementById('hidePanels').onclick=hide;
 document.getElementById('fullScreen').onclick=async()=>{wake();try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen({navigationUI:'hide'});else throw Error('unsupported');}catch(e){document.getElementById('appNotice').textContent='此浏览器请使用菜单中的全屏或添加到主屏幕';}};
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;document.getElementById('installApp').hidden=false;});
 document.getElementById('installApp').onclick=async()=>{if(installEvent){await installEvent.prompt();installEvent=null;}};
 document.addEventListener('keydown',e=>{if(e.key==='Tab')wake();if(e.key==='Escape')hide();if(e.key.toLowerCase()==='h')body.classList.contains('immersive')?wake():hide();});
 document.getElementById('controls').appendChild(document.querySelector('.diagnostic-bar'));
 document.getElementById('controls').appendChild(document.querySelector('.state-card'));
 for(const b of document.querySelectorAll('.family-btn'))b.addEventListener('click',()=>{body.classList.remove('left-open');wake();});
 if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./studio-sw.js',{scope:'./'}).catch(()=>{});
 wake();
})();
'''
css+=r'''
:root{--panel:rgba(27,33,39,.94);--soft:#b1bbc2;--muted:#d0d8de;--text:#f6f7f8;--accent:#dfb789}
body{background:#6d7a86}.vignette,.grain,.graph,.topbar,.hint,.panel-toggle{display:none!important}
.appbar{position:fixed;top:max(18px,env(safe-area-inset-top));left:24px;right:24px;display:flex;align-items:center;justify-content:space-between;gap:12px;z-index:10;transition:opacity .28s,transform .28s}.app-brand{color:#f6f8fa;font-size:15px;letter-spacing:.15em;text-shadow:0 1px 5px #243341}.app-brand small{display:block;font-size:10px;letter-spacing:.1em;opacity:.85;margin-top:6px}.app-actions{display:flex;gap:7px;align-items:center}.app-actions button,.app-actions a{font:12px/1.2 system-ui;padding:12px 15px;border:1px solid #ffffff32;background:#26313cd9;border-radius:12px;color:#fff;text-decoration:none;cursor:pointer}.app-actions button[hidden]{display:none}
.family-rail{top:85px;bottom:auto;left:20px;right:auto;width:230px;display:block;overflow:auto;max-height:calc(100dvh - 115px);transform:translateX(-280px);transition:transform .3s;box-shadow:0 14px 45px #20303d30}.family-btn{min-width:0;min-height:58px}.family-btn b{font-size:13px}.family-btn small{display:block;font-size:10px}.rail-title{display:block;font-size:10px;color:#b1bbc2}.left-open .family-rail{transform:translateX(0)}
.control-panel{top:85px;right:20px;width:290px;max-height:calc(100dvh - 112px);padding:19px;transform:translateX(340px);transition:transform .3s;scrollbar-width:thin}.right-open .control-panel{transform:translateX(0)}.panel-head strong{font-size:14px}.control label{font-size:12px}.control output{font-size:11px}.action,.preset{font-size:11px;height:36px}.control{margin-top:16px}input[type=range]{height:5px;margin:8px 0}input[type=range]::-webkit-slider-thumb{width:20px;height:20px}summary{font-size:12px;padding:4px 0}.seed-box b{font-size:12px}
.diagnostic-bar{position:static;display:flex;flex-wrap:wrap;transform:none;max-width:none;width:auto;margin-top:16px;backdrop-filter:none}.diag{font-size:10px;padding:9px}.state-card{position:static;display:block;width:auto;margin-top:14px;backdrop-filter:none}.state-card .state-rule{font-size:10px}.state-foot{font-size:10px}.state-foot:before{content:'演示参数，未做实测标定';display:block}.state-head strong{font-size:12px}
.viewbar{left:24px;right:auto;bottom:24px;transform:none;transition:opacity .28s,transform .28s}.lightbar{right:24px;bottom:24px;transition:opacity .28s,transform .28s}.view-btn,.light-btn{font-size:11px;padding:11px}.lightbar .light-btn:nth-child(n+4){display:block}
#appNotice{position:fixed;left:0;right:0;bottom:80px;text-align:center;color:white;font-size:12px;pointer-events:none;z-index:8}
.immersive .appbar,.immersive .viewbar,.immersive .lightbar{opacity:0;pointer-events:none;transform:translateY(-12px)}.immersive .viewbar,.immersive .lightbar{transform:translateY(20px)}.immersive #appNotice{opacity:0}
.loading{background:#7c8791}.loader{color:#fff}.error{background:#25323f}
@media(max-width:760px){.appbar{top:12px;left:12px;right:12px}.app-brand{font-size:12px}.app-brand small{font-size:8px}.app-actions{gap:4px}.app-actions button,.app-actions a{padding:10px;font-size:11px}.app-actions a,#hidePanels{display:none}.control-panel{right:10px;top:65px;width:min(285px,calc(100vw - 35px));max-height:calc(100dvh - 90px)}.family-rail{top:65px;left:10px;width:220px}.viewbar{left:10px;bottom:12px;max-width:calc(100vw - 20px);overflow:auto}.lightbar{right:10px;bottom:64px}.view-btn,.light-btn{padding:10px;font-size:10px}.lightbar .light-btn:nth-child(n+4){display:block}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
'''
page=re.sub(r'<link rel="stylesheet"[^>]+>', '<style>'+css+'</style>',page)
page=re.sub(r'<script src="[^"]+"></script>', '',page)
page=page.replace('V1.1','V1.2').replace('· V1.1','· V1.2')
page=page.replace('<title>Brick Mother 实时风化 PBR 工作台 V1.2</title>','<title>Brick Mother 材质展示</title>\n<meta name="theme-color" content="#354352">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<link rel="manifest" href="./studio.webmanifest">')
bar='''<header class="appbar"><div class="app-brand">BRICK MOTHER<small>MATERIAL STUDIO / 1.2</small></div><div class="app-actions"><button id="showMaterials">材质</button><button id="showControls">参数</button><button id="hidePanels">沉浸</button><button id="fullScreen">全屏展示</button><button id="installApp" hidden>安装应用</button><a href="./workbench.html#core">原核心</a></div></header><div id="appNotice"></div>'''
page=page.replace('<body>','<body>'+bar)
page=page.replace('</body>', '<script id="geometryWorkerSource" type="text/plain">'+worker+'</script>\n<script>'+runtime+'</script>\n<script>'+app+'</script>\n</body>')
(ROOT/'studio.html').write_text(page)
(ROOT/'studio.webmanifest').write_text(json.dumps({'name':'Brick Mother 材质展示','short_name':'Brick Mother','id':'./studio.html','start_url':'./studio.html','scope':'./','display':'standalone','background_color':'#7c8791','theme_color':'#354352','icons':[{'src':'./studio-icon.svg','sizes':'any','type':'image/svg+xml','purpose':'any'}]},ensure_ascii=False,indent=2))
(ROOT/'studio-icon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#354352"/><path d="M116 182h280v148H116zM116 256h280M256 182v74M200 256v74M330 256v74" fill="none" stroke="#dfb789" stroke-width="18" stroke-linejoin="round"/></svg>')
(ROOT/'studio-sw.js').write_text("""const CACHE='brick-studio-1.2-a9';const ROOT=new URL('./',self.location).href;const FILES=['studio.html','studio.webmanifest','studio-icon.svg'];self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(p=>new URL(p,ROOT).href))).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('brick-studio-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||!FILES.some(p=>u.origin+u.pathname===new URL(p,ROOT).href))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(k=>k.put(u.origin+u.pathname,c));}return r;}).catch(()=>caches.match(u.origin+u.pathname)));});""")
p=ROOT/'workbench.html';s=p.read_text()
s=s.replace('brick-mother-realtime-weathering-pbr-v1.1.0.html?v=20260902-pbr-v11a3','studio.html?v=12a9')
s=s.replace('brick-mother-stone-masonry-v2.8.0-alpha.html?v=20260902-runtime-fix','studio.html?family=3&v=12a9')
s=s.replace('PBR 实时风化</button>','PBR 实时风化 V1.2</button>')
s=s.replace(' src="./brick-mother-standalone-v2.7.5.html?', ' data-src="./brick-mother-standalone-v2.7.5.html?')
s=s.replace("panels.forEach(p=>p.classList.toggle('on',p===panel));", "panels.forEach(p=>{p.classList.toggle('on',p===panel);if(p!==panel){const f=p.querySelector('iframe');if(f.hasAttribute('src'))f.removeAttribute('src');}});")
s=s.replace("if(!frame.src) frame.src=frame.dataset.src;", "if(!frame.hasAttribute('src')) frame.src=frame.dataset.src;")
s=s.replace("weatheringRuntime:'1.1.0-alpha.3'","weatheringRuntime:'1.2.0-alpha.9'")
p.write_text(s)
manifest={'runtimeVersion':VER,'entry':'studio.html','selfContained':True,'preservedCoreBlob':CORE,'sourceBaseline':'V1.1 at 2249dbb48a7f825afd044bf8518d88109abf94c4','sourceBasis':[{'source':'The PBR Guide, third edition 2018','pages':[38,39,48,51,59,60,74,75,76,78],'adopted':'linear lighting; sRGB base color; GGX dielectric; roughness variability; independent AO; height versus normal'},{'source':'Project-specific changes','adopted':'worker, bright studio light, side drawers, non-periodic field operators','notFromPBRGuide':True}],'weatheringCalibration':'illustrative_not_calibrated','runtimeRenderer':'WebGL2 procedural','webgpuRuntime':False,'files':{},'visualApproved':False,'productionApproved':False}
for name in ['studio.html','studio.webmanifest','studio-sw.js','studio-icon.svg','workbench.html']:
 data=(ROOT/name).read_bytes();manifest['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
(ROOT/'STUDIO_BUILD.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
assert blob((ROOT/'brick-mother-standalone-v2.7.5.html').read_bytes())==CORE
print(json.dumps({name:info['bytes'] for name,info in manifest['files'].items()}))
