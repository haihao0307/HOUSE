const $ = (q, root=document) => root.querySelector(q);
const $$ = (q, root=document) => [...root.querySelectorAll(q)];
const clamp = (v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp = (a,b,t)=>a+(b-a)*t;
const smooth01 = t=>{t=clamp(t);return t*t*(3-2*t);};
const smooth = (a,b,x)=>smooth01((x-a)/Math.max(1e-9,b-a));
const fract = x=>x-Math.floor(x);
const hash32 = n => { n=Math.imul(n^(n>>>16),0x7feb352d); n=Math.imul(n^(n>>>15),0x846ca68b); return (n^(n>>>16))>>>0; };
const hash01 = (...v)=>{let h=2166136261;for(const n of v){h^=(Number(n)>>>0);h=Math.imul(h,16777619);}return hash32(h)/4294967295;};
function noise2(x,y,seed=0){const xi=Math.floor(x),yi=Math.floor(y),tx=smooth01(x-xi),ty=smooth01(y-yi);const h=(a,b)=>hash01(a,b,seed);return lerp(lerp(h(xi,yi),h(xi+1,yi),tx),lerp(h(xi,yi+1),h(xi+1,yi+1),tx),ty);}
function fbm(x,y,seed=0,oct=5){let v=0,a=.54,f=1,n=0;for(let i=0;i<oct;i++){v+=noise2(x*f,y*f,seed+i*1709)*a;n+=a;a*=.49;f*=2.03;}return v/n;}

const threeText = atob(document.getElementById('three-b64').textContent.trim());
const THREE = new Function(`${threeText}\nreturn TilesReferenceRuntime;`)();
if (!THREE || typeof THREE.WebGLRenderer !== 'function') throw new Error('内置 Three.js 运行时没有正确初始化');

const PROFILE = Object.freeze({
  pan: Object.freeze({name:'板瓦',length:.238,widthEave:.242,widthRidge:.221,riseEave:.050,riseRidge:.047,thickness:.012,effectiveStep:.198}),
  cover: Object.freeze({name:'筒瓦',length:.222,widthEave:.115,widthRidge:.090,riseEave:.037,riseRidge:.035,thickness:.010,effectiveStep:.198})
});
const PALETTE = Object.freeze([
  {hex:'#4d565b',weight:28,name:'讲武堂深蓝灰'},
  {hex:'#5b6669',weight:25,name:'旧瓦青蓝灰'},
  {hex:'#6b6f6d',weight:18,name:'烟灰中间色'},
  {hex:'#77746c',weight:11,name:'风化暖灰'},
  {hex:'#826d59',weight:7,name:'窑变暖褐'},
  {hex:'#92775b',weight:3,name:'局部土赭'},
  {hex:'#aaa79b',weight:6,name:'雨洗返白'},
  {hex:'#754438',weight:2,name:'少量铁红'}
]);
const FACE = Object.freeze(['top','bottom','left','right','eave','ridge']);
const FACE_LABEL = Object.freeze({top:'外表面',bottom:'内表面',left:'左侧边',right:'右侧边',eave:'出檐端',ridge:'迎水端'});

const state={geometryRevision:1,surfaceRevision:1,edgeStrength:1,colorLayer:1,striations:.7,focusSingle:false,showContacts:false,timberOnly:false,scene:'trio',trioFamily:'pan',uvFamily:'both',year:25,care:'maintained',light:'neutral',mode:'material',seed:314159,autoRotate:false,selectedFace:'all',cameraSide:'iso'};
const canvas=$('#stage');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NeutralToneMapping||THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.08;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(36,1,.01,100);
const stageRoot=new THREE.Group();scene.add(stageRoot);
const ambient=new THREE.AmbientLight(0xffffff,.40);
const hemi=new THREE.HemisphereLight(0xf5efe5,0x4e4a46,1.20);
const key=new THREE.DirectionalLight(0xffefd7,2.55);key.position.set(-5.2,8.5,5.8);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=.00015;key.shadow.normalBias=.025;
const fill=new THREE.DirectionalLight(0xdce8ee,.88);fill.position.set(6,4,-4);
const rim=new THREE.DirectionalLight(0xffc893,.48);rim.position.set(-4,3,-7);
const underFill=new THREE.DirectionalLight(0xffead5,.25);underFill.position.set(2,-6,4);
scene.add(ambient,hemi,key,fill,rim,underFill);

function makeEnvironment(){
  const w=192,h=96,data=new Float32Array(w*h*4),lights=[[.4,.8,.3,2.8],[-.8,.25,-.15,1.0],[.3,.45,-.8,1.55]];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const v=(y+.5)/h,u=(x+.5)/w,phi=u*Math.PI*2,theta=v*Math.PI;
    const n=[-Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi)];let b=.10+.30*Math.max(0,n[1]);
    for(const d of lights){const L=Math.hypot(d[0],d[1],d[2]),dot=(n[0]*d[0]+n[1]*d[1]+n[2]*d[2])/L;b+=d[3]*Math.pow(Math.max(0,dot),24);}
    const i=(y*w+x)*4;data[i]=b;data[i+1]=b;data[i+2]=b*1.025;data[i+3]=1;
  }
  const tex=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);tex.mapping=THREE.EquirectangularReflectionMapping;tex.colorSpace=THREE.LinearSRGBColorSpace;tex.needsUpdate=true;
  const pm=new THREE.PMREMGenerator(renderer),target=pm.fromEquirectangular(tex);tex.dispose();pm.dispose();return target;
}
let envTarget=null;try{envTarget=makeEnvironment();scene.environment=envTarget.texture;}catch(e){console.warn('环境反射初始化降级',e);}

let yaw=-.62,pitch=.54,distance=2.35,target=new THREE.Vector3(0,0,0),drag=null,panMode=false,needsRender=true;
function updateCamera(){camera.position.set(target.x+distance*Math.cos(pitch)*Math.sin(yaw),target.y+distance*Math.sin(pitch),target.z+distance*Math.cos(pitch)*Math.cos(yaw));camera.lookAt(target);needsRender=true;}
function fitCamera(kind=state.scene,side=state.cameraSide){
  state.cameraSide=side;
  if(kind==='trio'){distance=2.20*Math.max(1,1.05/camera.aspect);target.set(0,-.01,0);yaw=-.70;pitch=side==='under'?-.46:.54;}
  if(kind==='forty8'){distance=3.00*Math.max(1,1.05/camera.aspect);target.set(0,.57,-.03);yaw=side==='under'?.76:-2.30;pitch=side==='under'?-.34:.62;}
  if(kind==='roof'){distance=7.30*Math.max(1,1.05/camera.aspect);target.set(0,1.15,-.11);yaw=side==='under'?.76:-2.30;pitch=side==='under'?-.31:.62;}
  if(kind==='uv'){distance=2.30;target.set(0,0,0);yaw=-.58;pitch=side==='under'?-.42:.48;}
  if((kind==='forty8'||kind==='roof')&&lastRoof?.roof){
    lastRoof.roof.updateWorldMatrix(true,true);
    const box=new THREE.Box3().setFromObject(lastRoof.roof),centre=box.getCenter(new THREE.Vector3());
    target.copy(centre);
    const n=new THREE.Vector3(Math.cos(pitch)*Math.sin(yaw),Math.sin(pitch),Math.cos(pitch)*Math.cos(yaw)),right=new THREE.Vector3(n.z,0,-n.x).normalize(),up=n.clone().cross(right).normalize();
    const tan=Math.tan(THREE.MathUtils.degToRad(camera.fov)*.5);let fit=0;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const d=new THREE.Vector3(x,y,z).sub(centre);fit=Math.max(fit,d.dot(n)+Math.max(Math.abs(d.dot(right))/(tan*camera.aspect),Math.abs(d.dot(up))/tan)*1.16);}
    distance=Math.max(.8,fit);
  }
  updateCamera();
}
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};panMode=e.button===2||e.shiftKey;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag={x:e.clientX,y:e.clientY};if(panMode){const s=distance*.00115;const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);target.addScaledVector(right,-dx*s);target.addScaledVector(up,dy*s);}else{yaw-=dx*.007;pitch=clamp(pitch+dy*.006,-1.38,1.38);}updateCamera();});
canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=clamp(distance*Math.exp(e.deltaY*.001),.30,24);updateCamera();},{passive:false});
canvas.addEventListener('dblclick',()=>fitCamera(state.scene,'iso'));
function resize(){const r=canvas.getBoundingClientRect(),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();needsRender=true;}
new ResizeObserver(resize).observe(canvas);resize();

function circleArcY(kind,x,w,h){const R=w*w/(8*h)+h*.5,root=Math.sqrt(Math.max(0,R*R-x*x));return kind==='pan'?(R-h)-root:root-(R-h);}
function poreEvents(seed,count){const out=[];for(let i=0;i<count;i++)out.push({s:lerp(-.78,.78,hash01(seed,i,1)),t:lerp(.06,.94,hash01(seed,i,2)),rx:lerp(.025,.085,hash01(seed,i,3)),ry:lerp(.018,.060,hash01(seed,i,4)),d:lerp(.00025,.0012,hash01(seed,i,5))});return out;}
function surfacePoint(kind,s,t,opt){
  const p=PROFILE[kind],w=lerp(p.widthEave,p.widthRidge,t),h=lerp(p.riseEave,p.riseRidge,t);let x=s*w*.5;const z=(t-.5)*p.length;
  let y=circleArcY(kind,x,w,h);
  const hand=(fbm((s+1)*1.7,t*3.2,opt.seed+31,5)-.5)*.0036+(fbm((s+1)*7.5,t*10.1,opt.seed+73,3)-.5)*.00125;
  y+=hand*(.52+.48*Math.sin(Math.PI*t));
  let cavity=0;
  for(const e of opt.pores){const du=(s-e.s)/e.rx,dv=(t-e.t)/e.ry,r2=du*du+dv*dv;if(r2<5){const g=Math.exp(-r2*1.5),lip=Math.exp(-Math.pow(Math.sqrt(r2)-1.15,2)*8);y-=e.d*g;y+=e.d*.10*lip;cavity=Math.max(cavity,g);}}
  if(opt.damageClass>0){const side=opt.chipSide,edge=side>0?s:-s;const end=opt.chipEnd>0?t:1-t;const n=fbm(t*9.7,2,opt.seed+211,3);const chip=smooth(.50,1,edge)*smooth(.42,1,end)*smooth(.28,.72,n)*(opt.damageClass===2?1:.45);if(chip>0){const inward=(kind==='pan'?.026:.010)*chip;x-=side*inward;y-=.008*chip;}}
  const edge=smooth(.80,1,Math.abs(s)),wear=opt.damageClass===2?1:opt.damageClass===1?.64:.22;
  const scallop=(kind==='pan'?(.0004+.0029*wear):(.00025+.0009*wear))*(.22+.78*smooth(.30,.82,noise2(t*34,2,opt.seed+344)));
  x-=Math.sign(s)*edge*scallop;
  y-=edge*wear*.0011*smooth(.40,.75,noise2(t*23,4,opt.seed+188));
  return {p:new THREE.Vector3(x,y,z),cavity,relief:hand};
}
function surfaceNormal(kind,s,t,opt){const p=PROFILE[kind],w=lerp(p.widthEave,p.widthRidge,t),h=lerp(p.riseEave,p.riseRidge,t),x=s*w*.5,R=w*w/(8*h)+h*.5,root=Math.sqrt(Math.max(1e-8,R*R-x*x)),dyDx=(kind==='pan'?1:-1)*x/root,e=.001,a=clamp(t-e),b=clamp(t+e),ya=circleArcY(kind,x,lerp(p.widthEave,p.widthRidge,a),lerp(p.riseEave,p.riseRidge,a)),yb=circleArcY(kind,x,lerp(p.widthEave,p.widthRidge,b),lerp(p.riseEave,p.riseRidge,b)),dyDz=(yb-ya)/Math.max(1e-8,(b-a)*p.length);return new THREE.Vector3(-dyDx,1,-dyDz).normalize();}
function makeTileGeometryV098(kind='pan',options={}){
  const p=PROFILE[kind],opt={seed:1,damageClass:0,...options};opt.pores=poreEvents(opt.seed,10+opt.damageClass*5);opt.chipSide=hash01(opt.seed,901)>.5?1:-1;opt.chipEnd=hash01(opt.seed,902)>.5?1:-1;
  const nu=options.nu??28,nv=options.nv??34,pos=[],uv=[],cavity=[],face=[],relief=[],idx=[],surfaces=[];
  const add=(P,U,V,cav,fc,rel)=>{const i=pos.length/3;pos.push(P.x,P.y,P.z);uv.push(U,V);cavity.push(cav);face.push(fc);relief.push(rel);return i;};
  const top=[],bottom=[];
  for(let j=0;j<=nv;j++){top[j]=[];bottom[j]=[];const t=j/nv;for(let i=0;i<=nu;i++){const s=i/nu*2-1,o=surfacePoint(kind,s,t,opt),n=surfaceNormal(kind,s,t,opt);top[j][i]=add(o.p,i/nu,t,o.cavity,1,o.relief);bottom[j][i]=add(o.p.clone().addScaledVector(n,-p.thickness),i/nu,t,0,0,0);}}
  const begin=name=>surfaces.push({name,start:idx.length,count:0});const end=()=>surfaces.at(-1).count=idx.length-surfaces.at(-1).start;
  begin('top');for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=top[j][i],b=top[j][i+1],c=top[j+1][i],d=top[j+1][i+1];idx.push(a,c,b,b,c,d);}end();
  begin('bottom');for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=bottom[j][i],b=bottom[j][i+1],c=bottom[j+1][i],d=bottom[j+1][i+1];idx.push(a,b,c,b,d,c);}end();
  const read=i=>new THREE.Vector3(pos[i*3],pos[i*3+1],pos[i*3+2]);
  function strip(name,pairs,order){begin(name);for(let k=0;k<pairs.length-1;k++){const [o0,b0,u0]=pairs[k],[o1,b1,u1]=pairs[k+1];const a=add(read(o0),u0,1,0,0,0),b=add(read(o1),u1,1,0,0,0),c=add(read(b0),u0,0,0,0,0),d=add(read(b1),u1,0,0,0,0);if(order==='A')idx.push(a,c,b,b,c,d);else idx.push(a,b,c,b,d,c);}end();}
  strip('left',Array.from({length:nv+1},(_,j)=>[top[j][0],bottom[j][0],j/nv]),'A');
  strip('right',Array.from({length:nv+1},(_,j)=>[top[j][nu],bottom[j][nu],j/nv]),'B');
  strip('eave',Array.from({length:nu+1},(_,i)=>[top[0][i],bottom[0][i],i/nu]),'B');
  strip('ridge',Array.from({length:nu+1},(_,i)=>[top[nv][i],bottom[nv][i],i/nu]),'A');
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('tileCavity',new THREE.Float32BufferAttribute(cavity,1));g.setAttribute('tileFace',new THREE.Float32BufferAttribute(face,1));g.setAttribute('tileRelief',new THREE.Float32BufferAttribute(relief,1));g.setIndex(idx);g.computeVertexNormals();g.clearGroups();surfaces.forEach((s,i)=>g.addGroup(s.start,s.count,i));g.computeBoundingSphere();g.userData={kind,profile:p,surfaces,uvConvention:{top:['+x','+z'],bottom:['+x','+z'],left:['+z','innerToOuter'],right:['+z','innerToOuter'],eave:['+x','innerToOuter'],ridge:['+x','innerToOuter']}};return g;
}

