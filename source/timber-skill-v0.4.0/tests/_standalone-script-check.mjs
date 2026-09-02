
window.__YUNNAN_TIMBER_READY__=false;
window.__YUNNAN_TIMBER_FRAME_COUNT__=0;
window.__YUNNAN_TIMBER_ERRORS__=[];
window.addEventListener("error",event=>window.__YUNNAN_TIMBER_ERRORS__.push(String(event.error?.stack||event.message)));
const canvas = document.getElementById("gl");
const errorLayer = document.getElementById("error");
const errorText = document.getElementById("errorText");

const PRESETS = {
  dark_aged: {
    label:"深色旧木", description:"深褐与烟熏胡桃色，适合主柱、梁、枋和檩。",
    dark:[0.095,0.052,0.029], mid:[0.300,0.165,0.087], light:[0.475,0.300,0.172],
    weather:[0.245,0.225,0.192], fresh:[0.525,0.355,0.220],
    rough:[0.70,0.90], lacquer:0.015, contrast:0.32, relief:0.82, poreScale:0.92
  },
  warm_medium: {
    label:"暖褐中木", description:"温暖棕褐与柔和金棕色，适合门窗、楼板和次要构件。",
    dark:[0.145,0.083,0.043], mid:[0.405,0.245,0.128], light:[0.620,0.425,0.245],
    weather:[0.365,0.330,0.275], fresh:[0.690,0.500,0.295],
    rough:[0.63,0.84], lacquer:0.035, contrast:0.30, relief:0.76, poreScale:0.86
  },
  light_weathered: {
    label:"浅色风化", description:"日晒后的灰暖浅褐色，适合檐下木板、旧门板和外露次构件。",
    dark:[0.245,0.165,0.095], mid:[0.555,0.420,0.270], light:[0.765,0.650,0.465],
    weather:[0.590,0.575,0.520], fresh:[0.805,0.690,0.485],
    rough:[0.75,0.94], lacquer:0.00, contrast:0.27, relief:0.70, poreScale:0.82
  },
  lacquered_chestnut: {
    label:"栗褐上漆", description:"克制的栗红褐旧漆，适合厅堂门窗、栏板和维护较好的构件。",
    dark:[0.105,0.035,0.021], mid:[0.375,0.120,0.060], light:[0.610,0.260,0.128],
    weather:[0.285,0.190,0.140], fresh:[0.585,0.330,0.175],
    rough:[0.34,0.60], lacquer:0.58, contrast:0.28, relief:0.48, poreScale:0.60
  }
};

const state = {
  preset:"dark_aged",
  seed:randomUint(),
  quality:"inspection",
  contrast:0.32,
  detail:0.92,
  relief:0.68,
  weather:0.34,
  toolMarks:0.28,
  perMember:true,
  surfaceDebug:false,
  autoOrbit:false
};

function randomUint(){
  if (globalThis.crypto?.getRandomValues) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] >>> 0;
  }
  return (Math.random() * 0x100000000) >>> 0;
}
function hash32(text){
  text = String(text);
  let h = 2166136261 >>> 0;
  for(let i=0;i<text.length;i++){
    h ^= text.charCodeAt(i);
    h = Math.imul(h,16777619);
  }
  h ^= h>>>16; h = Math.imul(h,0x7feb352d);
  h ^= h>>>15; h = Math.imul(h,0x846ca68b);
  h ^= h>>>16;
  return h>>>0;
}
function seedFloat(memberId){
  const h = state.perMember ? hash32(`${state.seed}|${memberId}`) : state.seed;
  return h / 4294967295;
}
function variation(memberId){
  let x = hash32(`${state.seed}|${memberId}|variation`);
  const next=()=>{ x ^= x<<13; x ^= x>>>17; x ^= x<<5; return (x>>>0)/4294967295; };
  return [next(),next(),next(),next()];
}

const gl = canvas.getContext("webgl2", {
  antialias:true, alpha:false, depth:true, stencil:false,
  premultipliedAlpha:false, powerPreference:"high-performance"
});
if(!gl) fail("当前浏览器或显卡没有提供 WebGL2。");
gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LEQUAL);
gl.disable(gl.CULL_FACE);
gl.clearColor(0.47,0.46,0.43,1);

