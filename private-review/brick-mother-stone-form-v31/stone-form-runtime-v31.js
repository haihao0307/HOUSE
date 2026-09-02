(() => {
'use strict';

const canvas=document.getElementById('gl');
const loading=document.getElementById('loading');
const loadingText=document.getElementById('loadingText');
const loadingBar=document.getElementById('loadingBar');
const errorPanel=document.getElementById('error');
const errorText=document.getElementById('errorText');
const Geometry=window.BrickMotherStoneFormGeometryV31;
const fail=(message,error)=>{
  console.error(message,error||'');
  document.documentElement.dataset.runtimeFailure='true';
  if(loading)loading.classList.add('hidden');
  if(errorPanel){errorPanel.style.display='grid';if(errorText)errorText.textContent=message+(error&&error.message?' · '+error.message:'');}
};
window.addEventListener('error',event=>fail('石材形面运行时错误',event.error||new Error(event.message)));
window.addEventListener('unhandledrejection',event=>fail('石材形面异步任务失败',event.reason instanceof Error?event.reason:new Error(String(event.reason))));
if(!Geometry){fail('形面几何模块没有载入');return;}
const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,stencil:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
if(!gl){fail('当前浏览器无法启动 WebGL2');return;}

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const v3=(x=0,y=0,z=0)=>[x,y,z];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const muls=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length3=a=>Math.hypot(a[0],a[1],a[2]);
const norm=a=>{const l=length3(a)||1;return[a[0]/l,a[1]/l,a[2]/l];};
const lerp3=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];

function mat4Identity(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);}
function mat4Multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function mat4Perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far),o=new Float32Array(16);o[0]=f/aspect;o[5]=f;o[10]=(far+near)*nf;o[11]=-1;o[14]=2*far*near*nf;return o;}
function mat4Ortho(l,r,b,t,n,f){const o=mat4Identity();o[0]=2/(r-l);o[5]=2/(t-b);o[10]=-2/(f-n);o[12]=-(r+l)/(r-l);o[13]=-(t+b)/(t-b);o[14]=-(f+n)/(f-n);return o;}
function mat4LookAt(eye,center,up){const z=norm(sub(eye,center)),x=norm(cross(up,z)),y=cross(z,x),o=mat4Identity();o[0]=x[0];o[1]=y[0];o[2]=z[0];o[4]=x[1];o[5]=y[1];o[6]=z[1];o[8]=x[2];o[9]=y[2];o[10]=z[2];o[12]=-dot(x,eye);o[13]=-dot(y,eye);o[14]=-dot(z,eye);return o;}
function mat4TRS(p,r,s){const[rx,ry,rz]=r,cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz),m=new Float32Array(16);m[0]=cy*cz*s[0];m[1]=(sx*sy*cz+cx*sz)*s[0];m[2]=(-cx*sy*cz+sx*sz)*s[0];m[3]=0;m[4]=-cy*sz*s[1];m[5]=(-sx*sy*sz+cx*cz)*s[1];m[6]=(cx*sy*sz+sx*cz)*s[1];m[7]=0;m[8]=sy*s[2];m[9]=-sx*cy*s[2];m[10]=cx*cy*s[2];m[11]=0;m[12]=p[0];m[13]=p[1];m[14]=p[2];m[15]=1;return m;}

function calcNormals(pos,idx){const n=new Float32Array(pos.length);for(let i=0;i<idx.length;i+=3){const ia=idx[i]*3,ib=idx[i+1]*3,ic=idx[i+2]*3,ax=pos[ia],ay=pos[ia+1],az=pos[ia+2],bx=pos[ib],by=pos[ib+1],bz=pos[ib+2],cx=pos[ic],cy=pos[ic+1],cz=pos[ic+2],abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az,nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx;for(const j of[ia,ib,ic]){n[j]+=nx;n[j+1]+=ny;n[j+2]+=nz;}}for(let i=0;i<n.length;i+=3){const l=Math.hypot(n[i],n[i+1],n[i+2])||1;n[i]/=l;n[i+1]/=l;n[i+2]/=l;}return n;}
function makeBeveledCylinder(radius,height,segments=80,bevel=.075){const rings=[{y:0,r:radius-bevel},{y:bevel,r:radius},{y:height-bevel,r:radius},{y:height,r:radius-bevel}],pos=[],idx=[];for(const ring of rings)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;pos.push(Math.cos(a)*ring.r,ring.y,Math.sin(a)*ring.r);}for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;idx.push(a,c,b,b,c,d);}const top=pos.length/3;pos.push(0,height,0);const bot=pos.length/3;pos.push(0,0,0);const tr=(rings.length-1)*(segments+1);for(let i=0;i<segments;i++){idx.push(top,tr+i,tr+i+1);idx.push(bot,i+1,i);}const P=new Float32Array(pos);return{positions:P,normals:calcNormals(P,idx),indices:new Uint32Array(idx)};}
function makeAnnulus(inner,outer,segments=100){const pos=[],nor=[],idx=[];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,c=Math.cos(a),s=Math.sin(a);pos.push(c*inner,0,s*inner,c*outer,0,s*outer);nor.push(0,1,0,0,1,0);}for(let i=0;i<segments;i++){const a=i*2,b=a+1,c=a+2,d=a+3;idx.push(a,c,b,b,c,d);}return{positions:new Float32Array(pos),normals:new Float32Array(nor),indices:new Uint32Array(idx)};}
function makeCyclorama(){const width=60,profiles=[{z:9,y:-1.56,n:[0,1,0]},{z:-3.65,y:-1.56,n:[0,1,0]}],r=2.3,steps=24;for(let i=1;i<=steps;i++){const a=i/steps*Math.PI*.5;profiles.push({z:-3.65-r*Math.sin(a),y:-1.56+r*(1-Math.cos(a)),n:[0,Math.cos(a),Math.sin(a)]});}profiles.push({z:-5.95,y:8,n:[0,0,1]});const pos=[],nor=[],idx=[];for(const p of profiles){pos.push(-width/2,p.y,p.z,width/2,p.y,p.z);nor.push(...p.n,...p.n);}for(let j=0;j<profiles.length-1;j++){const a=j*2,b=a+1,c=a+2,d=a+3;idx.push(a,b,c,b,d,c);}return{positions:new Float32Array(pos),normals:new Float32Array(nor),indices:new Uint32Array(idx)};}