/* V099 bounded edge/profile study. Units: metres. No source scans at runtime.
   Evidence anchors: Jiangwutang source ae5510c0..., user line drawings 2026-09-05.
   Profile dimensions are inherited; edge amplitudes are visual candidates.
   V098 remains callable. Geometry seed is independent from surface parameters. */
function studyBoundary(kind,s,t,opt){
  const p=PROFILE[kind],seed=opt.seed,amount=clamp(opt.edgeStrength??1,0,1.5);
  const n=(x,k)=>noise2(x,1.7,seed+k)-.5;
  const left=n(t*3.6,17011)*.0017+n(t*8.3,17029)*.00035;
  const right=n(t*3.3,18013)*.0017+n(t*8.7,18041)*.00035;
  const edgeShift=lerp(left,right,(s+1)*.5)*amount;
  const w=lerp(p.widthEave,p.widthRidge,t);
  const h=lerp(p.riseEave,p.riseRidge,t);
  let x=s*w*.5+edgeShift;
  // End-line motion is independent at the two ends and remains sub-mm.
  const end0=(n((s+1)*2.1,19001)*.0014+n((s+1)*5.3,19009)*.00025)*amount;
  const end1=(n((s+1)*2.3,19103)*.0014+n((s+1)*5.1,19121)*.00025)*amount;
  let z=(t-.5)*p.length+lerp(end0,end1,t);
  let y=circleArcY(kind,s*w*.5,w,h);
  const hand=(fbm((s+1)*1.7,t*3.2,seed+31,5)-.5)*.0036+(fbm((s+1)*7.5,t*10.1,seed+73,3)-.5)*.00125;
  y+=hand*(.52+.48*Math.sin(Math.PI*t));
  // A bounded longitudinal variation, not an asserted historic flattened crown.
  y+=amount*Math.sin(Math.PI*t)*Math.sin(Math.PI*(s+1)*.5)*(n(t*2.5,19433)*.0008);
  let cavity=0;
  for(const e of opt.pores){const du=(s-e.s)/e.rx,dv=(t-e.t)/e.ry,r2=du*du+dv*dv;if(r2<5){const g=Math.exp(-r2*1.5),lip=Math.exp(-Math.pow(Math.sqrt(r2)-1.15,2)*8);y-=e.d*g;y+=e.d*.10*lip;cavity=Math.max(cavity,g);}}
  // Sparse local events with independent side identities. No full-edge sawtooth.
  const side=opt.chipSide,level=opt.damageClass;
  const bump=(q,c,r)=>{let d=Math.abs(q-c)/r;return d<1?(1-d*d)**2:0;};
  if(level>0){const at=.24+hash01(seed,2111)*.54,radius=.07+hash01(seed,2113)*.05;
    const near=smooth(.68,1,side*s),event=bump(t,at,radius)*near;
    x-=side*event*(kind==='pan'?.007:.002)*(level===2?1:.52)*amount;
    y-=event*.0016*(level===2?1:.5)*amount;
    // A larger corner loss is retained for the severe lifecycle category.
    if(level===2){const end=opt.chipEnd>0?t:1-t,c=smooth(.65,1,side*s)*smooth(.68,1,end);x-=side*c*(kind==='pan'?.011:.0025)*amount;y-=c*.003*amount;}
  }
  const normal=surfaceNormal(kind,s,t,opt);
  const thick=p.thickness*(1+amount*(n(t*2.7,19831)*.10+n((s+1)*1.8,19841)*.04));
  // Tangent-plane outset; compatible corner values keep all six patches closed.
  let out=new THREE.Vector3(Math.sign(s)*smooth(.78,1,Math.abs(s)),0,Math.sign(t-.5)*smooth(.78,1,Math.abs(2*t-1)));
  out.addScaledVector(normal,-out.dot(normal));
  const bevel=(kind==='pan'?.0016:.00125)*(1+amount*n(t*3+(s+1),19913)*.25);
  return {p:new THREE.Vector3(x,y,z),normal,out,thick,bevel,cavity,relief:hand};
}
function studyRoundPosition(o,q){
  const b=.18;let inset=0;
  if(q<b)inset=1-Math.sqrt(Math.max(0,1-(1-q/b)**2));
  else if(q>1-b)inset=1-Math.sqrt(Math.max(0,1-(1-(1-q)/b)**2));
  return o.p.clone().addScaledVector(o.normal,-o.thick*q).addScaledVector(o.out,-o.bevel*inset);
}
function smoothCoincidentNormals(g){
  // Weld the normal accumulator only. UV islands and vertex attributes stay split.
  const P=g.attributes.position.array,I=g.index.array,N=new Float32Array(P.length),sums=new Map(),keys=[];
  for(let i=0;i<P.length;i+=3)keys.push([P[i],P[i+1],P[i+2]].map(v=>Math.round(v*1e7)).join(','));
  for(let k=0;k<I.length;k+=3){const a=I[k],b=I[k+1],c=I[k+2],ax=P[b*3]-P[a*3],ay=P[b*3+1]-P[a*3+1],az=P[b*3+2]-P[a*3+2],bx=P[c*3]-P[a*3],by=P[c*3+1]-P[a*3+1],bz=P[c*3+2]-P[a*3+2],n=[ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];for(const j of [a,b,c]){let sum=sums.get(keys[j]);if(!sum){sum=[0,0,0];sums.set(keys[j],sum);}for(let v=0;v<3;v++)sum[v]+=n[v];}}
  for(let i=0;i<keys.length;i++){const n=sums.get(keys[i])||[0,1,0],len=Math.hypot(...n)||1;for(let v=0;v<3;v++)N[i*3+v]=n[v]/len;}
  g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));
}
function makeTileGeometryV099(kind='pan',options={}){
  if(!PROFILE[kind])throw new Error('Unknown tile family');
  const opt={seed:1,damageClass:0,edgeStrength:1,...options},p=PROFILE[kind];
  opt.pores=poreEvents(opt.seed,10+opt.damageClass*5);opt.chipSide=hash01(opt.seed,901)>.5?1:-1;opt.chipEnd=hash01(opt.seed,902)>.5?1:-1;
  const nu=options.nu??36,nv=options.nv??46;
  const pos=[],uv=[],cavity=[],face=[],relief=[],param=[],idx=[],surfaces=[],top=[],bottom=[];
  const add=(P,u,v,c,fc,r,stq)=>{const i=pos.length/3;param.push(...stq);pos.push(P.x,P.y,P.z);uv.push(u,v);cavity.push(c);face.push(fc);relief.push(r);return i;};
  const begin=name=>surfaces.push({name,start:idx.length,count:0}),end=()=>surfaces.at(-1).count=idx.length-surfaces.at(-1).start;
  for(let j=0;j<=nv;j++){top[j]=[];bottom[j]=[];for(let i=0;i<=nu;i++){const o=studyBoundary(kind,i/nu*2-1,j/nv,opt);top[j][i]=add(studyRoundPosition(o,0),i/nu,j/nv,o.cavity,1,o.relief,[i/nu*2-1,j/nv,0]);bottom[j][i]=add(studyRoundPosition(o,1),i/nu,j/nv,0,0,0,[i/nu*2-1,j/nv,1]);}}
  begin('top');for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=top[j][i],b=top[j][i+1],c=top[j+1][i],d=top[j+1][i+1];idx.push(a,c,b,b,c,d);}end();
  begin('bottom');for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=bottom[j][i],b=bottom[j][i+1],c=bottom[j+1][i],d=bottom[j+1][i+1];idx.push(a,b,c,b,d,c);}end();
  const qs=nv<=22?[0,.18,.5,.82,1]:[0,.05272,.18,.5,.82,.94728,1];
  function edge(name,n,fn,order){begin(name);const grid=[],lengths=[0];let prev=null,total=0;
    for(let k=0;k<=n;k++){const [s,t]=fn(k/n),o=studyBoundary(kind,s,t,opt);if(prev)total+=o.p.distanceTo(prev);lengths[k]=total;prev=o.p;grid[k]={o,s,t,ids:[]};}
    for(let k=0;k<=n;k++){const o=grid[k].o;for(const q of qs)grid[k].ids.push(add(studyRoundPosition(o,q),lengths[k]/total,1-q,0,0,0,[grid[k].s,grid[k].t,q]));}
    for(let k=0;k<n;k++)for(let r=0;r<qs.length-1;r++){const a=grid[k].ids[r],b=grid[k+1].ids[r],c=grid[k].ids[r+1],d=grid[k+1].ids[r+1];if(order==='A')idx.push(a,c,b,b,c,d);else idx.push(a,b,c,b,d,c);}end();
  }
  edge('left',nv,t=>[-1,t],'A');edge('right',nv,t=>[1,t],'B');edge('eave',nu,u=>[u*2-1,0],'B');edge('ridge',nu,u=>[u*2-1,1],'A');
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('studyParam',new THREE.Float32BufferAttribute(param,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('tileCavity',new THREE.Float32BufferAttribute(cavity,1));g.setAttribute('tileFace',new THREE.Float32BufferAttribute(face,1));g.setAttribute('tileRelief',new THREE.Float32BufferAttribute(relief,1));g.setIndex(idx);smoothCoincidentNormals(g);surfaces.forEach((s,i)=>g.addGroup(s.start,s.count,i));g.computeBoundingSphere();
  g.userData={kind,profile:p,surfaces,geometryRevision:'0.9.9-edge-study',seed:opt.seed,edgeStrength:opt.edgeStrength,bevelBands:qs.length-1,uvConvention:{top:['+x','+z'],bottom:['+x','+z'],left:['+z','innerToOuter'],right:['+z','innerToOuter'],eave:['+x','innerToOuter'],ridge:['+x','innerToOuter']}};return g;
}
function makeTileGeometry(kind='pan',options={}){
  return state.geometryRevision===0?makeTileGeometryV098(kind,options):makeTileGeometryV099(kind,{edgeStrength:state.edgeStrength??1,...options});
}

// V098 used a fixed world-axis side-normal sign. A rounded side crosses that
// sign legitimately; evaluate the shell-normal/edge-outward profile instead.
// Winding, UV direction and normal attributes are checked independently.
function uvGate(geometry){
 const result=uvGateV098(geometry);
 if(geometry.userData.geometryRevision!=='0.9.9-edge-study')return result;
 const P=geometry.attributes.position.array,I=geometry.index.array,Q=geometry.attributes.studyParam.array;
 for(const f of result.faces){
  const surf=geometry.userData.surfaces.find(s=>s.name===f.face);let minDot=1;
  for(let k=surf.start;k<surf.start+surf.count;k+=3){
   const ids=[I[k],I[k+1],I[k+2]],v=ids.map(i=>new THREE.Vector3(P[i*3],P[i*3+1],P[i*3+2]));
   const actual=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();let expected;
   if(f.face==='top'||f.face==='bottom')expected=new THREE.Vector3(0,f.face==='top'?1:-1,0);
   else{
    const stq=[0,0,0];for(const id of ids)for(let d=0;d<3;d++)stq[d]+=Q[id*3+d]/3;
    const [s,t,q]=stq,opt={seed:geometry.userData.seed,edgeStrength:geometry.userData.edgeStrength,damageClass:0,pores:[]};
    const o=studyBoundary(geometry.userData.kind,s,t,opt),N=o.normal;
    const vector={left:[-1,0,0],right:[1,0,0],eave:[0,0,-1],ridge:[0,0,1]}[f.face];
    const L=new THREE.Vector3(...vector);L.addScaledVector(N,-L.dot(N));
    let derivative=0;const b=.18;
    if(q<b){const a=1-q/b;derivative=a/(b*Math.sqrt(Math.max(1e-10,1-a*a)));}
    else if(q>1-b){const a=1-(1-q)/b;derivative=-a/(b*Math.sqrt(Math.max(1e-10,1-a*a)));}
    expected=L.clone().normalize().multiplyScalar(o.thick).addScaledVector(N,o.bevel*L.length()*derivative).normalize();
   }
   minDot=Math.min(minDot,actual.dot(expected));
  }
  f.noGeometricFold=minDot>0;f.minOutwardDot=minDot;f.outwardCriterion='shell normal and rounded edge-profile outward direction';
  f.passed=f.noGeometricFold&&f.finite&&f.inRange&&f.zeroAreaTriangles===0&&f.orientationConsistent&&f.tangentAligned&&f.bitangentAligned;
 }
 result.allPassed=result.faces.every(f=>f.passed);return result;
}

/* Rigid shell contact solver. Units: metres. No mesh is scaled to hide an overlap.
   Lower support top and upper shell underside are piecewise-linear surfaces.
   Final clearance uses projected triangle clipping, including edge crossings. */
const CONTACT_EPS=.00018;
function makeProxy(geometry, matrix=new THREE.Matrix4()){
  const pa=geometry.attributes.position.array,ix=geometry.index.array,v=new Float64Array(pa.length),p=new THREE.Vector3();
  let xmin=Infinity,xmax=-Infinity,zmin=Infinity,zmax=-Infinity;
  for(let i=0;i<pa.length;i+=3){p.set(pa[i],pa[i+1],pa[i+2]).applyMatrix4(matrix);v[i]=p.x;v[i+1]=p.y;v[i+2]=p.z;xmin=Math.min(xmin,p.x);xmax=Math.max(xmax,p.x);zmin=Math.min(zmin,p.z);zmax=Math.max(zmax,p.z);}
  const nx=8,nz=16,dx=Math.max(1e-5,xmax-xmin),dz=Math.max(1e-5,zmax-zmin),top=[],bottom=[],bins=Array.from({length:nx*nz},()=>[]);
  const bx=x=>Math.max(0,Math.min(nx-1,Math.floor((x-xmin)/dx*nx))),bz=z=>Math.max(0,Math.min(nz-1,Math.floor((z-zmin)/dz*nz)));
  for(let k=0;k<ix.length;k+=3){const a=ix[k]*3,b=ix[k+1]*3,c=ix[k+2]*3,ax=v[a],az=v[a+2],by=v[b+1],ay=v[a+1],cy=v[c+1],ux=v[b]-ax,uz=v[b+2]-az,vx=v[c]-ax,vz=v[c+2]-az,den=ux*vz-uz*vx;if(Math.abs(den)<1e-12)continue;
    const A=((by-ay)*vz-(cy-ay)*uz)/den,B=(ux*(cy-ay)-vx*(by-ay))/den,C=ay-A*ax-B*az;
    const t={a:[ax,az],b:[v[b],v[b+2]],c:[v[c],v[c+2]],A,B,C,den,minx:Math.min(ax,v[b],v[c]),maxx:Math.max(ax,v[b],v[c]),minz:Math.min(az,v[b+2],v[c+2]),maxz:Math.max(az,v[b+2],v[c+2])};
    if(den<0){const n=top.length;top.push(t);for(let z=bz(t.minz);z<=bz(t.maxz);z++)for(let x=bx(t.minx);x<=bx(t.maxx);x++)bins[z*nx+x].push(n);}else bottom.push(t);
  }
  const proxy={geometry,matrix:matrix.clone(),v,top,bottom,bins,bx,bz,nx,nz,xmin,xmax,zmin,zmax,yOffset:0};
  proxy.height=(x,z)=>{if(x<xmin-1e-8||x>xmax+1e-8||z<zmin-1e-8||z>zmax+1e-8)return -Infinity;let best=-Infinity;for(const n of bins[bz(z)*nx+bx(x)]){const t=top[n];if(pointInTri(x,z,t))best=Math.max(best,t.A*x+t.B*z+t.C);}return Number.isFinite(best)?best+proxy.yOffset:best;};
  return proxy;
}
function pointInTri(x,z,t){const u=((x-t.a[0])*(t.c[1]-t.a[1])-(z-t.a[1])*(t.c[0]-t.a[0]))/t.den,v=((t.b[0]-t.a[0])*(z-t.a[1])-(t.b[1]-t.a[1])*(x-t.a[0]))/t.den;return u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7;}
function clipTriangle(a,b){let poly=[a.a,a.b,a.c];const edges=[[b.a,b.b],[b.b,b.c],[b.c,b.a]],sign=Math.sign(b.den);for(const [v,w] of edges){if(!poly.length)break;const out=[],cross=p=>sign*((w[0]-v[0])*(p[1]-v[1])-(w[1]-v[1])*(p[0]-v[0]));let prev=poly.at(-1),d0=cross(prev);for(const curr of poly){const d1=cross(curr);if(d1>=-1e-10){if(d0< -1e-10){const k=d0/(d0-d1);out.push([prev[0]+k*(curr[0]-prev[0]),prev[1]+k*(curr[1]-prev[1])]);}out.push(curr);}else if(d0>=-1e-10){const k=d0/(d0-d1);out.push([prev[0]+k*(curr[0]-prev[0]),prev[1]+k*(curr[1]-prev[1])]);}prev=curr;d0=d1;}poly=out;}return poly;}
function exactGap(upper,lower){
  if(upper.xmax<lower.xmin||upper.xmin>lower.xmax||upper.zmax<lower.zmin||upper.zmin>lower.zmax)return {gap:Infinity,point:null,pairs:0};
  let gap=Infinity,point=null,pairs=0;
  for(const a of upper.bottom){if(a.maxx<lower.xmin||a.minx>lower.xmax||a.maxz<lower.zmin||a.minz>lower.zmax)continue;
    const seen=new Set();for(let z=lower.bz(a.minz);z<=lower.bz(a.maxz);z++)for(let x=lower.bx(a.minx);x<=lower.bx(a.maxx);x++)for(const n of lower.bins[z*lower.nx+x]){if(seen.has(n))continue;seen.add(n);const b=lower.top[n];if(a.maxx<b.minx||a.minx>b.maxx||a.maxz<b.minz||a.minz>b.maxz)continue;
      const poly=clipTriangle(a,b);if(!poly.length)continue;pairs++;for(const p of poly){const d=(a.A-b.A)*p[0]+(a.B-b.B)*p[1]+a.C-b.C+upper.yOffset-lower.yOffset;if(d<gap){gap=d;point=[p[0],b.A*p[0]+b.B*p[1]+b.C+lower.yOffset,p[1]];}}
    }
  }
  return {gap,point,pairs};
}
function minSupportGap(proxy,supports){let best={gap:Infinity,point:null};for(const s of supports){const r=exactGap(proxy,s);if(r.gap<best.gap)best=r;}return best;}
function poseMatrix(x,z,tilt,roll,y=0){return new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt,0,roll)),new THREE.Vector3(1,1,1));}
function seatAtAngle(g,x,z,tilt,left,right,width){
  let roll=0,proxy,gl,gr;
  for(let k=0;k<5;k++){
    proxy=makeProxy(g,poseMatrix(x,z,tilt,roll));gl=minSupportGap(proxy,left);gr=minSupportGap(proxy,right);
    if(!Number.isFinite(gl.gap)||!Number.isFinite(gr.gap))return null;
    const err=gl.gap-gr.gap;if(Math.abs(err)<.00005)break;
    const lever=gr.point&&gl.point?Math.abs(gr.point[0]-gl.point[0]):width*.8;
    roll=clamp(roll+err/Math.max(.025,lever),-.22,.22);
  }
  const raise=-Math.min(gl.gap,gr.gap)+CONTACT_EPS;proxy.yOffset=raise;
  proxy.matrix=poseMatrix(x,z,tilt,roll,raise);
  return {proxy,tilt,roll,leftGap:gl.gap+raise,rightGap:gr.gap+raise,contacts:[gl.point,gr.point]};
}
function settleTile(g,x,z,left,right,previous,width){
  if(!left.length||!right.length)return null;
  let current=null,prevGap=Infinity,lo=0,hi=.34,rounds=0;
  // A supported first tile can settle almost flat. Subsequent courses tilt up at
  // the eave; this creates overlap clearance without moving either timber line.
  const test=angle=>{const s=seatAtAngle(g,x,z,angle,left,right,width);if(!s)return null;const sep=minSupportGap(s.proxy,previous);s.overlapGap=sep.gap;return s;};
  current=test(0);if(!current)return null;
  if(current.overlapGap<CONTACT_EPS*.5){let high=test(hi);if(!high||high.overlapGap<CONTACT_EPS*.5)return {...current,unsupported:true,reason:'no rigid placement found within tilt limit'};
    for(let n=0;n<10;n++){const mid=(lo+hi)*.5,s=test(mid);rounds++;if(s&&s.overlapGap>=CONTACT_EPS*.5){hi=mid;high=s;}else lo=mid;}
    current=high;
  }
  current.iterations=rounds;current.unsupported=Math.max(current.leftGap,current.rightGap)>.0005;if(current.unsupported)current.reason='lost bilateral support under roll limit';return current;
}