const commonGLSL = `
uniform float uProfileType;
uniform float uToolMarks;
uniform float uPoreScale;
vec3 toTimber(vec3 p){
  return vec3(dot(p,uAxisX),dot(p,uAxisY),dot(p,uAxisZ));
}
float hash11(float p){
  p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);
}
float hash31(vec3 p){
  p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);
}
float noise3(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(
    mix(mix(hash31(i),hash31(i+vec3(1,0,0)),f.x),mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x),mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){
  float s=0.0,a=.52;mat3 r=mat3(0.0,.8,.6,-.8,.36,-.48,-.6,-.48,.64);
  for(int i=0;i<5;i++){s+=a*noise3(p);p=r*p*2.02+17.13;a*=.49;}return s;
}
float ridged(vec3 p){return 1.0-abs(noise3(p)*2.0-1.0);}
float roundMask(){return 1.0-step(.25,abs(uProfileType-1.0));}
vec4 woodSignals(vec3 pin,float cls,float seed,vec4 variation,float detail){
  vec3 p=pin+uGrainOffset;
  p.x*=mix(.92,1.09,variation.x);p.yz*=mix(.94,1.08,variation.y);
  p+=vec3(seed*43.7,seed*19.3,seed*31.1);
  float slowBend=fbm(vec3(p.x*.075,p.yz*.42));
  vec2 pith=vec2(sin(p.x*.16+seed*18.0),cos(p.x*.13+seed*23.0))*.035;
  pith+=vec2(variation.z-.5,variation.w-.5)*.15;
  vec2 q=p.yz-pith;
  float radial=length(q),angle=atan(q.y,q.x);
  float ringWarp=(slowBend-.5)*.13+.020*sin(p.x*.68+seed*15.0)+.010*sin(p.x*1.75+angle*.55);
  float ringPhase=(radial+ringWarp)*mix(10.5,13.8,variation.x);
  float ringWave=.5+.5*sin(6.2831853*ringPhase+fbm(vec3(p.x*.16,q*1.05))*1.15);
  float ringSoft=mix(ringWave,smoothstep(.58,.91,ringWave),.35);
  vec2 fibreWarp=vec2(fbm(vec3(p.x*.11,q*1.3)),fbm(vec3(p.x*.09+13.0,q*1.55+7.0)))-.5;
  vec2 fq=q+fibreWarp*.075;
  float coarse=ridged(vec3(p.x*.18,fq*7.5)+seed*7.0);
  float medium=ridged(vec3(p.x*.43,fq*16.0)+seed*11.0);
  float fine=ridged(vec3(p.x*1.35,fq*38.0)+seed*19.0);
  float silk=.57*coarse+.30*medium+.13*fine;
  float cell=floor((p.x+seed*7.0)*.38),localX=fract((p.x+seed*7.0)*.38)-.5;
  vec2 kc=vec2(hash11(cell+seed*37.0)-.5,hash11(cell+seed*71.0)-.5)*.60;
  float kr=length(fq-kc);
  float knot=exp(-15.0*(localX*localX*.52+kr*kr));
  float knotRing=.5+.5*sin(34.0*length(vec3(localX*.46,fq-kc)));
  float knotTone=knot*(.30+.70*knotRing);
  float knotFlow=knot*ridged(vec3(p.x*.35,angle*2.5,radial*7.0)+seed*41.0);
  float poreField=ridged(vec3(p.x*3.5,fq*(47.0*uPoreScale))+seed*29.0);
  float pores=smoothstep(.945,.992,poreField)*(.30+.70*medium);
  float hair=smoothstep(.975,.998,ridged(vec3(p.x*.16,fq*13.0)+seed*43.0))*smoothstep(.28,.90,slowBend);
  float toolLong=ridged(vec3(p.x*.10,fq*5.2)+seed*61.0);
  float toolCell=floor((p.x+seed*5.0)*1.7);
  float adzeWave=sin((p.x+hash11(toolCell)*.25)*10.0+angle*.25);
  float toolGroove=smoothstep(.90,.995,toolLong)*uToolMarks;
  float adzeMark=smoothstep(.70,.98,adzeWave*.5+.5)*hash11(toolCell+17.0)*uToolMarks*.35;
  float ray=ridged(vec3(radial*3.7,angle*9.0,p.x*.14)+seed*31.0);
  float endPore=smoothstep(.94,.992,ridged(vec3(q*43.0,p.x*.45)+seed*53.0));
  float radialCrack=smoothstep(.978,.999,ridged(vec3(angle*8.5,radial*1.15,seed*11.0)))*smoothstep(.20,.76,radial);
  float isEnd=step(.5,cls)*step(cls,1.5),isJoint=step(1.5,cls)*step(cls,2.5),isRound=roundMask();
  float rectSide=.37*ringSoft+.50*silk+.13*slowBend;
  float roundSide=.74*silk+.16*slowBend+.10*(.5+.5*sin(p.x*.31+slowBend*2.4));
  float sideTone=mix(rectSide,roundSide,isRound)+knotTone*.13+knotFlow*.08;
  float endTone=.70*ringSoft+.18*ray+.12*fbm(vec3(q*3.8,p.x));
  float tone=mix(sideTone,endTone,isEnd);tone=mix(tone,.62*endTone+.38*silk,isJoint);
  float rectHeight=.5+(ringSoft-.5)*.050+(silk-.5)*.040*detail;
  float roundHeight=.5+(silk-.5)*.052*detail+(slowBend-.5)*.020;
  float sideHeight=mix(rectHeight,roundHeight,isRound)+(fine-.5)*.012*detail+knotTone*.026+knotFlow*.012;
  sideHeight-=pores*.022*detail+hair*.080+toolGroove*.018+adzeMark*.012;
  float endHeight=.5+(ringSoft-.5)*.070+(ray-.5)*.020*detail-endPore*.025*detail-radialCrack*.105;
  float height=mix(sideHeight,endHeight,isEnd);height=mix(height,.5+(endHeight-.5)*.75+(silk-.5)*.014,isJoint);
  float cavity=clamp((.5-height)*3.2+pores*.20+hair*.48+radialCrack*.48+toolGroove*.12,0.0,1.0);
  float rough=clamp(.40+.32*fbm(vec3(p.x*.55,fq*4.7))+.16*cavity+.08*toolGroove,0.0,1.0);
  return vec4(clamp(tone,0.0,1.0),clamp(height,0.0,1.0),rough,cavity);
}
`;

