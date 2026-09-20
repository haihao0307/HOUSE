/* Small retained-mode WebGL2 specimen renderer. No per-frame field evaluation.
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
const vs=`#version 300 es
precision highp float;
layout(location=0)in vec3 aPosition;layout(location=1)in vec3 aNormal;layout(location=2)in vec4 aData;layout(location=3)in float aKind;layout(location=4)in vec3 aLocal;
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

void main(){vQ=detailCoordinates(aLocal);vP=aPosition;vN=aNormal;vD=aData;vKind=aKind;vShadow=uLightVP*vec4(aPosition,1.);gl_Position=uVP*vec4(aPosition,1.);}`;
const fs=`#version 300 es
precision highp float;
in vec3 vQ;in vec3 vP;in vec3 vN;in vec4 vD;in vec4 vShadow;in float vKind;
uniform int uTwists;uniform int uLevels;uniform float uStrength;uniform float uPhase;uniform float uFrequency;
uniform vec3 uEye;uniform vec3 uLight;uniform int uFamily;uniform int uMode;uniform float uWet;uniform float uRough;uniform float uGrain;uniform float uColor;uniform float uExposure;uniform float uClip;uniform highp sampler2DShadow uDepth;
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

void main(){
 if(uClip>0.5&&vP.x>0.)discard;
 vec3 N=normalize(vN),V=normalize(uEye-vP);if(!gl_FrontFacing)N=-N;
 float rough=uRough,ao=vD.a;vec3 base;float weight=clamp(uColor,0.,1.7);
 float a=vD.x,b=vD.y,c=vD.z,detail=0.;
 if(vKind<-.5){
  float s=shadow(N);float fade=1.-smoothstep(1.8,4.4,length(vP.xz));
  base=vec3(.10,.108,.105)*(.60+.40*s);frag=vec4(base,fade*.78);return;
 }
 // A continuous material volume is evaluated on ALL faces in object coordinates.
 vec3 q=vQ+vec3(uPhase*.47,-uPhase*.31,uPhase*.19);
 float footprint=max(length(dFdx(q)),length(dFdy(q)));
 float field=microscopeSum(q*uFrequency*2.4);
 float grain=noise(q*211.7+vec3(4.1,8.3,-2.1));
 float fineFilter=1.-smoothstep(.0015,.006,footprint);
 grain=mix(.5,grain,fineFilter);
 float drift=noise(q*4.3+vec3(7.8,-11.3,4.1));
 float weather=smoothstep(.34,.69,a+.17*(drift-.5));
 float mineral=smoothstep(.68,.86,grain+.2*(b-.5));
 float meso=clamp(.5+field*.42,0.,1.);
 if(uFamily==0||uFamily==4){
  base=mix(vec3(.61,.249,.116),vec3(.75,.379,.185),clamp(.48+(b-.5)*1.1,0.,1.));
  float firing=smoothstep(.47,.68,a+.20*(drift-.5)+.12*field);
  base=mix(base,vec3(.20,.179,.156),firing*.90*weight);
  base=mix(base,vec3(.76,.64,.47),smoothstep(.59,.77,b)*.24*weight);
  base=mix(base,vec3(.70,.69,.62),mineral*smoothstep(.59,.76,b)*.47*weight);
  if(uFamily==4){
   base=mix(base,vec3(.22,.225,.211),smoothstep(.38,.68,b+.14*drift)*.56*weight);
   base=mix(base,vec3(.57,.357,.218),smoothstep(.63,.80,a)*.28);
  }
  base*=.91+.14*c;
  detail=field*.018+(grain-.5)*.005;
  rough=clamp(rough+.10*(drift-.5)-.05*firing,.60,.99);
 }else if(uFamily==3){
  base=mix(vec3(.39,.291,.182),vec3(.63,.466,.275),clamp(.48+(a-.5)*1.15*weight,0.,1.));
  base*=.88+.18*b+.035*field;
  detail=(abs(field)-.30)*.010+(grain-.5)*.006;
  rough=clamp(rough+.04*(drift-.5),.77,1.);
 }else{
  // Related material regions, distinct outputs: mineral color is not copied into roughness.
  // Layer seams are sparse and gated; rubble/dressed/pebble do not inherit global stripes.
  float seams=0.;
  if(uFamily==1){
   float domain=dot(q,vec3(1.6,10.7,2.4))+drift*2.4;
   seams=smoothstep(.90,.994,sin(domain))*smoothstep(.50,.76,b)*.48;
  }
  float warm=smoothstep(.29,.76,a+.12*(drift-.5));
  base=mix(vec3(.32,.354,.365),vec3(.60,.565,.48),clamp(.46+(warm-.5)*1.12*weight,0.,1.));
  base=mix(base,vec3(.40,.31,.215),smoothstep(.58,.77,drift)*.19*weight);
  base=mix(base,vec3(.69,.686,.61),seams*weight);
  float fresh=smoothstep(.35,.78,c);
  base=mix(base,vec3(.65,.646,.607),mineral*fresh*.23*weight);
  base*=.975+.16*(grain-.5)+.045*field;
  detail=field*.013+(grain-.5)*.005;
  rough=clamp(rough+.12*(drift-.5)-mineral*fresh*.08,.62,.99);
  if(uFamily==5){base=mix(base,vec3(.56,.516,.438),.24);detail*=.87;}
  if(uFamily==6){
   base=mix(vec3(.285,.31,.29),vec3(.565,.537,.456),clamp(.54+(a-.5)*1.4*weight,0.,1.));
   base=mix(base,vec3(.70,.69,.626),mineral*.12);
   detail=field*.0028+(grain-.5)*.0022;
   rough=clamp(rough+.07*(b-.5),.50,.96);
  }
 }
 if(vKind>.5){
  float fiber=sin(vD.z*6.283185*3.+sin(vD.x*5.)*.3);
  base=mix(vec3(.39,.315,.193),vec3(.66,.544,.327),.56+.12*fiber);
  base*=1.-vD.y*.32;
  base=mix(base,vec3(.43,.329,.211),clamp(vD.w*.72,0.,.9));
  detail=fiber*.00025;rough=.93;ao=.92;
 }
 if(uMode==4){frag=vec4(vec3(clamp(.5+.33*field,0.,1.)),1.);return;}


 vec3 faceN=normalize(cross(dFdx(vP),dFdy(vP)));faceN*=sign(dot(faceN,N));
 if(vKind<.5)N=normalize(mix(N,faceN,(uFamily==1||uFamily==2||uFamily==5)?.20:uFamily==6?0.:.09));
 N=perturb(N,detail*uGrain);
 if(uMode==1){base=vec3(.49);N=normalize(vN);}if(uMode==2){frag=vec4(base,1);return;}if(uMode==3){frag=vec4(N*.5+.5,1);return;}
 base=linear(clamp(base,0.,1.))*(1.-uWet*.24);rough=clamp(rough-uWet*.30,.30,1.);
 if(uMode==5){frag=vec4(vec3(rough),1.);return;}
 if(uMode==6){frag=vec4(vec3(.04),1.);return;}
 if(uMode==7){frag=vec4(vec3(0.),1.);return;}
 vec3 H=normalize(V+uLight);float nl=max(dot(N,uLight),0.),nv=max(dot(N,V),.03),nh=max(dot(N,H),0.),vh=max(dot(V,H),0.);
 // Isotropic dielectric GGX with height-correlated Smith visibility and Schlick Fresnel.
 // Perceptual roughness -> alpha, only once. F0 = .04 is an explicit uncalibrated assumption.
 float alpha=rough*rough,aa=alpha*alpha,den=nh*nh*(aa-1.)+1.;
 float D=aa/(3.14159265*den*den);
 float gv=nl*sqrt(max(nv*nv*(1.-aa)+aa,0.));
 float glh=nv*sqrt(max(nl*nl*(1.-aa)+aa,0.));
 float vis=.5/max(gv+glh,1e-5);
 vec3 F=vec3(.04)+vec3(.96)*pow(1.-vh,5.);
 vec3 spec=D*vis*F;
 float visibility=shadow(N);
 vec3 hemi=mix(vec3(.18,.174,.16),vec3(.44,.455,.47),N.y*.5+.5);
 vec3 color=base*hemi*ao + ((1.-F)*base/3.14159+spec)*vec3(3.6,3.4,3.17)*nl*visibility;
 color+=base*vec3(.29,.31,.34)*max(dot(N,normalize(vec3(3.,1.,-2.))),0.);
 frag=vec4(srgb(tonemap(color*uExposure)),1.);
}`;
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
function program(v,f){const p=gl.createProgram();for(const [type,s]of[[gl.VERTEX_SHADER,v],[gl.FRAGMENT_SHADER,f]]){const sh=gl.createShader(type);gl.shaderSource(sh,s);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));gl.attachShader(p,sh);gl.deleteShader(sh);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const log=gl.getProgramInfoLog(p)+' '+gl.getAttachedShaders(p).map(s=>gl.getShaderInfoLog(s)).join(' / ');throw Error('着色器编译失败 '+log);}return p;}
const prog=program(vs,fs),depthProg=program(depthVS,depthFS),U={};for(const n of ['uVP','uLightVP','uEye','uLight','uFamily','uMode','uWet','uRough','uGrain','uColor','uExposure','uClip','uDepth','uTwists','uLevels','uStrength','uPhase','uFrequency'])U[n]=gl.getUniformLocation(prog,n);
const depthU=gl.getUniformLocation(depthProg,'uVP');
const floorProg=program(vs,floorFS),floorU={};for(const n of ['uVP','uLightVP','uLight','uDepth'])floorU[n]=gl.getUniformLocation(floorProg,n);
const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,1024,1024,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL);
const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,texture,0);gl.drawBuffers([gl.NONE]);gl.readBuffer(gl.NONE);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('阴影缓冲区不可用');gl.bindFramebuffer(gl.FRAMEBUFFER,null);
function mesh(a){const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buffers=[];[a.position,a.normal,a.data,a.kind,a.local||a.position].forEach((v,i)=>{const b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,v,gl.STATIC_DRAW);gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,[3,3,4,1,3][i],gl.FLOAT,false,0,0);});const ib=gl.createBuffer();buffers.push(ib);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,a.index,gl.STATIC_DRAW);gl.bindVertexArray(null);return{vao,buffers,count:a.index.length};}
let object=null,ground=null,lastGeometry=null,shadowDirty=true,light=[-3.1,4.4,5.2],lightVP=mul(ortho(2.8),look(light,[0,0,0]));
const camera={yaw:-.48,pitch:.23,radius:4.05,panX:0,panY:0};
const state={twists:2,levels:4,strength:1,phase:.7,frequency:14,family:2,mode:0,wet:0,rough:.84,grain:.5,color:1,exposure:1.10,clip:0,pixelRatio:1,auto:false,paused:false};
const stats={frames:0,geometryUploads:0,attributeUploads:0,shadowPasses:0,canvasPixels:0,submittedCpuMs:0,lastFrameAt:0,idle:true,traceEnabled:false,frameTrace:[]};
function remove(m){if(!m)return;for(const b of m.buffers)gl.deleteBuffer(b);gl.deleteVertexArray(m.vao);}
function upload(a){remove(object);remove(ground);object=mesh(a);lastGeometry=a;let y=a.stats.bounds.min[1]-.012;lightVP=mul(ortho(a.stats.layout==='trio'?5.9:2.8),look(light,[0,0,0]));
 ground=mesh({position:new Float32Array([-5,y,-5,5,y,-5,-5,y,5,5,y,5]),normal:new Float32Array([0,1,0,0,1,0,0,1,0,0,1,0]),data:new Float32Array(16).fill(1),kind:new Float32Array(4).fill(-1),index:new Uint32Array([0,2,1,2,3,1])});
 shadowDirty=true;stats.geometryUploads++;invalidate();}
function uploadData(a){lastGeometry={...lastGeometry,data:a};gl.bindBuffer(gl.ARRAY_BUFFER,object.buffers[2]);gl.bufferSubData(gl.ARRAY_BUFFER,0,a);stats.attributeUploads++;invalidate();}
let dirty=true,raf=0,fence=null,previous=0,disposed=false;
function invalidate(){if(disposed)return;dirty=true;if(!raf&&!document.hidden&&!state.paused)raf=requestAnimationFrame(render);}
function draw(m){if(!m)return;gl.bindVertexArray(m.vao);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_INT,0);}
function render(t){raf=0;if(disposed||state.paused||document.hidden)return;
 if(fence){const signal=gl.clientWaitSync(fence,0,0);if(signal===gl.TIMEOUT_EXPIRED){if(dirty||state.auto)raf=requestAnimationFrame(render);return;}gl.deleteSync(fence);fence=null;}
 if(state.auto){camera.yaw+=Math.min(t-previous||16,80)*.00014;dirty=true;}previous=t;
 if(!dirty){stats.idle=true;return;}dirty=false;const start=performance.now();
 const rect=canvas.getBoundingClientRect(),w=Math.max(2,Math.round(rect.width*state.pixelRatio)),h=Math.max(2,Math.round(rect.height*state.pixelRatio));if(w!==canvas.width||h!==canvas.height){canvas.width=w;canvas.height=h;}stats.canvasPixels=w*h;
 gl.enable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
 if(shadowDirty&&object){gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.viewport(0,0,1024,1024);gl.clear(gl.DEPTH_BUFFER_BIT);gl.useProgram(depthProg);gl.uniformMatrix4fv(depthU,false,lightVP);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1.0,1.0);draw(object);gl.disable(gl.POLYGON_OFFSET_FILL);gl.bindFramebuffer(gl.FRAMEBUFFER,null);stats.shadowPasses++;shadowDirty=false;}
 gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(prog);
 const target=[camera.panX,camera.panY,0],eye=[Math.sin(camera.yaw)*Math.cos(camera.pitch)*camera.radius+target[0],Math.sin(camera.pitch)*camera.radius+target[1],Math.cos(camera.yaw)*Math.cos(camera.pitch)*camera.radius];
 const viewProjection=mul(persp(.67,w/h),look(eye,target));gl.uniformMatrix4fv(U.uVP,false,viewProjection);gl.uniformMatrix4fv(U.uLightVP,false,lightVP);gl.uniform3fv(U.uEye,eye);gl.uniform3fv(U.uLight,norm(light));
 gl.uniform1i(U.uTwists,state.twists);gl.uniform1i(U.uLevels,state.levels);gl.uniform1f(U.uStrength,state.strength);gl.uniform1f(U.uPhase,state.phase);gl.uniform1f(U.uFrequency,state.frequency);gl.uniform1i(U.uFamily,state.family);gl.uniform1i(U.uMode,state.mode);for(const [n,k]of[['uWet','wet'],['uRough','rough'],['uGrain','grain'],['uColor','color'],['uExposure','exposure'],['uClip','clip']])gl.uniform1f(U[n],state[k]);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(U.uDepth,0);
 if(!state.clip&&camera.pitch>-.28){gl.useProgram(floorProg);gl.uniformMatrix4fv(floorU.uVP,false,viewProjection);gl.uniformMatrix4fv(floorU.uLightVP,false,lightVP);gl.uniform3fv(floorU.uLight, norm(light));gl.uniform1i(floorU.uDepth,0);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);draw(ground);gl.disable(gl.BLEND);gl.useProgram(prog);}
 if(state.clip)gl.disable(gl.CULL_FACE);else gl.enable(gl.CULL_FACE);draw(object); // Closed geometry culls its back faces; cutaway remains two-sided.
 stats.frames++;if(stats.traceEnabled){stats.frameTrace.push({t:performance.now(),yaw:camera.yaw,pitch:camera.pitch,pixels:w*h,family:state.family});if(stats.frameTrace.length>360)stats.frameTrace.shift();}stats.lastFrameAt=performance.now();stats.submittedCpuMs=stats.lastFrameAt-start;stats.idle=!state.auto;
 fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();if(state.auto)raf=requestAnimationFrame(render);
}
function setLight(side){light=side==='rake'?[-5,1.8,3.4]:[-3.1,4.4,5.2];lightVP=mul(ortho(lastGeometry?.stats.layout==='trio'?5.9:2.8),look(light,[0,0,0]));shadowDirty=true;invalidate();}
function pause(on){state.paused=on;if(on&&raf){cancelAnimationFrame(raf);raf=0;}if(!on)invalidate();}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();state.paused=true;stats.contextLost=true;if(raf){cancelAnimationFrame(raf);raf=0;}});
function fit(bounds){
 if(!bounds)return;const e=bounds.max.map((x,i)=>(x-bounds.min[i])/2),ctr=bounds.max.map((x,i)=>(x+bounds.min[i])/2);
 const aspect=Math.max(.2,canvas.clientWidth/Math.max(canvas.clientHeight,1)),yaw=camera.yaw,pitch=camera.pitch;
 const hw=Math.abs(Math.cos(yaw))*e[0]+Math.abs(Math.sin(yaw))*e[2];
 const hd=Math.abs(Math.sin(yaw))*e[0]+Math.abs(Math.cos(yaw))*e[2];
 const hh=Math.abs(Math.cos(pitch))*e[1]+Math.abs(Math.sin(pitch))*hd;
 camera.radius=Math.max(2.1,Math.min(18,1.16*Math.max(hw/(Math.tan(.335)*aspect),hh/Math.tan(.335))+hd*.48));
 camera.panX=ctr[0];camera.panY=ctr[1];invalidate();
}
function reset(){Object.assign(camera,{yaw:-.48,pitch:.23,panX:0,panY:0});if(lastGeometry)fit(lastGeometry.stats.bounds);else camera.radius=4.6;invalidate();}
let pointers=new Map(),prevPinch=0;canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,[e.clientX,e.clientY]);prevPinch=0;});
canvas.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p)return;const dx=e.clientX-p[0],dy=e.clientY-p[1];pointers.set(e.pointerId,[e.clientX,e.clientY]);if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(prevPinch)camera.radius=Math.max(1.4,Math.min(18,camera.radius*prevPinch/d));prevPinch=d;}else if(e.buttons===2||e.shiftKey){camera.panX-=dx*.003*camera.radius;camera.panY+=dy*.003*camera.radius;}else{camera.yaw-=dx*.006;camera.pitch=Math.max(-1.45,Math.min(1.45,camera.pitch+dy*.006));}invalidate();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{pointers.delete(e.pointerId);prevPinch=0;});
canvas.addEventListener('wheel',e=>{e.preventDefault();camera.radius=Math.max(1.4,Math.min(18,camera.radius*Math.exp(e.deltaY*.001)));invalidate();},{passive:false});canvas.addEventListener('dblclick',reset);
const ro=new ResizeObserver(invalidate);ro.observe(canvas);document.addEventListener('visibilitychange',()=>{if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;}else invalidate();});
function destroy(){disposed=true;if(raf)cancelAnimationFrame(raf);if(fence)gl.deleteSync(fence);remove(object);remove(ground);ro.disconnect();gl.deleteFramebuffer(fb);gl.deleteTexture(texture);gl.deleteProgram(prog);gl.deleteProgram(depthProg);gl.deleteProgram(floorProg);}
return{upload,uploadData,fit,state,camera,stats,invalidate,pause,reset,setLight,destroy,gl,object:()=>lastGeometry};
}