/* Timber: longitudinal UV seam, separate end-grain UVs, outward triangles.
   Damage rates are explicit illustration parameters, not surveyed service life. */
const TIMBER={rafterRadius:.040,beamRadius:.069,beamCount:4};
function woodGeometry(length,segments,seed,radius=.04,sampler=()=>({loss:0,y:0}),breakRanges=[]){
  const radial=24,pos=[],uv=[],col=[],idx=[],faces=[],rings=[];
  const cuts=new Set(Array.from({length:segments+1},(_,j)=>j/segments));
  for(const [a,b] of breakRanges){cuts.add(clamp(a));cuts.add(clamp(b));}
  const ts=[...cuts].sort((a,b)=>a-b);
  const colorAt=(loss,stain,t)=>{const n=(noise2(t*4.3,1,seed)-.5)*.04;return new THREE.Color().setRGB(clamp(lerp(.27,.047,clamp(stain))+n),clamp(lerp(.176,.047,clamp(stain))+n*.7),clamp(lerp(.091,.044,clamp(stain))+n*.3));};
  for(const t of ts){const s=sampler(t),r=radius*(1-clamp(s.loss,0,.86)),z=(t-.5)*length,ring=[];for(let i=0;i<=radial;i++){const angle=(i%radial)/radial*Math.PI*2;
    // Fine furrows stay inward; seam endpoints are exactly coincident.
    const grooves=(.00018+clamp(s.loss)*.0008)*(.5+.5*Math.sin(angle*11+seed*.03+Math.sin(t*6)*.12));
    const rr=Math.max(.004,r-grooves),x=Math.cos(angle)*rr,y=Math.sin(angle)*rr+(s.y||0),n=pos.length/3;
    pos.push(x,y,z);uv.push(i/radial,t);const c=colorAt(s.loss,s.stain??s.loss,t);col.push(c.r,c.g,c.b);ring.push(n);
  }rings.push(ring);}
  const disabled=t=>breakRanges.some(([a,b])=>t>a+1e-9&&t<b-1e-9);
  const alive=[];const start=idx.length;for(let j=0;j<ts.length-1;j++){alive[j]=!disabled((ts[j]+ts[j+1])*.5);if(!alive[j])continue;for(let i=0;i<radial;i++){const a=rings[j][i],b=rings[j][i+1],c=rings[j+1][i],d=rings[j+1][i+1];idx.push(a,b,c,b,d,c);}}
  faces.push({name:'side',start,count:idx.length-start});
  function cap(j,end,broken){const t=ts[j],s=sampler(t),z=(t-.5)*length,offset=idx.length,center=pos.length/3,r=radius*(1-clamp(s.loss,0,.86));pos.push(0,s.y||0,z);uv.push(.5,.5);const cc=colorAt(s.loss,clamp((s.stain??s.loss)*.65),t);col.push(cc.r,cc.g,cc.b);const rim=[];
    for(let i=0;i<radial;i++){const k=rings[j][i]*3,n=pos.length/3;const zz=pos[k+2];pos.push(pos[k],pos[k+1],zz);uv.push(.5+(end?1:-1)*pos[k]/(radius*2),.5+(pos[k+1]-(s.y||0))/(radius*2));col.push(cc.r,cc.g,cc.b);rim.push(n);}
    for(let i=0;i<radial;i++){const a=rim[i],b=rim[(i+1)%radial];end?idx.push(center,a,b):idx.push(center,b,a);}faces.push({name:end?'end':'start',broken,start:offset,count:idx.length-offset});}
  for(let j=0;j<ts.length-1;j++)if(alive[j]){if(j===0||!alive[j-1])cap(j,false,j>0);if(j===ts.length-2||!alive[j+1])cap(j+1,true,j<ts.length-2);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();g.clearGroups();faces.forEach(f=>g.addGroup(f.start,f.count,f.name==='side'?0:1));g.computeBoundingBox();g.computeBoundingSphere();g.userData={kind:'round-timber',length,radius,radial,segments:ts.length-1,surfaces:faces,breakRanges,centreLine:ts.map(t=>[(t-.5)*length,sampler(t).y||0]),uvConvention:{side:'U around circumference; V along grain; duplicate seam',ends:'end +X/+Y; start -X/+Y; viewed outward, never mirrored'}};
  return g;
}
function woodUVGate(g){const P=g.attributes.position.array,N=g.attributes.normal.array,U=g.attributes.uv?.array,I=g.index.array,finite=U&&Array.from(U).every(Number.isFinite),report=[];
  for(const type of ['side','start','end']){const parts=g.userData.surfaces.filter(f=>f.name===type);let good=0,total=0,minOutwardDot=1,areaOK=true,rangeOK=true,axisOK=true,orientationOK=true;
    for(const part of parts)for(let k=part.start;k<part.start+part.count;k+=3){const a=I[k],b=I[k+1],c=I[k+2],A=new THREE.Vector3(P[a*3],P[a*3+1],P[a*3+2]),B=new THREE.Vector3(P[b*3],P[b*3+1],P[b*3+2]),C=new THREE.Vector3(P[c*3],P[c*3+1],P[c*3+2]),n=B.clone().sub(A).cross(C.clone().sub(A)).normalize();let expected;if(type==='side'){const z=(A.z+B.z+C.z)/3,cl=g.userData.centreLine;let j=0;while(j<cl.length-2&&cl[j+1][0]<z)j++;const cy=lerp(cl[j][1],cl[j+1][1],clamp((z-cl[j][0])/(cl[j+1][0]-cl[j][0])));expected=new THREE.Vector3(A.x+B.x+C.x,A.y+B.y+C.y-3*cy,0).normalize();}else expected=new THREE.Vector3(0,0,type==='end'?1:-1);const outwardDot=n.dot(expected);minOutwardDot=Math.min(minOutwardDot,outwardDot);if(outwardDot>(type==='side'?1e-6:.6))good++;total++;
      const den=(U[b*2]-U[a*2])*(U[c*2+1]-U[a*2+1])-(U[b*2+1]-U[a*2+1])*(U[c*2]-U[a*2]);if(Math.abs(den)<1e-10)areaOK=false;if(den<=0)orientationOK=false;
      for(const i of [a,b,c])if(U[i*2]<-1e-6||U[i*2]>1+1e-6||U[i*2+1]<-1e-6||U[i*2+1]>1+1e-6)rangeOK=false;
      if(type==='side'){for(const [i,j] of [[a,b],[a,c]])if(Math.abs(P[i*3+2]-P[j*3+2])>1e-8&&(U[i*2+1]-U[j*2+1])*(P[i*3+2]-P[j*3+2])<=0)axisOK=false;}
    }
    report.push({face:type,minOutwardDot,outwardCriterion:type==='side'?'positive radial dot against local centreline':'end-facing normal',finite:!!finite,uvRange:rangeOK,nonzeroArea:areaOK,nonMirrored:orientationOK,longitudinalV:axisOK,outward:good===total&&total>0,triangles:total,passed:!!finite&&rangeOK&&areaOK&&orientationOK&&axisOK&&good===total&&total>0});
  }return {allPassed:report.every(f=>f.passed),faces:report};
}
function integrateTimber(rows,cols){
  const n=(cols+1)*rows,loss=new Float64Array(n),dose=new Float64Array(n),moisture=new Float64Array(n),stain=new Float64Array(n),repairs=new Uint16Array(n),beamLoss=new Float64Array(4*cols),forced=new Uint8Array(rows*cols);let panStates=[],hailHits=0;
  for(let year=0;year<=state.year;year++){
    const rain=.75+.5*hash01(state.seed,year,822),storm=year>10&&hash01(state.seed,year,910)>.91;
    panStates=Array.from({length:rows*cols},(_,i)=>{const r=Math.floor(i/cols),c=i%cols,s=lifecycle(r,c,'pan',rows,cols,year);if(state.care==='abandoned'&&forced[i]){s.missing=true;s.damageClass=2;s.reason='support loss';}
      if(storm&&hash01(state.seed,r,c,year,911)>.93){s.damageClass=Math.max(s.damageClass,1);s.hail=true;hailHits++;}return s;});
    for(let c=0;c<=cols;c++)for(let r=0;r<rows;r++){const i=c*rows+r;let water=0;for(const cc of [c-1,c])if(cc>=0&&cc<cols){const s=panStates[r*cols+cc];water=Math.max(water,s.missing?1:s.damageClass===2?.50:s.damageClass===1?.13:0);}if(r<rows-1)water=Math.max(water,moisture[c*rows+r+1]*.23);
      moisture[i]=moisture[i]*.72+water*.28;dose[i]+=moisture[i]*rain;stain[i]=clamp(stain[i]+water*.043+moisture[i]*.023);
      loss[i]=clamp(loss[i]+(.0006*water+.020*moisture[i])*(1+loss[i]*.8)*rain,0,.82);
      if(state.care==='maintained'&&loss[i]>.09&&hash01(i,year,state.seed,875)<.68){loss[i]=0;dose[i]=0;stain[i]=.08;moisture[i]=0;repairs[i]++;}
      if(state.care==='abandoned'&&loss[i]>.48){for(const cc of [c-1,c])if(cc>=0&&cc<cols)forced[r*cols+cc]=1;}
    }
    for(let b=0;b<4;b++)for(let c=0;c<cols;c++){const row=Math.round((b/3)*(rows-1)),i=b*cols+c,L=(loss[c*rows+row]+loss[(c+1)*rows+row])*.5,M=(moisture[c*rows+row]+moisture[(c+1)*rows+row])*.5;
      // Heavy horizontal members deteriorate after prolonged direct exposure.
      beamLoss[i]=clamp(beamLoss[i]+M*L*.0125*rain,0,.66);if(state.care==='maintained'&&beamLoss[i]>.075)beamLoss[i]=0;
    }
  }
  return {loss,dose,moisture,stain,repairs,beamLoss,panStates,hailHits,forced};
}
function interpArray(a,offset,t,n){const p=clamp(t)*Math.max(0,n-1),i=Math.floor(p);return lerp(a[offset+i]||0,a[offset+Math.min(n-1,i+1)]||0,p-i);}

function makeDetail(size=512){
  const n=size*size,h=new Float32Array(n),cavity=new Float32Array(n),mineral=new Float32Array(n),scratch=new Float32Array(n);let rng=2737649;
  const rnd=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return(rng>>>0)/4294967296;};const at=(x,y)=>((y+size)%size)*size+(x+size)%size,scale=.096;
  for(let i=0;i<n;i++){h[i]=(rnd()-.5)*.000030;mineral[i]=.5+(rnd()-.5)*.14;}
  const stamp=(cx,cy,rx,ry,depth,kind,phase)=>{const bx=Math.ceil(rx*1.3),by=Math.ceil(ry*1.3);for(let j=-by;j<=by;j++)for(let i=-bx;i<=bx;i++){const a=Math.atan2(j/ry,i/rx),r=Math.hypot(i/rx,j/ry)/(1+.14*Math.sin(a*5+phase)+.06*Math.cos(a*9-phase));if(r>1.2)continue;const id=at(cx+i,cy+j);if(kind===0){const u=clamp((r-.50)/.48),bowl=1-u*u*(3-2*u),lip=Math.exp(-Math.pow((r-1.01)/.085,2));h[id]-=depth*bowl;h[id]+=depth*.10*lip;cavity[id]=Math.max(cavity[id],bowl*.86);}else{const f=Math.max(0,1-r);h[id]+=depth*f;mineral[id]=clamp(mineral[id]+f*(Math.sin(phase*3.1)>.12?.40:-.38));}}};
  for(let k=0;k<4100;k++){const rx=(.10+rnd()**2*.37)/1000/scale*size,ry=rx*(.48+rnd());stamp(Math.floor(rnd()*size),Math.floor(rnd()*size),rx,ry,.000025+rnd()*.000070,1,rnd()*6.28);}
  for(let k=0;k<260;k++){const rx=(.17+rnd()**2*.95)/1000/scale*size,ry=rx*(.5+rnd()*.85);stamp(Math.floor(rnd()*size),Math.floor(rnd()*size),rx,ry,.00007+rnd()*.00027,0,rnd()*6.28);}
  for(let k=0;k<110;k++){const x=rnd()*size,y=rnd()*size,len=(.003+rnd()*.015)/scale*size,ang=(rnd()-.5)*.6;for(let q=0;q<len;q+=.6){const xx=Math.floor(x+q*Math.sin(ang)+Math.sin(q*.02)*.8),yy=Math.floor(y+q*Math.cos(ang)),f=Math.sin(Math.PI*q/len),id=at(xx,yy);h[id]-=.000048*f;scratch[id]=Math.max(scratch[id],f);}}
  const gradients=new Uint8Array(n*4),fields=new Uint8Array(n*4),du=scale/size;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x,j=i*4,dx=(h[at(x+1,y)]-h[at(x-1,y)])/(2*du),dy=(h[at(x,y+1)]-h[at(x,y-1)])/(2*du);gradients[j]=Math.round(clamp(.5+dx*.5)*255);gradients[j+1]=Math.round(clamp(.5+dy*.5)*255);gradients[j+2]=Math.round(clamp(.68+cavity[i]*.15-Math.abs(mineral[i]-.5)*.25+scratch[i]*.03)*255);gradients[j+3]=Math.round(clamp(1-cavity[i]*.38)*255);fields[j]=Math.round(clamp(.5+h[i]/.0012)*255);fields[j+1]=Math.round(clamp(mineral[i])*255);fields[j+2]=Math.round(scratch[i]*255);fields[j+3]=Math.round(cavity[i]*255);}
  const tex=d=>{const t=new THREE.DataTexture(d,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=THREE.NoColorSpace;t.needsUpdate=true;return t;};
  return {normalRoughAO:tex(gradients),fields:tex(fields)};
}
const detail=makeDetail();
const clayShader=`
varying vec3 vRest;varying vec3 vRestN;varying vec3 vAxisX;varying vec3 vAxisY;varying vec3 vAxisZ;varying float vCavity;varying float vFace;varying float vRelief;varying vec2 vTileUV;
uniform sampler2D detailNR;uniform sampler2D detailF;uniform vec4 ceramic;uniform vec4 history;uniform vec4 identity;uniform vec4 geom;
float th(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}float tn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(th(i),th(i+vec3(1,0,0)),f.x),mix(th(i+vec3(0,1,0)),th(i+vec3(1,1,0)),f.x),f.y),mix(mix(th(i+vec3(0,0,1)),th(i+vec3(1,0,1)),f.x),mix(th(i+vec3(0,1,1)),th(i+vec3(1,1,1)),f.x),f.y),f.z);}float tf(vec3 p){return .58*tn(p)+.28*tn(p*2.03+7.1)+.14*tn(p*4.09+19.7);}vec3 srgbLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 weights(){vec3 w=pow(abs(normalize(vRestN)),vec3(6.));return w/max(dot(w,vec3(1.)),.0001);}vec4 tri(sampler2D tex){vec3 p=vRest/.096+identity.xyz;vec3 w=weights();return texture2D(tex,p.yz)*w.x+texture2D(tex,p.xz)*w.y+texture2D(tex,p.xy)*w.z;}vec3 clayGradient(){vec3 p=vRest/.096+identity.xyz;vec3 w=weights();vec2 gx=(texture2D(detailNR,p.yz).rg*2.-1.),gy=(texture2D(detailNR,p.xz).rg*2.-1.),gz=(texture2D(detailNR,p.xy).rg*2.-1.);return vec3(0.,gx.x,gx.y)*w.x+vec3(gy.x,0.,gy.y)*w.y+vec3(gz.x,gz.y,0.)*w.z;}vec3 fields(){vec3 p=vRest*35.+identity.xyz;return vec3(tf(p*.24),tf(p),tf(p*3.7));}
float shelter(){return clamp(smoothstep(.05,.40,vTileUV.y)*.68+vCavity*.30+(1.-step(.5,vFace))*.17,0.,1.);}float runoff(){vec3 p=vRest;float panLane=exp(-pow(p.x/(geom.x*.23),2.));float capShed=smoothstep(.18,.78,abs(p.x)/(geom.x*.5));float lane=mix(panLane,capShed,geom.w);float stripe=smoothstep(.36,.64,tn(vec3(p.x*280.,p.y*28.,p.z*6.)+identity.xyz));return lane*stripe*step(.5,vFace);}
vec3 clayColor(){vec3 p=vRest*29.+identity.xyz;vec3 f=fields();vec4 m=tri(detailF);float broken=tn(p*8.1),warm=smoothstep(.57,.75,f.x+(f.z-.5)*.13+identity.w),pale=smoothstep(.58,.73,tf(p*1.6+31.)+(broken-.5)*.14+(m.g-.5)*.24),dark=smoothstep(.64,.80,tf(p*.9-12.));vec3 cool=vec3(.325,.365,.385),blue=vec3(.365,.408,.420),neutral=vec3(.435,.430,.405),ochre=vec3(.515,.405,.305),ash=vec3(.625,.610,.565),soot=vec3(.205,.225,.235),iron=vec3(.43,.235,.185);vec3 c=mix(cool,blue,.48+identity.w*.55);c=mix(c,neutral,.18);c=mix(c,ochre,warm*.38*ceramic.x);c=mix(c,iron,smoothstep(.84,.95,f.z+identity.w*.16)*.075*ceramic.x);c=mix(c,ash,pale*.16*ceramic.x);c=mix(c,soot,dark*.40*ceramic.x);c+=(f.y-.5)*.048+(f.z-.5)*.026+(m.g-.5)*.16;c=mix(c,ash,smoothstep(.78,.94,m.g)*.20*ceramic.x);c-=m.b*.016;c+=identity.w*.095;float dust=history.x*shelter()*smoothstep(.32,.68,f.z),wash=history.y*runoff(),bio=history.z*shelter()*smoothstep(.59,.73,tf(p*2.4));c=mix(c,vec3(.45,.44,.405),dust*.26);c=mix(c,blue,wash*.20);c=mix(c,vec3(.235,.275,.225),bio*.46);c=mix(c,soot,dust*history.w*.10);c*=1.-ceramic.z*.25;return clamp(c,vec3(.16),vec3(.76));}
float clayRough(){vec4 d=tri(detailNR);return clamp(d.b+.05+(fields().y-.5)*.12+vCavity*.055+history.x*shelter()*.06-ceramic.z*.29,.30,.95);}float clayAO(){return clamp(tri(detailNR).a*(1.-vCavity*.20),.55,1.);}
`;
const materialCache=new Map();
function clayMaterial(kind,variant,age,wet=0){
  const ageBand=Math.round(age/5)*5,key=[kind,variant,ageBand,wet].join('/');if(materialCache.has(key))return materialCache.get(key);
  const p=PROFILE[kind],seed=hash32(state.seed+variant*8191+(kind==='cover'?1337:0)),rand=k=>hash01(seed,k);
  const u={detailNR:{value:detail.normalRoughAO},detailF:{value:detail.fields},ceramic:{value:new THREE.Vector4(1.0,1.05,wet,0)},history:{value:new THREE.Vector4()},identity:{value:new THREE.Vector4(rand(1)*97,rand(2)*97,rand(3)*97,(rand(4)-.5)*.22)},geom:{value:new THREE.Vector4(p.widthEave,p.length,p.thickness,kind==='cover'?1:0)}};
  const curve=(on,tau)=>1-Math.exp(-Math.max(0,ageBand-on)/tau);u.history.value.set(curve(0,20),curve(4,48),curve(18,58),curve(10,70));
  const m=new THREE.MeshStandardMaterial({color:0xffffff,metalness:0,roughness:.78,side:THREE.FrontSide,envMapIntensity:.68});m.userData.uniforms=u;
  m.onBeforeCompile=s=>{Object.assign(s.uniforms,u);s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nattribute float tileCavity;attribute float tileFace;attribute float tileRelief;varying vec3 vRest;varying vec3 vRestN;varying vec3 vAxisX;varying vec3 vAxisY;varying vec3 vAxisZ;varying float vCavity;varying float vFace;varying float vRelief;varying vec2 vTileUV;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRest=position;vRestN=normal;vCavity=tileCavity;vFace=tileFace;vRelief=tileRelief;vTileUV=uv;vAxisX=normalMatrix*vec3(1,0,0);vAxisY=normalMatrix*vec3(0,1,0);vAxisZ=normalMatrix*vec3(0,0,1);');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\n'+clayShader).replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=srgbLinear(clayColor())*diffuseColor.rgb;').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clayRough();').replace('#include <aomap_fragment>','#include <aomap_fragment>\nreflectedLight.indirectDiffuse*=clayAO();').replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nvec3 grad=clayGradient();vec3 gv=vAxisX*grad.x+vAxisY*grad.y+vAxisZ*grad.z;gv-=normal*dot(gv,normal);normal=normalize(normal-gv*ceramic.y*1.17);');};
  m.customProgramCacheKey=()=>`tm097-clay-${kind}`;materialCache.set(key,m);return m;
}
/* Reference-informed surface layers. These are editable visual candidates,
   not measured albedo/roughness/height. Original clayShader remains unmodified. */