const vs = `#version 300 es
precision highp float;
in vec3 aPosition;
in vec3 aNormal;
in float aSurfaceClass;
uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat3 uNormalMatrix;
uniform float uSeed;
uniform vec4 uVariation;
uniform float uDetail;
uniform float uRelief;
uniform float uDisplacement;
uniform vec3 uAxisX;
uniform vec3 uAxisY;
uniform vec3 uAxisZ;
uniform vec3 uGrainOffset;
out vec3 vLocalPos;
out vec3 vLocalNormal;
out vec3 vWorldPos;
out vec3 vWorldNormal;
flat out float vSurfaceClass;
${commonGLSL}
void main(){
  vec3 local=aPosition;
  vec3 timberPos=toTimber(local);
  float lockDisplacement=step(aSurfaceClass,0.5);
  vec4 sig=woodSignals(timberPos,aSurfaceClass,uSeed,uVariation,uDetail);
  float low=fbm(vec3(timberPos.x*.16,timberPos.yz*.72)+uSeed*9.0)-.5;
  local += aNormal * low * uDisplacement * uRelief * lockDisplacement;
  vec4 world=uModel*vec4(local,1.0);
  vLocalPos=toTimber(local);
  vLocalNormal=normalize(toTimber(aNormal));
  vWorldPos=world.xyz;
  vWorldNormal=normalize(uNormalMatrix*aNormal);
  vSurfaceClass=aSurfaceClass;
  gl_Position=uViewProj*world;
}`;

const fs = `#version 300 es
precision highp float;
in vec3 vLocalPos;
in vec3 vLocalNormal;
in vec3 vWorldPos;
in vec3 vWorldNormal;
flat in float vSurfaceClass;
uniform vec3 uCameraPos;
uniform vec3 uCameraPosObj;
uniform float uSeed;
uniform vec4 uVariation;
uniform vec3 uDarkColor;
uniform vec3 uMidColor;
uniform vec3 uLightColor;
uniform vec3 uWeatherColor;
uniform vec3 uFreshColor;
uniform vec2 uRoughRange;
uniform float uLacquer;
uniform float uContrast;
uniform float uDetail;
uniform float uRelief;
uniform float uWeathering;
uniform int uParallaxSteps;
uniform float uParallaxDepth;
uniform float uNormalStrength;
uniform float uSurfaceDebug;
uniform float uIsGround;
uniform vec3 uAxisX;
uniform vec3 uAxisY;
uniform vec3 uAxisZ;
uniform vec3 uGrainOffset;
out vec4 fragColor;
${commonGLSL}

vec3 parallaxPoint(vec3 p, vec3 viewDirObj, float cls){
  if(uParallaxSteps<=0 || cls>2.5) return p;
  vec3 dir=normalize(viewDirObj);
  float grazing=max(abs(dot(dir,normalize(vLocalNormal))),0.28);
  float totalDepth=uParallaxDepth*uRelief/grazing;
  float stepDepth=1.0/float(max(uParallaxSteps,1));
  vec3 delta=dir*totalDepth*stepDepth;
  vec3 cur=p;
  float layer=0.0;
  for(int i=0;i<10;i++){
    if(i>=uParallaxSteps) break;
    float h=woodSignals(cur,cls,uSeed,uVariation,uDetail).y;
    if(h < 1.0-layer) break;
    cur-=delta;
    layer+=stepDepth;
  }
  return mix(p,cur,0.72);
}

vec3 perturbNormal(vec3 worldPos, vec3 baseNormal, float height){
  vec3 dp1=dFdx(worldPos);
  vec3 dp2=dFdy(worldPos);
  float dh1=dFdx(height);
  float dh2=dFdy(height);
  vec3 r1=cross(dp2,baseNormal);
  vec3 r2=cross(baseNormal,dp1);
  float det=dot(dp1,r1);
  vec3 grad=sign(det)*(dh1*r1+dh2*r2);
  return normalize(abs(det)*baseNormal-grad*uNormalStrength*uRelief);
}

float distributionGGX(vec3 N,vec3 H,float rough){
  float a=rough*rough;
  float a2=a*a;
  float n=max(dot(N,H),0.0);
  float d=n*n*(a2-1.0)+1.0;
  return a2/max(3.14159265*d*d,0.0001);
}
float geometrySchlick(float n,float rough){
  float r=rough+1.0;
  float k=(r*r)/8.0;
  return n/(n*(1.0-k)+k);
}
vec3 fresnelSchlick(float c,vec3 f0){
  return f0+(1.0-f0)*pow(1.0-c,5.0);
}

void main(){
  if(uIsGround>0.5){
    vec3 N=normalize(vWorldNormal);
    vec3 V=normalize(uCameraPos-vWorldPos);
    vec3 L=normalize(vec3(-0.45,0.82,0.38));
    float d=max(dot(N,L),0.0);
    float vign=clamp(1.0-length(vWorldPos.xz)*0.035,0.0,1.0);
    vec3 col=mix(vec3(.245,.238,.222),vec3(.36,.35,.325),d*.55+vign*.25);
    col=pow(col,vec3(1.0/2.2));
    fragColor=vec4(col,1.0);
    return;
  }

  vec3 viewObj=toTimber(uCameraPosObj)-vLocalPos;
  vec3 p=parallaxPoint(vLocalPos,viewObj,vSurfaceClass);
  vec4 sig=woodSignals(p,vSurfaceClass,uSeed,uVariation,uDetail);
  float tone=sig.x;
  float h=sig.y;
  float roughSignal=sig.z;
  float cavity=sig.w;

  if(uSurfaceDebug>0.5){
    vec3 debugColor=vSurfaceClass<0.5?vec3(.16,.58,.82):
                    vSurfaceClass<1.5?vec3(.95,.66,.15):
                    vSurfaceClass<2.5?vec3(.82,.25,.18):vec3(.45);
    fragColor=vec4(pow(debugColor,vec3(1.0/2.2)),1.0);
    return;
  }

  float softTone=mix(0.5,tone,uContrast);
  vec3 color=mix(uDarkColor,uMidColor,smoothstep(.14,.62,softTone));
  color=mix(color,uLightColor,smoothstep(.58,.94,softTone)*0.52);
  float isEnd=step(.5,vSurfaceClass)*step(vSurfaceClass,1.5);
  float isJoint=step(1.5,vSurfaceClass)*step(vSurfaceClass,2.5);
  color=mix(color,mix(color,uFreshColor,.36),isEnd*.42+isJoint*.62);
  float greyMask=uWeathering*(.28+.72*fbm(vec3(p.x*.16,p.yz*.78)+uSeed*5.0));
  color=mix(color,uWeatherColor,greyMask*.34);
  float pieceTint=(uVariation.z-.5)*.075;
  color*=1.0+pieceTint;
  color*=1.0-cavity*.22;

  vec3 N=perturbNormal(vWorldPos,normalize(vWorldNormal),h);
  vec3 V=normalize(uCameraPos-vWorldPos);
  vec3 L=normalize(vec3(-0.48,0.80,0.36));
  vec3 H=normalize(V+L);
  float NdotL=max(dot(N,L),0.0);
  float NdotV=max(dot(N,V),0.0);
  float rough=mix(uRoughRange.x,uRoughRange.y,roughSignal);
  rough=mix(rough,max(.26,rough*.64),uLacquer);
  float D=distributionGGX(N,H,rough);
  float G=geometrySchlick(NdotV,rough)*geometrySchlick(NdotL,rough);
  vec3 F0=mix(vec3(.035),color,.035+.055*uLacquer);
  vec3 F=fresnelSchlick(max(dot(H,V),0.0),F0);
  vec3 spec=(D*G*F)/max(4.0*NdotV*NdotL,.001);

  float hemi=.29+.26*clamp(N.y*.5+.5,0.0,1.0);
  vec3 warmBounce=vec3(.17,.135,.10)*(0.16+0.12*clamp(-N.y,0.0,1.0));
  vec3 diffuse=color*(hemi+NdotL*.86)*(1.0-cavity*.28);
  vec3 rim=vec3(.17,.20,.19)*pow(1.0-NdotV,3.0)*(.12+.18*uLacquer);
  vec3 finalColor=diffuse+spec*NdotL*1.18+warmBounce+rim;
  finalColor=finalColor/(finalColor+vec3(1.0));
  finalColor=pow(finalColor,vec3(1.0/2.2));
  fragColor=vec4(finalColor,1.0);
}`;