function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'shader compile failed');return s;}
function program(vs,fs){const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p)||'program link failed');return p;}

const vertexSource=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat4 uLightVP;
out vec3 vWorld;
out vec3 vLocal;
out vec3 vNormal;
out vec4 vShadow;
void main(){vec4 world=uModel*vec4(aPosition,1.0);vWorld=world.xyz;vLocal=aPosition;vNormal=normalize(mat3(transpose(inverse(uModel)))*aNormal);vShadow=uLightVP*world;gl_Position=uViewProj*world;}`;

const fragmentSource=`#version 300 es
precision highp float;
in vec3 vWorld;in vec3 vLocal;in vec3 vNormal;in vec4 vShadow;
out vec4 outColor;
uniform sampler2D uShadowMap;
uniform vec3 uCamera;
uniform vec3 uKeyDir;uniform vec3 uKeyColor;uniform float uKeyIntensity;
uniform vec3 uFillDir;uniform vec3 uFillColor;uniform float uFillIntensity;
uniform vec3 uRimDir;uniform vec3 uRimColor;uniform float uRimIntensity;
uniform vec3 uSkyColor;uniform vec3 uGroundColor;uniform float uAmbientIntensity;
uniform vec2 uResolution;uniform float uExposure;uniform float uSeed;uniform float uRelief;uniform float uWeather;uniform float uRoughness;uniform float uTint;uniform float uObjectScale;
uniform int uFamily;uniform int uKind;uniform float uSelected;
const float PI=3.14159265359;
float hash31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
vec3 hash33(vec3 p){p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));return fract(sin(p)*43758.5453123);}
float valueNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.0-15.0)+10.0);float n000=hash31(i),n100=hash31(i+vec3(1,0,0)),n010=hash31(i+vec3(0,1,0)),n110=hash31(i+vec3(1,1,0)),n001=hash31(i+vec3(0,0,1)),n101=hash31(i+vec3(1,0,1)),n011=hash31(i+vec3(0,1,1)),n111=hash31(i+vec3(1,1,1));return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y),f.z);}
float fbm(vec3 p){float s=0.0,a=.54,total=0.0;mat3 m=mat3(.00,.80,.60,-.80,.36,-.48,-.60,-.48,.64);for(int i=0;i<5;i++){s+=valueNoise(p)*a;total+=a;p=m*p*2.03+vec3(1.7,-2.1,.9);a*=.49;}return s/total;}
float ridged(vec3 p){float s=0.0,a=.56,total=0.0;for(int i=0;i<4;i++){float n=1.0-abs(valueNoise(p)*2.0-1.0);s+=n*n*a;total+=a;p=p*2.08+vec3(3.7,11.1,7.9);a*=.48;}return s/total;}
vec2 worley(vec3 p){vec3 ip=floor(p),fp=fract(p);float f1=10.0,f2=10.0;for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec3 c=vec3(float(x),float(y),float(z)),q=c+hash33(ip+c)-fp;float d=dot(q,q);if(d<f1){f2=f1;f1=d;}else if(d<f2)f2=d;}return sqrt(vec2(f1,f2));}
vec2 surfaceUV(vec3 p,vec3 n){vec3 a=abs(n);if(a.x>a.y&&a.x>a.z)return p.zy;if(a.y>a.z)return p.xz;return p.xy;}
float shadowPCF(vec3 N,vec3 L){vec3 sc=vShadow.xyz/vShadow.w;sc=sc*.5+.5;if(sc.z<=0.0||sc.z>=1.0||any(lessThan(sc.xy,vec2(0)))||any(greaterThan(sc.xy,vec2(1))))return 1.0;vec2 texel=1.0/vec2(textureSize(uShadowMap,0));float bias=max(.00075*(1.0-dot(N,L)),.00018),sum=0.0;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){float d=texture(uShadowMap,sc.xy+vec2(x,y)*texel*1.65).r;sum+=sc.z-bias<=d?1.0:0.0;}return sum/9.0;}
vec3 perturb(vec3 N,float h,float strength){vec3 dp1=dFdx(vWorld),dp2=dFdy(vWorld);float dh1=dFdx(h),dh2=dFdy(h);vec3 r1=cross(dp2,N),r2=cross(N,dp1);float det=dot(dp1,r1);vec3 grad=sign(det)*(dh1*r1+dh2*r2);return normalize(abs(det)*N-grad*strength);}
float D_GGX(float NoH,float a){float a2=a*a,d=NoH*NoH*(a2-1.0)+1.0;return a2/(PI*d*d+1e-5);}
float G_Smith(float NoV,float NoL,float a){float a2=a*a;float gv=NoL*sqrt(NoV*NoV*(1.0-a2)+a2),gl=NoV*sqrt(NoL*NoL*(1.0-a2)+a2);return .5/(gv+gl+1e-5);}
vec3 F_Schlick(vec3 f0,float VoH){return f0+(1.0-f0)*pow(1.0-VoH,5.0);}
vec3 brdf(vec3 base,float rough,float metal,vec3 N,vec3 V,vec3 L,vec3 lc,float intensity){float NoL=max(dot(N,L),0.0),NoV=max(dot(N,V),.001);if(NoL<=0.0)return vec3(0);vec3 H=normalize(V+L);float NoH=max(dot(N,H),0.0),VoH=max(dot(V,H),0.0),a=max(.045,rough*rough);vec3 f0=mix(vec3(.04),base,metal),F=F_Schlick(f0,VoH);float D=D_GGX(NoH,a),G=G_Smith(NoV,NoL,a);vec3 spec=D*G*F,kd=(1.0-F)*(1.0-metal);return(kd*base/PI+spec)*lc*intensity*NoL;}
void stoneMaterial(vec3 p,vec3 N,out vec3 c,out float rough,out float height,out float ao){
 vec3 seed=vec3(uSeed*.0113,uSeed*.0197,uSeed*.0311);
 vec3 warp=vec3(fbm(p*.34+seed+vec3(7,1,3)),fbm(p*.34+seed+vec3(2,9,5)),fbm(p*.34+seed+vec3(6,4,11)))-.5;
 vec3 q=p+warp*.20;
 float macroA=fbm(q*.48+seed),macroB=fbm(q*.78+seed*1.37+vec3(3.4,-6.2,1.7)),macroC=fbm(q*1.22+seed*1.91+vec3(-7.2,2.6,4.1));
 float mesoA=fbm(q*2.35+seed*2.31),mesoB=ridged(q*3.15+seed*2.77),fine=fbm(q*11.5+seed*4.07),grit=valueNoise(q*31.0+seed*6.13);
 vec2 cells=worley(q*7.8+seed*1.71),cellsMed=worley(q*3.65+seed*2.23);
 float side=1.0-smoothstep(.66,.93,abs(N.y)),top=smoothstep(.30,.91,N.y),underside=1.0-smoothstep(-.65,.18,N.y);
 float broadDriver=clamp(macroA*.48+macroB*.27+macroC*.15+mesoB*.10,0.0,1.0);
 float broadScale=mix(.70,1.46,smoothstep(.13,.88,broadDriver));
 float mineral=(1.0-smoothstep(.055,.145,cells.x))*smoothstep(.54,.88,macroC*.55+mesoA*.45);
 float darkGrain=(1.0-smoothstep(.038,.105,cells.x))*smoothstep(.73,.94,mesoB);
 float poreTiny=smoothstep(.948,.993,valueNoise(q*27.0+seed*5.3))*smoothstep(.56,.88,macroB);
 float poreMedium=(1.0-smoothstep(.085,.185,cellsMed.x))*smoothstep(.68,.91,macroC*.45+mesoB*.55);
 float cavity=clamp(poreTiny*.42+poreMedium*.70,0.0,1.0);
 height=(macroB-.5)*.036+(mesoA-.5)*.022+(mesoB-.5)*.017+(fine-.5)*.005-cavity*.020;
 rough=clamp(uRoughness+(fine-.5)*.07+(mesoB-.5)*.045+cavity*.16,0.18,.98);ao=1.0-cavity*.15;
 if(uFamily==0){
   vec3 deep=vec3(.105,.108,.098),cool=vec3(.205,.218,.210),mid=vec3(.355,.340,.300),warm=vec3(.505,.410,.285),pale=vec3(.610,.565,.470);
   c=mix(deep,mid,smoothstep(.08,.88,macroA));c=mix(c,cool,(1.0-smoothstep(.34,.60,macroB))*.42);c=mix(c,warm,smoothstep(.68,.92,macroB)*.36);c=mix(c,pale,mineral*.32);
   vec2 uv=surfaceUV(p,N);float stroke=1.0-smoothstep(.012,.062,abs(fract(uv.x*7.2+uv.y*.62+valueNoise(vec3(uv*1.65,uSeed*.013))*.45)-.5));float tool=stroke*side*smoothstep(.50,.82,mesoB)*smoothstep(.30,.80,macroC)*.46;
   c*=1.0-tool*.15;height-=tool*.010;rough+=tool*.08;
   float calcite=1.0-smoothstep(.012,.055,abs(fbm(q*2.05+seed*3.2)-.505));calcite*=smoothstep(.60,.86,macroC)*side*.52;c=mix(c,pale,calcite*.24);height+=calcite*.008;
   float dirt=underside*smoothstep(.52,.84,macroB)*uWeather;c=mix(c,deep,dirt*.34);
 }else if(uFamily==1){
   vec3 deep=vec3(.070,.077,.073),cool=vec3(.150,.175,.174),mid=vec3(.315,.300,.260),warm=vec3(.470,.330,.185),pale=vec3(.575,.535,.435),olive=vec3(.260,.285,.225);
   c=mix(deep,mid,smoothstep(.07,.91,macroA));c=mix(c,cool,(1.0-smoothstep(.30,.58,macroB))*.34);c=mix(c,warm,smoothstep(.70,.94,macroB)*.38*uWeather);c=mix(c,olive,smoothstep(.72,.94,macroC)*.24);c=mix(c,pale,mineral*.27);
   float faceTone=clamp(dot(N,normalize(vec3(.62,.17,-.76)))*.5+.5,0.0,1.0);c*=mix(.80,1.18,faceTone*.58+macroA*.42);
   float vein=1.0-smoothstep(.010,.052,abs(fbm(q*1.72+seed*3.65)-.512));vein*=smoothstep(.54,.84,macroC)*.72;c=mix(c,pale,vein*.27);height+=vein*.010;
   float rust=smoothstep(.70,.92,macroC*.46+mesoB*.54)*smoothstep(.42,.88,side+.15)*uWeather;c=mix(c,warm,rust*.26);
   float bruise=side*smoothstep(.75,.94,mesoA)*smoothstep(.45,.82,macroB);c=mix(c,deep,bruise*.25);rough+=bruise*.08;
 }else if(uFamily==2){
   vec3 deep=vec3(.060,.075,.083),blue=vec3(.135,.175,.188),mid=vec3(.265,.290,.282),warm=vec3(.420,.325,.220),pale=vec3(.520,.510,.450),rust=vec3(.385,.195,.090);
   c=mix(deep,mid,smoothstep(.08,.90,macroA));c=mix(c,blue,(1.0-smoothstep(.33,.61,macroB))*.50);c=mix(c,warm,smoothstep(.72,.94,macroC)*.22);
   vec2 dir=normalize(vec2(.91,.42)),crossDir=vec2(-dir.y,dir.x);float along=dot(p.xz,dir),across=dot(p.xz,crossDir);
   float bedding=fbm(vec3(along*1.45,p.y*.22,across*.30)+seed*.73);c*=mix(.76,1.27,smoothstep(.15,.88,bedding));
   float region=smoothstep(.58,.83,fbm(q*.68+seed*1.8+vec3(9.1,-2.7,4.3)))*side;
   float warpY=(fbm(q*.86+seed*2.2)-.5)*.040;float s1=1.0-smoothstep(.007,.027,abs(p.y-.103-warpY)),s2=1.0-smoothstep(.006,.024,abs(p.y-.205+warpY*.62));float seam=max(s1*region,s2*region*smoothstep(.70,.88,macroB));
   c=mix(c,deep,seam*.72);height-=seam*.022;ao-=seam*.14;rough+=seam*.09;
   float exposed=side*smoothstep(.84,.965,mesoB)*smoothstep(.46,.84,macroC);c=mix(c,pale,exposed*.20);
   float oxide=side*smoothstep(.72,.91,macroC*.50+mesoA*.50)*smoothstep(.50,.84,region)*uWeather;c=mix(c,rust,oxide*.25);
 }else{
   vec3 deep=vec3(.060,.078,.080),cool=vec3(.130,.190,.198),mid=vec3(.255,.265,.245),warm=vec3(.455,.315,.175),cream=vec3(.560,.485,.350),olive=vec3(.235,.275,.215);
   c=mix(deep,mid,smoothstep(.05,.93,macroA));c=mix(c,warm,smoothstep(.72,.94,macroB)*.34);c=mix(c,cool,(1.0-smoothstep(.38,.68,macroC))*.32);c=mix(c,olive,smoothstep(.78,.95,mesoA)*.24);c=mix(c,cream,mineral*.24);
   float fleck=smoothstep(.86,.965,1.0-cells.x)*smoothstep(.52,.86,macroC);c=mix(c,cream,fleck*.18);
   float wet=(1.0-smoothstep(.08,.52,p.y))*smoothstep(.48,.86,macroB)*uWeather;c=mix(c,deep,wet*.42);rough-=wet*.24;
   float polish=smoothstep(.46,.90,top+side*.18)*(1.0-cavity);rough-=polish*.10;height=(mesoA-.5)*.017+(fine-.5)*.004-cavity*.007;
 }
 c*=broadScale;
 c=mix(c,vec3(.018,.020,.019),cavity*.58);
 c=mix(c,c*vec3(1.08,1.055,.99),top*smoothstep(.73,.94,mesoB)*uWeather*.13);
 c=mix(c,c*vec3(.70,.75,.77),underside*.12*uWeather);
 c*=mix(.94,1.06,fine);
 rough=clamp(rough,0.18,.98);ao=clamp(ao,0.52,1.0);c=clamp(c*(.98+uTint*.10),vec3(.008),vec3(.92));
}
vec3 aces(vec3 x){float a=2.51,b=.03,c=2.43,d=.59,e=.14;return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0);}
void main(){
 vec3 N=normalize(vNormal),V=normalize(uCamera-vWorld),base;float rough,metal,height=0.0,ao=1.0,emissive=0.0;
 if(uKind==0){vec3 p=vLocal/max(uObjectScale,.001);stoneMaterial(p,N,base,rough,height,ao);N=perturb(N,height,mix(.10,.68,uRelief));metal=0.0;}
 else if(uKind==1){float n=fbm(vLocal*6.2+vec3(uSeed*.01));base=mix(vec3(.018,.022,.025),vec3(.065,.072,.076),n);height=(n-.5)*.014;N=perturb(N,height,.26);rough=.24;metal=.76;ao=.92;}
 else if(uKind==2){float floorMask=smoothstep(.72,.98,N.y),g=smoothstep(.03,.98,gl_FragCoord.y/uResolution.y),n=fbm(vWorld*.12);vec3 bg=mix(vec3(.006,.009,.014),vec3(.036,.038,.039),g)+n*.0035;float pool=exp(-.045*dot(vWorld.xz-vec2(.25,0),vWorld.xz-vec2(.25,0)));bg+=pool*vec3(.010,.008,.006);float sh=shadowPCF(N,normalize(uKeyDir));bg*=mix(1.0,.50+.50*sh,floorMask);float horizon=smoothstep(-3.1,-1.2,vWorld.z)*(1.0-floorMask);bg+=horizon*vec3(.010,.012,.014);bg=pow(aces(bg*uExposure*1.75),vec3(1.0/2.2));outColor=vec4(bg,1);return;}
 else{base=vec3(.64,.39,.13);rough=.23;metal=.45;emissive=.24;}
 vec3 Lk=normalize(uKeyDir),Lf=normalize(uFillDir),Lr=normalize(uRimDir);float sh=shadowPCF(N,Lk);vec3 col=brdf(base,rough,metal,N,V,Lk,uKeyColor,uKeyIntensity)*sh;col+=brdf(base,rough,metal,N,V,Lf,uFillColor,uFillIntensity);col+=brdf(base,rough,metal,N,V,Lr,uRimColor,uRimIntensity);
 float hemi=clamp(N.y*.5+.5,0.0,1.0);vec3 env=mix(uGroundColor,uSkyColor,hemi),R=reflect(-V,N),envR=mix(uGroundColor,uSkyColor,clamp(R.y*.5+.5,0.0,1.0)),f0=mix(vec3(.04),base,metal),F=F_Schlick(f0,max(dot(N,V),0.0));col+=base*(env+vec3(.060,.052,.043))*uAmbientIntensity*(1.0-metal)*(.36+.34*(1.0-rough))*ao;col+=envR*F*uAmbientIntensity*(.16+.52*(1.0-rough))*ao;float rim=pow(1.0-max(dot(N,V),0.0),3.0);col+=uRimColor*rim*uRimIntensity*.052*(uKind==0?1.0:.45);col+=base*emissive+vec3(.12,.075,.030)*uSelected*.025;col=pow(aces(col*uExposure),vec3(1.0/2.2));outColor=vec4(col,1);
}`;
const depthVS=`#version 300 es
precision highp float;layout(location=0) in vec3 aPosition;uniform mat4 uModel;uniform mat4 uLightVP;void main(){gl_Position=uLightVP*uModel*vec4(aPosition,1.0);}`;
const depthFS=`#version 300 es
precision highp float;void main(){}`;
let mainProgram,depthProgram;
try{mainProgram=program(vertexSource,fragmentSource);depthProgram=program(depthVS,depthFS);}catch(error){fail('着色器编译失败',error);return;}
function uniforms(p,names){const o={};for(const n of names)o[n]=gl.getUniformLocation(p,n);return o;}
const U=uniforms(mainProgram,['uModel','uViewProj','uLightVP','uShadowMap','uCamera','uKeyDir','uKeyColor','uKeyIntensity','uFillDir','uFillColor','uFillIntensity','uRimDir','uRimColor','uRimIntensity','uSkyColor','uGroundColor','uAmbientIntensity','uResolution','uExposure','uSeed','uRelief','uWeather','uRoughness','uTint','uObjectScale','uFamily','uKind','uSelected']);
const DU=uniforms(depthProgram,['uModel','uLightVP']);
function gpuGeometry(data){const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buffers=[];const pb=gl.createBuffer();buffers.push(pb);gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,data.positions,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);const nb=gl.createBuffer();buffers.push(nb);gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,data.normals,gl.STATIC_DRAW);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);let indexed=false,count=data.positions.length/3;if(data.indices){indexed=true;count=data.indices.length;const ib=gl.createBuffer();buffers.push(ib);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,data.indices,gl.STATIC_DRAW);}gl.bindVertexArray(null);return{vao,buffers,indexed,count,triangles:indexed?count/3:data.positions.length/9};}
function destroyGeometry(g){if(!g)return;for(const b of g.buffers)gl.deleteBuffer(b);gl.deleteVertexArray(g.vao);}
function object(geo,p,r,s,kind,opts={}){return{geo,model:mat4TRS(p,r,s),kind,family:opts.family??0,seed:opts.seed??0,tint:opts.tint??0,selected:opts.selected??0,cast:opts.cast!==false,objectScale:opts.objectScale??1};}

const floorY=-1.56,fixed=[];
const cyclo=gpuGeometry(makeCyclorama());fixed.push(object(cyclo,[0,0,0],[0,0,0],[1,1,1],2,{cast:false}));
const pedHero=gpuGeometry(makeBeveledCylinder(1.66,.34,96,.085));fixed.push(object(pedHero,[-.78,floorY,0],[0,0,0],[1,1,1],1,{seed:31}));
const pedMini=gpuGeometry(makeBeveledCylinder(.70,.23,72,.055)),miniPos=[[2.08,-1.42],[3.02,0],[2.02,1.46]],miniHeights=[.23,.29,.255];
for(let i=0;i<3;i++)fixed.push(object(pedMini,[miniPos[i][0],floorY,miniPos[i][1]],[0,0,0],[1,miniHeights[i]/.23,1],1,{seed:51+i}));
const ring=gpuGeometry(makeAnnulus(1.49,1.555,110));fixed.push(object(ring,[-.78,floorY+.346,0],[0,0,0],[1,1,1],3,{cast:false,selected:1}));

const families=[
{name:'规则石材',seed:8231,form:.48,fracture:.38,edge:.30,relief:.38,weather:.36,rough:.82,rule:'承重面稳定 · 錾修侧面 · 局部崩角'},
{name:'半规则毛石',seed:9298,form:.67,fracture:.50,edge:.42,relief:.40,weather:.52,rough:.86,rule:'偏心体量 · 多组断面 · 稳定落座'},
{name:'片石',seed:10365,form:.62,fracture:.46,edge:.28,relief:.38,weather:.56,rough:.90,rule:'单一主层理 · 薄板厚度 · 局部沿层剥离'},
{name:'卵石',seed:11642,form:.58,fracture:.34,edge:.68,relief:.38,weather:.44,rough:.54,rule:'差异磨圆 · 稳定底面 · 局部碰撞伤'}
];
const state={family:0,seed:8231,form:.48,fracture:.38,edge:.30,relief:.38,weather:.36,rough:.82,lightAngle:-36,lightMode:'studio',auto:false,piece:'all'};
let stones=[],triangleTotal=0,rebuildToken=0,rebuildTimer=0,shadowDirty=true;
function clearStones(){for(const s of stones)destroyGeometry(s.geo);stones=[];}
function setProgress(p,text){if(loadingBar)loadingBar.style.width=(p*100).toFixed(0)+'%';if(loadingText)loadingText.textContent=text;}
function rebuildStones(initial=false){
 const token=++rebuildToken;clearTimeout(rebuildTimer);if(initial&&loading)loading.classList.remove('hidden');setProgress(.06,'BUILDING FORM ENVELOPE');
 try{
  clearStones();triangleTotal=0;const f=state.family,baseSeed=state.seed,mobile=innerWidth<760,qa=new URLSearchParams(location.search).has('qa'),heroQ=mobile?.56:(qa?.62:.72),miniQ=mobile?.30:(qa?.32:.38);
  const heroData=Geometry.buildMesh(f,baseSeed,state,heroQ,1);if(token!==rebuildToken)return;const hero=gpuGeometry(heroData);triangleTotal+=hero.triangles;
  const heroRot=f===0?[.012,-.34,.004]:f===1?[.018,-.42,-.010]:f===2?[.020,-.28,.010]:[.012,-.38,-.012];stones.push(object(hero,[-.78,floorY+.358,0],heroRot,[1,1,1],0,{family:f,seed:baseSeed,tint:.02,selected:1,objectScale:1}));setProgress(.46,'PRIMARY FORM COMPLETE');
  const rots=[[.045,.38,-.020],[-.022,-.54,.030],[.032,.66,-.030]],scales=[.43,.39,.45];
  for(let i=0;i<3;i++){const seed=baseSeed+(i+1)*1067,variant={...state,form:clamp(state.form+(i-1)*.07,0,1),fracture:clamp(state.fracture+(i===1?.06:-.025),0,1),edge:clamp(state.edge+(i-1)*.045,0,1)},data=Geometry.buildMesh(f,seed,variant,miniQ,scales[i]);if(token!==rebuildToken)return;const geo=gpuGeometry(data);triangleTotal+=geo.triangles;stones.push(object(geo,[miniPos[i][0],floorY+miniHeights[i]+.012,miniPos[i][1]],rots[i],[1,1,1],0,{family:f,seed,tint:(i-1)*.18,objectScale:scales[i]}));setProgress(.60+i*.12,'BUILDING CHILD '+(i+1));}
  $('#triangleCount').textContent=Math.round(triangleTotal).toLocaleString('en-US')+' TRI';$('#familyName').textContent=families[f].name;$('#familyRule').textContent=families[f].rule;shadowDirty=true;document.documentElement.dataset.workbenchReady='true';document.documentElement.dataset.stoneFormVersion='3.2.0-alpha.1';document.documentElement.dataset.visualReady='true';showHint('已生成 '+families[f].name+' · '+state.seed,800);setProgress(1,'STONE FORM READY');setTimeout(()=>{if(token===rebuildToken)loading.classList.add('hidden');},140);
 }catch(error){fail('形面生成失败',error);}
}
function scheduleRebuild(){clearTimeout(rebuildTimer);rebuildTimer=setTimeout(()=>rebuildStones(false),180);}

const shadowSize=1024,shadowFBO=gl.createFramebuffer(),shadowTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,shadowTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,shadowSize,shadowSize,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFBO);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,shadowTex,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)console.warn('shadow framebuffer incomplete');gl.bindFramebuffer(gl.FRAMEBUFFER,null);

const camera={yaw:.72,pitch:.34,radius:9.35,target:[.42,-.18,0],goalYaw:.72,goalPitch:.34,goalRadius:9.35,goalTarget:[.42,-.18,0]};
function cameraEye(){const cp=Math.cos(camera.pitch);return[camera.target[0]+Math.sin(camera.yaw)*cp*camera.radius,camera.target[1]+Math.sin(camera.pitch)*camera.radius,camera.target[2]+Math.cos(camera.yaw)*cp*camera.radius];}
function setView(piece){state.piece=piece;$$('.view-btn[data-piece]').forEach(b=>b.classList.toggle('active',b.dataset.piece===piece));if(piece==='hero'){camera.goalTarget=[-.78,-.34,0];camera.goalRadius=4.75;camera.goalYaw=.61;camera.goalPitch=.27;}else if(piece==='mini'){camera.goalTarget=[2.34,-.46,0];camera.goalRadius=5.45;camera.goalYaw=.84;camera.goalPitch=.31;}else{camera.goalTarget=[.42,-.18,0];camera.goalRadius=9.35;camera.goalYaw=.72;camera.goalPitch=.34;}}
function resetCamera(){setView('all');showHint('视角已复位',650);}
const lights={studio:{key:[1.0,.82,.66,3.65],fill:[.36,.45,.56,.56],rim:[.55,.68,.88,.94],sky:[.115,.135,.155],ground:[.028,.023,.019],ambient:1.20,exposure:1.12,height:9.2},neutral:{key:[.98,.99,1.0,2.92],fill:[.58,.63,.70,.62],rim:[.80,.86,.96,.62],sky:[.15,.16,.17],ground:[.045,.042,.038],ambient:1.38,exposure:1.03,height:10.2},raking:{key:[1.0,.70,.47,4.35],fill:[.22,.29,.38,.32],rim:[.38,.54,.78,1.18],sky:[.08,.105,.14],ground:[.018,.015,.014],ambient:.88,exposure:1.10,height:3.7}};
let lightVP=mat4Identity(),keyDir=[.3,.8,.5],keyPos=[4,9,4];
function updateLight(){const p=lights[state.lightMode],a=state.lightAngle*Math.PI/180,r=8.6;keyPos=[Math.sin(a)*r,p.height,Math.cos(a)*r];keyDir=norm(sub(keyPos,[0,-.25,0]));const lv=mat4LookAt(keyPos,[0,-.25,0],[0,1,0]),lp=mat4Ortho(-6.8,6.8,-5.7,6.8,1,25);lightVP=mat4Multiply(lp,lv);}
function setVec3(loc,a){if(loc)gl.uniform3f(loc,a[0],a[1],a[2]);}
function drawObject(o,depth=false,vp=null,eye=null){gl.bindVertexArray(o.geo.vao);if(depth){gl.uniformMatrix4fv(DU.uModel,false,o.model);gl.uniformMatrix4fv(DU.uLightVP,false,lightVP);}else{gl.uniformMatrix4fv(U.uModel,false,o.model);gl.uniformMatrix4fv(U.uViewProj,false,vp);gl.uniformMatrix4fv(U.uLightVP,false,lightVP);gl.uniform1f(U.uSeed,o.seed);gl.uniform1i(U.uFamily,o.family);gl.uniform1i(U.uKind,o.kind);gl.uniform1f(U.uTint,o.tint);gl.uniform1f(U.uSelected,o.selected);gl.uniform1f(U.uObjectScale,o.objectScale);}if(o.geo.indexed)gl.drawElements(gl.TRIANGLES,o.geo.count,gl.UNSIGNED_INT,0);else gl.drawArrays(gl.TRIANGLES,0,o.geo.count);}
function renderShadow(){gl.bindFramebuffer(gl.FRAMEBUFFER,shadowFBO);gl.viewport(0,0,shadowSize,shadowSize);gl.colorMask(false,false,false,false);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(depthProgram);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(2.0,4.0);for(const o of[...fixed,...stones])if(o.cast)drawObject(o,true);gl.disable(gl.POLYGON_OFFSET_FILL);gl.colorMask(true,true,true,true);gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
function renderMain(vp,eye){const w=canvas.width,h=canvas.height;gl.viewport(0,0,w,h);gl.clearColor(.005,.007,.010,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(mainProgram);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,shadowTex);gl.uniform1i(U.uShadowMap,0);setVec3(U.uCamera,eye);const p=lights[state.lightMode],fillDir=norm([-keyDir[0]*.75,.34,-keyDir[2]*.75]),rimDir=norm([keyDir[2]*.82,.54,-keyDir[0]*.82]);setVec3(U.uKeyDir,keyDir);setVec3(U.uKeyColor,p.key);gl.uniform1f(U.uKeyIntensity,p.key[3]);setVec3(U.uFillDir,fillDir);setVec3(U.uFillColor,p.fill);gl.uniform1f(U.uFillIntensity,p.fill[3]);setVec3(U.uRimDir,rimDir);setVec3(U.uRimColor,p.rim);gl.uniform1f(U.uRimIntensity,p.rim[3]);setVec3(U.uSkyColor,p.sky);setVec3(U.uGroundColor,p.ground);gl.uniform1f(U.uAmbientIntensity,p.ambient);gl.uniform2f(U.uResolution,w,h);gl.uniform1f(U.uExposure,p.exposure);gl.uniform1f(U.uRelief,state.relief);gl.uniform1f(U.uWeather,state.weather);gl.uniform1f(U.uRoughness,state.rough);for(const o of fixed)drawObject(o,false,vp,eye);for(const o of stones)drawObject(o,false,vp,eye);gl.bindVertexArray(null);}
let last=performance.now(),fpsFrames=0,fpsTime=last;
function resize(){const area=innerWidth*innerHeight,scale=area>2600000?.72:area>1200000?.86:1,dpr=Math.min(devicePixelRatio||1,1.65)*scale,w=Math.max(2,Math.floor(innerWidth*dpr)),h=Math.max(2,Math.floor(innerHeight*dpr));document.documentElement.dataset.renderScale=scale.toFixed(2);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;shadowDirty=true;}}
function animate(now){resize();const dt=Math.min(.05,(now-last)/1000);last=now;if(state.auto)camera.goalYaw+=dt*.17;camera.yaw=mix(camera.yaw,camera.goalYaw,1-Math.exp(-dt*10));camera.pitch=mix(camera.pitch,camera.goalPitch,1-Math.exp(-dt*10));camera.radius=mix(camera.radius,camera.goalRadius,1-Math.exp(-dt*9));camera.target=lerp3(camera.target,camera.goalTarget,1-Math.exp(-dt*9));updateLight();const eye=cameraEye(),view=mat4LookAt(eye,camera.target,[0,1,0]),proj=mat4Perspective(35*Math.PI/180,canvas.width/canvas.height,.05,60),vp=mat4Multiply(proj,view);if(shadowDirty){renderShadow();shadowDirty=false;}renderMain(vp,eye);fpsFrames++;if(now-fpsTime>1000){document.documentElement.dataset.fps=String(Math.round(fpsFrames*1000/(now-fpsTime)));fpsFrames=0;fpsTime=now;}requestAnimationFrame(animate);}

let pointer=null;canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointer={id:e.pointerId,x:e.clientX,y:e.clientY,mode:(e.button===2||e.shiftKey)?'pan':'orbit'};});canvas.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer.x=e.clientX;pointer.y=e.clientY;if(pointer.mode==='orbit'){camera.goalYaw-=dx*.0062;camera.goalPitch=clamp(camera.goalPitch+dy*.0052,-.04,1.18);}else{const eye=cameraEye(),forward=norm(sub(camera.target,eye)),right=norm(cross(forward,[0,1,0])),up=norm(cross(right,forward)),k=camera.goalRadius*.00135;camera.goalTarget=add(camera.goalTarget,add(muls(right,-dx*k),muls(up,dy*k)));}});canvas.addEventListener('pointerup',e=>{if(pointer&&pointer.id===e.pointerId)pointer=null;});canvas.addEventListener('pointercancel',()=>pointer=null);canvas.addEventListener('wheel',e=>{e.preventDefault();camera.goalRadius=clamp(camera.goalRadius*Math.exp(e.deltaY*.00105),2.8,15.5);},{passive:false});canvas.addEventListener('dblclick',resetCamera);window.addEventListener('keydown',e=>{if(e.key==='r'||e.key==='R')resetCamera();if(e.key==='l'||e.key==='L'){const m=['studio','neutral','raking'];setLight(m[(m.indexOf(state.lightMode)+1)%m.length]);}});
function rangeFill(el){const min=+el.min,max=+el.max,v=+el.value;el.style.setProperty('--fill',((v-min)/(max-min)*100).toFixed(2)+'%');}
$$('input[type=range]').forEach(rangeFill);
function bindRange(id,key,out,rebuild=false,format=v=>v.toFixed(2)){const el=$('#'+id),o=$('#'+out);el.addEventListener('input',()=>{state[key]=+el.value;o.textContent=format(state[key]);rangeFill(el);if(rebuild)scheduleRebuild();else shadowDirty=true;});}
bindRange('form','form','formOut',true);bindRange('fracture','fracture','fractureOut',true);bindRange('edge','edge','edgeOut',true);bindRange('relief','relief','reliefOut');bindRange('weather','weather','weatherOut');bindRange('rough','rough','roughOut');bindRange('lightAngle','lightAngle','lightOut',false,v=>(v<0?'−':'')+Math.abs(v).toFixed(0)+'°');
function syncControls(){for(const[id,key,out]of[['form','form','formOut'],['fracture','fracture','fractureOut'],['edge','edge','edgeOut'],['relief','relief','reliefOut'],['weather','weather','weatherOut'],['rough','rough','roughOut']]){const e=$('#'+id);e.value=state[key];$('#'+out).textContent=Number(state[key]).toFixed(2);rangeFill(e);}$('#seedValue').textContent=state.seed;$('#familyName').textContent=families[state.family].name;$('#familyRule').textContent=families[state.family].rule;}
$$('.family-btn').forEach((b,i)=>b.addEventListener('click',()=>{if(i===state.family)return;state.family=i;Object.assign(state,families[i]);$$('.family-btn').forEach((x,j)=>x.classList.toggle('active',j===i));syncControls();loading.classList.remove('hidden');setProgress(.02,'SWITCHING STONE GRAMMAR');rebuildStones(false);}));
$('#newSeed').addEventListener('click',()=>{state.seed=(state.seed+104729+(Math.floor(performance.now())%997))%999983;if(state.seed<1000)state.seed+=4001;$('#seedValue').textContent=state.seed;loading.classList.remove('hidden');setProgress(.02,'DERIVING NEW STONE DNA');rebuildStones(false);});
$$('.view-btn[data-piece]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.piece)));$('#resetView').addEventListener('click',resetCamera);$('#autoRotate').addEventListener('click',e=>{state.auto=!state.auto;e.currentTarget.classList.toggle('active',state.auto);showHint(state.auto?'转台已开启':'转台已停止',600);});
function setLight(mode){state.lightMode=mode;shadowDirty=true;$$('.light-btn').forEach(b=>b.classList.toggle('active',b.dataset.light===mode));showHint({studio:'棚拍光',neutral:'中性检查光',raking:'掠射细节光'}[mode],650);}$$('.light-btn').forEach(b=>b.addEventListener('click',()=>setLight(b.dataset.light)));$('#panelToggle').addEventListener('click',()=>$('#controls').classList.toggle('open'));
let hintTimer;function showHint(text,ms=900){const h=$('#hint');h.textContent=text;h.classList.add('flash');clearTimeout(hintTimer);hintTimer=setTimeout(()=>{h.classList.remove('flash');h.textContent='拖动旋转 · 滚轮缩放 · 右键平移 · R 重置视角';},ms);}

const params=new URLSearchParams(location.search);if(params.has('family')){const i=clamp(parseInt(params.get('family'),10)||0,0,3);state.family=i;Object.assign(state,families[i]);$$('.family-btn').forEach((b,j)=>b.classList.toggle('active',j===i));}if(['studio','neutral','raking'].includes(params.get('light')))setLight(params.get('light'));syncControls();if(params.get('view')==='hero')setView('hero');else if(params.get('view')==='mini')setView('mini');rebuildStones(true);requestAnimationFrame(animate);
document.documentElement.dataset.brickMotherStoneFormReady='true';window.__BRICK_MOTHER_STONE_WORKBENCH__={version:'3.2.0-alpha.1',sourceLineage:'BRICK_MOTHER_V2.7.5',family:()=>state.family,seed:()=>state.seed,state,visualApproved:false,productionApproved:false};
})();