const studySurfaceShader=`
uniform vec4 studySurface;
vec3 studySurfaceColor(vec3 base){
  vec3 p=vRest*26.+identity.xyz;
  float coarse=tf(p*.36+vec3(12.,-7.,9.));
  float mid=tf(p*1.8+vec3(31.,8.,2.));
  float mineral=tf(p*6.1+vec3(8.,19.,-4.));
  float warm=smoothstep(.52,.70,coarse+(mid-.5)*.22);
  float pale=smoothstep(.54,.73,tf(p*.72+41.)+(mineral-.5)*.23);
  float deep=smoothstep(.59,.77,tf(p*.53-26.));
  vec3 c=mix(base,vec3(.48,.37,.275),warm*.32*studySurface.y);
  c=mix(c,vec3(.60,.585,.54),pale*.30*studySurface.y);
  c=mix(c,vec3(.265,.305,.325),deep*.16*studySurface.y);
  // Low-amplitude interrupted striations, varied per stable material identity.
  float direction=(identity.x*.073-.5)*.5;
  float line=sin((vRest.x+vRest.z*direction)*3600.+tn(p*2.)*7.);
  float mask=smoothstep(.44,.61,mid)*smoothstep(.78,.97,line);
  c-=mask*.018*studySurface.z;
  c+=(mineral-.5)*.025*studySurface.y;
  return mix(base,clamp(c,vec3(.16),vec3(.76)),studySurface.x);
}
`;
function studyClayMaterial(kind,variant,age,wet=0){
  if(state.mode==='clay')return new THREE.MeshStandardMaterial({color:0x969e9b,roughness:.82,metalness:0,side:THREE.FrontSide,envMapIntensity:.55});
  const m=clayMaterial(kind,variant,age,wet);
  if(!m.userData.study){
    const before=m.onBeforeCompile;
    m.userData.study={value:new THREE.Vector4(state.surfaceRevision?1:0,state.colorLayer??1,state.striations??.7,0)};
    m.onBeforeCompile=s=>{before(s);s.uniforms.studySurface=m.userData.study;
      s.fragmentShader=s.fragmentShader.replace('vec3 clayColor(){',studySurfaceShader+'\nvec3 clayColor(){');
      s.fragmentShader=s.fragmentShader.replace('srgbLinear(clayColor())','srgbLinear(studySurfaceColor(clayColor()))');
      s.fragmentShader=s.fragmentShader.replace('roughnessFactor=clayRough();','roughnessFactor=clayRough(); roughnessFactor=clamp(roughnessFactor+studySurface.x*(tf(vRest*120.+identity.xyz)-.5)*.075,.30,.95);');
    };
    m.customProgramCacheKey=()=>`tm099-study-${kind}`;
  }
  return m;
}
function updateStudySurface(){
  for(const m of materialCache.values())if(m.userData.study)m.userData.study.value.set(state.surfaceRevision?1:0,state.colorLayer??1,state.striations??.7,0);
  needsRender=true;
}