const program = makeProgram(vs,fs);
const loc = {
  aPosition:gl.getAttribLocation(program,"aPosition"),
  aNormal:gl.getAttribLocation(program,"aNormal"),
  aSurfaceClass:gl.getAttribLocation(program,"aSurfaceClass")
};
const u = {};
[
 "uModel","uViewProj","uNormalMatrix","uCameraPos","uCameraPosObj","uSeed","uVariation",
 "uDarkColor","uMidColor","uLightColor","uWeatherColor","uFreshColor","uRoughRange",
 "uLacquer","uContrast","uDetail","uRelief","uWeathering","uParallaxSteps",
 "uParallaxDepth","uNormalStrength","uDisplacement","uSurfaceDebug","uIsGround",
 "uAxisX","uAxisY","uAxisZ","uGrainOffset","uProfileType","uToolMarks","uPoreScale"
].forEach(name=>u[name]=gl.getUniformLocation(program,name));

function makeProgram(vertexSource,fragmentSource){
  const compile=(type,source)=>{
    const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)+"\n"+source);
    return s;
  };
  const p=gl.createProgram();
  gl.attachShader(p,compile(gl.VERTEX_SHADER,vertexSource));
  gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fragmentSource));
  gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}

function geometryBuffers(data){
  const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
  const add=(attrib,arr,size)=>{
    const b=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(attrib); gl.vertexAttribPointer(attrib,size,gl.FLOAT,false,0,0);
  };
  add(loc.aPosition,data.positions,3);
  add(loc.aNormal,data.normals,3);
  add(loc.aSurfaceClass,data.classes,1);
  const ib=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(data.indices),gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return {vao,count:data.indices.length};
}

