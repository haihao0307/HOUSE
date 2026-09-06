/* Small retained-mode WebGL2 specimen renderer. No per-frame CPU geometry-field evaluation. Visible fragments still evaluate material functions.
   Only camera/light/material uniforms change while inspecting the object. */
function createBrickRenderer(canvas){
'use strict';
const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'low-power',preserveDrawingBuffer:false});
if(!gl)throw Error('当前浏览器未提供 WebGL 2，请启用图形加速后重开。');
const norm=a=>{let d=Math.hypot(...a)||1;return a.map(v=>v/d)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
function look(eye,tgt){const z=norm(eye.map((v,i)=>v-tgt[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function persp(fov,aspect){const f=1/Math.tan(fov/2),n=.05,fa=40;return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(fa+n)/(n-fa),-1,0,0,2*fa*n/(n-fa),0]);}
function ortho(s){return new Float32Array([1/s,0,0,0,0,1/s,0,0,0,0,-2/20,0,0,0,-1,1]);}
const domainVS=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPosition;layout(location=1)in vec3 aNormal;layout(location=2)in vec4 aData;layout(location=3)in float aKind;
uniform mat4 uVP;uniform mat4 uLightVP;
out vec3 vQ;out vec3 vP;out vec3 vN;out vec4 vD;out vec4 vShadow;out float vKind;
uniform int uTwists;uniform float uStrength;uniform float uPhase;
float h(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}

// Coordinate twists are project experiments. The source scalar alone is studied from Macroscopic microscope.
vec3 localTwist(vec3 p, vec3 center, vec3 axis, float radius, float freq, float amp, float phase){
 vec3 v=p-center;axis=normalize(axis);
 float angle=amp*uStrength*exp(-dot(v,v)/(radius*radius))*sin(freq*dot(axis,v)+phase);
 float c=cos(angle),s=sin(angle);
 return center+c*v+s*cross(axis,v)+(1.-c)*axis*dot(axis,v);
}
vec3 detailCoordinates(vec3 p){
 if(uTwists>0)p=localTwist(p,vec3(.12,-.08,.04),vec3(.38,.82,.42),2.4,1.45,.65,uPhase);
 if(uTwists>1)p=localTwist(p,vec3(-.16,.13,-.06),vec3(-.67,.15,.73),2.1,4.1,.20,uPhase+1.3);
 if(uTwists>0){vec3 x=p*6.9+vec3(uPhase);p+=.050*uStrength*(vec3(noise(x),noise(x+vec3(14.7,-6.3,4.2)),noise(x+vec3(-3.7,17.2,12.4)))-.5);}
 return p;
}

void main(){vQ=aKind>.5?aPosition:detailCoordinates(aPosition);vP=aPosition;vN=aNormal;vD=aData;vKind=aKind;vShadow=uLightVP*vec4(aPosition,1.);gl_Position=uVP*vec4(aPosition,1.);}`;
const vs=domainVS.replace('layout(location=0)in vec3 aPosition;', 'layout(location=4)in vec3 aCoordinates;layout(location=0)in vec3 aPosition;').replace('vQ=aKind>.5?aPosition:detailCoordinates(aPosition);','vQ=aCoordinates;');
const fs=`#version 300 es
precision highp float;
in vec3 vQ;in vec3 vP;in vec3 vN;in vec4 vD;in vec4 vShadow;in float vKind;
uniform int uTwists;uniform int uLevels;uniform float uStrength;uniform float uPhase;uniform float uFrequency;
uniform vec3 uEye;uniform vec3 uLight;uniform int uRock;uniform int uFamily;uniform int uMode;uniform float uWet;uniform float uRough;uniform float uGrain;uniform float uColor;uniform float uRed;uniform float uChar;uniform float uKiln;uniform float uTone;uniform float uMineral;uniform float uPolish;uniform float uStrata;uniform float uExposure;uniform float uClip;uniform highp sampler2DShadow uDepth;
out vec4 frag;
float h(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);}
vec3 srgb(vec3 c){return mix(12.92*c,1.055*pow(max(c,vec3(0)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
vec3 linear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 tonemap(vec3 x){return max(x,vec3(0))/(1.+max(x,vec3(0)));}
float shadow(vec3 n){vec3 q=vShadow.xyz/vShadow.w*.5+.5;if(any(lessThan(q,vec3(0)))||any(greaterThan(q,vec3(1))))return 1.;float bias=max(.0005*(1.-dot(n,uLight)),.00012);float s=0.;for(int i=0;i<4;i++){vec2 offset=vec2(float(i%2),float(i/2))-.5;s+=texture(uDepth,vec3(q.xy+offset/1024.,q.z-bias));}return s*.25;}
vec3 perturb(vec3 n,float height){vec3 x=dFdx(vP),y=dFdy(vP),r1=cross(y,n),r2=cross(n,x);float det=dot(x,r1);vec3 grad=sign(det)*(dFdx(height)*r1+dFdy(height)*r2)/max(abs(det),1e-8);return normalize(n-grad);}

float microscopeCell(vec3 p){
 vec3 c=cos(p);return cos(c.z*c.x+c.y*c.y+c.y*c.x);
}
// Four finite coupled scales; stage two and the octave transforms are our own adaptation.
float microscopeSum(vec3 q){
 float footprint=max(length(dFdx(q)),length(dFdy(q))),sum=0.,freq=1.,amp=1.;
 const mat3 turn=mat3(.36,.48,-.80,-.80,.60,0.,.48,.64,.60);
 for(int j=0;j<5;j++){
  if(j>=uLevels)break;
  float w=1.-smoothstep(.24,1.1,footprint*freq);
  sum+=w*(microscopeCell(q)-.6556965)*amp;
  q=turn*q*2.07+vec3(7.13,-3.71,5.47);freq*=2.07;amp*=.43;
 }
 return sum;
}


// R6: limited analytic mineral masks. No 27-cell neighbour search per pixel.
// Shared continuous fields drive related, independently remapped material outputs.
void rockMaterial(vec3 q,float macro,float meso,float micro,float fp,out vec3 base,out float rough,out float height){
 bool worn=uFamily==6;float wear=worn?1.:0.;float variety=clamp(uColor,0.,1.5);
 float g=noise(q*129.7+vec3(2.8,15.7,7.1));
 g=mix(.5,g,1.-smoothstep(.004,.018,fp));
 float broad=noise(q*3.4+vec3(14.1,-8.3,2.7));
 float weather=smoothstep(.60,.83,broad+.15*(meso-.5));
 if(uRock==1){
  // Compact granite candidate: three mineral populations with irregular contacts.
  vec3 gp=q*vec3(65.3,68.1,61.7);
  float cr=noise(gp+vec3(12.3,7.1,-3.4)),other=noise(gp*1.31+vec3(-17.1,4.3,9.7));
  float resolved=1.-smoothstep(.3,.95,fp*68.1);
  float mica=(1.-smoothstep(.22,.29,cr+.13*(other-.5)))*resolved;
  float quartz=smoothstep(.51,.63,other)*(1.-mica);
  float warm=clamp(.12+.38*meso+uTone*.35,0.,1.);
  vec3 feldspar=mix(vec3(.69,.67,.62),vec3(.67,.44,.34),warm);
  vec3 mineral=mix(feldspar,vec3(.49,.525,.52),quartz);
  mineral=mix(mineral,vec3(.14,.16,.15),mica*(.55+.4*uMineral));
  mineral*=.84+.31*g;
  base=mix(vec3(.57,.54,.49),mineral,resolved*(.25+.75*uMineral));
  rough=(worn?.60:.81)+(uRough-.8)*.68-.06*quartz-.10*mica+.04*(other-.5);
  height=(cr-.5)*(worn?.0005:.0020)+(g-.5)*(worn?.0004:.0014);
 }else if(uRock==2){
  float fine=noise(q*vec3(91.,104.,98.)+vec3(19.,2.,7.));
  fine=mix(.5,fine,1.-smoothstep(.32,1.2,fp*104.));
  float bed=noise(vec3(q.x*3.1,q.y*16.7+macro*.38,q.z*4.3));
  base=mix(vec3(.48,.33,.20),vec3(.73,.62,.44),clamp(.49+(macro-.5)*variety*1.5+.10*(bed-.5),0.,1.));
  base=mix(base,vec3(.54,.36,.23),weather*.28);
  base*=.96+.20*(fine-.5)*(.25+.75*uMineral);
  rough=(worn?.76:.90)+(uRough-.8)*.62+.055*(fine-.5);
  height=(fine-.5)*(worn?.00055:.0027)+(bed-.5)*uStrata*(worn?.0006:.0036);
 }else if(uRock==3){
  float fine=noise(q*vec3(70.,148.,99.)+vec3(14.2,2.7,-8.3));
  float fleck=smoothstep(.72,.86,fine)*(1.-smoothstep(.3,1.2,fp*148.));
  base=mix(vec3(.22,.25,.29),vec3(.38,.405,.386),clamp(.5+(macro-.5)*1.7*variety,0.,1.));
  base=mix(base,vec3(.62,.61,.52),fleck*(.15+.5*uMineral));
  base=mix(base,vec3(.38,.29,.22),weather*.4);
  rough=(worn?.60:.82)+(uRough-.8)*.67+.045*(g-.5);
  height=(g-.5)*(worn?.00033:.0015)+fleck*.0004;
 }else if(uRock==4){
  float gran=noise(q*67.2+vec3(14.,6.,1.));
  float vein=noise(q*vec3(3.1,7.4,4.7)+vec3(18.7,5.3,7.4));
  base=mix(vec3(.52,.52,.48),vec3(.79,.745,.643),clamp(.5+(macro-.5)*1.4*variety,0.,1.));
  base=mix(base,vec3(.86,.84,.76),smoothstep(.51,.67,vein)*uMineral*.45);
  base*=.97+.16*(gran-.5);
  rough=(worn?.56:.79)+(uRough-.8)*.67-.09*smoothstep(.52,.7,vein);
  height=(gran-.5)*(worn?.00035:.0017);
 }else if(uRock==5){
  float layer=noise(vec3(q.x*2.5,q.y*(17.+20.*uStrata)+broad*.38,q.z*2.7));
  base=mix(vec3(.20,.255,.285),vec3(.45,.49,.478),clamp(.52+(layer-.5)*1.2*variety,0.,1.));
  base=mix(base,vec3(.53,.394,.28),weather*.28);
  base=mix(base,vec3(.62,.63,.60),smoothstep(.64,.80,g)*uMineral*.22);
  rough=(worn?.56:.78)+(uRough-.8)*.67+.1*(layer-.5);
  height=(layer-.5)*(.001+uStrata*.005)*(worn?.22:1.)+(g-.5)*.0008;
 }else if(uRock==6){
  float band=noise(vec3(q.x*3.2,q.y*(12.+uStrata*13.)+macro*.7,q.z*3.6));
  float grain=noise(q*52.1+vec3(11.7,-3.9,4.2));
  base=mix(vec3(.21,.23,.24),vec3(.73,.70,.63),smoothstep(.30,.65,band));
  base=mix(base,vec3(.40,.31,.275),weather*.28);
  base*=.90+.21*grain*(.25+.75*uMineral);
  rough=(worn?.58:.81)+(uRough-.8)*.68+.08*(grain-.5);
  height=(grain-.5)*(worn?.0004:.0023)+(band-.5)*uStrata*(worn?.0003:.0028);
 }else{
  float vein=noise(vec3(q.x*3.8,q.y*9.1+broad*.6,q.z*4.1));
  float mask=(1.-smoothstep(.018,.095,abs(vein-.49)))*(.3+.7*meso);
  base=mix(vec3(.64,.67,.653),vec3(.81,.78,.69),clamp(.5+(macro-.5)*1.8,0.,1.));
  base=mix(base,vec3(.27,.32,.34),mask*(.20+.62*uMineral));
  rough=(worn?.49:.72)+(uRough-.8)*.68+.07*mask;
  height=(g-.5)*(worn?.0002:.0010);
 }
 // Coherent colour variation uses low-frequency regions, not independent RGB dots.
 base*=1.+(macro-.5)*.20*variety;
 base=mix(base,base*vec3(1.13,.99,.85),max(uTone,0.));
 base=mix(base,base*vec3(.86,.99,1.16),max(-uTone,0.));
 rough=clamp(rough-(worn?uPolish*.20:0.),.27,.99);
 if(!worn)height+=(broad-.5)*.0012;
}

void main(){
 if(uClip>0.5&&vP.x>0.)discard;
 vec3 N=normalize(vN),V=normalize(uEye-vP);if(!gl_FrontFacing)N=-N;
 float rough=uRough,ao=vD.a;vec3 base;float weight=clamp(uColor,0.,1.7);
 float a=vD.x,b=vD.y,c=vD.z,detail=0.;
 if(vKind<-.5){
  float s=shadow(N);float fade=1.-smoothstep(1.8,4.4,length(vP.xz));
  base=vec3(.10,.108,.105)*(.60+.40*s);frag=vec4(base,fade*.78);return;
 }
 float field=0.,drift=.5;
 if(vKind<.5){
 // A continuous material volume is evaluated on ALL faces in object coordinates.
 vec3 q=vQ+vec3(uPhase*.47,-uPhase*.31,uPhase*.19);
 float footprint=max(length(dFdx(q)),length(dFdy(q)));
 if(uRock==0)field=microscopeSum(q*uFrequency*2.4);
 float grain=.5;if(uRock==0)grain=noise(q*211.7+vec3(4.1,8.3,-2.1));
 float fineFilter=1.-smoothstep(.0015,.006,footprint);
 grain=mix(.5,grain,fineFilter);
 drift=noise(q*4.3+vec3(7.8,-11.3,4.1));
 float weather=smoothstep(.34,.69,a+.17*(drift-.5));
 float mineral=smoothstep(.68,.86,grain+.2*(b-.5));
 float meso=clamp(.5+field*.42,0.,1.);
 if(uRock>0){
  rockMaterial(q*(uFrequency/13.),a,b,c,footprint*(uFrequency/13.),base,rough,detail);field=detail*70.;
 }else if(uFamily==0||uFamily==4){

  // Coverage and contrast are independent, as in a remapped material mask.
  vec3 clay=mix(vec3(.62,.305,.18),vec3(.73,.245,.14),uRed);
  base=clay*(.92+.18*b);
  float soot=smoothstep(1.-uChar*.56,1.08-uChar*.56,a+.20*(drift-.5));
  base=mix(base,vec3(.22,.175,.145),soot*.78);
  base=mix(base,vec3(.74,.58,.41),smoothstep(.66,.82,b)*.16*weight);
  base=mix(base,vec3(.71,.68,.58),mineral*smoothstep(.60,.78,b)*.30*weight);
  detail=field*.010+(grain-.5)*.005;
  rough=clamp(rough+.08*(drift-.5)-.04*soot,.48,.99);
  if(uFamily==4){
   float fired=smoothstep(.38,.68,drift*.62+a*.38);
   base=mix(base,vec3(.47,.235,.212),fired*uKiln*.67);
   base=mix(base,vec3(.78,.42,.235),smoothstep(.52,.75,b)*(1.-fired)*uKiln*.50);
   rough=clamp(rough-fired*uKiln*.17,.40,.99);
  }
  base*=.98+.08*c;
  base=mix(base,base*vec3(1.10,.99,.88),max(uTone,0.));
  base=mix(base,base*vec3(.90,1.,1.12),max(-uTone,0.));
 }else if(uFamily==3){
  base=mix(vec3(.39,.291,.182),vec3(.63,.466,.275),clamp(.48+(a-.5)*1.15*weight,0.,1.));
  base*=.88+.18*b+.035*field;
  base*=vec3(1.+uTone*.10,1.,1.-uTone*.12);
  detail=(abs(field)-.30)*.0045+(grain-.5)*.0045+(drift-.5)*.0015;
  rough=clamp(rough+.04*(drift-.5),.77,1.);
 }else if(uFamily==6){
  base=mix(vec3(.29,.32,.31),vec3(.56,.54,.46),clamp(.48+(a-.5)*1.4*weight,0.,1.));
  base=mix(base,vec3(.61,.58,.50),smoothstep(.72,.91,b)*.38*weight);
  detail=field*.005+(grain-.5)*.0014;
  rough=clamp(rough+.10*(b-.5),.45,.86);
 }else{
  // Bedding and tiny mica/mineral regions have different roughness, not a shared grayscale map.
  // Non-uniform mineral seam mask. No periodic sin bands on every rock.
  float vein=noise(vec3(q.x*3.1+drift*.25,q.y*7.2,q.z*3.4)+vec3(11.7,6.2,-8.3));
  float seams=(1.-smoothstep(.012,.056,abs(vein-.54)))*smoothstep(.43,.69,b);
  if(uFamily!=1)seams*=.33;
  base=mix(vec3(.255,.287,.298),vec3(.59,.56,.47),clamp(.50+(a-.5)*1.40*weight,0.,1.));
  base=mix(base,vec3(.38,.294,.196),smoothstep(.58,.77,drift)*.25*weight);
  base=mix(base,vec3(.66,.659,.60),seams*.26*weight);
  float fresh=smoothstep(.32,.77,c);
  base=mix(base,vec3(.55,.554,.522),mineral*fresh*.22*weight);
  base*=.96+.28*(grain-.5)+.13*field;
  detail=field*.012+(grain-.5)*.0040-(1.-meso)*seams*.0012;
  rough=clamp(rough+.13*(drift-.5)-mineral*fresh*.10,.58,.98);
 }
 }else{
  drift=vD.x;
  float fiber=sin(vD.z*6.283185*3.+sin(vD.x*5.)*.3);
  base=mix(vec3(.35,.285,.175),vec3(.62,.505,.302),.48+.12*fiber+.16*(drift-.5));
  base*=1.-vD.y*.32;
  base=mix(base,vec3(.43,.329,.211),clamp(vD.w*.72,0.,.9));
  if(vKind>4.5){
   float rim=smoothstep(.85,.985,vD.z),ribs=sin(vD.x*43.+vD.z*2.3);
   base=mix(vec3(.52,.409,.24),vec3(.73,.61,.39),rim*.70+.16*(ribs*.5+.5));
   base=mix(base,vec3(.43,.329,.211),clamp(vD.w*.55,0.,.85));
   detail=ribs*.00010;rough=.87;ao=.94;
  }else{detail=fiber*.00025;rough=.93;ao=.92;}
 }
 if(uMode==4){frag=vec4(vec3(clamp(.5+.33*field,0.,1.)),1.);return;}
 if(uMode==5){frag=vec4(vec3(rough),1.);return;}

 vec3 faceN=normalize(cross(dFdx(vP),dFdy(vP)));faceN*=sign(dot(faceN,N));
 if(vKind<.5)N=normalize(mix(N,faceN,(uFamily==1||uFamily==2||uFamily==5)?.20:uFamily==6?.01:.02));
 N=perturb(N,detail*uGrain);
 if(uMode==1){base=vec3(.49);N=normalize(vN);}if(uMode==2){frag=vec4(base,1);return;}if(uMode==3){frag=vec4(N*.5+.5,1);return;}
 base=linear(clamp(base,0.,1.))*(1.-uWet*.24);rough=clamp(rough-uWet*.34,.28,1.);
 vec3 H=normalize(V+uLight);float nl=max(dot(N,uLight),0.),nv=max(dot(N,V),.03),nh=max(dot(N,H),0.),vh=max(dot(V,H),0.);
 float alpha=rough*rough,aa=alpha*alpha,den=nh*nh*(aa-1.)+1.;float D=aa/(3.14159*den*den);// Height-correlated Smith visibility. alpha = perceptual roughness squared.
 float visibleG=.5/max(nl*sqrt(nv*nv*(1.-aa)+aa)+nv*sqrt(nl*nl*(1.-aa)+aa),1e-5);
 vec3 F=vec3(.04)+.96*pow(1.-vh,5.);vec3 spec=D*visibleG*F;
 float visibility=shadow(N);
 vec3 hemi=mix(vec3(.18,.174,.16),vec3(.44,.455,.47),N.y*.5+.5);
 vec3 color=base*hemi*ao + ((1.-F)*base/3.14159+spec)*vec3(3.6,3.4,3.17)*nl*visibility;
 color+=base*vec3(.29,.31,.34)*max(dot(N,normalize(vec3(3.,1.,-2.))),0.);
 frag=vec4(srgb(tonemap(color*uExposure)),1.);
}`;
// Straw uses the same lighting model through a short, specialized shader.
// It never enters the rock/brick microstructure program. Geometry and quality are unchanged.
const fiberFS=fs.slice(0,fs.indexOf(' if(vKind<.5){\n // A continuous'))+' {'+fs.slice(fs.indexOf('  drift=vD.x;'));
const floorFS=`#version 300 es
precision highp float;
in vec3 vP;in vec4 vShadow;
uniform highp sampler2DShadow uDepth;uniform vec3 uLight;
out vec4 frag;
void main(){vec3 q=vShadow.xyz/vShadow.w*.5+.5;float s=1.;
 if(all(greaterThanEqual(q,vec3(0)))&&all(lessThanEqual(q,vec3(1)))){s=0.;float bias=max(.0005*(1.-uLight.y),.00012);for(int i=0;i<4;i++){vec2 offset=vec2(float(i%2),float(i/2))-.5;s+=texture(uDepth,vec3(q.xy+offset/1024.,q.z-bias));}s*=.25;}
 float fade=1.-smoothstep(1.8,4.4,length(vP.xz));frag=vec4(vec3(.10,.108,.105)*(.60+.40*s),fade*.78);
}`;
const depthVS=`#version 300 es
layout(location=0)in vec3 aPosition;uniform mat4 uVP;void main(){gl_Position=uVP*vec4(aPosition,1.);}`;
const depthFS=`#version 300 es
precision mediump float;void main(){}`;
function program(v,f,feedback=null){const p=gl.createProgram();for(const [type,s]of[[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){const sh=gl.createShader(type);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));gl.attachShader(p,sh);gl.deleteShader(sh);}if(feedback)gl.transformFeedbackVaryings(p,feedback,gl.INTERLEAVED_ATTRIBS);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const log=gl.getProgramInfoLog(p)+' '+gl.getAttachedShaders(p).map(s=>gl.getShaderInfoLog(s)).join(' / ');throw Error('着色器编译失败 '+log);}return p;}
const domainProg=program(domainVS,depthFS,['vQ']),domainTF=gl.createTransformFeedback(),domainU={};for(const n of ['uTwists','uStrength','uPhase'])domainU[n]=gl.getUniformLocation(domainProg,n);
// Specialize the selected lithology so dormant crystal/noise branches are compiled away.
// Programs are cached on first use; changing camera never recompiles them.
const uniformNames=['uVP','uLightVP','uEye','uLight','uFamily','uRock','uMode','uWet','uRough','uGrain','uColor','uRed','uChar','uKiln','uTone','uMineral','uPolish','uStrata','uExposure','uClip','uDepth','uTwists','uLevels','uStrength','uPhase','uFrequency'];
const materialPrograms=new Map();
function materialProgram(rock){
 rock=Math.max(0,Math.min(7,Math.round(rock)));
 if(materialPrograms.has(rock))return materialPrograms.get(rock);
 const p=program(vs,fs.replace('uniform int uRock;', 'const int uRock='+rock+';')),U={};for(const n of uniformNames)U[n]=gl.getUniformLocation(p,n);
 const entry={prog:p,U};materialPrograms.set(rock,entry);return entry;
}
const baseProgram=materialProgram(0),prog=baseProgram.prog,depthProg=program(depthVS,depthFS);
const fiberProg=program(vs,fiberFS),fiberU={};for(const n of uniformNames)fiberU[n]=gl.getUniformLocation(fiberProg,n);
const depthU=gl.getUniformLocation(depthProg,'uVP');
const floorProg=program(vs,floorFS),floorU={};for(const n of ['uVP','uLightVP','uLight','uDepth'])floorU[n]=gl.getUniformLocation(floorProg,n);
const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,1024,1024,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL);
const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,texture,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('阴影缓冲区不可用');gl.bindFramebuffer(gl.FRAMEBUFFER,null);
function mesh(a){const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buffers=[];[a.position,a.normal,a.data,a.kind].forEach((v,i)=>{const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,[3,3,4,1][i],gl.FLOAT,false,0,0);});const ib=gl.createBuffer();buffers.push(ib);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,a.index,gl.STATIC_DRAW);const cb=gl.createBuffer();buffers.push(cb);gl.bindBuffer(gl.ARRAY_BUFFER,cb);gl.bufferData(gl.ARRAY_BUFFER,a.position.byteLength,gl.DYNAMIC_COPY);gl.enableVertexAttribArray(4);gl.vertexAttribPointer(4,3,gl.FLOAT,false,0,0);gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);
 const domainVao=gl.createVertexArray();gl.bindVertexArray(domainVao);
 for(const i of [0,3]){gl.bindBuffer(gl.ARRAY_BUFFER,buffers[i]);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,i===0?3:1,gl.FLOAT,false,0,0);}gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);
 return{vao,domainVao,buffers,count:a.index.length,bodyCount:a.stats?.bodyIndexCount??a.index.length,vertices:a.position.length/3,coordinates:cb,coordinateKey:null};}
let object=null,ground=null,lastGeometry=null,shadowDirty=true,light=[-3.1,4.4,5.2],lightVP=mul(ortho(2.8),look(light,[0,0,0]));
const camera={yaw:-.48,pitch:.23,radius:4.05,panX:0,panY:0};
const state={twists:2,levels:4,strength:1,phase:.7,frequency:14,family:2,rock:0,red:.72,char:.16,kiln:.45,tone:0,mineral:.6,polish:.3,strata:.7,mode:0,wet:0,rough:.84,grain:.5,color:1,exposure:1,clip:0,pixelRatio:1,auto:false,paused:false};
const stats={coordinateBakes:0,frames:0,geometryUploads:0,attributeUploads:0,shadowPasses:0,canvasPixels:0,submittedCpuMs:0,lastFrameAt:0,idle:true,traceEnabled:false,frameTrace:[]};
function remove(m){if(!m)return;for(const b of m.buffers)gl.deleteBuffer(b);gl.deleteVertexArray(m.vao);gl.deleteVertexArray(m.domainVao);}
function upload(a){remove(object);remove(ground);object=mesh(a);lastGeometry=a;let y=a.stats.bounds.min[1]-.012;
 ground=mesh({position:new Float32Array([-5,y,-5,5,y,-5,-5,y,5,5,y,5]),normal:new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]),data:new Float32Array(16).fill(1),kind:new Float32Array(4).fill(-1),index:new Uint32Array([0,2,1,2,3,1])});
 shadowDirty=true;stats.geometryUploads++;invalidate();}
function uploadData(a){lastGeometry={...lastGeometry,data:a};gl.bindBuffer(gl.ARRAY_BUFFER,object.buffers[2]);gl.bufferSubData(gl.ARRAY_BUFFER,0,a);stats.attributeUploads++;invalidate();}
// Bake material-domain coordinates once per specimen / domain recipe on the GPU.
// Camera motion reads the retained buffer; it does not repeat twists and domain noise.
function bakeCoordinates(){
 if(!object)return;const key=[state.twists,state.strength,state.phase].join(':');if(object.coordinateKey===key)return;
 gl.useProgram(domainProg);gl.uniform1i(domainU.uTwists,state.twists);gl.uniform1f(domainU.uStrength,state.strength);gl.uniform1f(domainU.uPhase,state.phase);
 gl.bindVertexArray(object.domainVao);gl.bindBuffer(gl.ARRAY_BUFFER,null);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,domainTF);gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,object.coordinates);
 gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,object.vertices);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
 gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,null);gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK,null);gl.bindVertexArray(null);object.coordinateKey=key;stats.coordinateBakes++;
}
let dirty=true,raf=0,fence=null,previous=0,disposed=false;
function invalidate(){if(disposed)return;dirty=true;if(!raf&&!document.hidden&&!state.paused)raf=requestAnimationFrame(render);}
function draw(m){if(!m)return;gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0);}
function render(t){raf=0;if(disposed||state.paused||document.hidden)return;
 if(fence){const signal=gl.clientWaitSync(fence,0,0);if(signal===gl.TIMEOUT_EXPIRED){if(dirty||state.auto)raf=requestAnimationFrame(render);return;}gl.deleteSync(fence);fence=null;}
 if(state.auto){camera.yaw+=Math.min(t-previous||16,80)*.00014;dirty=true;}previous=t;
 if(!dirty){stats.idle=true;return;}dirty=false;const start=performance.now();
 const rect=canvas.getBoundingClientRect(),w=Math.max(2,Math.round(rect.width*state.pixelRatio)),h=Math.max(2,Math.round(rect.height*state.pixelRatio));if(w!==canvas.width||h!==canvas.height){canvas.width=w;canvas.height=h;}stats.canvasPixels=w*h;bakeCoordinates();
 gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
 if(shadowDirty&&object){gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.viewport(0,0,1024,1024);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(depthProg);gl.uniformMatrix4fv(depthU,false,lightVP);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.0,1.0);draw(object);gl.disable(gl.POLYGON_OFFSET_FILL);gl.bindFramebuffer(gl.FRAMEBUFFER,null);stats.shadowPasses++;shadowDirty=false;}
 gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const selectedProgram=materialProgram(state.rock);gl.useProgram(selectedProgram.prog);
 const target=[camera.panX,camera.panY,0],eye=[Math.sin(camera.yaw)*Math.cos(camera.pitch)*camera.radius+target[0],Math.sin(camera.pitch)*camera.radius+target[1],Math.cos(camera.yaw)*Math.cos(camera.pitch)*camera.radius];
 const viewProjection=mul(persp(.67,w/h),look(eye,target));setUniforms(selectedProgram.U);
 function setUniforms(L){
gl.uniformMatrix4fv(L.uVP,false,viewProjection);gl.uniformMatrix4fv(L.uLightVP,false,lightVP);gl.uniform3fv(L.uEye,eye);gl.uniform3fv(L.uLight,norm(light));
 gl.uniform1i(L.uTwists,state.twists);gl.uniform1i(L.uLevels,state.levels);gl.uniform1f(L.uStrength,state.strength);gl.uniform1f(L.uPhase,state.phase);gl.uniform1f(L.uFrequency,state.frequency);gl.uniform1i(L.uFamily,state.family);gl.uniform1i(L.uRock,state.rock);gl.uniform1i(L.uMode,state.mode);for(const [n,k]of[['uWet','wet'],['uRough','rough'],['uGrain','grain'],['uColor','color'],['uRed','red'],['uChar','char'],['uKiln','kiln'],['uTone','tone'],['uMineral','mineral'],['uPolish','polish'],['uStrata','strata'],['uExposure','exposure'],['uClip','clip']])gl.uniform1f(L[n],state[k]);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(L.uDepth,0);
}
 if(!state.clip&&camera.pitch>-.28){gl.useProgram(floorProg);gl.uniformMatrix4fv(floorU.uVP,false,viewProjection);gl.uniformMatrix4fv(floorU.uLightVP,false,lightVP);gl.uniform3fv(floorU.uLight,norm(light));gl.uniform1i(floorU.uDepth,0);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);draw(ground);gl.disable(gl.BLEND);gl.useProgram(selectedProgram.prog);}
 if(state.clip)gl.disable(gl.CULL_FACE);else gl.enable(gl.CULL_FACE);
 if(object){gl.bindVertexArray(object.vao);gl.drawElements(gl.TRIANGLES,object.bodyCount,gl.UNSIGNED_INT,0);
  if(object.count>object.bodyCount){gl.useProgram(fiberProg);setUniforms(fiberU);gl.drawElements(gl.TRIANGLES,object.count-object.bodyCount,gl.UNSIGNED_INT,object.bodyCount*4);}}
 // Closed geometry culls its back faces; cutaway remains two-sided.
 stats.frames++;if(stats.traceEnabled){stats.frameTrace.push({t:performance.now(),yaw:camera.yaw,pitch:camera.pitch,pixels:w*h,family:state.family});if(stats.frameTrace.length>360)stats.frameTrace.shift();}stats.lastFrameAt=performance.now();stats.submittedCpuMs=stats.lastFrameAt-start;stats.idle=!state.auto;
 fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();if(state.auto)raf=requestAnimationFrame(render);
}
function setLight(side){light=side==='rake'?[-5,1.8,3.4]:[-3.1,4.4,5.2];lightVP=mul(ortho(2.8),look(light,[0,0,0]));shadowDirty=true;invalidate();}
function pause(on){state.paused=on;if(on&&raf){cancelAnimationFrame(raf);raf=0;}if(!on)invalidate();}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();state.paused=true;stats.contextLost=true;if(raf){cancelAnimationFrame(raf);raf=0;}});
function reset(){Object.assign(camera,{yaw:-.48,pitch:.23,radius:canvas.clientWidth<600?7.3:4.05,panX:0,panY:0});invalidate();}
let pointers=new Map(),prevPinch=0;canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);prevPinch=0;});
canvas.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p)return;const dx=e.clientX-p[0],dy=e.clientY-p[1];pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(prevPinch)camera.radius=Math.max(1.4,Math.min(12,camera.radius*prevPinch/d));prevPinch=d;}else if(e.buttons===2||e.shiftKey){camera.panX-=dx*.003*camera.radius;camera.panY+=dy*.003*camera.radius;}else{camera.yaw-=dx*.006;camera.pitch=Math.max(-1.45,Math.min(1.45,camera.pitch+dy*.006));}invalidate();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{pointers.delete(e.pointerId);prevPinch=0;});
canvas.addEventListener('wheel',e=>{e.preventDefault();camera.radius=Math.max(1.4,Math.min(12,camera.radius*Math.exp(e.deltaY*.001)));invalidate();},{passive:false});canvas.addEventListener('dblclick',reset);
const ro=new ResizeObserver(invalidate);ro.observe(canvas);document.addEventListener('visibilitychange',()=>{if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;}else invalidate();});
function destroy(){disposed=true;if(raf)cancelAnimationFrame(raf);if(fence)gl.deleteSync(fence);remove(object);remove(ground);ro.disconnect();gl.deleteFramebuffer(fb);gl.deleteTexture(texture);for(const m of materialPrograms.values())gl.deleteProgram(m.prog);materialPrograms.clear();gl.deleteProgram(depthProg);gl.deleteProgram(floorProg);gl.deleteProgram(fiberProg);gl.deleteProgram(domainProg);gl.deleteTransformFeedback(domainTF);}
return{upload,uploadData,state,camera,stats,invalidate,pause,reset,setLight,destroy,gl,programCount:()=>materialPrograms.size,object:()=>lastGeometry};
}