function legacyTileTint(id,age,generation=0){
  const r=hash01(id,state.seed,17),g=hash01(id,state.seed,31),b=hash01(id,state.seed,47),c=new THREE.Color(1,1,1);
  if(r<.66)c.setRGB(lerp(.88,.99,g),lerp(.96,1.045,b),lerp(1.01,1.085,r));
  else if(r<.90)c.setRGB(lerp(.94,1.025,g),lerp(.94,1.015,b),lerp(.91,.99,r));
  else if(r<.975)c.setRGB(lerp(.99,1.07,g),lerp(.93,1.005,b),lerp(.86,.95,r));
  else c.setRGB(1.07,1.055,1.00);
  if(generation>0)c.lerp(new THREE.Color(1.035,1.025,.995),.15);
  if(age>70&&b>.90)c.lerp(new THREE.Color(1.08,1.07,1.025),.12);
  return c;
}

const POPULATION=Object.freeze([
 {name:'讲武堂参考组',hex:'#596268',weight:24,tint:[.97,1.0,1.03]},
 {name:'整片深蓝灰',hex:'#404c54',weight:27,tint:[.69,.79,.87]},
 {name:'整片青灰',hex:'#677277',weight:25,tint:[1.02,1.12,1.15]},
 {name:'整片浅灰',hex:'#93958e',weight:10,tint:[1.55,1.50,1.33]},
 {name:'整片白化',hex:'#b5b3a5',weight:7,tint:[2.0,1.87,1.57]},
 {name:'整片黄褐',hex:'#9a805a',weight:5,tint:[1.64,1.13,.63]},
 {name:'整片铁红',hex:'#855543',weight:2,tint:[1.28,.65,.47]}
]);
function populationFor(id,generation=0){let r=hash01(id,state.seed,12017,generation)*100;for(const p of POPULATION){r-=p.weight;if(r<0)return p;}return POPULATION.at(-1);}
function tileTint(id,age,generation=0){const p=populationFor(id,generation),v=.96+hash01(id,state.seed,12812)*.08;return new THREE.Color().setRGB(p.tint[0]*v,p.tint[1]*v,p.tint[2]*v);}

function makeUVTexture(face,kind){const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d'),colors={top:'#b64b42',bottom:'#3569a9',left:'#688c54',right:'#a87934',eave:'#895b91',ridge:'#317f83'},fc=colors[face];x.fillStyle='#f4f1e7';x.fillRect(0,0,512,512);x.strokeStyle=fc;x.lineWidth=4;for(let i=0;i<=8;i++){x.beginPath();x.moveTo(i*64,0);x.lineTo(i*64,512);x.stroke();x.beginPath();x.moveTo(0,i*64);x.lineTo(512,i*64);x.stroke();}x.fillStyle='rgba(255,255,255,.91)';x.fillRect(14,14,484,130);x.fillStyle='#20292c';x.font='700 34px system-ui';x.fillText(`${kind==='pan'?'板瓦':'筒瓦'} · ${FACE_LABEL[face]}`,28,60);x.font='600 22px system-ui';x.fillText(face==='top'||face==='bottom'?'U 左→右   V 檐→脊':face==='left'||face==='right'?'U 檐→脊   V 内→外':'U 左→右   V 内→外',28,100);x.fillText('EAVE 0                         RIDGE 1',28,132);x.strokeStyle='#c63b31';x.lineWidth=13;x.beginPath();x.moveTo(86,418);x.lineTo(420,418);x.stroke();x.beginPath();x.moveTo(420,418);x.lineTo(382,388);x.moveTo(420,418);x.lineTo(382,448);x.stroke();x.strokeStyle='#2761ae';x.beginPath();x.moveTo(86,418);x.lineTo(86,192);x.stroke();x.beginPath();x.moveTo(86,192);x.lineTo(56,230);x.moveTo(86,192);x.lineTo(116,230);x.stroke();const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t;}
const UV_MATERIALS={};for(const kind of ['pan','cover'])UV_MATERIALS[kind]=FACE.map(f=>new THREE.MeshBasicMaterial({map:makeUVTexture(f,kind),side:THREE.FrontSide,toneMapped:false}));
const PERSISTENT_MATERIALS=new Set([...UV_MATERIALS.pan,...UV_MATERIALS.cover]);

function uvGateV098(geometry){
  const P=geometry.attributes.position.array,U=geometry.attributes.uv.array,I=geometry.index.array;const expected={top:[[1,0,0],[0,0,1]],bottom:[[1,0,0],[0,0,1]],left:[[0,0,1],[0,1,0]],right:[[0,0,1],[0,1,0]],eave:[[1,0,0],[0,1,0]],ridge:[[1,0,0],[0,1,0]]};let all=true;
  const faces=geometry.userData.surfaces.map(s=>{let finite=true,inRange=true,zero=0,orient=[],tanScore=0,bitScore=0,samples=0;const exU=new THREE.Vector3(...expected[s.name][0]),exV=new THREE.Vector3(...expected[s.name][1]);for(let k=s.start;k<s.start+s.count;k+=3){const ids=[I[k],I[k+1],I[k+2]],ps=ids.map(i=>new THREE.Vector3(P[i*3],P[i*3+1],P[i*3+2])),uvs=ids.map(i=>new THREE.Vector2(U[i*2],U[i*2+1]));for(const q of uvs){finite&&=Number.isFinite(q.x)&&Number.isFinite(q.y);inRange&&=q.x>=-1e-6&&q.x<=1+1e-6&&q.y>=-1e-6&&q.y<=1+1e-6;}const du1=uvs[1].clone().sub(uvs[0]),du2=uvs[2].clone().sub(uvs[0]),den=du1.x*du2.y-du1.y*du2.x;if(Math.abs(den)<1e-10){zero++;continue;}orient.push(Math.sign(den));const dp1=ps[1].clone().sub(ps[0]),dp2=ps[2].clone().sub(ps[0]),T=dp1.clone().multiplyScalar(du2.y).addScaledVector(dp2,-du1.y).multiplyScalar(1/den).normalize(),B=dp2.clone().multiplyScalar(du1.x).addScaledVector(dp1,-du2.x).multiplyScalar(1/den).normalize();tanScore+=T.dot(exU);bitScore+=B.dot(exV);samples++;}
    const geometricSigns=[];for(let k=s.start;k<s.start+s.count;k+=3){const ia=I[k]*3,ib=I[k+1]*3,ic=I[k+2]*3,A=new THREE.Vector3(P[ia],P[ia+1],P[ia+2]),B=new THREE.Vector3(P[ib],P[ib+1],P[ib+2]),C=new THREE.Vector3(P[ic],P[ic+1],P[ic+2]),N=B.sub(A).cross(C.sub(A));const e={top:[0,1,0],bottom:[0,-1,0],left:[-1,0,0],right:[1,0,0],eave:[0,0,-1],ridge:[0,0,1]}[s.name];geometricSigns.push(N.dot(new THREE.Vector3(...e)));}const noGeometricFold=geometricSigns.every(v=>v>0);const consistent=orient.length>0&&orient.every(v=>v===orient[0]),tangentAligned=samples>0&&tanScore/samples>.45,bitangentAligned=samples>0&&bitScore/samples>.18,passed=finite&&inRange&&zero===0&&consistent&&tangentAligned&&bitangentAligned&&noGeometricFold;all&&=passed;return {face:s.name,label:FACE_LABEL[s.name],noGeometricFold,finite,inRange,zeroAreaTriangles:zero,orientationConsistent:consistent,tangentAligned,bitangentAligned,tangentScore:samples?tanScore/samples:0,bitangentScore:samples?bitScore/samples:0,passed};});return {allPassed:all,faces};
}

function clearStage(){
  const geometries=new Set(),materials=new Set();
  stageRoot.traverse(o=>{
    if(o.geometry)geometries.add(o.geometry);
    if(o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material]))materials.add(m);}
  });
  while(stageRoot.children.length)stageRoot.remove(stageRoot.children[stageRoot.children.length-1]);
  for(const g of geometries)g.dispose?.();
  for(const m of materials){
    if(PERSISTENT_MATERIALS.has(m)||[...materialCache.values()].includes(m))continue;
    if(m.map&&m.map.isTexture)m.map.dispose?.();
    m.dispose?.();
  }
  for(const m of materialCache.values())m.dispose?.();
  materialCache.clear();
  $('#sceneStats').innerHTML='';
}
function caption(text,pos,scale=.65){const c=document.createElement('canvas');c.width=512;c.height=96;const x=c.getContext('2d');x.fillStyle='rgba(247,245,238,.89)';x.roundRect(8,8,496,80,16);x.fill();x.fillStyle='#283135';x.font='600 28px system-ui';x.textAlign='center';x.fillText(text,256,60);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));s.position.copy(pos);s.scale.set(1.05*scale,.197*scale,1);stageRoot.add(s);}
function tileMesh(kind,variant,age,{damageClass=0,mode=state.mode}={}){const g=makeTileGeometry(kind,{seed:state.seed+variant*101,damageClass});const mat=mode==='uv'?UV_MATERIALS[kind]:studyClayMaterial(kind,variant,age,state.light==='rain'?1:0);const m=new THREE.Mesh(g,mat);m.castShadow=m.receiveShadow=true;m.userData={kind,variant,uv:uvGate(g)};if(mode!=='uv'&&mode!=='clay')m.material.color.copy(legacyTileTint(variant,age));return m;}
function buildTrio(){
 clearStage();const fam=state.trioFamily,kinds=state.focusSingle?[fam==='mix'?'pan':fam]:(fam==='mix'?['pan','cover','pan']:[fam,fam,fam]);
 const xs=state.focusSingle?[0]:[-.42,0,.42];
 kinds.forEach((kind,i)=>{const v=state.focusSingle?1:i,age=[8,38,74][v],m=tileMesh(kind,v,age,{damageClass:v===2?1:0});m.position.set(xs[i],kind==='pan'?.03:.01,0);m.rotation.set(-.11,state.focusSingle?0:(i-1)*.05,state.focusSingle?0:(i-1)*.028);m.scale.setScalar(1.58);stageRoot.add(m);if(!state.focusSingle)caption(`${kind==='pan'?'板瓦':'筒瓦'} 0${v+1}`,new THREE.Vector3(xs[i],-.31,.08),.40);});
 $('#sceneStats').innerHTML=`<b>${state.focusSingle?'单片边口近景':'三片独立瓦母体'}</b><span>板瓦 23.8 cm；宽 24.2 / 22.1 cm；厚约 1.2 cm</span><span>筒瓦 22.2 cm；两处宽 11.5 / 9.0 cm；厚约 1.0 cm。端位语义与部分手写读数待核。</span><span>${state.geometryRevision?'独立边线种子；6带圆钝剖面；缓变厚度；连续法线':'V0.9.8 原始生成器'}</span><span>孔隙与观察光继承；表面增强可独立关闭。</span>`;
 fitCamera('trio',state.cameraSide);if(state.focusSingle){target.set(0,.025,0);yaw=-.63;pitch=state.cameraSide==='under'?-.5:.48;distance=(fam==='cover'?.80:1.05)*Math.max(1,.9/camera.aspect);updateCamera();}
}