function newGeo(){ return {positions:[],normals:[],classes:[],indices:[]}; }
function addGridFace(g,origin,uvec,vvec,normal,useg,vseg,cls){
  const start=g.positions.length/3;
  for(let j=0;j<=vseg;j++) for(let i=0;i<=useg;i++){
    const a=i/useg,b=j/vseg;
    g.positions.push(origin[0]+uvec[0]*a+vvec[0]*b,origin[1]+uvec[1]*a+vvec[1]*b,origin[2]+uvec[2]*a+vvec[2]*b);
    g.normals.push(...normal); g.classes.push(cls);
  }
  for(let j=0;j<vseg;j++) for(let i=0;i<useg;i++){
    const a=start+j*(useg+1)+i,b=a+1,c=a+(useg+1),d=c+1;
    g.indices.push(a,c,b,b,c,d);
  }
}
function createBox(length,width,depth,lengthSeg=24,crossSeg=5,endClass=1){
  const g=newGeo(),x=length/2,y=width/2,z=depth/2;
  addGridFace(g,[-x,-y,-z],[0,width,0],[0,0,depth],[-1,0,0],crossSeg,crossSeg,endClass);
  addGridFace(g,[ x,-y,-z],[0,width,0],[0,0,depth],[ 1,0,0],crossSeg,crossSeg,endClass);
  addGridFace(g,[-x,-y,-z],[length,0,0],[0,0,depth],[0,-1,0],lengthSeg,crossSeg,0);
  addGridFace(g,[-x, y,-z],[length,0,0],[0,0,depth],[0, 1,0],lengthSeg,crossSeg,0);
  addGridFace(g,[-x,-y,-z],[length,0,0],[0,width,0],[0,0,-1],lengthSeg,crossSeg,0);
  addGridFace(g,[-x,-y, z],[length,0,0],[0,width,0],[0,0, 1],lengthSeg,crossSeg,0);
  return geometryBuffers(g);
}
function createCylinder(length,radius,radialSeg=72,lengthSeg=28,capRings=10,axis="x"){
  const g=newGeo();
  let start=0;
  for(let i=0;i<=lengthSeg;i++){
    const x=-length/2+length*i/lengthSeg;
    for(let j=0;j<=radialSeg;j++){
      const t=j/radialSeg*Math.PI*2,c=Math.cos(t),s=Math.sin(t);
      g.positions.push(x,c*radius,s*radius);
      g.normals.push(0,c,s); g.classes.push(0);
    }
  }
  for(let i=0;i<lengthSeg;i++) for(let j=0;j<radialSeg;j++){
    const a=i*(radialSeg+1)+j,b=a+1,c=a+(radialSeg+1),d=c+1;
    g.indices.push(a,c,b,b,c,d);
  }
  for(const side of [-1,1]){
    start=g.positions.length/3;
    for(let r=0;r<=capRings;r++){
      const rr=radius*r/capRings;
      for(let j=0;j<=radialSeg;j++){
        const t=j/radialSeg*Math.PI*2;
        g.positions.push(side*length/2,Math.cos(t)*rr,Math.sin(t)*rr);
        g.normals.push(side,0,0); g.classes.push(1);
      }
    }
    for(let r=0;r<capRings;r++) for(let j=0;j<radialSeg;j++){
      const a=start+r*(radialSeg+1)+j,b=a+1,c=a+(radialSeg+1),d=c+1;
      g.indices.push(a,c,b,b,c,d);
    }
  }
  if(axis==="y"){
    for(let i=0;i<g.positions.length;i+=3){
      const ox=g.positions[i],oy=g.positions[i+1],oz=g.positions[i+2];
      g.positions[i]=oy; g.positions[i+1]=ox; g.positions[i+2]=-oz;
      const nx=g.normals[i],ny=g.normals[i+1],nz=g.normals[i+2];
      g.normals[i]=ny; g.normals[i+1]=nx; g.normals[i+2]=-nz;
    }
  }
  return geometryBuffers(g);
}
function createGround(){
  const g=newGeo();
  addGridFace(g,[-12,0,-12],[24,0,0],[0,0,24],[0,1,0],1,1,9);
  return geometryBuffers(g);
}

function mat4Identity(){ return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]); }
function mat4Mul(a,b){
  const o=new Float32Array(16);
  for(let c=0;c<4;c++) for(let r=0;r<4;r++){
    o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
  }
  return o;
}
function trans(x,y,z){ const m=mat4Identity(); m[12]=x;m[13]=y;m[14]=z;return m; }
function rotX(a){ const c=Math.cos(a),s=Math.sin(a); return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]); }
function rotY(a){ const c=Math.cos(a),s=Math.sin(a); return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]); }
function rotZ(a){ const c=Math.cos(a),s=Math.sin(a); return new Float32Array([c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1]); }
function compose(t=[0,0,0],r=[0,0,0]){
  return mat4Mul(trans(...t),mat4Mul(rotZ(r[2]),mat4Mul(rotY(r[1]),rotX(r[0]))));
}
function perspective(fovy,aspect,near,far){
  const f=1/Math.tan(fovy/2),nf=1/(near-far),o=new Float32Array(16);
  o[0]=f/aspect;o[5]=f;o[10]=(far+near)*nf;o[11]=-1;o[14]=2*far*near*nf;
  return o;
}
function lookAt(eye,target,up){
  let zx=eye[0]-target[0],zy=eye[1]-target[1],zz=eye[2]-target[2];
  let l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;
  let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;
  l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
  const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
  return new Float32Array([
    xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
    -(xx*eye[0]+xy*eye[1]+xz*eye[2]),
    -(yx*eye[0]+yy*eye[1]+yz*eye[2]),
    -(zx*eye[0]+zy*eye[1]+zz*eye[2]),1
  ]);
}
function normalMat3(m){ return new Float32Array([m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]]); }
function toObjectPoint(world,m){
  const dx=world[0]-m[12],dy=world[1]-m[13],dz=world[2]-m[14];
  return [m[0]*dx+m[1]*dy+m[2]*dz,m[4]*dx+m[5]*dy+m[6]*dz,m[8]*dx+m[9]*dy+m[10]*dz];
}

