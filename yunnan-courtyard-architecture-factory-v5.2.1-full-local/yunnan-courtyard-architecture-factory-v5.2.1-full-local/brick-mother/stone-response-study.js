'use strict';
const STUDY_VERSION='stone-response-s1.0';
const PARAMS=new URLSearchParams(location.search);
const settings={kind:Math.max(0,Math.min(3,Number(PARAMS.get('stone')??0))),scale:1,mineral:.7,chroma:1,rough:0,wet:0,relief:1,angle:-30,exposure:1};
const names=['青灰石灰岩','暖色砂岩','花岗岩','蓝灰板岩'];
const shaderExtension=`
uniform int sKind;
uniform vec4 sSurface;
uniform vec4 sDisplay;
uniform float sRelief;
struct StoneSample {vec3 color;float height;float rough;float mineral;float cavity;};
float sf(vec3 p){return valueNoise3(p)*.57+valueNoise3(p*2.07+13.7)*.28+valueNoise3(p*4.11+27.2)*.15;}
vec4 scell(vec3 p){vec3 ip=floor(p),fp=fract(p);float md=100.;vec3 id=vec3(0);for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 off=vec3(x,y,z),ix=ip+off;vec3 v=off+hash33(ix)-fp;float d=dot(v,v);if(d<md){md=d;id=ix;}}return vec4(hash33(id+3.4),sqrt(md));}
StoneSample stoneFields(vec3 pos){
 vec3 seed=seedVector(uColorSeed,.071);vec3 p=pos*sSurface.x;
 vec3 q=p+vec3(sf(p*.8+seed),sf(p*.8+seed+7.),sf(p*.8+seed+19.))*.25;
 float broad=sf(q*1.35+seed),patch=sf(q*3.2+seed+11.);
 float grain=valueNoise3(q*49.+seed),weather=sf(q*2.2+seedVector(uWeatherSeed,.09));
 float phase=q.y*5.7+q.x*.82+q.z*.41+sf(q*1.8+seed)*1.25;
 float bands=.5+.5*sin(phase*6.28318);
 float line=abs(sin((q.x*.84+q.y*.37+q.z*.51+sf(q*1.7+seed)*.44)*12.));
 float aa=max(fwidth(line),.008);
 float vein=(1.-smoothstep(.028,.064+aa,line))*smoothstep(.34,.63,patch);
 float pits=pow(max(0.,(sf(q*19.+seedVector(uPoreSeed,.061))-.57)/.43),2.);
 vec4 crystal=scell(q*13.+seed);float mineral=0.;float h=0.;float rough=.75;vec3 col=vec3(.4);
 if(sKind==0){
  col=mix(vec3(.26,.31,.32),vec3(.57,.59,.55),smoothstep(.24,.73,broad));
  col=mix(col,vec3(.49,.40,.29),smoothstep(.57,.76,weather)*.65);
  mineral=vein*sSurface.y;col=mix(col,vec3(.83,.81,.70),mineral*.90);
  rough=mix(.79,.43,mineral);h=(broad-.5)*.018+(patch-.5)*.007+vein*.004-pits*.025;
 }else if(sKind==1){
  float strata=sf(vec3(q.x*1.4,phase*1.8,q.z*1.4)+seed);
  col=mix(vec3(.34,.21,.13),vec3(.75,.58,.36),smoothstep(.24,.76,strata*.64+broad*.36));
  col=mix(col,vec3(.48,.27,.15),pow(bands,9.)*smoothstep(.30,.64,patch)*.43);
  mineral=smoothstep(.80,.93,crystal.z)*sSurface.y;
  col=mix(col,vec3(.85,.76,.60),mineral*.46);rough=.87-mineral*.11;
  h=(strata-.5)*.015+sin(phase*6.28318)*.0025+(grain-.5)*.0007-pits*.011;
 }else if(sKind==2){
  float a=smoothstep(.28,.34,crystal.x),b=smoothstep(.62,.68,crystal.x);
  col=mix(vec3(.18,.20,.20),vec3(.67,.66,.59),a);
  col=mix(col,vec3(.73,.49,.41),b*.83);col*=.80+.29*patch;
  mineral=(1.-a*.7)*sSurface.y;rough=mix(.66,.28,mineral);
  h=(crystal.y-.5)*.003+(broad-.5)*.009+(grain-.5)*.00035-pits*.007;
 }else{
  float cleavage=sf(vec3(q.x*1.8,phase*2.8,q.z*1.8)+seed);
  col=mix(vec3(.10,.15,.19),vec3(.30,.37,.40),smoothstep(.20,.78,cleavage*.58+broad*.42));
  col=mix(col,vec3(.47,.33,.20),smoothstep(.60,.77,weather)*.67);
  mineral=vein*sSurface.y;col=mix(col,vec3(.57,.61,.57),mineral*.51);
  rough=.48+cleavage*.17-mineral*.19;
  h=(cleavage-.5)*.009+(broad-.5)*.012+sin(phase*6.28318)*.0018-pits*.01;
 }
 float geomCavity=0.;for(int i=0;i<20;i++){if(i>=uEventCount)break;vec3 r=max(uEventSize[i].xyz,vec3(.001));float d=length((pos-uEventCenter[i].xyz)/r);float code=uEventCenter[i].w;if(code==6.||code==5.)geomCavity=max(geomCavity,1.-smoothstep(.35,1.2,d));}
 float cav=clamp(geomCavity*.55+pits*1.4,0.,1.);
 float wet=clamp(sSurface.z*(.18+.82*smoothstep(.32,.75,weather+cav*.25)),0.,1.);
 float lum=dot(col,vec3(.2126,.7152,.0722));col=mix(vec3(lum),col,sDisplay.w);
 vec3 linear=srgbToLinear(clamp(col,.025,.95));linear*=1.-wet*.38;
 StoneSample o;o.color=linear;o.height=h*sRelief;o.rough=clamp(mix(rough+sSurface.w,.17,wet),.12,.98);o.mineral=mineral;o.cavity=cav;return o;
}
vec3 stoneLight(vec3 N,vec3 V,vec3 L,vec3 irradiance,vec3 c,float r){
 float nv=max(dot(N,V),.001),nl=max(dot(N,L),0.);vec3 hv=V+L;vec3 H=hv/max(length(hv),.00001);
 float nh=max(dot(N,H),0.),vh=max(dot(V,H),0.),a=max(r*r,.018),a2=a*a;
 float den=nh*nh*(a2-1.)+1.;float D=a2/(3.14159265*den*den+.000001);
 float k=(r+1.)*(r+1.)*.125;float G=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);
 vec3 F=vec3(.04)+vec3(.96)*pow(1.-vh,5.);
 return ((1.-F)*c/3.14159265+D*G*F/max(4.*nv*nl,.001))*irradiance*nl;
}
vec4 stoneResponse(){
 StoneSample m=stoneFields(vLocalPos);vec3 N=normalize(vNormal);if(!gl_FrontFacing)N=-N;
 vec3 dx=dFdx(vWorldPos),dy=dFdy(vWorldPos),r1=cross(dy,N),r2=cross(N,dx);float det=dot(dx,r1);
 N=normalize(abs(det)*N-sign(det)*(dFdx(m.height)*r1+dFdy(m.height)*r2));
 if(uDebugMode==1)return vec4(linearToSrgb(m.color),1.);
 if(uDebugMode==2)return vec4(vec3(m.cavity),1.);
 if(uDebugMode==3)return vec4(vec3(m.rough),1.);
 if(uDebugMode==4)return vec4(N*.5+.5,1.);
 if(uDebugMode==8)return vec4(vec3(m.mineral),1.);
 vec3 V=normalize(uCamera-vWorldPos);float a=sDisplay.x;
 vec3 L=normalize(vec3(sin(a),.62,cos(a)));vec3 light=stoneLight(N,V,L,vec3(2.8,2.74,2.62),m.color,m.rough);
 light+=stoneLight(N,V,normalize(vec3(.70,.32,-.5)),vec3(.52,.59,.7),m.color,m.rough);
 float ao=1.-m.cavity*.40;light+=m.color*(.21+.15*(N.y*.5+.5))*ao;
 vec3 c=vec3(1.)-exp(-max(light,vec3(0.))*sDisplay.y);
 return vec4(linearToSrgb(c),1.);
}
`;
function compileProgram(gl,vs,fs){const shaders=[vs,fs].map((src,i)=>{const s=gl.createShader(i?gl.FRAGMENT_SHADER:gl.VERTEX_SHADER);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;});const p=gl.createProgram();shaders.forEach(s=>gl.attachShader(p,s));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));shaders.forEach(s=>gl.deleteShader(s));return p;}
const vertexSource=`#version 300 es
precision highp float;
in vec3 aPosition;in vec3 aNormal;uniform mat4 uViewProj;
out vec3 vWorldPos;out vec3 vLocalPos;out vec3 vNormal;
void main(){vWorldPos=aPosition;vLocalPos=aPosition;vNormal=aNormal;gl_Position=uViewProj*vec4(aPosition,1.);}`;
const fieldSource=`#version 300 es
precision highp float;
in vec3 vWorldPos;in vec3 vLocalPos;in vec3 vNormal;out vec4 outColor;
uniform vec3 uCamera;uniform float uColorSeed;uniform float uPoreSeed;uniform float uWeatherSeed;uniform int uDebugMode;
uniform int uEventCount;uniform vec4 uEventCenter[20];uniform vec4 uEventSize[20];
vec3 hash33(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.xxy+p.yxx)*p.zyx);}
float valueNoise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);return mix(mix(mix(hash33(i).x,hash33(i+vec3(1,0,0)).x,f.x),mix(hash33(i+vec3(0,1,0)).x,hash33(i+vec3(1,1,0)).x,f.x),f.y),mix(mix(hash33(i+vec3(0,0,1)).x,hash33(i+vec3(1,0,1)).x,f.x),mix(hash33(i+vec3(0,1,1)).x,hash33(i+vec3(1,1,1)).x,f.x),f.y),f.z);}
vec3 seedVector(float seed,float salt){return hash33(vec3(seed*.001,salt,seed*.00013))*49.;}
vec3 srgbToLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 linearToSrgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
`+shaderExtension+`
void main(){outColor=stoneResponse();}`;
function viewMatrix(eye,target){const G=window.BrickMotherGeometryV2,z=G.norm3(G.sub3(eye,target)),x=G.norm3(G.cross3(G.vec3(0,1,0),z)),y=G.cross3(z,x);return new Float32Array([x.x,y.x,z.x,0,x.y,y.y,z.y,0,x.z,y.z,z.z,0,-G.dot3(x,eye),-G.dot3(y,eye),-G.dot3(z,eye),1]);}
function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
class StoneRenderer{
 constructor(canvas){this.canvas=canvas;this.gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(!this.gl)throw Error('当前浏览器没有可用的 WebGL2');const gl=this.gl;this.program=compileProgram(gl,vertexSource,fieldSource);this.loc=Object.fromEntries(['uViewProj','uCamera','uColorSeed','uPoreSeed','uWeatherSeed','uDebugMode','uEventCount','uEventCenter[0]','uEventSize[0]','sKind','sSurface','sDisplay','sRelief'].map(k=>[k,gl.getUniformLocation(this.program,k)]));this.pos=gl.getAttribLocation(this.program,'aPosition');this.nor=gl.getAttribLocation(this.program,'aNormal');this.meshes=[];this.debugMode=0;this.autoRotate=false;this.lightRotate=false;this.dirty=true;this.drag=false;this.drawCount=0;this.resetView();canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.onpointerdown=e=>{this.drag=true;this.pan=e.button===2||e.shiftKey;this.px=e.clientX;this.py=e.clientY;canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!this.drag)return;const dx=e.clientX-this.px,dy=e.clientY-this.py;this.px=e.clientX;this.py=e.clientY;if(this.pan){this.camera.target.x-=dx*.004*this.camera.distance;this.camera.target.y+=dy*.004*this.camera.distance;}else{this.camera.yaw+=dx*.007;this.camera.pitch=Math.max(-1.2,Math.min(1.2,this.camera.pitch+dy*.006));}this.dirty=true;};canvas.onpointerup=canvas.onpointercancel=()=>this.drag=false;canvas.addEventListener('wheel',e=>{e.preventDefault();this.camera.distance=Math.max(2.6,Math.min(20,this.camera.distance*Math.exp(e.deltaY*.001)));this.dirty=true;},{passive:false});this.observer=new ResizeObserver(()=>this.dirty=true);this.observer.observe(canvas);requestAnimationFrame(t=>this.loop(t));}
 resetView(){this.camera={yaw:.24,pitch:.13,distance:6.15,target:{x:0,y:0,z:0}};this.dirty=true;}
 setDebugMode(n){this.debugMode=n;this.dirty=true;}
 setMeshes(items){const gl=this.gl;for(const m of this.meshes){gl.deleteBuffer(m.p);gl.deleteBuffer(m.n);}this.meshes=items.map(item=>{const upload=data=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return b;};return {...item,p:upload(item.mesh.positions),n:upload(item.mesh.normals)};});this.dirty=true;}
 draw(){const gl=this.gl,c=this.canvas,l=this.loc;const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(2,Math.round(c.clientWidth*dpr)),h=Math.max(2,Math.round(c.clientHeight*dpr));if(c.width!==w||c.height!==h){c.width=w;c.height=h;}gl.viewport(0,0,w,h);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);const cam=this.camera,cp=Math.cos(cam.pitch),eye={x:cam.target.x+Math.sin(cam.yaw)*cp*cam.distance,y:cam.target.y+Math.sin(cam.pitch)*cam.distance,z:cam.target.z+Math.cos(cam.yaw)*cp*cam.distance};const f=1/Math.tan(Math.PI/8.4),near=.05,far=100;const proj=new Float32Array([f/(w/h),0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);gl.uniformMatrix4fv(l.uViewProj,false,multiply(proj,viewMatrix(eye,cam.target)));gl.uniform3f(l.uCamera,eye.x,eye.y,eye.z);gl.uniform1i(l.uDebugMode,this.debugMode);gl.uniform1i(l.sKind,settings.kind);gl.uniform4f(l.sSurface,settings.scale,settings.mineral,settings.wet,settings.rough);gl.uniform4f(l.sDisplay,settings.angle*Math.PI/180,settings.exposure,0,settings.chroma);gl.uniform1f(l.sRelief,settings.relief);for(const item of this.meshes){for(const [loc,buffer] of [[this.pos,item.p],[this.nor,item.n]]){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);}const seeds=item.mesh.seedDNA;gl.uniform1f(l.uColorSeed,seeds.color);gl.uniform1f(l.uPoreSeed,seeds.pore);gl.uniform1f(l.uWeatherSeed,seeds.weather);const events=item.mesh.damage.formationEvents.slice(0,20),a=new Float32Array(80),b=new Float32Array(80);events.forEach((e,i)=>{a.set([e.center.x,e.center.y,e.center.z,e.typeCode],i*4);b.set([e.size.x,e.size.y,e.size.z,e.strength],i*4);});gl.uniform1i(l.uEventCount,events.length);gl.uniform4fv(l['uEventCenter[0]'],a);gl.uniform4fv(l['uEventSize[0]'],b);gl.drawArrays(gl.TRIANGLES,0,item.mesh.vertices);}this.drawCount++;}
 loop(t){const dt=Math.min(.05,(t-(this.lastTime||t))/1000);this.lastTime=t;if(this.autoRotate&&!this.drag){this.camera.yaw+=dt*.22;this.dirty=true;}if(this.lightRotate){settings.angle=(settings.angle+dt*18+180)%360-180;document.getElementById('angle').value=settings.angle;document.getElementById('angleOut').textContent=Math.round(settings.angle)+'°';this.dirty=true;}if(this.dirty&&this.meshes.length){this.draw();this.dirty=false;}requestAnimationFrame(n=>this.loop(n));}
}
let renderer,profile,currentMesh;let building=false;const cache=new Map();
function showError(e){document.getElementById('busy').hidden=false;document.getElementById('busy').textContent='加载失败：'+e.message;document.documentElement.dataset.studyReady='false';console.error(e);}
function selectStone(n){settings.kind=n;document.querySelectorAll('[data-kind]').forEach(b=>b.classList.toggle('on',+b.dataset.kind===n));document.getElementById('badge').textContent=(n<0?'原 V2.7.5 石材':names[n])+(settings.wet>.02?' · 局部潮湿':' · 干燥表面');if(renderer)renderer.dirty=true;}
async function build(){if(building)return;building=true;const busy=document.getElementById('busy');busy.hidden=false;busy.textContent='正在生成现有石材网格…';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));try{const G=window.BrickMotherGeometryV2;const seed=Math.max(1,Math.min(9999999,Math.round(Number(document.getElementById('seed').value)||8231)));const quality=Number(document.getElementById('quality').value);const key=seed+':'+quality;let mesh=cache.get(key);const start=performance.now();if(!mesh){const controls={...profile.compositeDefaults,benchmarkSlab:1,mobilePreview:0};mesh=G.buildMesh(profile,{master:seed},controls,.48,quality);if(cache.size>=4)cache.delete(cache.keys().next().value);cache.set(key,mesh);}currentMesh=mesh;renderer.setMeshes([{profile,mesh,position:G.vec3(0,0,0),yaw:0}]);renderer.resetView();renderer.camera.yaw=.24;renderer.camera.pitch=.13;renderer.camera.distance=6.15;renderer.dirty=true;window.__STONE_STUDY__={version:STUDY_VERSION,sourceHead:'54f9ae9f43c078522ac6e082c4a857e57b06fae2',seed,quality,triangles:mesh.triangles,grid:mesh.grid,settings,sourceGeometryUnmodified:true,visualApproved:false,productionApproved:false};window.__STONE_STUDY_RENDERER__=renderer;document.getElementById('status').textContent='种子 '+seed+' · '+Math.round(mesh.triangles).toLocaleString()+' 三角面 · 构建 '+((performance.now()-start)/1000).toFixed(2)+' 秒 · 拖动旋转 / 滚轮缩放';busy.hidden=true;document.documentElement.dataset.studyReady='true';}catch(e){showError(e);}finally{building=false;}}
async function start(){try{const res=await fetch('./data/brick-material-profiles-v2.json');if(!res.ok)throw Error('材料档案 HTTP '+res.status);const data=await res.json();profile=data.profiles.find(p=>p.id==='stone-block');if(!profile)throw Error('缺少石材档案');renderer=new StoneRenderer(document.getElementById('canvas'));document.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>selectStone(+b.dataset.kind));document.querySelectorAll('[data-debug]').forEach(b=>b.onclick=()=>{renderer.setDebugMode(+b.dataset.debug);renderer.dirty=true;document.querySelectorAll('[data-debug]').forEach(x=>x.classList.toggle('on',x===b));});for(const key of ['scale','mineral','chroma','rough','wet','relief','angle','exposure'])document.getElementById(key).oninput=e=>{settings[key]=+e.target.value;document.getElementById(key+'Out').textContent=key==='angle'?settings[key]+'°':settings[key].toFixed(2);selectStone(settings.kind);};document.getElementById('rebuild').onclick=build;document.getElementById('quality').onchange=build;document.getElementById('next').onclick=()=>{document.getElementById('seed').value=(+document.getElementById('seed').value+1067)%9999999||1;build();};document.getElementById('reset').onclick=()=>{renderer.resetView();renderer.camera.distance=6.15;renderer.dirty=true;};document.getElementById('rotate').onclick=e=>{renderer.autoRotate=!renderer.autoRotate;e.target.classList.toggle('on',renderer.autoRotate);};document.getElementById('light').onclick=e=>{renderer.lightRotate=!renderer.lightRotate;e.target.classList.toggle('on',renderer.lightRotate);};document.getElementById('focus').onclick=()=>{document.body.classList.toggle('focus');renderer.dirty=true;};document.getElementById('export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(window.__STONE_STUDY__,null,2)],{type:'application/json'}));a.download='stone-response-s1.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};selectStone(settings.kind);await build();}catch(e){showError(e);}}
start();