function lifecycle(row,col,kind,rows,cols,yearOverride){
  const Y=yearOverride??state.year,yn=Y/100,seed=state.seed+(kind==='cover'?7001:0),base=hash01(row,col,seed,11),cx=.58,cy=.44;
  const dx=col/Math.max(1,cols-1)-cx,dy=row/Math.max(1,rows-1)-cy;
  const spread=.018+.15*smooth(18,100,Y),cluster=Math.exp(-(dx*dx+dy*dy)/spread);
  const exposure=clamp(.30+.52*(1-row/Math.max(1,rows-1))+.18*hash01(row,col,seed,29));
  let install=0,generation=0;
  if(state.care==='maintained'){
    for(let w=5;w<=Y;w+=5){
      const ageAt=w-install,major=w%25===0?1:0,ageRisk=smooth(18,70,ageAt);
      const repairProbability=.006+major*.065+ageRisk*.040+Math.max(0,base-.72)*.035+cluster*.010;
      if(hash01(row,col,w,seed,53)<repairProbability){install=w;generation++;}
    }
  }
  const age=Math.max(0,Y-install),an=age/100;
  let hazard,damageProbability,severeProbability,missingProbability;
  if(state.care==='maintained'){
    hazard=an*(.42+.16*exposure)+Math.max(0,base-.58)*.12+cluster*.025;
    damageProbability=clamp(smooth(4,22,Y)*(.006+an*.052+Math.max(0,base-.80)*.10+cluster*.012));
    severeProbability=clamp(smooth(.22,.66,hazard)*.28);
    missingProbability=clamp(smooth(.38,.82,hazard)*.035);
  }else{
    const baseWear=.015+.12*smooth(7,30,Y)+.13*smooth(25,60,Y)+.16*smooth(50,100,Y);
    const cascadeAmplitude=.04+.62*smooth(20,100,Y);
    hazard=baseWear*(.72+.38*exposure)+cluster*cascadeAmplitude+Math.max(0,base-.60)*.12;
    const timeGate=smooth(3,20,Y);
    damageProbability=clamp(timeGate*(.02+.10*smooth(8,30,Y)+.20*smooth(22,60,Y)+cluster*(.12+.58*smooth(18,100,Y))+Math.max(0,base-.75)*.25));
    severeProbability=clamp(timeGate*(.02+.10*smooth(20,55,Y)+.55*smooth(45,100,Y)+cluster*.20));
    missingProbability=clamp(.001+.035*smooth(20,50,Y)+.74*smooth(46,100,Y)+cluster*.20*smooth(35,100,Y));
  }
  const roll=hash01(row,col,seed,61),severeRoll=hash01(row,col,seed,67),missingRoll=hash01(row,col,seed,71);
  let damageClass=roll<damageProbability?(severeRoll<severeProbability?2:1):0;
  let missing=damageClass>0&&missingRoll<missingProbability;
  if(Y>=25&&age>=15){
    const residualRate=cols<=4?.08+.06*yn:.04+.025*yn;
    if(hash01(row,col,seed,79)>1-residualRate)damageClass=Math.max(damageClass,1);
  }
  if(state.care==='maintained'&&missing&&hash01(row,col,Y,seed,81)<.84)missing=false;
  const sag=state.care==='abandoned'?hazard*.040:hazard*.010;
  const water=clamp((damageClass*.18+(missing?.96:0))*exposure+cluster*yn*.16);
  return {age,install,generation,hazard,missing,damageClass,sag,water,exposure,cluster};
}
function crackSegments(g,seed,level,matrix=new THREE.Matrix4()){
  if(!level)return [];const proxy=makeProxy(g),p=g.userData.profile,w=(p.widthEave+p.widthRidge)*.5,out=[],n=level===2?3:1;
  for(let branch=0;branch<n;branch++){const cx=(hash01(seed,branch,18)-.5)*w*.40,cz=(hash01(seed,branch,21)-.5)*p.length*.48,a=hash01(seed,branch,27)*Math.PI*2,len=(.018+hash01(seed,branch,31)*.045)*(level===2?1.3:1);let previous=null;
    for(let k=0;k<=10;k++){const d=(k/10-.5)*len,x=cx+Math.cos(a)*d+Math.sin(k*1.6+branch)*.0006,z=cz+Math.sin(a)*d,y=proxy.height(x,z);if(!Number.isFinite(y)){previous=null;continue;}const v=new THREE.Vector3(x,y+.00016,z).applyMatrix4(matrix);if(previous)out.push(...previous.toArray(),...v.toArray());previous=v;}
  }return out;
}
function crackLines(vertices){if(!vertices.length)return null;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));const m=new THREE.LineBasicMaterial({color:0x242927,transparent:true,opacity:.62,depthWrite:false});const line=new THREE.LineSegments(g,m);line.userData.kind='tile-batch';return line;}

let lastRoof=null;
const placementCache=new Map();
function packFit(f){if(!f)return null;return {matrix:f.proxy.matrix.elements.slice(),tilt:f.tilt,roll:f.roll,leftGap:f.leftGap,rightGap:f.rightGap,overlapGap:f.overlapGap,contacts:f.contacts,unsupported:f.unsupported,iterations:f.iterations};}
function unpackFit(f,g){if(!f)return null;const proxy=makeProxy(g,new THREE.Matrix4().fromArray(f.matrix));return {...f,proxy};}
let woodMaterials=null,woodUVMats=null;
function getWoodMaterials(check=false){
  if(check&&woodUVMats)return woodUVMats;if(!check&&woodMaterials)return woodMaterials;
  function texture(end=false,uvMode=false){const c=document.createElement('canvas');c.width=512;c.height=end?512:1024;const ctx=c.getContext('2d');
    if(uvMode){ctx.fillStyle='#ecede3';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#426370';ctx.lineWidth=3;for(let x=0;x<=512;x+=64){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,c.height);ctx.stroke();}for(let y=0;y<=c.height;y+=64){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(512,y);ctx.stroke();}ctx.fillStyle='#c24931';ctx.font='bold 36px sans-serif';ctx.fillText(end?'END / 横断面':'SIDE / 木纹纵向',30,55);ctx.fillText('U →',300,c.height-35);ctx.fillStyle='#32678b';ctx.fillText('V ↑',25,160);ctx.lineWidth=12;ctx.strokeStyle='#32678b';ctx.beginPath();ctx.moveTo(65,c.height-100);ctx.lineTo(65,220);ctx.lineTo(40,255);ctx.moveTo(65,220);ctx.lineTo(90,255);ctx.stroke();}
    else{const image=ctx.createImageData(c.width,c.height);for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){let f;
      if(end){const r=Math.hypot(x-252,y-258),a=Math.atan2(y-258,x-252);f=.83+.033*Math.sin(r*.19+fbm(x*.018,y*.018,313,3)*3)+.012*Math.cos(a*44);}
      else{const u=x/512,v=y/1024,wave=Math.sin(v*7+Math.sin(v*19)*.13)*.9,fiber=Math.sin(x*.24+wave*.3+noise2(x*.008,y*.002,73)*15);f=.83+.03*fiber+.08*(fbm(x*.035,y*.0015,713,3)-.5);if(Math.pow(Math.max(0,Math.sin(x*.042+wave*.3)),28)>.88)f-=.033;}
      const k=(y*c.width+x)*4;image.data[k]=Math.round(clamp(f)*255);image.data[k+1]=Math.round(clamp(f)*255);image.data[k+2]=Math.round(clamp(f)*255);image.data[k+3]=255;}ctx.putImageData(image,0,0);}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
  }
  const arr=[false,true].map(end=>check?new THREE.MeshBasicMaterial({map:texture(end,true),side:THREE.FrontSide,toneMapped:false}):new THREE.MeshStandardMaterial({map:texture(end),vertexColors:true,roughness:.93,metalness:0,side:THREE.FrontSide,envMapIntensity:.40}));arr.forEach(m=>PERSISTENT_MATERIALS.add(m));if(check)woodUVMats=arr;else woodMaterials=arr;return arr;
}
function timberNodes(roof,rows,cols,stepX,stepZ,model){
  const length=(rows-1)*stepZ+PROFILE.pan.length+.10,mid=(rows-1)*stepZ*.5,beamZ=Array.from({length:4},(_,i)=>lerp(-.042,(rows-1)*stepZ+.042,i/3));
  const crossLength=cols*stepX+.20,beams=[],rafters=[],mat=getWoodMaterials(state.mode==='uv');let brokenRafters=0,brokenBeams=0;
  const gapForPeak=(fn,n,threshold,padding=.01)=>{let best=0,at=.5;for(let i=2;i<n-2;i++){const t=i/(n-1),v=fn(t);if(v>best){best=v;at=t;}}return best>threshold?[[clamp(at-padding,.03,.90),clamp(at+padding,.10,.97)]]:[];};
  for(let b=0;b<4;b++){
    const lossFn=t=>interpArray(model.beamLoss,b*cols,clamp((t*crossLength-.10)/(cols*stepX)),cols);
    const broken=state.care==='abandoned'?gapForPeak(lossFn,Math.max(8,cols*2),.20,.025):[];if(broken.length)brokenBeams++;
    const sample=t=>({loss:lossFn(t),stain:clamp(lossFn(t)*2),y:-(lossFn(t)**2)*.012*Math.sin(Math.PI*t)});
    const g=woodGeometry(crossLength,Math.max(20,cols*3),state.seed+b*433,TIMBER.beamRadius,sample,broken);const m=new THREE.Mesh(g,mat);m.rotation.y=Math.PI/2;m.position.set(0,-TIMBER.rafterRadius-TIMBER.beamRadius,beamZ[b]);m.castShadow=m.receiveShadow=cols<=4;m.userData.kind='crossbeam';m.updateMatrix();roof.add(m);beams.push({proxy:makeProxy(g,m.matrix),mesh:m,lossFn,broken});
  }
  for(let c=0;c<=cols;c++){
    const at=t=>clamp(((t-.5)*length+mid)/Math.max(.01,(rows-1)*stepZ));
    const lossFn=t=>interpArray(model.loss,c*rows,at(t),rows),stainFn=t=>interpArray(model.stain,c*rows,at(t),rows);
    const broken=[];
    if(state.care==='abandoned')for(let b=0;b<3;b++){
      const z=lerp(beamZ[b],beamZ[b+1],.52),t=(z-mid)/length+.5,l=lossFn(t);
      if(l>.48){const w=(.024+l*.055)/length;broken.push([t-w,t+w]);}
    }
    if(broken.length)brokenRafters++;
    const x=(c-cols/2)*stepX;
    // Surviving support anchors define the centreline. A missing beam station
    // does not teleport a rafter downward through the remaining beam ends.
    const anchors=beamZ.map((z,k)=>({z,h:beams[k].proxy.height(x,z)})).filter(a=>Number.isFinite(a.h));
    const sample=t=>{
      const z=(t-.5)*length+mid,loss=lossFn(t),r=TIMBER.rafterRadius*(1-loss);
      let ai=0;while(ai<anchors.length-2&&z>anchors[ai+1].z)ai++;
      const A=anchors[ai]??{z:beamZ[0],h:-TIMBER.rafterRadius},B=anchors[Math.min(ai+1,anchors.length-1)]??{z:beamZ[3],h:-TIMBER.rafterRadius};
      const q=clamp((z-A.z)/Math.max(.001,B.z-A.z)),base=lerp(A.h,B.h,q)+r;
      const relativeEI=Math.max(.035,Math.exp(-interpArray(model.dose,c*rows,at(t),rows)*.022)*Math.pow(1-loss,4));
      const sag=Math.min(.065,(1/relativeEI-1)*.0018)*Math.sin(Math.PI*q)**2;
      return {loss,stain:stainFn(t),y:base-sag};
    };
    const g=woodGeometry(length,Math.max(32,rows*5),state.seed+c*97,TIMBER.rafterRadius,sample,broken);const m=new THREE.Mesh(g,mat);m.position.set(x,0,mid);m.castShadow=m.receiveShadow=cols<=4;m.userData.kind='round-rafter';m.updateMatrix();
    // Exact mesh clearance, including the finite width of a round beam.
    // Lift the local support zone only; intermediate span sag is retained.
    let proxy=makeProxy(g,m.matrix),corrections=[];
    for(let k=0;k<beams.length;k++){
      const zc=beamZ[k]-mid,flat=TIMBER.beamRadius+length/Math.max(32,rows*5)*1.6,fade=Math.min(.18,(beamZ[1]-beamZ[0])*.46);
      const weight=z=>Math.abs(z-zc)<=flat?1:Math.max(0,1-(Math.abs(z-zc)-flat)/Math.max(.015,fade-flat));
      for(let iteration=0;iteration<4;iteration++){
        const check=exactGap(proxy,beams[k].proxy);if(!Number.isFinite(check.gap)||check.gap>=CONTACT_EPS-1e-7)break;
        const dy=CONTACT_EPS-check.gap+1e-7,pa=g.attributes.position;
        for(let j=0;j<pa.count;j++)pa.setY(j,pa.getY(j)+dy*weight(pa.getZ(j)));
        for(const node of g.userData.centreLine)node[1]+=dy*weight(node[0]);
        corrections.push({beam:k,liftMm:dy*1000});g.attributes.position.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();proxy=makeProxy(g,m.matrix);
      }
    }
    roof.add(m);rafters.push({mesh:m,proxy,broken,corrections,supportAnchors:anchors});
  }
  return {beams,rafters,beamZ,brokenRafters,brokenBeams};
}
function summarizeContact(fits){const cases=fits.filter(f=>f&&!f.unsupported),gaps=cases.flatMap(f=>[f.leftGap,f.rightGap]),overlaps=cases.map(f=>f.overlapGap).filter(Number.isFinite);return {tested:cases.length,maxSeatGapMm:gaps.length?Math.max(...gaps)*1000:0,minSeatGapMm:gaps.length?Math.min(...gaps)*1000:0,minOverlapGapMm:overlaps.length?Math.min(...overlaps)*1000:null,unresolved:fits.filter(f=>f?.unsupported).length,clearanceToleranceMm:CONTACT_EPS*1000};}
function buildRoofLike(kind){
  clearStage();const is48=kind==='forty8',cols=is48?4:22,rows=is48?6:20,coverRows=is48?8:20,seams=cols-1,stepX=.264,stepZ=.198;
  const roof=new THREE.Group();roof.rotation.x=-.43;roof.position.set(0,.36,is48?-.48:-1.82);stageRoot.add(roof);
  const layoutKey=[state.geometryRevision,state.edgeStrength,kind,state.year,state.seed,state.care].join('/'),cached=placementCache.get(layoutKey);
  const model=cached?.model??integrateTimber(rows,cols),panStates=model.panStates,timber=timberNodes(roof,rows,cols,stepX,stepZ,model);
  const geos={},lod=state.geometryRevision===0?(is48?{nu:16,nv:22}:{nu:10,nv:14}):(is48?{nu:16,nv:22}:{nu:10,nv:14});for(const family of ['pan','cover'])for(let d=0;d<3;d++){geos[`${family}/${d}`]=makeTileGeometry(family,{seed:state.seed+(family==='cover'?2000:0)+d*31,damageClass:d,nu:lod.nu,nv:lod.nv});}
  const buckets=new Map(),fits=[],panFits=[],coverFits=[],contacts=[],crackPoints=[];let panVisible=0,coverVisible=0,missing=0,damaged=0,replaced=0,unsupported=0;const populations=Object.fromEntries(POPULATION.map(x=>[x.name,0]));
  function addTile(family,r,c,st,fit,id){const variant=Math.floor(hash01(r,c,state.seed,family==='pan'?83:123)*3),ageTier=st.age<15?5:st.age<50?30:75,d=st.damageClass,key=`${family}/${variant}/${d}/${ageTier}`;let b=buckets.get(key);
    if(!b){const mat=state.mode==='uv'?UV_MATERIALS[family]:studyClayMaterial(family,variant,ageTier,state.light==='rain'?1:0),m=new THREE.InstancedMesh(geos[`${family}/${d}`],mat,is48?48:860);m.castShadow=m.receiveShadow=is48;m.userData.kind='tile-batch';roof.add(m);b={m,n:0};buckets.set(key,b);}
    if(st.damageClass)crackPoints.push(...crackSegments(geos[`${family}/${d}`],state.seed+id*127,st.damageClass,fit.proxy.matrix));
    b.m.setMatrixAt(b.n,fit.proxy.matrix);if(state.mode!=='uv'&&state.mode!=='clay')b.m.setColorAt(b.n,tileTint(id,st.age,st.generation));b.n++;
    if(st.damageClass)damaged++;if(st.generation)replaced++;fits.push(fit);fit.family=family;fit.id=id;for(const p of fit.contacts)if(p)contacts.push({p,family});
  }
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const i=r*cols+c,st=panStates[i];populations[populationFor(i,st.generation).name]++;if(st.missing){missing++;panFits[i]=null;continue;}
    const previous=[...(r&&panFits[(r-1)*cols+c]?[panFits[(r-1)*cols+c].proxy]:[]),...timber.beams.map(b=>b.proxy)];
    const s=cached?unpackFit(cached.pan[i],geos[`pan/${st.damageClass}`]):settleTile(geos[`pan/${st.damageClass}`],(c-(cols-1)/2)*stepX,r*stepZ,[timber.rafters[c].proxy],[timber.rafters[c+1].proxy],previous,stepX);
    if(!s||s.unsupported){unsupported++;missing++;panFits[i]=null;continue;}panFits[i]=s;addTile('pan',r,c,st,s,i);panVisible++;
  }
  const coverStep=((rows-1)*stepZ+PROFILE.pan.length-PROFILE.cover.length)/(coverRows-1);
  for(let r=0;r<coverRows;r++)for(let c=0;c<seams;c++){
    const i=r*seams+c,id=440+i,z=(PROFILE.cover.length-PROFILE.pan.length)/2+r*coverStep,st=lifecycle(r,c,'cover',coverRows,seams);populations[populationFor(id,st.generation).name]++;
    if(st.missing){missing++;coverFits[i]=null;continue;}
    const left=[],right=[];for(let pr=0;pr<rows;pr++)if(Math.abs(pr*stepZ-z)<.25){const a=panFits[pr*cols+c],b=panFits[pr*cols+c+1];if(a)left.push(a.proxy);if(b)right.push(b.proxy);}
    const previous=[...(r&&coverFits[(r-1)*seams+c]?[coverFits[(r-1)*seams+c].proxy]:[]),...timber.beams.map(b=>b.proxy)];
    const s=cached?unpackFit(cached.cover[i],geos[`cover/${st.damageClass}`]):settleTile(geos[`cover/${st.damageClass}`],(c+1-cols/2)*stepX,z,left,right,previous,.085);
    if(!s||s.unsupported){unsupported++;missing++;coverFits[i]=null;continue;}coverFits[i]=s;addTile('cover',r,c,st,s,id);coverVisible++;
  }
  for(const b of buckets.values()){b.m.count=b.n;b.m.instanceMatrix.needsUpdate=true;if(b.m.instanceColor)b.m.instanceColor.needsUpdate=true;b.m.computeBoundingSphere();}
  const crackMesh=crackLines(crackPoints);if(crackMesh)roof.add(crackMesh);
  const markerGeo=new THREE.SphereGeometry(.0038,7,5),markerMat=new THREE.MeshBasicMaterial({color:0x39a57f,depthTest:false}),markers=new THREE.InstancedMesh(markerGeo,markerMat,Math.max(1,contacts.length));markers.renderOrder=5;markers.count=contacts.length;
  contacts.forEach((d,i)=>{markers.setMatrixAt(i,new THREE.Matrix4().makeTranslation(...d.p));markers.setColorAt(i,new THREE.Color(d.family==='cover'?0xd19a37:0x24ab88));});markers.visible=state.showContacts;markers.userData.kind='contact-markers';roof.add(markers);
  const contactReport=summarizeContact(fits),designTotal=is48?48:860;
  const woodContacts=[];for(let c=0;c<timber.rafters.length;c++)for(let b=0;b<timber.beams.length;b++){const gap=exactGap(timber.rafters[c].proxy,timber.beams[b].proxy).gap;if(Number.isFinite(gap))woodContacts.push({rafter:c,beam:b,gapMm:gap*1000});}
  contactReport.timber={tested:woodContacts.length,minGapMm:Math.min(...woodContacts.map(c=>c.gapMm)),penetrations:woodContacts.filter(c=>c.gapMm<-.05),absentStations:timber.rafters.reduce((n,r)=>n+4-r.supportAnchors.length,0)};
  const actualGeometry=[...Object.values(geos).map(g=>({kind:g.userData.kind,qa:uvGate(g)})),...timber.rafters.concat(timber.beams).map(m=>({kind:'timber',qa:woodUVGate(m.mesh.geometry)}))];
  contactReport.actualGeometry={tested:actualGeometry.length,failures:actualGeometry.filter(x=>!x.qa.allPassed),allPassed:actualGeometry.every(x=>x.qa.allPassed)};
  if(!cached){placementCache.set(layoutKey,{model,pan:panFits.map(packFit),cover:coverFits.map(packFit)});if(placementCache.size>8)placementCache.delete(placementCache.keys().next().value);}
  lastRoof={kind,roof,rows,cols,coverRows,stepX,stepZ,panFits,coverFits,timber,contactReport,model,populations,counts:{design:designTotal,panVisible,coverVisible,missing,damaged,replaced,unsupported},markers};
  $('#sceneStats').innerHTML=`<b>${is48?'48片瓦构造检查':'860片屋面检查'}</b><span>${is48?'24片板瓦（4垄×6行）＋24片筒瓦（3缝×8行）':'440片板瓦＋420片筒瓦'}。筒瓦按自身搭接长度铺设。</span><span>${cols+1}根共享圆椽，直径8 cm；下方4根横梁，直径13.8 cm。尺寸为当前可调展示值。</span><span>${state.year}年 · ${state.care==='maintained'?'持续维护':'停止维护'}：在役 ${panVisible+coverVisible} / ${designTotal}，缺失或失去支承 ${missing}，可见破损 ${damaged}</span><span>双侧接触检查 ${contactReport.tested}片；最大落座间隙 ${contactReport.maxSeatGapMm.toFixed(2)} mm；搭接最小间隙 ${contactReport.minOverlapGapMm?.toFixed(2)??'无'} mm</span><span>断段圆椽 ${timber.brokenRafters}根；断段横梁 ${timber.brokenBeams}根。木板、望板、隐藏平面：0</span><span>整片色群：${Object.entries(populations).map(([k,v])=>k+' '+v).join('，')}</span>`;
  $('#contactGate').textContent=contactReport.unresolved===0&&contactReport.maxSeatGapMm<.5&&contactReport.timber.penetrations.length===0&&contactReport.actualGeometry.allPassed?'本场景检查通过':'本场景需复核';$('#contactGate').className=contactReport.maxSeatGapMm<.5&&contactReport.timber.penetrations.length===0&&contactReport.actualGeometry.allPassed?'pill ok':'pill bad';
  fitCamera(is48?'forty8':'roof',state.cameraSide);applyTimberOnly();
}
function applyTimberOnly(){stageRoot.traverse(o=>{if(o.userData.kind==='tile-batch')o.visible=!state.timberOnly;if(o.userData.kind==='contact-markers')o.visible=!!state.showContacts;});needsRender=true;}