const G = {
  column:createCylinder(3.15,.58,88,34,13,"y"),
  beam:createBox(3.30,.68,.74,38,8),
  purlin:createCylinder(2.85,.32,72,30,10),
  rafter:createBox(3.25,.34,.43,38,6),
  post:createBox(3.05,.42,.47,34,7),
  rail:createBox(2.72,.36,.40,34,7),
  peg:createBox(.66,.135,.135,10,3,2),
  tenon:createBox(.46,.22,.25,10,4,2),
  ground:createGround()
};
const BASIS_X={x:[1,0,0],y:[0,1,0],z:[0,0,1]};
const BASIS_Y={x:[0,1,0],y:[1,0,0],z:[0,0,-1]};
const objects = [
  {id:"column_round_01",sourceId:"column_log_A",role:"column",profile:1,geo:G.column,model:compose([-3.15,1.575,.05],[0,0,0]),basis:BASIS_Y,grainOffset:[0,0,0],preset:"dark_aged"},
  {id:"beam_rect_01",sourceId:"beam_log_A",role:"beam",profile:0,geo:G.beam,model:compose([-1.35,.45,1.30],[0,-.13,.03]),basis:BASIS_X,grainOffset:[0,0,0],preset:"dark_aged"},
  {id:"purlin_round_01",sourceId:"purlin_log_A",role:"purlin",profile:1,geo:G.purlin,model:compose([1.33,.48,1.42],[0,.10,.02]),basis:BASIS_X,grainOffset:[0,0,0],preset:"warm_medium"},
  {id:"rafter_01",sourceId:"rafter_log_A",role:"rafter",profile:0,geo:G.rafter,model:compose([3.20,1.04,.55],[.03,.22,.46]),basis:BASIS_X,grainOffset:[0,0,0],preset:"light_weathered"},
  {id:"door_post_left",sourceId:"door_post_L",role:"door",profile:0,geo:G.post,model:compose([.35,1.525,-1.55],[0,0,Math.PI/2]),basis:BASIS_X,grainOffset:[0,0,0],preset:"lacquered_chestnut"},
  {id:"door_post_right",sourceId:"door_post_R",role:"door",profile:0,geo:G.post,model:compose([2.82,1.525,-1.55],[0,0,Math.PI/2]),basis:BASIS_X,grainOffset:[0,0,0],preset:"lacquered_chestnut"},
  {id:"door_lintel",sourceId:"door_lintel_A",role:"door",profile:0,geo:G.rail,model:compose([1.585,2.72,-1.55],[0,0,0]),basis:BASIS_X,grainOffset:[0,0,0],preset:"lacquered_chestnut"},
  {id:"door_sill",sourceId:"door_sill_A",role:"door",profile:0,geo:G.rail,model:compose([1.585,.34,-1.55],[0,0,0]),basis:BASIS_X,grainOffset:[0,0,0],preset:"lacquered_chestnut"},
  {id:"door_peg_l_top",sourceId:"door_peg_1",role:"joinery",profile:0,geo:G.peg,model:compose([.35,2.72,-1.55],[0,-Math.PI/2,0]),basis:BASIS_X,grainOffset:[0,0,0],preset:"dark_aged"},
  {id:"door_peg_r_top",sourceId:"door_peg_2",role:"joinery",profile:0,geo:G.peg,model:compose([2.82,2.72,-1.55],[0,-Math.PI/2,0]),basis:BASIS_X,grainOffset:[0,0,0],preset:"dark_aged"},
  {id:"door_peg_l_low",sourceId:"door_peg_3",role:"joinery",profile:0,geo:G.peg,model:compose([.35,.34,-1.55],[0,-Math.PI/2,0]),basis:BASIS_X,grainOffset:[0,0,0],preset:"dark_aged"},
  {id:"door_peg_r_low",sourceId:"door_peg_4",role:"joinery",profile:0,geo:G.peg,model:compose([2.82,.34,-1.55],[0,-Math.PI/2,0]),basis:BASIS_X,grainOffset:[0,0,0],preset:"dark_aged"}
];

const camera={yaw:-.62,pitch:.34,distance:9.2,target:[0,1.15,0]};
function cameraPos(){
  const cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch),cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw);
  return [camera.target[0]+camera.distance*cp*sy,camera.target[1]+camera.distance*sp,camera.target[2]+camera.distance*cp*cy];
}
function resetCamera(){ camera.yaw=-.62;camera.pitch=.34;camera.distance=9.2;camera.target=[0,1.15,0]; }

function presetFor(obj){
  if(state.preset==="mixed") return PRESETS[obj.preset];
  return PRESETS[state.preset];
}
function setVec3(location,a){ gl.uniform3f(location,a[0],a[1],a[2]); }
function setVec4(location,a){ gl.uniform4f(location,a[0],a[1],a[2],a[3]); }

function drawObject(obj,viewProj,eye){
  const p=presetFor(obj),v=variation(obj.id);
  const q=state.quality;
  const steps=q==="building"?0:q==="close"?6:10;
  const displacement=q==="inspection"?0.0045:0.0;
  const parallax=q==="building"?0.0:q==="close"?0.0045:0.0065;
  const normalStrength=q==="building"?0.10:q==="close"?0.145:0.175;

  gl.bindVertexArray(obj.geo.vao);
  gl.uniformMatrix4fv(u.uModel,false,obj.model);
  gl.uniformMatrix4fv(u.uViewProj,false,viewProj);
  gl.uniformMatrix3fv(u.uNormalMatrix,false,normalMat3(obj.model));
  setVec3(u.uCameraPos,eye);
  setVec3(u.uCameraPosObj,toObjectPoint(eye,obj.model));
  gl.uniform1f(u.uSeed,seedFloat(obj.sourceId||obj.id));
  setVec4(u.uVariation,v);
  setVec3(u.uAxisX,obj.basis.x); setVec3(u.uAxisY,obj.basis.y); setVec3(u.uAxisZ,obj.basis.z);
  setVec3(u.uGrainOffset,obj.grainOffset||[0,0,0]);
  gl.uniform1f(u.uProfileType,obj.profile||0);
  gl.uniform1f(u.uToolMarks,state.toolMarks);
  gl.uniform1f(u.uPoreScale,p.poreScale||1);
  setVec3(u.uDarkColor,p.dark); setVec3(u.uMidColor,p.mid); setVec3(u.uLightColor,p.light);
  setVec3(u.uWeatherColor,p.weather); setVec3(u.uFreshColor,p.fresh);
  gl.uniform2f(u.uRoughRange,p.rough[0],p.rough[1]);
  gl.uniform1f(u.uLacquer,p.lacquer);
  gl.uniform1f(u.uContrast,state.contrast*(p.contrast/0.32));
  gl.uniform1f(u.uDetail,state.detail);
  gl.uniform1f(u.uRelief,state.relief*p.relief);
  gl.uniform1f(u.uWeathering,state.weather);
  gl.uniform1i(u.uParallaxSteps,steps);
  gl.uniform1f(u.uParallaxDepth,parallax);
  gl.uniform1f(u.uNormalStrength,normalStrength);
  gl.uniform1f(u.uDisplacement,displacement);
  gl.uniform1f(u.uSurfaceDebug,state.surfaceDebug?1:0);
  gl.uniform1f(u.uIsGround,0);
  gl.drawElements(gl.TRIANGLES,obj.geo.count,gl.UNSIGNED_INT,0);
}
function drawGround(viewProj,eye){
  const m=mat4Identity();
  gl.bindVertexArray(G.ground.vao);
  gl.uniformMatrix4fv(u.uModel,false,m); gl.uniformMatrix4fv(u.uViewProj,false,viewProj);
  gl.uniformMatrix3fv(u.uNormalMatrix,false,normalMat3(m));
  setVec3(u.uCameraPos,eye); setVec3(u.uCameraPosObj,eye);
  gl.uniform1f(u.uSeed,0); setVec4(u.uVariation,[0,0,0,0]);
  setVec3(u.uAxisX,[1,0,0]); setVec3(u.uAxisY,[0,1,0]); setVec3(u.uAxisZ,[0,0,1]);
  setVec3(u.uGrainOffset,[0,0,0]);
  gl.uniform1f(u.uProfileType,0);gl.uniform1f(u.uToolMarks,0);gl.uniform1f(u.uPoreScale,1);
  setVec3(u.uDarkColor,[.2,.2,.2]);setVec3(u.uMidColor,[.3,.3,.3]);setVec3(u.uLightColor,[.4,.4,.4]);
  setVec3(u.uWeatherColor,[.3,.3,.3]);setVec3(u.uFreshColor,[.3,.3,.3]);
  gl.uniform2f(u.uRoughRange,.9,1);gl.uniform1f(u.uLacquer,0);gl.uniform1f(u.uContrast,.3);
  gl.uniform1f(u.uDetail,.5);gl.uniform1f(u.uRelief,0);gl.uniform1f(u.uWeathering,0);
  gl.uniform1i(u.uParallaxSteps,0);gl.uniform1f(u.uParallaxDepth,0);gl.uniform1f(u.uNormalStrength,0);
  gl.uniform1f(u.uDisplacement,0);gl.uniform1f(u.uSurfaceDebug,0);gl.uniform1f(u.uIsGround,1);
  gl.drawElements(gl.TRIANGLES,G.ground.count,gl.UNSIGNED_INT,0);
}
function render(t){
  resize();
  window.__YUNNAN_TIMBER_FRAME_COUNT__+=1;
  if(window.__YUNNAN_TIMBER_FRAME_COUNT__>2) window.__YUNNAN_TIMBER_READY__=true;
  if(state.autoOrbit) camera.yaw+=0.00035;
  const eye=cameraPos();
  const proj=perspective(Math.PI/4,canvas.width/canvas.height,.08,60);
  const view=lookAt(eye,camera.target,[0,1,0]);
  const vp=mat4Mul(proj,view);
  gl.viewport(0,0,canvas.width,canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);
  drawGround(vp,eye);
  for(const obj of objects) drawObject(obj,vp,eye);
  gl.bindVertexArray(null);
  requestAnimationFrame(render);
}
function resize(){
  const dpr=Math.min(devicePixelRatio||1,2);
  const w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
}