function buildUV(){clearStage();if(state.uvFamily==='timber'){
  ['rafter','beam'].forEach((kind,i)=>{const g=woodGeometry(.52,18,321+i*9,i===0?.04:.069),m=new THREE.Mesh(g,getWoodMaterials(true));m.position.x=i===0?-.18:.18;m.rotation.set(.28,0,0);stageRoot.add(m);caption(i===0?'圆椽：侧壁 / 两端':'横梁：侧壁 / 两端',new THREE.Vector3(m.position.x,-.26,0),.37);});
  $('#sceneStats').innerHTML='<b>椽子与横梁 UV / 法线</b><span>侧壁 U 绕圆周，V 沿木纹；两端使用独立截面坐标。端面与侧壁不共享法线。</span><span>三角形朝外、接缝重复顶点、纵向 V、端面方向共同检查。</span>';fitCamera('uv');distance=1.75*Math.max(1,1.05/camera.aspect);updateCamera();return;
} const kinds=state.uvFamily==='both'?['pan','cover']:[state.uvFamily],xs=kinds.length===2?[-.34,.34]:[0],reports=[];kinds.forEach((kind,i)=>{const m=tileMesh(kind,i,0,{mode:'uv'});m.scale.setScalar(1.75);m.position.x=xs[i];m.rotation.x=-.08;stageRoot.add(m);reports.push({kind,report:uvGate(m.geometry)});caption(kind==='pan'?'板瓦六面':'筒瓦六面',new THREE.Vector3(xs[i],-.36,.07),.52);});state.uvReports=reports;renderUVReport();$('#sceneStats').innerHTML=`<b>逐面 UV 硬门</b><span>板瓦与筒瓦分别检查外表面、内表面、左右侧边、出檐端和迎水端</span><span>红箭头为 U 正向，蓝箭头为 V 正向</span><span>检查有限值、零到一范围、三角面积、拓扑方向、世界切线和世界副切线</span>`;fitCamera('uv',state.cameraSide);applyFaceCamera(state.selectedFace);}
function renderUVReport(){const box=$('#uvReport'),all=state.uvReports||[];if(!all.length){box.innerHTML='';return;}let passed=true,count=0,total=0;box.innerHTML=all.map(x=>`<div class="uv-family"><b>${x.kind==='pan'?'板瓦':'筒瓦'}</b>${x.report.faces.map(f=>{passed&&=f.passed;total++;if(f.passed)count++;return `<div class="qa-row ${f.passed?'pass':'fail'}"><span>${f.label}</span><b>${f.passed?'PASS':'FAIL'}</b></div>`;}).join('')}</div>`).join('');$('#uvGate').textContent=passed?`UV GATE ${count}/${total} PASS`:`UV GATE ${count}/${total}`;$('#uvGate').className=passed?'pill ok':'pill bad';}
function applyFaceCamera(face){if(state.scene!=='uv')return;target.set(0,0,0);distance=2.05;const v={all:[-.58,.48],top:[0,1.28],bottom:[0,-1.28],left:[-1.5,.04],right:[1.5,.04],eave:[Math.PI,.04],ridge:[0,.04]}[face]||[-.58,.48];yaw=v[0];pitch=v[1];updateCamera();}
function rebuild(){renderer.shadowMap.needsUpdate=true;lastRoof=null;$('#contactGate').textContent='落座：切换屋面检查';if(state.scene==='trio')buildTrio();else if(state.scene==='forty8')buildRoofLike('forty8');else if(state.scene==='roof')buildRoofLike('roof');else buildUV();syncUI();runGlobalQA();studyUI();}
function setLight(name){state.light=name;const p={neutral:{bg:0xa9aca8,amb:.42,hemi:1.20,key:2.55,fill:.88,rim:.48,under:.25,exp:1.08},sunny:{bg:0xb9c6cd,amb:.34,hemi:1.05,key:3.35,fill:.72,rim:.62,under:.18,exp:1.06},cloudy:{bg:0xb7bcba,amb:.56,hemi:1.58,key:1.40,fill:1.10,rim:.28,under:.30,exp:1.10},rain:{bg:0x8f9da2,amb:.42,hemi:1.28,key:1.55,fill:.82,rim:.38,under:.24,exp:1.01}}[name];scene.background=new THREE.Color(p.bg);ambient.intensity=p.amb;hemi.intensity=p.hemi;key.intensity=p.key;fill.intensity=p.fill;rim.intensity=p.rim;underFill.intensity=p.under;renderer.toneMappingExposure=p.exp;rebuild();}
function syncUI(){$('#underCamera').classList.toggle('active',state.cameraSide==='under');$('#timberOnly').classList.toggle('active',state.timberOnly);$('#contacts').classList.toggle('active',state.showContacts);$$('[data-scene]').forEach(b=>b.classList.toggle('active',b.dataset.scene===state.scene));$$('[data-light]').forEach(b=>b.classList.toggle('active',b.dataset.light===state.light));$$('[data-care]').forEach(b=>b.classList.toggle('active',b.dataset.care===state.care));$$('[data-family]').forEach(b=>b.classList.toggle('active',b.dataset.family===state.trioFamily));$$('[data-uv-family]').forEach(b=>b.classList.toggle('active',b.dataset.uvFamily===state.uvFamily));$$('[data-year]').forEach(b=>b.classList.toggle('active',+b.dataset.year===state.year));$('#yearValue').textContent=state.year+' 年';$('#year').value=state.year;$('#mode').value=state.mode;$('#seed').value=state.seed;$('#sceneName').textContent={trio:'三片独立瓦',forty8:'四十八片瓦',roof:'八百六十片屋面',uv:'逐面 UV 检查'}[state.scene];$('#faceControls').hidden=state.scene!=='uv';$('#uvFamilyControls').hidden=state.scene!=='uv';$('#trioControls').hidden=state.scene!=='trio';$('#lifeControls').hidden=state.scene==='uv'||state.scene==='trio';}
let lastGlobalQA=null;
function runGlobalQA(){const pg=makeTileGeometry('pan',{seed:101}),cg=makeTileGeometry('cover',{seed:202}),rg=woodGeometry(.62,18,503,.04),bg=woodGeometry(.75,18,709,.069);const p=uvGate(pg),c=uvGate(cg),r=woodUVGate(rg),b=woodUVGate(bg);[pg,cg,rg,bg].forEach(g=>g.dispose());const all=p.allPassed&&c.allPassed&&r.allPassed&&b.allPassed,total=[p,c,r,b].flatMap(x=>x.faces),count=total.filter(x=>x.passed).length;$('#uvGate').textContent=`UV / 法线 ${count}/${total.length}`;$('#uvGate').className=all?'pill ok':'pill bad';lastGlobalQA={pan:p,cover:c,rafter:r,crossbeam:b,allPassed:all};$('#uvReport').innerHTML=[['板瓦',p],['筒瓦',c],['圆椽',r],['横梁',b]].map(([n,q])=>`<b>${n}</b>`+q.faces.map(f=>`<div class="qa-row ${f.passed?'pass':'fail'}"><span>${f.label||f.face}</span><b>${f.passed?'PASS':'FAIL'}</b></div>`).join('')).join('');return lastGlobalQA;}


function queued(action){const overlay=$('#runtimeOverlay');$('#runtimeTitle').textContent='正在计算实际搭接与承托';$('#runtimeMessage').textContent='首次打开860片需要计算实际接触，等待时间取决于设备。已计算的年份会缓存，灯光与回看继续沿用同一份几何。';overlay.hidden=false;requestAnimationFrame(()=>setTimeout(()=>{try{action();}catch(e){window.__tilesShowRuntimeError(e.message);return;}overlay.hidden=true;},20));}
$$('[data-scene]').forEach(b=>b.onclick=()=>{state.scene=b.dataset.scene;state.focusSingle=false;state.cameraSide='iso';queued(rebuild);});
$$('[data-light]').forEach(b=>b.onclick=()=>queued(()=>setLight(b.dataset.light)));
$$('[data-care]').forEach(b=>b.onclick=()=>{state.care=b.dataset.care;queued(rebuild);});
$$('[data-family]').forEach(b=>b.onclick=()=>{state.trioFamily=b.dataset.family;rebuild();});
$$('[data-uv-family]').forEach(b=>b.onclick=()=>{state.uvFamily=b.dataset.uvFamily;rebuild();});
$$('[data-year]').forEach(b=>b.onclick=()=>{state.year=+b.dataset.year;queued(rebuild);});
$('#year').oninput=e=>{$('#yearValue').textContent=e.target.value+' 年';};$('#year').onchange=e=>{state.year=+e.target.value;queued(rebuild);};
$('#mode').onchange=e=>{state.mode=e.target.value;queued(rebuild);};
$('#seed').onchange=e=>{state.seed=Math.max(1,Math.floor(+e.target.value||1));queued(rebuild);};
$('#timberOnly').onclick=()=>{state.timberOnly=!state.timberOnly;$('#timberOnly').classList.toggle('active',state.timberOnly);applyTimberOnly();};
$('#contacts').onclick=()=>{state.showContacts=!state.showContacts;$('#contacts').classList.toggle('active',state.showContacts);applyTimberOnly();};
$('#newSeed').onclick=()=>{state.seed=hash32(state.seed+Date.now());queued(rebuild);};
$('#resetCamera').onclick=()=>fitCamera(state.scene,'iso');
$('#underCamera').onclick=()=>{state.cameraSide=state.cameraSide==='under'?'iso':'under';fitCamera(state.scene,state.cameraSide);$('#underCamera').classList.toggle('active',state.cameraSide==='under');};
$('#spin').onclick=()=>{state.autoRotate=!state.autoRotate;$('#spin').classList.toggle('active',state.autoRotate);};
$$('[data-face]').forEach(b=>b.onclick=()=>{state.selectedFace=b.dataset.face;$$('[data-face]').forEach(x=>x.classList.toggle('active',x===b));applyFaceCamera(state.selectedFace);});
$('#capture').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download=`Tiles_Mother_V098_${state.scene}_${state.year}.png`;a.href=canvas.toDataURL('image/png');a.click();};
$('#paletteInfo').innerHTML=POPULATION.map(p=>`<div class="sw"><i style="background:${p.hex}"></i><span>${p.name}</span><small>${p.weight}%</small></div>`).join('');
$('#dimensionInfo').innerHTML=`<div class="stats"><span><b>板瓦</b> 23.8 × 24.2/22.1 cm，弧深约 5.0 cm，厚约 1.2 cm</span><span><b>筒瓦</b> 22.2 × 11.5/9.0 cm，弧高约 3.7 cm，厚约 1.0 cm</span><span>测绘读数保留约值状态，未把模糊字迹登记为精确实测。</span></div>`;
const params=new URLSearchParams(location.search);if(params.has('scene'))state.scene=params.get('scene');if(params.has('year'))state.year=clamp(+params.get('year'),0,100);if(params.has('care'))state.care=params.get('care');if(params.has('light'))state.light=params.get('light');if(params.has('mode'))state.mode=params.get('mode');
setLight(state.light);
let last=performance.now();function loop(now){if(state.autoRotate){yaw+=(now-last)*.00017;updateCamera();}last=now;if(needsRender){renderer.render(scene,camera);needsRender=false;}requestAnimationFrame(loop);}requestAnimationFrame(loop);
window.TilesMotherV098={version:'0.9.8',state,getState:()=>structuredClone(state),setScene:s=>{state.scene=s;rebuild();},setYear:y=>{state.year=clamp(+y,0,100);rebuild();},setCare:c=>{state.care=c;rebuild();},runUVQA:runGlobalQA,getContactQA:()=>lastRoof?.contactReport??null,getCounts:()=>lastRoof?.counts??null,getPopulation:()=>lastRoof?.populations??null,profiles:PROFILE,structure:{roofBoardCount:0,hiddenSupportPlaneCount:0,panSupportRafters:2,crossbeamCount:4,rafterDiameter:.08,crossbeamDiameter:.138},setView:(x)=>{Object.assign(state,x);rebuild();},setCamera:(a,p,d)=>{yaw=a;pitch=p;distance=d;updateCamera();},getTimberQA:()=>lastRoof?{brokenRafters:lastRoof.timber.brokenRafters,brokenBeams:lastRoof.timber.brokenBeams,maxRadialLoss:Math.max(...lastRoof.model.loss),maxBeamLoss:Math.max(...lastRoof.model.beamLoss)}:null,verifyAllContacts:()=>lastRoof?.contactReport??null,visualApproved:false,productionApproved:false};
window.__tilesDebug={uvGate,woodUVGate,THREE,scene,stageRoot,camera,renderer,makeProxy,exactGap,getRoof:()=>lastRoof,clayShader,detail};

document.body.dataset.ready='true';document.body.dataset.version='0.9.8';const overlay=$('#runtimeOverlay');if(overlay)overlay.hidden=true;const gate=$('#runtimeGate');if(gate){gate.textContent='3D READY';gate.className='pill ok';}

/* Live UI: comparison changes keep the same camera and installation conditions. */
function studyCameraSave(){return {yaw,pitch,distance,target:target.toArray(),side:state.cameraSide};}
function studyCameraRestore(v){yaw=v.yaw;pitch=v.pitch;distance=v.distance;target.fromArray(v.target);state.cameraSide=v.side;updateCamera();}
function applyStudyPreset(name){
 const keep=studyCameraSave();
 const shape=name==='original'?0:1,surface=name==='surface'?1:0;
 const changed=shape!==state.geometryRevision;
 state.geometryRevision=shape;state.surfaceRevision=surface;
 if(changed){queued(()=>{rebuild();studyCameraRestore(keep);studyUI();});}
 else{updateStudySurface();studyUI();}
}
function studyUI(){
 const name=state.geometryRevision===0?'original':state.surfaceRevision?'surface':'shape';
 $$('[data-study]').forEach(b=>b.classList.toggle('active',b.dataset.study===name));
 $('#studyLabel').textContent={original:'A · V0.9.8 原形 / 原材质',shape:'B · 新边口 / 原材质',surface:'C · 新边口 / 分层材质'}[name];
 $('#edgeRange').value=Math.round((state.edgeStrength??1)*100);$('#edgeValue').textContent=$('#edgeRange').value+'%';
 $('#colorRange').value=Math.round((state.colorLayer??1)*100);$('#colorValue').textContent=$('#colorRange').value+'%';
 $('#reliefRange').value=Math.round((state.striations??.7)*100);$('#reliefValue').textContent=$('#reliefRange').value+'%';
 $('#closeup').classList.toggle('active',!!state.focusSingle);
 $('#revisionInfo').textContent='V0.9.9 · 候选审阅 · 基线 V0.9.8 保留';
 $('#surfaceNote').textContent=state.surfaceRevision?'参考分层已启用；原微孔与观察光保持':'原陶瓦着色与观察光保持';
}
function focusStudy(){
 state.scene='trio';state.focusSingle=!state.focusSingle;state.cameraSide='iso';rebuild();
}
function setStudyAngle(which){
 const isSmall=state.scene==='trio'||state.scene==='uv';
 if(!isSmall){if(which==='under'){state.cameraSide='under';fitCamera(state.scene,'under');}else fitCamera(state.scene,'iso');return;}
 if(!state.focusSingle){state.scene='trio';state.focusSingle=true;rebuild();}
 target.set(0,-.007,0);distance=(state.trioFamily==='cover'?1.10:1.38)*Math.max(1,.9/camera.aspect);
 if(which==='edge'){yaw=-.67;pitch=.19;}
 if(which==='end'){yaw=Math.PI;pitch=.03;}
 if(which==='top'){yaw=0;pitch=1.36;}
 if(which==='under'){yaw=-.55;pitch=-.5;}
 if(which==='iso'){yaw=-.63;pitch=.60;}
 state.cameraSide=which==='under'?'under':'iso';updateCamera();studyUI();
}
$$('[data-study]').forEach(b=>b.onclick=()=>applyStudyPreset(b.dataset.study));
$('#edgeRange').oninput=e=>{$('#edgeValue').textContent=e.target.value+'%';};
$('#applyEdge').onclick=()=>{const c=studyCameraSave();state.edgeStrength=+$('#edgeRange').value/100;state.geometryRevision=1;queued(()=>{rebuild();studyCameraRestore(c);studyUI();});};
$('#colorRange').oninput=e=>{state.colorLayer=+e.target.value/100;state.surfaceRevision=1;updateStudySurface();studyUI();};
$('#reliefRange').oninput=e=>{state.striations=+e.target.value/100;state.surfaceRevision=1;updateStudySurface();studyUI();};
$('#closeup').onclick=focusStudy;$$('[data-study-angle]').forEach(b=>b.onclick=()=>setStudyAngle(b.dataset.studyAngle));
$('#neutralClay').onclick=()=>{const keep=studyCameraSave();state.mode=state.mode==='clay'?'material':'clay';queued(()=>{rebuild();studyCameraRestore(keep);studyUI();});};
$('#saveStudy').onclick=()=>{const r={schema:'tiles-mother-v099-review-state',version:'0.9.9',state:structuredClone(state),camera:studyCameraSave(),counts:lastRoof?.counts??null,contacts:lastRoof?.contactReport??null,sourceCommit:'ab18ac365be1444587f42f483af5d2a08cf8a815',sourceScanSHA256:'ae5510c0e2eaec236adff0b94d978688f6c17a9412407c6c7ec54968222dd365',visualApproved:false,productionApproved:false};const url=URL.createObjectURL(new Blob([JSON.stringify(r,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='Tiles_Mother_V099_Review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
let referenceURL=null;
$('#referenceFile').onchange=e=>{const f=e.target.files[0];if(!f)return;if(!/^image\//.test(f.type)){alert('请选择图片文件');return;}if(referenceURL)URL.revokeObjectURL(referenceURL);referenceURL=URL.createObjectURL(f);$('#referenceImage').src=referenceURL;$('#referenceName').textContent=f.name;$('#referencePanel').hidden=false;};
$('#closeReference').onclick=()=>{$('#referencePanel').hidden=true;};
// Two-finger pinch/pan is independent from the inherited single-pointer rotation.
const touchPoints=new Map();let touchGesture=null;
canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touchPoints.size===2){const a=[...touchPoints.values()];touchGesture={span:Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y),x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2};drag=null;e.stopImmediatePropagation();}},true);
canvas.addEventListener('pointermove',e=>{if(!touchPoints.has(e.pointerId))return;touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touchPoints.size===2&&touchGesture){const a=[...touchPoints.values()],span=Math.hypot(a[1].x-a[0].x,a[1].y-a[0].y),x=(a[0].x+a[1].x)/2,y=(a[0].y+a[1].y)/2;distance=clamp(distance*touchGesture.span/Math.max(1,span),.3,24);const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);target.addScaledVector(right,-(x-touchGesture.x)*distance*.00115).addScaledVector(up,(y-touchGesture.y)*distance*.00115);touchGesture={span,x,y};drag=null;updateCamera();e.stopImmediatePropagation();}},true);
for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,e=>{touchPoints.delete(e.pointerId);touchGesture=null;},true);
window.TilesMotherV099={...window.TilesMotherV098,version:'0.9.9',applyPreset:applyStudyPreset,setAngle:setStudyAngle,focus:focusStudy,getCamera:studyCameraSave,sourceCommit:'ab18ac365be1444587f42f483af5d2a08cf8a815',setView:x=>{Object.assign(state,x);rebuild();studyUI();},geometryBuilders:{original:makeTileGeometryV098,candidate:makeTileGeometryV099},auditUV:uvGate};
window.__tilesDebug.makeTileGeometry=makeTileGeometry;window.__tilesDebug.placementCache=placementCache;
studyUI();document.body.dataset.version='0.9.9';

renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;needsRender=true;