let dragging=false,lastX=0,lastY=0;
canvas.addEventListener("pointerdown",e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener("pointerup",()=>dragging=false);
canvas.addEventListener("pointercancel",()=>dragging=false);
canvas.addEventListener("pointermove",e=>{
  if(!dragging)return;
  const dx=e.clientX-lastX,dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;
  camera.yaw-=dx*.006;camera.pitch=Math.max(-.08,Math.min(1.12,camera.pitch+dy*.005));
});
canvas.addEventListener("wheel",e=>{e.preventDefault();camera.distance=Math.max(4.1,Math.min(16,camera.distance*Math.exp(e.deltaY*.001)));},{passive:false});

function bindRange(id,key,formatter){
  const el=document.getElementById(id),out=document.getElementById(id+"Out");
  const apply=()=>{state[key]=Number(el.value);out.textContent=formatter(state[key]);};
  el.addEventListener("input",apply);apply();
}
bindRange("contrast","contrast",v=>Math.round(v*100)+"%");
bindRange("detail","detail",v=>Math.round(v*100)+"%");
bindRange("relief","relief",v=>Math.round(v*100)+"%");
bindRange("weather","weather",v=>Math.round(v*100)+"%");
bindRange("toolMarks","toolMarks",v=>Math.round(v*100)+"%");

const presetEl=document.getElementById("preset"),presetName=document.getElementById("presetName");
const presetHint=document.getElementById("presetHint"),swatches=document.getElementById("swatches");
function updatePresetUI(){
  state.preset=presetEl.value;
  if(state.preset==="mixed"){
    presetName.textContent="混合展示";
    presetHint.textContent="按构件用途组合深色旧木、暖褐中木、浅色风化和栗褐上漆。";
    swatches.innerHTML=Object.values(PRESETS).map(p=>`<span class="swatch" style="background:rgb(${p.mid.map(v=>Math.round(v*255)).join(",")})"></span>`).join("");
  }else{
    const p=PRESETS[state.preset];presetName.textContent=p.label;presetHint.textContent=p.description;
    swatches.innerHTML=[p.dark,p.mid,p.light,p.weather].map(c=>`<span class="swatch" style="background:rgb(${c.map(v=>Math.round(v*255)).join(",")})"></span>`).join("");
    document.getElementById("contrast").value=p.contrast;
    document.getElementById("contrast").dispatchEvent(new Event("input"));
  }
}
presetEl.addEventListener("change",updatePresetUI);updatePresetUI();

const seedEl=document.getElementById("seed"),seedOut=document.getElementById("seedOut");
function applySeed(value){state.seed=(Number(value)>>>0);seedEl.value=state.seed;seedOut.textContent="0x"+state.seed.toString(16).padStart(8,"0");}
seedEl.addEventListener("change",()=>applySeed(seedEl.value));
document.getElementById("randomSeed").addEventListener("click",()=>applySeed(randomUint()));
applySeed(state.seed);

const qualityEl=document.getElementById("quality"),qualityOut=document.getElementById("qualityOut");
const qnames={building:"建筑观察",close:"近景观察",inspection:"构造检查"};
qualityEl.addEventListener("change",()=>{state.quality=qualityEl.value;qualityOut.textContent=qnames[state.quality];});
document.getElementById("perMember").addEventListener("change",e=>state.perMember=e.target.checked);
document.getElementById("surfaceDebug").addEventListener("change",e=>state.surfaceDebug=e.target.checked);
document.getElementById("autoOrbit").addEventListener("change",e=>state.autoOrbit=e.target.checked);
document.getElementById("focusColumn").addEventListener("click",()=>{
  camera.target=[-3.15,1.55,.05];camera.yaw=-.42;camera.pitch=.18;camera.distance=4.35;
});
document.getElementById("resetCamera").addEventListener("click",resetCamera);
document.getElementById("exportConfig").addEventListener("click",()=>{
  const config={
    skill:"yunnan_timber_procedural",skillVersion:"0.4.0",
    generationSeed:state.seed,defaultPresetId:state.preset,
    qualityCap:state.quality,contrast:state.contrast,detail:state.detail,
    relief:state.relief,weathering:state.weather,toolMarks:state.toolMarks,
    coordinateContract:{
      canonicalLengthAxis:[1,0,0],
      cylinderGeometryAxis:[0,1,0],
      verticalColumnModelRotationZ:0,
      mappingSpace:"member_local_object_space",
      uvRequired:false
    },
    members:objects.map(o=>({memberId:o.id,role:o.role,profile:o.profile===1?"round":"rectangular",derivedSeed:hash32(`${state.seed}|${o.sourceId||o.id}`),sourceTimberId:o.sourceId||o.id,grainOffset:o.grainOffset,presetId:state.preset==="mixed"?o.preset:state.preset}))
  };
  const blob=new Blob([JSON.stringify(config,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);
  a.download=`yunnan-timber-${state.seed}.json`;a.click();URL.revokeObjectURL(a.href);
});

function fail(message){
  errorLayer.style.display="grid";errorText.textContent=String(message);
  throw new Error(message);
}
try{requestAnimationFrame(render);}catch(error){fail(error.stack||error.message||error);}
